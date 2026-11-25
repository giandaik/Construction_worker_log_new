import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { buildSignatureNotificationTemplate } from '@/lib/email/templates/signatureNotificationTemplate';

/**
 * `vi.mock` is hoisted above every import, so the nodemailer stub has to be
 * created inside `vi.hoisted` — a factory that closes over test-body locals
 * throws "createTransport is not defined" before any test runs.
 */
const { sendMailMock, createTransportMock } = vi.hoisted(() => ({
  sendMailMock: vi.fn(),
  createTransportMock: vi.fn(),
}));

vi.mock('nodemailer', () => ({
  default: { createTransport: createTransportMock },
  createTransport: createTransportMock,
}));

import { sendSignatureNotificationEmail } from '@/lib/email/sendEmail';

describe('SMTP email notification', () => {
  beforeEach(() => {
    process.env.GMAIL_USER = 'noreply@example.com';
    process.env.GMAIL_APP_PASSWORD = 'app-password';
    process.env.RESEND_FROM_EMAIL = 'noreply@example.com';
    process.env.RESEND_NOTIFICATION_RECIPIENT = 'notify@example.com';
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';

    sendMailMock.mockReset();
    createTransportMock.mockReset();
    sendMailMock.mockResolvedValue({ messageId: 'msg-1' });
    createTransportMock.mockReturnValue({ sendMail: sendMailMock });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('builds a signature notification template with the correct fields', () => {
    const template = buildSignatureNotificationTemplate({
      signerName: 'Jane Smith',
      signerRole: 'Supervisor',
      projectName: 'Downtown Renovation',
      signatureSignedAt: '2026-06-08T14:30:00Z',
      workLogId: 'abc123',
    });

    expect(template.subject).toContain('Jane Smith');
    expect(template.html).toContain('Work Log Signature');
    expect(template.html).toContain('Jane Smith');
    expect(template.html).toContain('Supervisor');
    expect(template.html).toContain('Downtown Renovation');
    expect(template.html).toContain('http://localhost:3000/worklogs/abc123');
    expect(template.text).toContain('Signer: Jane Smith');
    expect(template.text).toContain('Role: Supervisor');
    expect(template.text).toContain('Project: Downtown Renovation');
    // The signer's timestamp is rendered in the runtime's locale, so assert on
    // the rendered value rather than a hard-coded zone suffix.
    expect(template.text).toContain(new Date('2026-06-08T14:30:00Z').toLocaleString());
  });

  it('sends mail via nodemailer with the expected payload', async () => {
    // The notification goes to the *project owner*: without one there is no
    // recipient and the sender refuses rather than blasting a default inbox.
    const result = await sendSignatureNotificationEmail({
      signerName: 'Jane Smith',
      signerRole: 'Supervisor',
      projectName: 'Downtown Renovation',
      signatureSignedAt: '2026-06-08T14:30:00Z',
      projectOwnerEmail: 'owner@example.com',
    });

    expect(result).toBe(true);
    expect(createTransportMock).toHaveBeenCalled();
    expect(sendMailMock).toHaveBeenCalledTimes(1);
    const mailArgs = sendMailMock.mock.calls[0][0];
    expect(mailArgs.from).toBe('noreply@example.com');
    expect(mailArgs.to).toBe('owner@example.com');
    expect(mailArgs.subject).toContain('Jane Smith');
    expect(mailArgs.html).toContain('Work Log Signature');
  });
});
