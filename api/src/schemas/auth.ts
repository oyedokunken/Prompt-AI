import { z } from "zod";

const email = z
  .string()
  .min(1, "Email is required")
  .email("Enter a valid email address")
  .transform((v) => v.trim().toLowerCase());

const otp = z
  .string()
  .length(6, "OTP must be exactly 6 digits")
  .regex(/^\d{6}$/, "OTP must contain only digits");

const password = z
  .string()
  .min(10, "Password must be at least 10 characters")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[0-9]/, "Password must contain at least one number")
  .regex(/[^A-Za-z0-9]/, "Password must contain at least one symbol");

export const otpRequestSchema = z.object({ email });

export const verifySignupOtpSchema = z.object({ email, otp, password });

export const verifyResetOtpSchema = z.object({ email, otp, newPassword: password });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password"),
    newPassword: password,
  })
  .refine((d) => d.currentPassword !== d.newPassword, {
    message: "Choose a password different from your current one",
    path: ["newPassword"],
  });

export type OtpRequestInput = z.infer<typeof otpRequestSchema>;
export type VerifySignupOtpInput = z.infer<typeof verifySignupOtpSchema>;
export type VerifyResetOtpInput = z.infer<typeof verifyResetOtpSchema>;
