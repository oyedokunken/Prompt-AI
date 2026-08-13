export interface OtpEmailData {
  to: string;
  otp: string;
  expiresInMinutes: number;
  appUrl: string;
  appName?: string;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

export function renderOtpEmail(data: OtpEmailData): RenderedEmail {
  const { otp, expiresInMinutes, appUrl, appName = "Prompt AI" } = data;

  const subject = `${otp} is your ${appName} verification code`;

  const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta http-equiv="X-UA-Compatible" content="IE=edge" />
    <title>${subject}</title>
    <style>
      * { box-sizing: border-box; }
    </style>
  </head>
  <body style="margin:0;padding:0;background-color:#0a0a0b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Oxygen,Ubuntu,Cantarell,sans-serif;-webkit-font-smoothing:antialiased;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="background-color:#0a0a0b;min-height:100vh;">
      <tr>
        <td align="center" valign="top" style="padding:48px 16px 64px;">

          <!-- Card -->
          <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="max-width:480px;background-color:#111113;border:1px solid #1f1f22;border-radius:16px;overflow:hidden;">

            <!-- Header -->
            <tr>
              <td style="padding:24px 32px;border-bottom:1px solid #1a1a1d;">
                <table cellpadding="0" cellspacing="0" border="0" role="presentation">
                  <tr>
                    <td valign="middle" style="padding-right:10px;">
                      <div style="width:32px;height:32px;background-color:#111113;border:1px solid #232327;border-radius:8px;display:flex;align-items:center;justify-content:center;">
                        <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <rect width="32" height="32" rx="8" fill="#111113" stroke="#232327" stroke-width="1"/>
                          <text x="5" y="20" font-family="monospace" font-size="12" font-weight="600" fill="#F2A93B">&gt;</text>
                          <text x="14" y="20" font-family="monospace" font-size="12" font-weight="400" fill="#EDEDEF">_</text>
                          <rect x="14" y="21" width="8" height="2" rx="1" fill="#F2A93B" opacity="0.7"/>
                        </svg>
                      </div>
                    </td>
                    <td valign="middle">
                      <span style="font-size:16px;font-weight:600;color:#EDEDEF;letter-spacing:-0.02em;">Prompt<span style="color:#F2A93B;">AI</span></span>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Body -->
            <tr>
              <td style="padding:36px 32px 28px;">
                <p style="margin:0 0 6px;font-size:21px;font-weight:700;color:#ededef;letter-spacing:-0.02em;line-height:1.25;">Verify your email address</p>
                <p style="margin:0 0 32px;font-size:14px;color:#8b8b93;line-height:1.65;">Enter the code below to complete your ${appName} signup. It expires in ${expiresInMinutes} minutes.</p>

                <!-- OTP block -->
                <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="margin-bottom:32px;">
                  <tr>
                    <td style="background-color:#0a0a0b;border:1px solid #2a2a2e;border-radius:12px;padding:28px 24px;text-align:center;">
                      <p style="margin:0 0 10px;font-size:11px;font-family:'Courier New',Courier,monospace;text-transform:uppercase;letter-spacing:0.14em;color:#5c5c63;">Your verification code</p>
                      <p style="margin:0;font-size:40px;font-weight:800;font-family:'Courier New',Courier,monospace;letter-spacing:0.3em;color:#f2a93b;line-height:1;">${otp}</p>
                    </td>
                  </tr>
                </table>

                <p style="margin:0 0 12px;font-size:13px;color:#5c5c63;line-height:1.7;">This code is single-use and expires <strong style="color:#8b8b93;">${expiresInMinutes} minutes</strong> from when this email was sent.</p>
                <p style="margin:0;font-size:13px;color:#5c5c63;line-height:1.7;">If you did not create a ${appName} account, you can safely ignore this email. No action is required and your email address will not be used.</p>
              </td>
            </tr>

            <!-- Divider -->
            <tr>
              <td style="padding:0 32px;">
                <div style="height:1px;background-color:#1a1a1d;"></div>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="padding:20px 32px 28px;">
                <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation">
                  <tr>
                    <td>
                      <p style="margin:0;font-size:12px;color:#3c3c42;line-height:1.6;">
                        Sent by ${appName}
                        &nbsp;&middot;&nbsp;
                        <a href="${appUrl}" style="color:#5c5c63;text-decoration:none;">${appUrl.replace(/^https?:\/\//, "")}</a>
                      </p>
                      <p style="margin:6px 0 0;font-size:11px;color:#2d2d32;line-height:1.5;">Do not share this code with anyone. ${appName} will never ask for it by phone or chat.</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

          </table>
          <!-- End card -->

        </td>
      </tr>
    </table>
  </body>
</html>`;

  const text = `${subject}

Your ${appName} verification code is: ${otp}

This code expires in ${expiresInMinutes} minutes and can only be used once.

If you did not request this, ignore this email. No action is required.

${appName} -- ${appUrl}
`;

  return { subject, html, text };
}
