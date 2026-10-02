import { z } from "zod";

// The password rules from signup, in one place. The server enforces the same
// rules again, so a change that skips this form is refused all the same.
export const passwordRules = z
  .string()
  .min(10, "Password must be at least 10 characters")
  .regex(/[A-Z]/, "Password needs at least one uppercase letter")
  .regex(/[a-z]/, "Password needs at least one lowercase letter")
  .regex(/[0-9]/, "Password needs at least one number")
  .regex(/[^A-Za-z0-9]/, "Password needs at least one symbol");

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password"),
    newPassword: passwordRules,
    confirmPassword: z.string().min(1, "Confirm your new password"),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  })
  .refine((d) => !d.currentPassword || d.currentPassword !== d.newPassword, {
    message: "Choose a password different from your current one",
    path: ["newPassword"],
  });

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
