import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { buildSignatureNotificationTemplate } from '@/lib/email/templates/signatureNotificationTemplate';
import { sendSignatureNotificationEmail } from '@/lib/email/sendEmail';

describe('SMTP email notification', () => {
  beforeEach(() => {
    process.env.GMAIL_USER = 'noreply@example.com';
    process.env.GMAIL_APP_PASSWORD = 'app-password';
    process.env.RESEND_FROM_EMAIL = 'noreply@example.com';
    process.env.RESEND_NOTIFICATION_RECIPIENT = 'notify@example.com';
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('builds a signature notification template with the correct fields', () => {
    const template = buildSignatureNotificationTemplate({
      signerName: 'Jane Smith',
      signerRole: 'Supervisor',
      projectName: 'Downtown Renovation',
      signatureTimestamp: '2026-06-08T14:30:00Z',
    });

    expect(template.subject).toContain('Jane Smith');
    expect(template.html).toContain('Work Log Signature');
    expect(template.html).toContain('Jane Smith');
    expect(template.html).toContain('Supervisor');
    expect(template.html).toContain('Downtown Renovation');
    expect(template.text).toContain('Signer: Jane Smith');
    expect(template.text).toContain('Role: Supervisor');
    expect(template.text).toContain('Project: Downtown Renovation');
  });

  it('sends mail via nodemailer with the expected payload', async () => {
    const sendMail = vi.fn().mockResolvedValue({ messageId: 'msg-1' });
    const createTransport = vi.fn().mockReturnValue({ sendMail });

    vi.mock('nodemailer', () => ({ createTransport }));

    const result = await sendSignatureNotificationEmail({
      signerName: 'Jane Smith',
      signerRole: 'Supervisor',
      projectName: 'Downtown Renovation',
      signatureTimestamp: '2026-06-08T14:30:00Z',
    });

    expect(result).toBe(true);
    expect(createTransport).toHaveBeenCalled();
    expect(sendMail).toHaveBeenCalledTimes(1);
    const mailArgs = sendMail.mock.calls[0][0];
    expect(mailArgs.from).toBe('noreply@example.com');
    expect(mailArgs.to).toContain('notify@example.com');
    expect(mailArgs.subject).toContain('Jane Smith');
    expect(mailArgs.html).toContain('Work Log Signature');
  });
});
