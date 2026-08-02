import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

export interface WelcomeEmailInput {
  to: string;
  firstName: string;
  companyName: string;
}

/** Funcție pură — separată ca să poată fi testată fără rețea/cont Resend. */
export function buildWelcomeEmailHtml(input: WelcomeEmailInput): string {
  return `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <h1 style="font-size: 20px;">Bine ai venit pe WorkSphere, ${input.firstName}!</h1>
      <p>Contul companiei <strong>${input.companyName}</strong> a fost creat cu succes.</p>
      <p>Ai 14 zile de trial gratuit ca să explorezi Angajați, Concedii, Proiecte, CRM, Inventar și Chat intern.</p>
      <p>Spor la treabă!<br />Echipa WorkSphere</p>
    </div>
  `.trim();
}

export interface PasswordResetEmailInput {
  to: string;
  firstName: string;
  resetUrl: string;
}

/** Funcție pură — separată ca să poată fi testată fără rețea/cont Resend. */
export function buildPasswordResetEmailHtml(input: PasswordResetEmailInput): string {
  return `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <h1 style="font-size: 20px;">Resetare parolă</h1>
      <p>Salut, ${input.firstName}. Am primit o cerere de resetare a parolei contului tău WorkSphere.</p>
      <p><a href="${input.resetUrl}" style="color: #4f46e5;">Alege o parolă nouă</a></p>
      <p>Linkul e valabil o oră. Dacă nu ai cerut tu resetarea, poți ignora acest email — parola ta rămâne neschimbată.</p>
      <p>Echipa WorkSphere</p>
    </div>
  `.trim();
}

/**
 * Trimite email-uri tranzacționale prin Resend. Fără `RESEND_API_KEY`
 * configurat, `sendWelcomeEmail` devine un no-op (loghează și întoarce
 * imediat) — la fel ca `TwilioService`/`FirebaseService`: email-ul e un
 * bonus, nu trebuie să strice fluxul de înregistrare care îl declanșează.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly client: Resend | null;
  private readonly fromAddress: string;

  constructor(config: ConfigService) {
    const apiKey = config.get<string>('app.resend.apiKey') ?? '';
    this.fromAddress = config.get<string>('app.resend.fromAddress') ?? '';
    this.client = apiKey ? new Resend(apiKey) : null;
  }

  get isConfigured(): boolean {
    return this.client !== null;
  }

  async sendWelcomeEmail(input: WelcomeEmailInput): Promise<void> {
    if (!this.client) return;
    try {
      await this.client.emails.send({
        from: this.fromAddress,
        to: input.to,
        subject: `Bine ai venit pe WorkSphere, ${input.firstName}!`,
        html: buildWelcomeEmailHtml(input),
      });
    } catch (error) {
      this.logger.warn(
        `Trimitere email de bun venit eșuată către ${input.to}: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  async sendPasswordResetEmail(input: PasswordResetEmailInput): Promise<void> {
    if (!this.client) return;
    try {
      await this.client.emails.send({
        from: this.fromAddress,
        to: input.to,
        subject: 'Resetează-ți parola WorkSphere',
        html: buildPasswordResetEmailHtml(input),
      });
    } catch (error) {
      this.logger.warn(
        `Trimitere email de resetare a parolei eșuată către ${input.to}: ${error instanceof Error ? error.message : error}`,
      );
    }
  }
}
