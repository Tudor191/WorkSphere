import { ConfigService } from '@nestjs/config';
import { ServiceUnavailableException } from '@nestjs/common';
import { BillingService } from './billing.service';

describe('BillingService', () => {
  const unconfigured = () =>
    new BillingService({ get: () => '' } as unknown as ConfigService, {} as never);

  it('respinge clar checkout-ul când STRIPE_SECRET_KEY nu e configurată', async () => {
    const service = unconfigured();
    await expect(service.createCheckoutSession({ planSlug: 'basic' })).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('respinge clar portalul când STRIPE_SECRET_KEY nu e configurată', async () => {
    const service = unconfigured();
    await expect(service.createPortalSession()).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
