import {
  SignatureNotificationPayload,
  buildSignatureNotificationTemplate,
} from '@/lib/email/templates/signatureNotificationTemplate';

export type { SignatureNotificationPayload };

interface ResendMailOptions {
  from: string;
  to: string | string[];
  subject: string;
  html: string;
  text: string;
}

const RESEND_API_BASE = 'https://api.resend.com/emails';

const getNotificationRecipients = (): string[] => {
  const recipients = [
    ...(process.env.RESEND_NOTIFICATION_RECIPIENTS?.split(',') ?? []),
    ...(process.env.RESEND_NOTIFICATION_RECIPIENT ? [process.env.RESEND_NOTIFICATION_RECIPIENT] : []),
  ]
    .map((recipient) => recipient.trim())
    .filter(Boolean);

  return Array.from(new Set(recipients));
};

const getSenderEmail = (): string => {
  return process.env.RESEND_FROM_EMAIL?.trim() || 'no-reply@construction-app.com';
};

export const sendResendEmail = async (
  options: ResendMailOptions
): Promise<boolean> => {
  const apiKey = process.env.RESEND_API_KEY?.trim();

  if (!apiKey) {
    console.warn('[Resend] RESEND_API_KEY is not configured. Email notification skipped.');
    return false;
  }

  console.log('[Resend] Sending email', {
    from: options.from,
    to: options.to,
    subject: options.subject,
  });

  const response = await fetch(RESEND_API_BASE, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(options),
  });

  if (!response.ok) {
    const body = await response.text();
    console.error('[Resend] Failed to send email:', response.status, body);
    return false;
  }

  console.log('[Resend] Email sent successfully');
  return true;
};

export const sendSignatureNotificationEmail = async (
  payload: SignatureNotificationPayload
): Promise<boolean> => {
  const recipients = getNotificationRecipients();

  if (recipients.length === 0) {
    console.warn('[Resend] No notification recipients are configured. Set RESEND_NOTIFICATION_RECIPIENT or RESEND_NOTIFICATION_RECIPIENTS.');
    return false;
  }

  console.log('[Resend] Preparing signature notification email for recipients:', recipients);
  const template = buildSignatureNotificationTemplate(payload);
  return sendResendEmail({
    from: getSenderEmail(),
    to: recipients,
    subject: template.subject,
    html: template.html,
    text: template.text,
  });
};
