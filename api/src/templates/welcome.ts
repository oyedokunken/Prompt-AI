export interface WelcomeEmailData {
  to: string;
  appUrl: string;
  appName?: string;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

export function renderWelcomeEmail(data: WelcomeEmailData): RenderedEmail {
  const { appUrl, appName = "Prompt AI" } = data;

  const subject = `Welcome to ${appName}`;

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
                <p style="margin:0 0 6px;font-size:21px;font-weight:700;color:#ededef;letter-spacing:-0.02em;line-height:1.25;">Welcome to ${appName}</p>
                <p style="margin:0 0 24px;font-size:14px;color:#8b8b93;line-height:1.65;">Thanks for signing up. You now have access to turn vague ideas into structured prompts that AI tools can execute correctly on the first try.</p>

                <p style="margin:0 0 12px;font-size:14px;color:#ededef;line-height:1.65;">Here is what you can do with ${appName}:</p>

                <ul style="margin:0 0 24px;padding-left:20px;font-size:14px;color:#8b8b93;line-height:1.8;">
                  <li style="margin-bottom:8px;">Describe your goal in plain language and get follow-up questions when context is missing</li>
                  <li style="margin-bottom:8px;">Get structured prompts built for the AI tool you actually need</li>
                  <li style="margin-bottom:8px;">See a completeness score and understand what was inferred versus what you said</li>
                  <li style="margin-bottom:0;">Save your prompt history and iterate on previous work</li>
                </ul>

                <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="margin-bottom:28px;">
                  <tr>
                    <td align="center">
                      <a href="${appUrl}" style="display:inline-block;padding:12px 24px;background-color:#F2A93B;color:#0A0A0B;text-decoration:none;font-size:14px;font-weight:600;border-radius:8px;">Go to dashboard</a>
                    </td>
                  </tr>
                </table>

                <p style="margin:0;font-size:13px;color:#5c5c63;line-height:1.7;">If you have questions or run into issues, reply to this email. We read every message.</p>
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
                      <p style="margin:6px 0 0;font-size:11px;color:#2d2d32;line-height:1.5;">This email was sent because you created an account. If you did not create this account, you can safely ignore it.</p>
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

Thanks for signing up for ${appName}.

You now have access to turn vague ideas into structured prompts that AI tools can execute correctly on the first try.

Here is what you can do with ${appName}:

- Describe your goal in plain language and get follow-up questions when context is missing
- Get structured prompts built for the AI tool you actually need
- See a completeness score and understand what was inferred versus what you said
- Save your prompt history and iterate on previous work

Get started: ${appUrl}

If you have questions or run into issues, reply to this email. We read every message.

This email was sent because you created an account. If you did not create this account, you can safely ignore it.

${appName} -- ${appUrl}
`;

  return { subject, html, text };
}
