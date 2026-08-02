import { ConfigService } from '@nestjs/config';
import { TwilioService } from './twilio.service';

describe('TwilioService', () => {
  const unconfigured = () => new TwilioService({ get: () => '' } as unknown as ConfigService);

  it('isConfigured e false fără accountSid/authToken/fromNumber', () => {
    expect(unconfigured().isConfigured).toBe(false);
  });

  it('sendSms e no-op (nu aruncă) când nu e configurat', async () => {
    await expect(unconfigured().sendSms('+40712345678', 'test')).resolves.toBeUndefined();
  });
});
