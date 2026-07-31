import { ConfigService } from '@nestjs/config';
import { ServiceUnavailableException } from '@nestjs/common';
import { AiService } from './ai.service';

describe('AiService', () => {
  it('respinge clar cererea când OPENAI_API_KEY nu e configurată, în loc să eșueze criptic', async () => {
    const config = { get: () => '' } as unknown as ConfigService;
    const service = new AiService(config, {} as never);
    await expect(service.chat([{ role: 'user', content: 'Salut' }])).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
