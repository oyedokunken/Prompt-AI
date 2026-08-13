import { Router, type Request, type Response } from "express";
import { authService } from "../services/authService";
import { emailService } from "../services/emailService";
import { validate } from "../middleware/validate";
import { requireAuth } from "../middleware/auth";
import { authLimiter } from "../middleware/rateLimit";
import {
  registerSchema,
  loginSchema,
  verifyOtpSchema,
  resendOtpSchema,
  refreshSchema,
  forgotPasswordSchema,
  sendWelcomeSchema,
} from "../schemas/auth";

export const authRouter = Router();

// ---------------------------------------------------------------------------
// POST /auth/register
// Create a new email user. Sends OTP. Responds with userId and email only.
// ---------------------------------------------------------------------------
authRouter.post(
  "/register",
  authLimiter,
  validate(registerSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { userId, email } = await authService.registerWithEmail(
        req.body.email as string,
        req.body.password as string
      );
      res.status(201).json({
        message: "Registration successful. Check your email for the verification code.",
        userId,
        email,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "UNKNOWN_ERROR";
      if (message === "REGISTRATION_FAILED") {
        res.status(409).json({ error: "REGISTRATION_FAILED", message: "Unable to register with that email." });
      } else {
        console.error("[POST /auth/register]", err);
        res.status(500).json({ error: "INTERNAL_ERROR", message: "An unexpected error occurred." });
      }
    }
  }
);

// ---------------------------------------------------------------------------
// POST /auth/login
// Email + password login for verified users. Returns access + refresh tokens.
// ---------------------------------------------------------------------------
authRouter.post(
  "/login",
  authLimiter,
  validate(loginSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const tokens = await authService.loginWithEmail(
        req.body.email as string,
        req.body.password as string
      );
      res.json(tokens);
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      if (message === "INVALID_CREDENTIALS") {
        res.status(401).json({ error: "INVALID_CREDENTIALS", message: "Email or password is incorrect." });
      } else if (message === "EMAIL_NOT_VERIFIED") {
        res.status(403).json({ error: "EMAIL_NOT_VERIFIED", message: "Verify your email before logging in." });
      } else {
        console.error("[POST /auth/login]", err);
        res.status(500).json({ error: "INTERNAL_ERROR", message: "An unexpected error occurred." });
      }
    }
  }
);

// ---------------------------------------------------------------------------
// POST /auth/verify-otp
// Verify the 6-digit code. Issues tokens on success.
// ---------------------------------------------------------------------------
authRouter.post(
  "/verify-otp",
  authLimiter,
  validate(verifyOtpSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const tokens = await authService.verifyOtp(
        req.body.email as string,
        req.body.otp as string
      );
      res.json(tokens);
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      if (message === "INVALID_OTP") {
        res.status(400).json({ error: "INVALID_OTP", message: "The code is incorrect or has expired." });
      } else {
        console.error("[POST /auth/verify-otp]", err);
        res.status(500).json({ error: "INTERNAL_ERROR", message: "An unexpected error occurred." });
      }
    }
  }
);

// ---------------------------------------------------------------------------
// POST /auth/resend-otp
// Re-send verification code. Subject to the same rate limit as /register.
// ---------------------------------------------------------------------------
authRouter.post(
  "/resend-otp",
  authLimiter,
  validate(resendOtpSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const user = await (await import("../lib/prisma")).prisma.user.findUnique({
        where: { email: req.body.email as string },
      });
      if (user && !user.emailVerified) {
        await authService.sendVerificationOtp(user.id, user.email);
      }
      res.json({ message: "If that address is pending verification, a new code has been sent." });
    } catch (err) {
      console.error("[POST /auth/resend-otp]", err);
      res.status(500).json({ error: "INTERNAL_ERROR", message: "An unexpected error occurred." });
    }
  }
);

// ---------------------------------------------------------------------------
// POST /auth/forgot-password
// Sends a password-reset OTP to the registered address.
// Always returns 200 to prevent email enumeration.
// ---------------------------------------------------------------------------
authRouter.post(
  "/forgot-password",
  authLimiter,
  validate(forgotPasswordSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      await authService.sendPasswordResetOtp(req.body.email as string);
      res.json({ message: "If an account with that email exists, a reset code has been sent." });
    } catch (err) {
      console.error("[POST /auth/forgot-password]", err);
      res.status(500).json({ error: "INTERNAL_ERROR", message: "An unexpected error occurred." });
    }
  }
);

// ---------------------------------------------------------------------------
// POST /auth/refresh
// Rotate the refresh token. Returns new access + refresh token pair.
// ---------------------------------------------------------------------------
authRouter.post(
  "/refresh",
  validate(refreshSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const tokens = await authService.rotateRefreshToken(req.body.refreshToken as string);
      res.json(tokens);
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      if (message === "INVALID_REFRESH_TOKEN") {
        res.status(401).json({ error: "INVALID_REFRESH_TOKEN", message: "Refresh token is invalid or expired." });
      } else {
        console.error("[POST /auth/refresh]", err);
        res.status(500).json({ error: "INTERNAL_ERROR", message: "An unexpected error occurred." });
      }
    }
  }
);

// ---------------------------------------------------------------------------
// POST /auth/logout
// Revoke the provided refresh token.
// ---------------------------------------------------------------------------
authRouter.post(
  "/logout",
  requireAuth,
  validate(refreshSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      await authService.revokeRefreshToken(req.body.refreshToken as string);
      res.status(204).send();
    } catch (err) {
      console.error("[POST /auth/logout]", err);
      res.status(500).json({ error: "INTERNAL_ERROR", message: "An unexpected error occurred." });
    }
  }
);

// ---------------------------------------------------------------------------
// GET /auth/me
// Returns the authenticated user's basic profile.
// ---------------------------------------------------------------------------
authRouter.get(
  "/me",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { prisma } = await import("../lib/prisma");
      const user = await prisma.user.findUnique({
        where: { id: req.userId },
        select: { id: true, email: true, emailVerified: true, createdAt: true },
      });
      if (!user) {
        res.status(404).json({ error: "NOT_FOUND", message: "User not found." });
        return;
      }
      res.json(user);
    } catch (err) {
      console.error("[GET /auth/me]", err);
      res.status(500).json({ error: "INTERNAL_ERROR", message: "An unexpected error occurred." });
    }
  }
);

// ---------------------------------------------------------------------------
// POST /auth/send-welcome
// Sends a welcome email to the provided address. Used for OAuth users who
// may not have received one during signup. Subject to rate limiting.
// ---------------------------------------------------------------------------
authRouter.post(
  "/send-welcome",
  authLimiter,
  validate(sendWelcomeSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { email } = req.body;
      const { prisma } = await import("../lib/prisma");
      const user = await prisma.user.findUnique({ where: { email } });
      if (user) {
        await emailService.sendWelcome({
          to: user.email,
          appUrl: (await import("../config/env")).env.APP_URL,
        });
      }
      res.json({ message: "If an account with that email exists, a welcome email has been sent." });
    } catch (err) {
      console.error("[POST /auth/send-welcome]", err);
      res.status(500).json({ error: "INTERNAL_ERROR", message: "An unexpected error occurred." });
    }
  }
);
