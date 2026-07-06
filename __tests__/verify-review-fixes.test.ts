import { describe, expect, it } from 'vitest';
import { escapeHtml } from '@/lib/email/escapeHtml';
import { buildRejectWorkLogTemplate } from '@/lib/email/templates/rejectWorkLogTemplate';
import { config as middlewareConfig } from '@/middleware';

describe('escapeHtml', () => {
  it('escapes HTML metacharacters', () => {
    expect(escapeHtml(`<a href="x">'&`)).toBe('&lt;a href=&quot;x&quot;&gt;&#39;&amp;');
  });

  it('leaves plain text untouched', () => {
    expect(escapeHtml('ποσότητα 5 m³')).toBe('ποσότητα 5 m³');
  });
});

describe('rejection email template', () => {
  it('escapes the rejection comment in the HTML body', () => {
    const { html } = buildRejectWorkLogTemplate({
      rejectionComment: '<a href="https://phish.example">Re-submit here</a>',
      rejectedAt: new Date('2026-06-27T00:00:00Z'),
    });
    expect(html).not.toContain('<a href="https://phish.example">');
    expect(html).toContain('&lt;a href=&quot;https://phish.example&quot;&gt;');
  });

  it('escapes the project name in the HTML body', () => {
    const { html } = buildRejectWorkLogTemplate({
      projectName: 'Site <script>alert(1)</script>',
      rejectionComment: 'ok',
      rejectedAt: new Date('2026-06-27T00:00:00Z'),
    });
    expect(html).not.toContain('<script>alert(1)</script>');
  });

  it('keeps angle brackets literal in the plain-text body', () => {
    const { text } = buildRejectWorkLogTemplate({
      rejectionComment: 'ποσότητα < 5 m³',
      rejectedAt: new Date('2026-06-27T00:00:00Z'),
    });
    expect(text).toContain('ποσότητα < 5 m³');
  });
});

describe('auth middleware matcher', () => {
  const pattern = new RegExp(`^${middlewareConfig.matcher[0]}$`);

  it('still runs auth for dynamic routes that end in an image extension', () => {
    expect(pattern.test('/worklogs/x.png')).toBe(true);
    expect(pattern.test('/projects/x.jpeg')).toBe(true);
  });

  it('still runs auth for regular app and API routes', () => {
    expect(pattern.test('/worklogs')).toBe(true);
    expect(pattern.test('/api/worklogs/abc')).toBe(true);
  });

  it('skips auth only for Next internals and the named public assets', () => {
    expect(pattern.test('/sitely-logo.png')).toBe(false);
    expect(pattern.test('/favicon.ico')).toBe(false);
    expect(pattern.test('/_next/static/chunk.js')).toBe(false);
    expect(pattern.test('/_next/image')).toBe(false);
  });
});
