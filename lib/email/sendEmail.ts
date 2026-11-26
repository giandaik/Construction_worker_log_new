import nodemailer from 'nodemailer';
import {
  SignatureNotificationPayload,
  buildSignatureNotificationTemplate,
} from '@/lib/email/templates/signatureNotificationTemplate';
import {
  WorkLogCompletionPayload,
  buildWorkLogCompletionTemplate,
} from '@/lib/email/templates/workLogCompletionTemplate';
import { RejectWorkLogPayload, buildRejectWorkLogTemplate } from '@/lib/email/templates/rejectWorkLogTemplate';

/**
 * Masks an address for logging: `alice@alpha.test` -> `a***@alpha.test`.
 *
 * Recipient addresses are personal data and must not reach the logs in full.
 * The domain and first character are kept so a delivery problem is still
 * diagnosable.
 */
const maskEmail = (value: string): string => {
  const atIndex = value.lastIndexOf('@');

  if (atIndex <= 0) {
    return '***';
  }

  return `${value[0]}***${value.slice(atIndex)}`;
};

/** Masks one address or a list of them. */
const maskRecipients = (value: string | string[] | undefined): string => {
  if (!value) {
    return '(none)';
  }

  const list = Array.isArray(value) ? value : value.split(',');

  return list.map((entry) => maskEmail(entry.trim())).join(', ');
};

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
    console.log('[SMTP] Sending email', { to: maskRecipients(mailOptions.to), subject: mailOptions.subject });
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
  

  console.log('[SMTP] Preparing signature notification email for recipients:', payload.signerRole);
  const template = buildSignatureNotificationTemplate(payload);

  if (!payload.projectOwnerEmail) {
    console.error('[SMTP] No project owner email provided');
    return false;
  }

  return sendSmtpEmail({
    from: getSenderEmail(),
    to: payload.projectOwnerEmail,
    subject: template.subject,
    html: template.html,
    text: template.text,
  });
};

export const sendWorkLogCompletedEmail = async (
  payload: WorkLogCompletionPayload,
  attachments?: Array<{ filename: string; content: string | Buffer; contentType?: string }>
): Promise<boolean> => {
  const recipients = [
    payload.projectOwnerEmail,
    payload.projectContractorEmail,
  ].filter((email): email is string => Boolean(email));

  if (recipients.length === 0) {
    console.warn('[SMTP] No notification recipients are configured. Set RESEND_NOTIFICATION_RECIPIENT or RESEND_NOTIFICATION_RECIPIENTS.');
    return false;
  }

  console.log('[SMTP] Preparing completed work log email for recipients:', maskRecipients(recipients));
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

export const sendRejectWorkLogEmail = async (
  payload: RejectWorkLogPayload
): Promise<boolean> => {
  

  console.log('[SMTP] Preparing rejection notification email for recipients:', maskRecipients(payload.projectContractorEmail));
  const template = buildRejectWorkLogTemplate(payload);

  if (!payload.projectContractorEmail) {
    console.error('[SMTP] No project contractor email provided');
    return false;
  }

  return sendSmtpEmail({
    from: getSenderEmail(),
    to: payload.projectContractorEmail,
    subject: template.subject,
    html: template.html,
    text: template.text,
  });
};

export async function sendTenantInvitationEmail(payload: {
  email: string;
  tenantName: string;
  inviterName: string;
  tenantRole: string;
  inviteUrl: string;
}): Promise<boolean> {
  const escapeHtml = (value: string) =>
    value.replace(/[&<>"']/g, (character) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    })[character] ?? character);
  const roleLabel = payload.tenantRole.toLowerCase();
  const tenantName = escapeHtml(payload.tenantName);
  const inviterName = escapeHtml(payload.inviterName);
  const inviteUrl = escapeHtml(payload.inviteUrl);
  const subject = `Invitation to join ${payload.tenantName} on Sitely`;
  const text = `${payload.inviterName} invited you to join ${payload.tenantName} as a ${roleLabel}.\n\nAccept the invitation: ${payload.inviteUrl}\n\nThis link expires in 7 days and can only be used once.`;

  return sendSmtpEmail({
    from: getSenderEmail(),
    to: payload.email,
    subject,
    text,
    html: `<p>${inviterName} invited you to join <strong>${tenantName}</strong> on Sitely as a ${escapeHtml(roleLabel)}.</p><p><a href="${inviteUrl}">Accept invitation</a></p><p>This link expires in 7 days and can only be used once.</p>`,
  });
}

export async function sendSignupRequestNotificationEmail(payload: {
  recipients: string[];
  requestId: string;
  firstName: string;
  lastName: string;
  email: string;
  organizationName: string;
  message?: string;
}): Promise<boolean> {
  if (payload.recipients.length === 0) {
    console.error('[SMTP] Cannot notify about an access request: no platform super-admin email addresses are configured.');
    return false;
  }

  const escapeHtml = (value: string) =>
    value.replace(/[&<>"']/g, (character) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    })[character] ?? character);
  const fullName = `${payload.firstName} ${payload.lastName}`;
  const message = payload.message?.trim() || '(No message provided)';
  const subject = `Account access request from ${fullName}`;
  const text = [
    'A new account invitation request is waiting for review.',
    '',
    `Name: ${fullName}`,
    `Email: ${payload.email}`,
    `Organisation: ${payload.organizationName}`,
    `Message: ${message}`,
    `Request ID: ${payload.requestId}`,
    '',
    'Review it in Platform Administration > Signup Requests.',
  ].join('\n');

  return sendSmtpEmail({
    from: getSenderEmail(),
    to: payload.recipients,
    subject,
    text,
    html: `<p>A new account invitation request is waiting for review.</p><dl><dt>Name</dt><dd>${escapeHtml(fullName)}</dd><dt>Email</dt><dd>${escapeHtml(payload.email)}</dd><dt>Organisation</dt><dd>${escapeHtml(payload.organizationName)}</dd><dt>Message</dt><dd>${escapeHtml(message)}</dd><dt>Request ID</dt><dd>${escapeHtml(payload.requestId)}</dd></dl><p>Review it in Platform Administration &rarr; Signup Requests.</p>`,
  });
}

export async function sendSignupRequestRejectedEmail(payload: {
  email: string;
  firstName: string;
  organizationName: string;
  reason?: string;
}): Promise<boolean> {
  const escapeHtml = (value: string) =>
    value.replace(/[&<>"']/g, (character) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    })[character] ?? character);
  const reason = payload.reason?.trim();
  const subject = 'Update on your account access request';
  const text = `Hello ${payload.firstName},\n\nYour request to join ${payload.organizationName} was not approved.${reason ? `\n\nNote from the review team: ${reason}` : ''}\n\nIf you believe this was a mistake, contact your organisation administrator.`;

  return sendSmtpEmail({
    from: getSenderEmail(),
    to: payload.email,
    subject,
    text,
    html: `<p>Hello ${escapeHtml(payload.firstName)},</p><p>Your request to join <strong>${escapeHtml(payload.organizationName)}</strong> was not approved.</p>${reason ? `<p>Note from the review team: ${escapeHtml(reason)}</p>` : ''}<p>If you believe this was a mistake, contact your organisation administrator.</p>`,
  });
}
