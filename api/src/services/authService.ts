import crypto from "crypto";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma";
import { supabaseAdmin } from "../lib/supabase";
import { emailService } from "./emailService";
import { env } from "../config/env";

const OTP_EXPIRY_MINUTES = 10;
const OTP_DIGITS = 6;
const BCRYPT_ROUNDS = 12;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function generateOtp(): string {
  const bytes = crypto.randomBytes(3);
  const num = bytes.readUIntBE(0, 3) % 1_000_000;
  return num.toString().padStart(OTP_DIGITS, "0");
}

function hashOtp(otp: string): string {
  return crypto
    .createHmac("sha256", env.OTP_PEPPER)
    .update(otp)
    .digest("hex");
}

function verifyOtpHash(otp: string, storedHash: string): boolean {
  const computed = hashOtp(otp);
  if (computed.length !== storedHash.length) return false;
  return crypto.timingSafeEqual(
    Buffer.from(computed, "hex"),
    Buffer.from(storedHash, "hex")
  );
}

function hashToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  refreshExpiresAt: number;
}

// ---------------------------------------------------------------------------
// Auth service
// ---------------------------------------------------------------------------

export const authService = {
  // -------------------------------------------------------------------------
  // Email registration
  // Creates a new unverified user and dispatches the OTP email.
  // Throws REGISTRATION_FAILED for all failure modes to prevent user enumeration.
  // -------------------------------------------------------------------------
  async registerWithEmail(
    email: string,
    password: string
  ): Promise<{ userId: string; email: string }> {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      if (!existing.emailVerified) {
        await authService.sendVerificationOtp(existing.id, existing.email);
        return { userId: existing.id, email: existing.email };
      }
      throw new Error("REGISTRATION_FAILED");
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    const user = await prisma.user.create({
      data: { email, passwordHash, emailVerified: false },
    });

    await authService.sendVerificationOtp(user.id, user.email);

    return { userId: user.id, email: user.email };
  },

  // -------------------------------------------------------------------------
  // OTP dispatch
  // Invalidates any existing active tokens before issuing a new one.
  // -------------------------------------------------------------------------
  async sendVerificationOtp(userId: string, email: string): Promise<void> {
    await prisma.otpToken.updateMany({
      where: { userId, usedAt: null, expiresAt: { gt: new Date() } },
      data: { usedAt: new Date() },
    });

    const otp = generateOtp();
    const tokenHash = hashOtp(otp);
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1_000);

    await prisma.otpToken.create({
      data: { userId, tokenHash, expiresAt },
    });

    await emailService.sendOtp({
      to: email,
      otp,
      expiresInMinutes: OTP_EXPIRY_MINUTES,
      appUrl: env.APP_URL,
    });
  },

  // -------------------------------------------------------------------------
  // OTP verification
  // Verifies the code, marks the user as confirmed, and issues JWT + refresh.
  // If the user does not yet exist in Supabase Auth, creates them there.
  // -------------------------------------------------------------------------
  async verifyOtp(email: string, otp: string): Promise<AuthTokens> {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw new Error("INVALID_OTP");

    const token = await prisma.otpToken.findFirst({
      where: {
        userId: user.id,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!token || !verifyOtpHash(otp, token.tokenHash)) {
      throw new Error("INVALID_OTP");
    }

    await prisma.$transaction([
      prisma.otpToken.update({
        where: { id: token.id },
        data: { usedAt: new Date() },
      }),
      prisma.user.update({
        where: { id: user.id },
        data: { emailVerified: true },
      }),
    ]);

    // Mirror user into Supabase Auth so OAuth and email users share the same
    // session layer. If the user already exists in Supabase, this is a no-op.
    try {
      const { error } = await supabaseAdmin.auth.admin.createUser({
        email: user.email,
        email_confirm: true,
        user_metadata: { prompt_ai_user_id: user.id },
      });
      if (error && error.message !== "User already registered") {
        console.warn("[authService] supabase createUser warning:", error.message);
      }
    } catch (err) {
      console.warn("[authService] supabase createUser failed (non-blocking):", err);
    }

    return authService.issueTokens(user.id);
  },

  // -------------------------------------------------------------------------
  // Email + password login
  // -------------------------------------------------------------------------
  async loginWithEmail(email: string, password: string): Promise<AuthTokens> {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.passwordHash) throw new Error("INVALID_CREDENTIALS");
    if (!user.emailVerified) throw new Error("EMAIL_NOT_VERIFIED");

    const matches = await bcrypt.compare(password, user.passwordHash);
    if (!matches) throw new Error("INVALID_CREDENTIALS");

    return authService.issueTokens(user.id);
  },

  // -------------------------------------------------------------------------
  // Password reset: sends OTP email to confirmed address
  // -------------------------------------------------------------------------
  async sendPasswordResetOtp(email: string): Promise<void> {
    const user = await prisma.user.findUnique({ where: { email } });
    // Always resolve to the same response to prevent email enumeration
    if (!user || !user.emailVerified) return;
    await authService.sendVerificationOtp(user.id, user.email);
  },

  // -------------------------------------------------------------------------
  // Token issuance
  // -------------------------------------------------------------------------
  async issueTokens(userId: string): Promise<AuthTokens> {
    const accessToken = jwt.sign(
      { sub: userId, type: "access" },
      env.JWT_ACCESS_SECRET,
      { expiresIn: env.JWT_ACCESS_EXPIRES_IN } as jwt.SignOptions
    );

    const rawRefresh = randomUUID();
    const refreshTokenHash = hashToken(rawRefresh);
    const refreshExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1_000);

    await prisma.refreshToken.create({
      data: { userId, tokenHash: refreshTokenHash, expiresAt: refreshExpiresAt },
    });

    return {
      accessToken,
      refreshToken: rawRefresh,
      refreshExpiresAt: Math.floor(refreshExpiresAt.getTime() / 1_000),
    };
  },

  // -------------------------------------------------------------------------
  // Refresh token rotation
  // -------------------------------------------------------------------------
  async rotateRefreshToken(rawToken: string): Promise<AuthTokens> {
    const tokenHash = hashToken(rawToken);

    const record = await prisma.refreshToken.findUnique({ where: { tokenHash } });
    if (!record || record.revokedAt !== null || record.expiresAt < new Date()) {
      throw new Error("INVALID_REFRESH_TOKEN");
    }

    await prisma.refreshToken.update({
      where: { id: record.id },
      data: { revokedAt: new Date() },
    });

    return authService.issueTokens(record.userId);
  },

  // -------------------------------------------------------------------------
  // Logout: revoke specific refresh token
  // -------------------------------------------------------------------------
  async revokeRefreshToken(rawToken: string): Promise<void> {
    const tokenHash = hashToken(rawToken);
    await prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  },

  // -------------------------------------------------------------------------
  // Verify a JWT access token and return the userId
  // -------------------------------------------------------------------------
  verifyAccessToken(token: string): string {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as jwt.JwtPayload;
    if (payload.type !== "access" || typeof payload.sub !== "string") {
      throw new Error("INVALID_TOKEN");
    }
    return payload.sub;
  },
};
