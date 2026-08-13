import { transporter } from "../lib/mailer";
import { renderOtpEmail, type OtpEmailData } from "../templates/otp";
import { env } from "../config/env";

export const emailService = {
  async sendOtp(data: OtpEmailData): Promise<void> {
    const { subject, html, text } = renderOtpEmail(data);

    await transporter.sendMail({
      from: `"${env.EMAIL_FROM_NAME}" <${env.EMAIL_FROM}>`,
      to: data.to,
      subject,
      html,
      text,
    });
  },
};
