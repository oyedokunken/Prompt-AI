import crypto from "crypto";
import disposableDomains from "disposable-email-domains";
import { prisma } from "../lib/prisma";
import { supabaseAdmin } from "../lib/supabase";
import { emailService } from "./emailService";
import { env } from "../config/env";

// ---------------------------------------------------------------------------
// Auth model
// Supabase owns the actual session and password storage, that is the only
// system of record for "is this the right password" and "is this user
// signed in". This service's only job is the OTP step itself: generating a
// code, emailing it through Nodemailer using the branded templates, and
// verifying it. OTP only ever gates two moments, confirming a new signup
// and confirming a password reset, never routine login.
// ---------------------------------------------------------------------------

const OTP_EXPIRY_MINUTES = 10;
const OTP_DIGITS = 6;
const OTP_RESEND_COOLDOWN_SECONDS = 30;

const DISPOSABLE_DOMAINS = new Set(disposableDomains);

function isDisposableEmail(email: string): boolean {
  const domain = email.split("@")[1]?.toLowerCase();
  return !!domain && DISPOSABLE_DOMAINS.has(domain);
}

function generateOtp(): string {
  const bytes = crypto.randomBytes(3);
  const num = bytes.readUIntBE(0, 3) % 1_000_000;
  return num.toString().padStart(OTP_DIGITS, "0");
}

function hashOtp(otp: string): string {
  return crypto.createHmac("sha256", env.OTP_PEPPER).update(otp).digest("hex");
}

function verifyOtpHash(otp: string, storedHash: string): boolean {
  const computed = hashOtp(otp);
  if (computed.length !== storedHash.length) return false;
  return crypto.timingSafeEqual(Buffer.from(computed, "hex"), Buffer.from(storedHash, "hex"));
}

async function issueOtp(userId: string, email: string): Promise<void> {
  await prisma.otpToken.updateMany({
    where: { userId, usedAt: null, expiresAt: { gt: new Date() } },
    data: { usedAt: new Date() },
  });

  const otp = generateOtp();
  const tokenHash = hashOtp(otp);
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1_000);

  await prisma.otpToken.create({ data: { userId, tokenHash, expiresAt } });

  await emailService.sendOtp({
    to: email,
    otp,
    expiresInMinutes: OTP_EXPIRY_MINUTES,
    appUrl: env.APP_URL,
  });
}

async function checkCooldown(userId: string): Promise<number | null> {
  const latestToken = await prisma.otpToken.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
  if (!latestToken) return null;
  const secondsSince = (Date.now() - latestToken.createdAt.getTime()) / 1000;
  if (secondsSince < OTP_RESEND_COOLDOWN_SECONDS) {
    return Math.ceil(OTP_RESEND_COOLDOWN_SECONDS - secondsSince);
  }
  return null;
}

async function consumeOtp(userId: string, otp: string): Promise<boolean> {
  const token = await prisma.otpToken.findFirst({
    where: { userId, usedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  if (!token || !verifyOtpHash(otp, token.tokenHash)) return false;
  await prisma.otpToken.update({ where: { id: token.id }, data: { usedAt: new Date() } });
  return true;
}

// Looks up a Supabase auth user's id by email through the same Postgres
// connection this service already has, the admin JS client has no direct
// getUserByEmail call.
async function findSupabaseUserIdByEmail(email: string): Promise<string | null> {
  const rows = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `select id from auth.users where email = $1 limit 1`,
    email
  );
  return rows[0]?.id ?? null;
}

export const authService = {
  // -------------------------------------------------------------------------
  // Signup: request a code
  // Creates the local tracking row if this email has not been seen before,
  // this does not touch Supabase at all yet, that only happens once the
  // code is verified and we have a real password to create the account
  // with.
  // -------------------------------------------------------------------------
  async requestSignupOtp(email: string): Promise<{ retryAfterSeconds?: number }> {
    if (isDisposableEmail(email)) {
      throw new Error("DISPOSABLE_EMAIL");
    }

    let user = await prisma.user.findUnique({ where: { email } });
    if (user?.emailVerified) {
      const existingSupabaseId = await findSupabaseUserIdByEmail(email);
      if (existingSupabaseId) {
        throw new Error("ALREADY_REGISTERED");
      }
    }
    if (!user) {
      user = await prisma.user.create({ data: { email, emailVerified: false } });
    }

    const retryAfterSeconds = await checkCooldown(user.id);
    if (retryAfterSeconds) return { retryAfterSeconds };

    await issueOtp(user.id, user.email);
    return {};
  },

  // -------------------------------------------------------------------------
  // Signup: verify the code and create the real Supabase account
  // The password arrives here directly from the signup form, still in
  // memory on the same client, it is never stored on this side, only
  // handed to Supabase's own admin API which becomes the sole place a
  // password for this account lives.
  // -------------------------------------------------------------------------
  async verifySignupOtp(email: string, otp: string, password: string): Promise<void> {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw new Error("INVALID_OTP");

    const ok = await consumeOtp(user.id, otp);
    if (!ok) throw new Error("INVALID_OTP");

    const wasAlreadyVerified = user.emailVerified;
    await prisma.user.update({ where: { id: user.id }, data: { emailVerified: true } });

    const existingSupabaseId = await findSupabaseUserIdByEmail(email);
    if (existingSupabaseId) {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(existingSupabaseId, {
        password,
        email_confirm: true,
      });
      if (error) {
        console.error("[authService] supabase updateUserById failed:", error);
        throw new Error("ACCOUNT_CREATE_FAILED");
      }
    } else {
      const { error } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { prompt_ai_user_id: user.id },
      });
      if (error) {
        console.error("[authService] supabase createUser failed:", error);
        throw new Error("ACCOUNT_CREATE_FAILED");
      }
    }

    if (!wasAlreadyVerified) {
      try {
        await emailService.sendWelcome({ to: email, appUrl: env.APP_URL });
      } catch (err) {
        console.warn("[authService] failed to send welcome email (non-blocking):", err);
      }
    }
  },

  // -------------------------------------------------------------------------
  // Forgot password: request a code
  // Always resolves the same way regardless of whether the account exists,
  // to avoid confirming or denying an email address is registered.
  // -------------------------------------------------------------------------
  async requestPasswordResetOtp(email: string): Promise<void> {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.emailVerified) return;
    const supabaseId = await findSupabaseUserIdByEmail(email);
    if (!supabaseId) return;

    const retryAfterSeconds = await checkCooldown(user.id);
    if (retryAfterSeconds) return;

    await issueOtp(user.id, user.email);
  },

  // -------------------------------------------------------------------------
  // OAuth welcome email
  // Not an OTP flow at all, just a one-time notification for people who
  // signed up via Google/GitHub and so never went through the Nodemailer
  // code above. Reuses the same Prisma User row as a "have we welcomed this
  // address before" marker, creating it on first sight.
  // -------------------------------------------------------------------------
  async sendOAuthWelcomeIfNeeded(email: string): Promise<void> {
    const user = await prisma.user.findUnique({ where: { email } });
    if (user?.emailVerified) return;

    if (user) {
      await prisma.user.update({ where: { id: user.id }, data: { emailVerified: true } });
    } else {
      await prisma.user.create({ data: { email, emailVerified: true } });
    }

    await emailService.sendWelcome({ to: email, appUrl: env.APP_URL });
  },

  // -------------------------------------------------------------------------
  // Forgot password: verify the code and set the new password
  // -------------------------------------------------------------------------
  async verifyPasswordResetOtp(email: string, otp: string, newPassword: string): Promise<void> {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw new Error("INVALID_OTP");

    const ok = await consumeOtp(user.id, otp);
    if (!ok) throw new Error("INVALID_OTP");

    const supabaseId = await findSupabaseUserIdByEmail(email);
    if (!supabaseId) throw new Error("ACCOUNT_NOT_FOUND");

    const { error } = await supabaseAdmin.auth.admin.updateUserById(supabaseId, {
      password: newPassword,
    });
    if (error) {
      console.error("[authService] password reset updateUserById failed:", error);
      throw new Error("PASSWORD_RESET_FAILED");
    }
  },
};
