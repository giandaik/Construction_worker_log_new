import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { buildSignatureNotificationTemplate } from '@/lib/email/templates/signatureNotificationTemplate';
import { sendSignatureNotificationEmail } from '@/lib/email/resendEmail';

describe('Resend email notification', () => {
  beforeEach(() => {
    process.env.RESEND_API_KEY = 'test-api-key';
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

  it('calls the Resend API with the expected payload', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 202,
      json: async () => ({ id: 'email-id' }),
      text: async () => 'accepted',
    });

    vi.stubGlobal('fetch', fetchMock);

    const result = await sendSignatureNotificationEmail({
      signerName: 'Jane Smith',
      signerRole: 'Supervisor',
      projectName: 'Downtown Renovation',
      signatureTimestamp: '2026-06-08T14:30:00Z',
    });

    expect(result).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('https://api.resend.com/emails', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({
        Authorization: 'Bearer test-api-key',
        'Content-Type': 'application/json',
      }),
      body: expect.any(String),
    }));

    const body = JSON.parse((fetchMock.mock.calls[0] as any)[1].body);
    expect(body.from).toBe('noreply@example.com');
    expect(body.to).toContain('notify@example.com');
    expect(body.subject).toContain('Jane Smith');
    expect(body.html).toContain('Work Log Signature');
  });
});
