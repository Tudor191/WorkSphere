import { ConfigService } from '@nestjs/config';
import { FirebaseService } from './firebase.service';

describe('FirebaseService', () => {
  const unconfigured = () => new FirebaseService({ get: () => '' } as unknown as ConfigService);

  it('isConfigured e false fără cheile de service account', () => {
    expect(unconfigured().isConfigured).toBe(false);
  });

  it('sendToTokens e no-op (nu aruncă, nu întoarce token-uri invalide) când nu e configurat', async () => {
    const result = await unconfigured().sendToTokens(['token1'], { title: 't', body: 'b' });
    expect(result).toEqual({ invalidTokens: [] });
  });

  it('sendToTokens e no-op și fără niciun token de trimis', async () => {
    const result = await unconfigured().sendToTokens([], { title: 't', body: 'b' });
    expect(result).toEqual({ invalidTokens: [] });
  });
});
