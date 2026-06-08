export interface SignatureNotificationPayload {
  signerName: string;
  signerRole?: string;
  projectName?: string;
  signatureTimestamp?: string;
  workLogUrl?: string;
}

const getAppUrl = (): string => {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    'http://localhost:3000'
  ).replace(/\/$/, '');
};

export const buildSignatureNotificationTemplate = (
  payload: SignatureNotificationPayload
) => {
  const formattedDate = payload.signatureTimestamp
    ? new Date(payload.signatureTimestamp).toLocaleString()
    : 'Unknown date';

  const workLogUrl = payload.workLogUrl || `${getAppUrl()}/worklogs`;
  const subject = `Work log signed by ${payload.signerName}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5;">
        <tr>
          <td align="center" style="padding: 40px 20px;">
            <table width="100%" max-width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
              <!-- Header -->
              <tr>
                <td style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 32px 20px; text-align: center; border-radius: 12px 12px 0 0;">
                  <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700;">Work Log Signature</h1>
                </td>
              </tr>

              <!-- Content -->
              <tr>
                <td style="padding: 40px 30px;">
                  <p style="margin: 0 0 24px; color: #374151; font-size: 16px; line-height: 1.6;">
                    A work log has been signed by:
                  </p>
                  
                  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 24px; background-color: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 6px;">
                    <tr>
                      <td style="padding: 12px 16px; color: #92400e; font-size: 15px;">
                        <strong>${payload.signerName}</strong>
                      </td>
                    </tr>
                    ${payload.signerRole ? `
                    <tr>
                      <td style="padding: 8px 16px; color: #92400e; font-size: 14px; border-top: 1px solid #fde68a;">
                        Role: ${payload.signerRole}
                      </td>
                    </tr>
                    ` : ''}
                    ${payload.projectName ? `
                    <tr>
                      <td style="padding: 8px 16px; color: #92400e; font-size: 14px; border-top: 1px solid #fde68a;">
                        Project: ${payload.projectName}
                      </td>
                    </tr>
                    ` : ''}
                    <tr>
                      <td style="padding: 8px 16px; color: #92400e; font-size: 14px; border-top: 1px solid #fde68a;">
                        Signed on: ${formattedDate}
                      </td>
                    </tr>
                  </table>

                  <!-- CTA Button -->
                  <table cellpadding="0" cellspacing="0" style="margin-bottom: 24px;">
                    <tr>
                      <td style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 12px 32px; border-radius: 8px; text-align: center;">
                        <a href="${workLogUrl}" style="color: #ffffff; text-decoration: none; font-weight: 600; font-size: 16px; display: inline-block;">
                          Review Work Log
                        </a>
                      </td>
                    </tr>
                  </table>

                  <p style="margin: 0; color: #9ca3af; font-size: 13px; line-height: 1.5;">
                    If you did not expect this email or have questions, please contact your project manager.
                  </p>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="background-color: #f9fafb; padding: 20px 30px; text-align: center; border-radius: 0 0 12px 12px; border-top: 1px solid #e5e7eb;">
                  <p style="margin: 0; color: #9ca3af; font-size: 12px;">
                    Construction Worker Daily Log • Auto-generated email
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  const text = `Work Log Signature

Signer: ${payload.signerName}${payload.signerRole ? `
Role: ${payload.signerRole}` : ''}${payload.projectName ? `
Project: ${payload.projectName}` : ''}
Signed on: ${formattedDate}

Review the work log at: ${workLogUrl}

---
Construction Worker Daily Log
`;

  return { subject, html, text };
};
