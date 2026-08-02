import { ConfigService } from '@nestjs/config';
import {
  EmailService,
  buildAccountSuspensionEmailHtml,
  buildPasswordResetEmailHtml,
  buildWelcomeEmailHtml,
} from './email.service';

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

  it('sendAccountSuspensionEmail e no-op (nu aruncă) când nu e configurat', async () => {
    await expect(
      unconfigured().sendAccountSuspensionEmail({
        to: 'test@e2e.ro',
        firstName: 'Ana',
        companyName: 'Acme SRL',
        code: '123456',
        confirmUrl: 'https://example.ro/account-deletion/confirm?email=test%40e2e.ro',
        gracePeriodDays: 7,
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

describe('buildAccountSuspensionEmailHtml', () => {
  it('include numele, compania, codul, link-ul de confirmare și perioada de grație', () => {
    const html = buildAccountSuspensionEmailHtml({
      to: 'x@e2e.ro',
      firstName: 'Ana',
      companyName: 'Acme SRL',
      code: '123456',
      confirmUrl: 'https://example.ro/account-deletion/confirm?email=x%40e2e.ro',
      gracePeriodDays: 7,
    });
    expect(html).toContain('Ana');
    expect(html).toContain('Acme SRL');
    expect(html).toContain('123456');
    expect(html).toContain('https://example.ro/account-deletion/confirm?email=x%40e2e.ro');
    expect(html).toContain('7 zile');
  });

  it('face escape la HTML în numele/compania primite', () => {
    const html = buildAccountSuspensionEmailHtml({
      to: 'x@e2e.ro',
      firstName: '<script>alert(1)</script>',
      companyName: 'Acme SRL',
      code: '123456',
      confirmUrl: 'https://example.ro/account-deletion/confirm',
      gracePeriodDays: 7,
    });
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });
});
