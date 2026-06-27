export interface RejectWorkLogPayload {
  projectName?: string;
  workLogUrl?: string;
  workLogId?: string;
  projectOwnerEmail?: string;
  projectContractorEmail?: string;
  rejectionComment: string;
  rejectedAt: string | Date;
}

const getAppUrl = (): string => {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    'http://localhost:3000'
  ).replace(/\/$/, '');
};

export const buildRejectWorkLogTemplate = (
  payload: RejectWorkLogPayload
) => {
const workLogUrl =
  payload.workLogUrl ??
  (payload.workLogId
    ? `${getAppUrl()}/worklogs/${payload.workLogId}` : `${getAppUrl()}/worklogs`);

const subject = `Work log rejected${payload.projectName ? `: ${payload.projectName}` : ''}`;

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
            <td style="background:linear-gradient(135deg,#dc2626 0%,#b91c1c 100%);padding:32px 20px;text-align:center;border-radius:12px 12px 0 0;">
              <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;">
                Work Log Rejected
              </h1>
            </td>
          </tr>

          <tr>
            <td style="padding:40px 30px;color:#374151;font-size:16px;line-height:1.6;">

              <p style="margin:0 0 24px;">
                The submitted work log has been reviewed and requires changes before it can be approved.
              </p>

              ${
                payload.projectName
                  ? `<p style="margin:0 0 24px;">
                      Project: <strong>${payload.projectName}</strong>
                    </p>`
                  : ""
              }

              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;background-color:#fef2f2;border-left:4px solid #dc2626;border-radius:6px;">
                <tr>
                  <td style="padding:16px;">
                    <p style="margin:0 0 8px;color:#991b1b;font-weight:600;">
                      Rejection comments
                    </p>
                    <p style="margin:0;color:#7f1d1d;white-space:pre-line;">
                      ${payload.rejectionComment}
                    </p>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 24px;">
                Please review the comments above, make the necessary corrections,
                and resubmit the work log for approval.
              </p>

              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:linear-gradient(135deg,#2563eb 0%,#1d4ed8 100%);padding:12px 32px;border-radius:8px;text-align:center;">
                    <a href="${workLogUrl}"
                      style="color:#ffffff;text-decoration:none;font-weight:600;font-size:16px;display:inline-block;">
                      Review Work Log
                    </a>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <tr>
            <td style="background-color:#f9fafb;padding:20px 30px;text-align:center;border-radius:0 0 12px 12px;border-top:1px solid #e5e7eb;">
              <p style="margin:0;color:#9ca3af;font-size:12px;">
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

const text =
`Work log rejected${payload.projectName ? `: ${payload.projectName}` : ""}

${payload.projectName ? `Project: ${payload.projectName}\n\n` : ""}

Reason for rejection:

${payload.rejectionComment}

Please review the comments, make the necessary corrections, and resubmit the work log.

View work log:
${workLogUrl}

---
Construction Worker Daily Log
`;

return { subject, html, text };
};
