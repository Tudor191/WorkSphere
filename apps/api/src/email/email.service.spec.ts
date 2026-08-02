import { ConfigService } from '@nestjs/config';
import { EmailService, buildPasswordResetEmailHtml, buildWelcomeEmailHtml } from './email.service';

describe('EmailService', () => {
  const unconfigured = () => new EmailService({ get: () => '' } as unknown as ConfigService);

  it('isConfigured e false fără RESEND_API_KEY', () => {
    expect(unconfigured().isConfigured).toBe(false);
  });

  it('sendWelcomeEmail e no-op (nu aruncă) când nu e configurat', async () => {
    await expect(
      unconfigured().sendWelcomeEmail({
        to: 'test@e2e.ro',
        firstName: 'Ana',
        companyName: 'Acme SRL',
      }),
    ).resolves.toBeUndefined();
  });

  it('sendPasswordResetEmail e no-op (nu aruncă) când nu e configurat', async () => {
    await expect(
      unconfigured().sendPasswordResetEmail({
        to: 'test@e2e.ro',
        firstName: 'Ana',
        resetUrl: 'https://example.ro/reset-password?token=abc',
        expiresInMinutes: 60,
      }),
    ).resolves.toBeUndefined();
  });
});

describe('buildWelcomeEmailHtml', () => {
  it('include numele și compania în HTML-ul generat', () => {
    const html = buildWelcomeEmailHtml({
      to: 'x@e2e.ro',
      firstName: 'Ana',
      companyName: 'Acme SRL',
    });
    expect(html).toContain('Ana');
    expect(html).toContain('Acme SRL');
  });
});

describe('buildPasswordResetEmailHtml', () => {
  it('include numele, link-ul de resetare și durata de expirare în HTML-ul generat', () => {
    const html = buildPasswordResetEmailHtml({
      to: 'x@e2e.ro',
      firstName: 'Ana',
      resetUrl: 'https://example.ro/reset-password?token=abc',
      expiresInMinutes: 60,
    });
    expect(html).toContain('Ana');
    expect(html).toContain('https://example.ro/reset-password?token=abc');
    expect(html).toContain('60');
  });

  it('face escape la HTML în numele primit, ca să nu poată injecta markup', () => {
    const html = buildPasswordResetEmailHtml({
      to: 'x@e2e.ro',
      firstName: '<script>alert(1)</script>',
      resetUrl: 'https://example.ro/reset-password?token=abc',
      expiresInMinutes: 60,
    });
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });
});
