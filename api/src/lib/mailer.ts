import nodemailer from "nodemailer";
import { env } from "../config/env";

/**
 * Nodemailer transport singleton.
 * For development, point SMTP_* vars to Mailtrap or Ethereal.
 * For production, use Resend, Postmark, or AWS SES SMTP.
 *
 * If SMTP vars are not configured the transporter is still created but
 * sendMail calls will fail, the auth OTP flow degrades gracefully.
 */
export const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_SECURE,
  auth: env.SMTP_USER && env.SMTP_PASS
    ? { user: env.SMTP_USER, pass: env.SMTP_PASS }
    : undefined,
});
