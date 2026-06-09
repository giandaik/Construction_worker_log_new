import nodemailer from 'nodemailer';
import {
  SignatureNotificationPayload,
  buildSignatureNotificationTemplate,
} from '@/lib/email/templates/signatureNotificationTemplate';
import {
  WorkLogCompletionPayload,
  buildWorkLogCompletionTemplate,
} from '@/lib/email/templates/workLogCompletionTemplate';

export type { SignatureNotificationPayload, WorkLogCompletionPayload };

interface sendMailOptions {
  from: string;
  to: string | string[];
  subject: string;
  html: string;
  text: string;
  attachments?: Array<{
    filename: string;
    content: string | Buffer;
    contentType?: string;
  }>; 
}

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
  return process.env.RESEND_FROM_EMAIL?.trim() || process.env.GMAIL_USER || 'no-reply@construction-app.com';
};

const createTransporter = () => {
  const host = process.env.GMAIL_SMTP_HOST || 'smtp.gmail.com';
  const port = Number(process.env.GMAIL_SMTP_PORT || '465');
  const secure = port === 465;
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;

  if (!user || !pass) {
    console.warn('[SMTP] GMAIL_USER or GMAIL_APP_PASSWORD not configured.');
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass,
    },
    tls: {
      rejectUnauthorized: false,
    },
  });
};

export const sendSmtpEmail = async (options: sendMailOptions): Promise<boolean> => {
  const transporter = createTransporter();
  if (!transporter) return false;

  const mailOptions = {
    from: options.from,
    to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
    subject: options.subject,
    text: options.text,
    html: options.html,
    attachments: options.attachments,
  };

  try {
    console.log('[SMTP] Sending email', { to: mailOptions.to, subject: mailOptions.subject });
    const info = await transporter.sendMail(mailOptions as any);
    console.log('[SMTP] Email sent', info && (info as any).messageId);
    return true;
  } catch (err) {
    console.error('[SMTP] Failed to send email:', err);
    return false;
  }
};

export const sendSignatureNotificationEmail = async (
  payload: SignatureNotificationPayload
): Promise<boolean> => {
  const recipients = getNotificationRecipients();

  if (recipients.length === 0) {
    console.warn('[SMTP] No notification recipients are configured. Set RESEND_NOTIFICATION_RECIPIENT or RESEND_NOTIFICATION_RECIPIENTS.');
    return false;
  }

  console.log('[SMTP] Preparing signature notification email for recipients:', recipients);
  const template = buildSignatureNotificationTemplate(payload);

  return sendSmtpEmail({
    from: getSenderEmail(),
    to: recipients,
    subject: template.subject,
    html: template.html,
    text: template.text,
  });
};

export const sendWorkLogCompletedEmail = async (
  payload: WorkLogCompletionPayload,
  attachments?: Array<{ filename: string; content: string | Buffer; contentType?: string }>
): Promise<boolean> => {
  const recipients = getNotificationRecipients();

  if (recipients.length === 0) {
    console.warn('[SMTP] No notification recipients are configured. Set RESEND_NOTIFICATION_RECIPIENT or RESEND_NOTIFICATION_RECIPIENTS.');
    return false;
  }

  console.log('[SMTP] Preparing completed work log email for recipients:', recipients);
  const template = buildWorkLogCompletionTemplate(payload);

  return sendSmtpEmail({
    from: getSenderEmail(),
    to: recipients,
    subject: template.subject,
    html: template.html,
    text: template.text,
    attachments,
  });
};
