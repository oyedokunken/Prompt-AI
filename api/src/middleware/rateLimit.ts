import rateLimit from "express-rate-limit";

/**
 * Strict limiter for auth mutation endpoints.
 * Allows 10 requests per IP per 15-minute window.
 * Appropriate for register, login, send-otp, verify-otp, forgot-password.
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1_000,
  max: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    error: "RATE_LIMITED",
    message: "Too many requests from this IP. Try again in 15 minutes.",
  },
  skipSuccessfulRequests: false,
});

/**
 * Relaxed limiter for read-only or token refresh endpoints.
 * Allows 60 requests per IP per minute.
 */
export const generalLimiter = rateLimit({
  windowMs: 60 * 1_000,
  max: 60,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    error: "RATE_LIMITED",
    message: "Too many requests. Slow down and try again.",
  },
});
