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

// Every transactional email renders on a white background unconditionally,
// independent of the app's own light or dark theme toggle. Email clients
// handle dark mode inconsistently, so a fixed light presentation is the
// reliable choice here, the same way the app's own 404 page is
// intentionally exempt from the toggle in the opposite direction.
export function renderOtpEmail(data: OtpEmailData): RenderedEmail {
  const { otp, expiresInMinutes, appUrl, appName = "Prompt AI" } = data;

  const subject = `${otp} is your ${appName} verification code`;

  const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta http-equiv="X-UA-Compatible" content="IE=edge" />
    <meta name="color-scheme" content="light only" />
    <meta name="supported-color-schemes" content="light only" />
    <title>${subject}</title>
    <style>
      * { box-sizing: border-box; }
      @media (prefers-color-scheme: dark) {
        body, table, td { background-color: #ffffff !important; }
      }
    </style>
  </head>
  <body style="margin:0;padding:0;background-color:#ffffff;font-family:'Geist',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;-webkit-font-smoothing:antialiased;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="background-color:#ffffff;min-height:100vh;">
      <tr>
        <td align="center" valign="top" style="padding:48px 16px 64px;">

          <!-- Card -->
          <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="max-width:480px;background-color:#ffffff;border:1px solid #e4e4e7;border-radius:16px;overflow:hidden;">

            <!-- Header -->
            <tr>
              <td style="padding:24px 32px;border-bottom:1px solid #e4e4e7;">
                <img src="${appUrl}/promptai-logo.png" width="104" height="34" alt="${appName}" style="display:block;border:0;outline:none;" />
              </td>
            </tr>

            <!-- Body -->
            <tr>
              <td style="padding:36px 32px 28px;">
                <p style="margin:0 0 6px;font-size:21px;font-weight:700;color:#0a0a0b;letter-spacing:-0.02em;line-height:1.25;">Verify your email address</p>
                <p style="margin:0 0 32px;font-size:14px;color:#525252;line-height:1.65;">Enter the code below to complete your ${appName} signup. It expires in ${expiresInMinutes} minutes.</p>

                <!-- OTP block -->
                <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="margin-bottom:32px;">
                  <tr>
                    <td style="background-color:#fdf6ec;border:1px solid #f0dcb8;border-radius:12px;padding:28px 24px;text-align:center;">
                      <p style="margin:0 0 10px;font-size:11px;font-family:'Geist Mono','Courier New',Courier,monospace;text-transform:uppercase;letter-spacing:0.14em;color:#a1a1aa;">Your verification code</p>
                      <p style="margin:0;font-size:40px;font-weight:800;font-family:'Geist Mono','Courier New',Courier,monospace;letter-spacing:0.3em;color:#0a0a0b;line-height:1;">${otp}</p>
                    </td>
                  </tr>
                </table>

                <p style="margin:0 0 12px;font-size:13px;color:#71717a;line-height:1.7;">This code is single-use and expires <strong style="color:#525252;">${expiresInMinutes} minutes</strong> from when this email was sent.</p>
                <p style="margin:0;font-size:13px;color:#71717a;line-height:1.7;">If you did not create a ${appName} account, you can safely ignore this email. No action is required and your email address will not be used.</p>
              </td>
            </tr>

            <!-- Divider -->
            <tr>
              <td style="padding:0 32px;">
                <div style="height:1px;background-color:#e4e4e7;"></div>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="padding:20px 32px 28px;">
                <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation">
                  <tr>
                    <td>
                      <p style="margin:0;font-size:12px;color:#a1a1aa;line-height:1.6;">
                        Sent by ${appName}
                        &nbsp;&middot;&nbsp;
                        <a href="${appUrl}" style="color:#71717a;text-decoration:none;">${appUrl.replace(/^https?:\/\//, "")}</a>
                      </p>
                      <p style="margin:6px 0 0;font-size:11px;color:#c1c1c6;line-height:1.5;">Do not share this code with anyone. ${appName} will never ask for it by phone or chat.</p>
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

${appName}, ${appUrl}
`;

  return { subject, html, text };
}
