import { ConfigService } from '@nestjs/config';
import { EmailService, buildWelcomeEmailHtml } from './email.service';

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
