export interface WorkLogCompletionPayload {
  signerName: string;
  signerRole?: string;
  projectName?: string;
  signatureSignedAt?: string | Date;
  workLogUrl?: string;
  workLogId?: string;
  projectOwnerEmail?: string;
  projectContractorEmail?: string;
}

const getAppUrl = (): string => {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    'http://localhost:3000'
  ).replace(/\/$/, '');
};

export const buildWorkLogCompletionTemplate = (
  payload: WorkLogCompletionPayload
) => {
  const workLogUrl =
    payload.workLogUrl ??
    (payload.workLogId ? `${getAppUrl()}/worklogs/${payload.workLogId}` : `${getAppUrl()}/worklogs`);

  const subject = `Work log completed and signed${payload.projectName ? `: ${payload.projectName}` : ''}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;background-color:#f5f5f5;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f5f5;">
        <tr>
          <td align="center" style="padding:40px 20px;">
            <table width="100%" max-width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;box-shadow:0 4px 6px rgba(0,0,0,0.1);">
              <tr>
                <td style="background:linear-gradient(135deg,#16a34a 0%,#059669 100%);padding:32px 20px;text-align:center;border-radius:12px 12px 0 0;">
                  <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;">Work Log Completed</h1>
                </td>
              </tr>
              <tr>
                <td style="padding:40px 30px;color:#374151;font-size:16px;line-height:1.6;">
                  <p style="margin:0 0 24px;">The work log has been signed by both required parties and is now complete.</p>
                  ${payload.projectName ? `<p style="margin:0 0 24px;">Project: <strong>${payload.projectName}</strong></p>` : ''}
                  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;background-color:#ecfdf5;border-left:4px solid #10b981;border-radius:6px;">
                    <tr>
                      <td style="padding:12px 16px;color:#065f46;font-size:15px;">
                        <strong>${payload.signerName ?? 'The team'}</strong>
                        ${payload.projectName ? ' has completed the signed work log.' : ' has completed the signed work log.'}
                      </td>
                    </tr>
                  </table>
                  <table cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                    <tr>
                      <td style="background:linear-gradient(135deg,#16a34a 0%,#059669 100%);padding:12px 32px;border-radius:8px;text-align:center;">
                        <a href="${workLogUrl}" style="color:#ffffff;text-decoration:none;font-weight:600;font-size:16px;display:inline-block;">View Completed Work Log</a>
                      </td>
                    </tr>
                  </table>
                  <p style="margin:0;color:#9ca3af;font-size:13px;line-height:1.5;">Attached is the signed and completed work log PDF.</p>
                </td>
              </tr>
              <tr>
                <td style="background-color:#f9fafb;padding:20px 30px;text-align:center;border-radius:0 0 12px 12px;border-top:1px solid #e5e7eb;">
                  <p style="margin:0;color:#9ca3af;font-size:12px;">Construction Worker Daily Log • Auto-generated email</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  const text = `Work log completed and signed${payload.projectName ? `: ${payload.projectName}` : ''}

` +
    `${payload.signerName ? `Completed by: ${payload.signerName}
` : ''}` +
    `Review the completed work log at: ${workLogUrl}

` +
    `Attached is the signed work log PDF.

---
Construction Worker Daily Log
`;

  return { subject, html, text };
};
