import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Twilio from 'twilio';
import type { Twilio as TwilioClient } from 'twilio';

/**
 * Trimite SMS prin Twilio. Fără credențiale configurate, `sendSms` devine
 * un no-op (loghează și întoarce imediat) — la fel ca `FirebaseService`
 * pentru push: SMS-ul e un bonus opt-in, nu trebuie să strice fluxul care
 * îl declanșează (ex. respingerea unei cereri de concediu).
 */
@Injectable()
export class TwilioService {
  private readonly logger = new Logger(TwilioService.name);
  private readonly client: TwilioClient | null;
  private readonly fromNumber: string;

  constructor(config: ConfigService) {
    const accountSid = config.get<string>('app.twilio.accountSid') ?? '';
    const authToken = config.get<string>('app.twilio.authToken') ?? '';
    this.fromNumber = config.get<string>('app.twilio.fromNumber') ?? '';

    if (!accountSid || !authToken || !this.fromNumber) {
      this.client = null;
      return;
    }
    this.client = Twilio(accountSid, authToken);
  }

  get isConfigured(): boolean {
    return this.client !== null;
  }

  async sendSms(to: string, body: string): Promise<void> {
    if (!this.client) return;
    try {
      await this.client.messages.create({ to, from: this.fromNumber, body });
    } catch (error) {
      this.logger.warn(`Trimitere SMS eșuată: ${error instanceof Error ? error.message : error}`);
    }
  }
}
