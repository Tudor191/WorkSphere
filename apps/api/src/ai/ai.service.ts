import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../common/tenant/tenant-context';
import { ChatMessageDto } from './dto/chat.dto';

const MAX_HISTORY_MESSAGES = 20;

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly client: OpenAI | null;
  private readonly model: string;

  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const apiKey = config.get<string>('app.openai.apiKey') ?? '';
    this.model = config.get<string>('app.openai.model') ?? 'gpt-4o-mini';
    // Fără cheie configurată, clientul rămâne `null` — chat() aruncă o eroare
    // clară (503) în loc să lase SDK-ul OpenAI să eșueze criptic la request.
    this.client = apiKey ? new OpenAI({ apiKey }) : null;
  }

  async chat(messages: ChatMessageDto[]): Promise<{ reply: string }> {
    if (!this.client) {
      throw new ServiceUnavailableException(
        'AI Assistant nu este configurat — lipsește OPENAI_API_KEY pe server.',
      );
    }

    const companyId = TenantContext.requireCompanyId();
    const company = await this.prisma.tenantScoped.company.findUnique({
      where: { id: companyId },
      select: { name: true },
    });

    const recentHistory = messages.slice(-MAX_HISTORY_MESSAGES);

    const completion = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: 'system',
          content:
            `Ești asistentul AI intern al platformei WorkSphere, pentru compania „${company?.name ?? 'necunoscută'}”. ` +
            'Răspunde concis și în română. NU ai acces la datele reale ale companiei (angajați, concedii, ' +
            'pontaj, proiecte) în această versiune — dacă ți se cere o informație specifică din companie, ' +
            'spune clar că nu ai acces la ea încă și îndrumă utilizatorul spre pagina relevantă din platformă, ' +
            'în loc să inventezi un răspuns.',
        },
        ...recentHistory.map((m) => ({ role: m.role, content: m.content }) as const),
      ],
    });

    const reply = completion.choices[0]?.message?.content;
    if (!reply) {
      this.logger.warn('Răspuns OpenAI fără conținut.');
      throw new ServiceUnavailableException('AI Assistant nu a putut genera un răspuns — încearcă din nou.');
    }
    return { reply };
  }
}
