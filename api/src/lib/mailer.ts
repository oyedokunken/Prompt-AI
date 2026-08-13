import nodemailer from "nodemailer";
import { env } from "../config/env";

/**
 * Nodemailer transport singleton.
 * For development, point SMTP_HOST to Mailtrap or use the Ethereal test account.
 * For production, use a real SMTP provider (Resend, Postmark, AWS SES).
 */
export const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_SECURE,
  auth: {
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
  },
});

/**
 * Verify the SMTP connection on startup.
 * Logs a warning in development if it fails; does not crash the server.
 */
export async function verifyMailer(): Promise<void> {
  if (env.NODE_ENV === "production") return;
  try {
    await transporter.verify();
    console.log("[mailer] SMTP connection verified");
  } catch (err) {
    console.warn("[mailer] SMTP connection failed - emails will not send:", err);
  }
}
