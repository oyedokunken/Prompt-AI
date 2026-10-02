import { Router, type Request, type Response } from "express";
import { authService } from "../services/authService";
import { validate } from "../middleware/validate";
import { requireUser } from "../middleware/requireUser";
import { authLimiter } from "../middleware/rateLimit";
import {
  otpRequestSchema,
  verifySignupOtpSchema,
  verifyResetOtpSchema,
  changePasswordSchema,
} from "../schemas/auth";

export const authRouter = Router();

// ---------------------------------------------------------------------------
// Every OTP code in this router is generated here and sent through
// Nodemailer using the branded templates -- Supabase is never asked to send
// mail. Supabase is only ever touched afterwards, to create the account or
// change its password once the code has been verified. Routine login does
// not go through here at all, the client calls
// supabase.auth.signInWithPassword directly.
// ---------------------------------------------------------------------------

// POST /auth/otp/request-signup
authRouter.post(
  "/otp/request-signup",
  authLimiter,
  validate(otpRequestSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const result = await authService.requestSignupOtp(req.body.email as string);
      if (result.retryAfterSeconds) {
        res.status(429).json({
          error: "RESEND_COOLDOWN",
          message: `Wait ${result.retryAfterSeconds} seconds before requesting another code.`,
          retryAfterSeconds: result.retryAfterSeconds,
        });
        return;
      }
      res.json({ message: "A verification code has been sent to that address." });
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      if (message === "DISPOSABLE_EMAIL") {
        res.status(422).json({
          error: "DISPOSABLE_EMAIL",
          message: "Disposable or temporary email addresses are not accepted. Use an address you can actually receive mail at.",
        });
      } else if (message === "ALREADY_REGISTERED") {
        res.status(409).json({
          error: "ALREADY_REGISTERED",
          message: "An account with that email already exists. Log in instead.",
        });
      } else {
        console.error("[POST /auth/otp/request-signup]", err);
        res.status(500).json({ error: "INTERNAL_ERROR", message: "An unexpected error occurred." });
      }
    }
  }
);

// POST /auth/otp/verify-signup
authRouter.post(
  "/otp/verify-signup",
  authLimiter,
  validate(verifySignupOtpSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      await authService.verifySignupOtp(
        req.body.email as string,
        req.body.otp as string,
        req.body.password as string
      );
      res.json({ message: "Account verified." });
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      if (message === "INVALID_OTP") {
        res.status(400).json({ error: "INVALID_OTP", message: "The code is incorrect or has expired." });
      } else if (message === "ACCOUNT_CREATE_FAILED") {
        res.status(502).json({ error: "ACCOUNT_CREATE_FAILED", message: "Could not create your account. Try again." });
      } else {
        console.error("[POST /auth/otp/verify-signup]", err);
        res.status(500).json({ error: "INTERNAL_ERROR", message: "An unexpected error occurred." });
      }
    }
  }
);

// POST /auth/otp/request-reset
authRouter.post(
  "/otp/request-reset",
  authLimiter,
  validate(otpRequestSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      await authService.requestPasswordResetOtp(req.body.email as string);
    } catch (err) {
      console.error("[POST /auth/otp/request-reset]", err);
    }
    // Always the same response, whether or not the account exists.
    res.json({ message: "If an account with that email exists, a reset code has been sent." });
  }
);

// POST /auth/otp/verify-reset
authRouter.post(
  "/otp/verify-reset",
  authLimiter,
  validate(verifyResetOtpSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      await authService.verifyPasswordResetOtp(
        req.body.email as string,
        req.body.otp as string,
        req.body.newPassword as string
      );
      res.json({ message: "Password updated." });
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      if (message === "INVALID_OTP") {
        res.status(400).json({ error: "INVALID_OTP", message: "The code is incorrect or has expired." });
      } else if (message === "ACCOUNT_NOT_FOUND" || message === "PASSWORD_RESET_FAILED") {
        res.status(502).json({ error: "PASSWORD_RESET_FAILED", message: "Could not reset your password. Try again." });
      } else {
        console.error("[POST /auth/otp/verify-reset]", err);
        res.status(500).json({ error: "INTERNAL_ERROR", message: "An unexpected error occurred." });
      }
    }
  }
);

// POST /auth/send-welcome
// Called by the OAuth callback after a Google/GitHub sign-in. Not gated by
// any code, just a one-time notification.
authRouter.post(
  "/send-welcome",
  authLimiter,
  validate(otpRequestSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      await authService.sendOAuthWelcomeIfNeeded(req.body.email as string);
    } catch (err) {
      console.error("[POST /auth/send-welcome]", err);
    }
    res.json({ message: "ok" });
  }
);

// POST /auth/change-password
// For a signed in user with an email and password account. requireUser checks
// the bearer token against Supabase on every call, so an expired or revoked
// session is refused here, not trusted from the browser. The current password
// is proven again before the new one is set.
authRouter.post(
  "/change-password",
  authLimiter,
  requireUser,
  validate(changePasswordSchema),
  async (req: Request, res: Response): Promise<void> => {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: "UNAUTHORIZED", message: "Your session has expired. Sign in again." });
      return;
    }
    try {
      await authService.changePassword(user, req.body.currentPassword as string, req.body.newPassword as string);
      res.json({ message: "Password updated." });
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      if (message === "WRONG_PASSWORD") {
        res.status(400).json({ error: "WRONG_PASSWORD", message: "Your current password is not correct." });
      } else if (message === "NO_PASSWORD") {
        res.status(400).json({ error: "NO_PASSWORD", message: "This account signs in with Google or GitHub and has no password to change." });
      } else if (message === "PASSWORD_CHANGE_FAILED") {
        res.status(502).json({ error: "PASSWORD_CHANGE_FAILED", message: "Could not change your password. Try again." });
      } else {
        console.error("[POST /auth/change-password]", err);
        res.status(500).json({ error: "INTERNAL_ERROR", message: "An unexpected error occurred." });
      }
    }
  }
);
