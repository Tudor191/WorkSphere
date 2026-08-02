import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

/**
 * Datele interpolate în șabloane vin parțial din input controlat de user
 * (`firstName`, `companyName`) — escapăm explicit înainte de a le băga în
 * HTML, ca igienă de bază (nu ca fix al unei vulnerabilități exploatabile
 * azi: emailul ajunge mereu la contul căruia îi aparține numele).
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Token-uri de brand comune tuturor email-urilor tranzacționale — culorile
 * sunt cele reale din `apps/web/src/app/globals.css` (`--primary`), nu
 * inventate, ca emailurile să semene vizual cu aplicația.
 */
const BRAND = {
  accent: '#5048e5',
  accentDark: '#4338ca',
  ink: '#111827',
  body: '#4b5563',
  muted: '#9ca3af',
  pageBg: '#f3f4f6',
  cardBg: '#ffffff',
  border: '#e5e7eb',
  fontStack: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
};

/**
 * Șasiul comun (tabele imbricate, nu div-uri) al oricărui email
 * tranzacțional — compatibil Outlook/Gmail/Apple Mail, care ignoră sau
 * randează greșit flexbox/grid și multe proprietăți CSS moderne. Fiecare
 * stil e inline (nu doar în `<style>`), pentru că majoritatea clienților
 * de email strip-uiesc `<style>`-ul din `<head>`.
 */
function renderEmailShell(input: { preheader: string; bodyHtml: string }): string {
  const year = new Date().getFullYear();
  return `
<!DOCTYPE html>
<html lang="ro" xmlns="http://www.w3.org/1999/xhtml">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta http-equiv="X-UA-Compatible" content="IE=edge" />
    <title>WorkSphere</title>
    <!--[if mso]>
    <noscript>
      <xml>
        <o:OfficeDocumentSettings>
          <o:PixelsPerInch>96</o:PixelsPerInch>
        </o:OfficeDocumentSettings>
      </xml>
    </noscript>
    <![endif]-->
    <style>
      body, table, td { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
      img { border: 0; line-height: 100%; outline: none; text-decoration: none; }
      table { border-collapse: collapse !important; }
      body { margin: 0; padding: 0; width: 100% !important; background-color: ${BRAND.pageBg}; }
      @media (max-width: 600px) {
        .ws-container { width: 100% !important; }
        .ws-px { padding-left: 24px !important; padding-right: 24px !important; }
      }
    </style>
  </head>
  <body style="margin:0; padding:0; background-color:${BRAND.pageBg};">
    <!-- Preheader: text-ul de previzualizare din inbox, invizibil în corpul emailului. -->
    <div style="display:none; max-height:0; overflow:hidden; mso-hide:all; font-size:1px; line-height:1px; color:${BRAND.pageBg};">
      ${input.preheader}
    </div>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${BRAND.pageBg};">
      <tr>
        <td align="center" style="padding: 40px 16px;">
          <table role="presentation" class="ws-container" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px; max-width:600px; background-color:${BRAND.cardBg}; border:1px solid ${BRAND.border}; border-radius:12px;">
            <!-- Header: logo -->
            <tr>
              <td align="center" style="padding: 32px 40px 8px;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="width:28px; height:28px; background-color:${BRAND.accent}; border-radius:8px; text-align:center; vertical-align:middle; font-family:${BRAND.fontStack}; font-size:15px; line-height:28px; color:#ffffff; font-weight:700;">
                      &#10003;
                    </td>
                    <td style="padding-left:10px; font-family:${BRAND.fontStack}; font-size:17px; font-weight:700; color:${BRAND.ink};">
                      WorkSphere
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Body -->
            <tr>
              <td class="ws-px" style="padding: 24px 40px 40px; font-family:${BRAND.fontStack};">
                ${input.bodyHtml}
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="padding: 24px 40px; border-top:1px solid ${BRAND.border};">
                <p style="margin:0 0 4px; font-family:${BRAND.fontStack}; font-size:12px; line-height:18px; color:${BRAND.muted};">
                  &copy; ${year} WorkSphere. Toate drepturile rezervate.
                </p>
                <p style="margin:0; font-family:${BRAND.fontStack}; font-size:12px; line-height:18px; color:${BRAND.muted};">
                  Acesta e un email automat — dacă ai nevoie de ajutor, scrie-ne la
                  <a href="mailto:suport@worksphere.ro" style="color:${BRAND.muted}; text-decoration:underline;">suport@worksphere.ro</a>.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`.trim();
}

/**
 * Buton "bulletproof" — `<a>` cu padding (nu `<button>`, nesuportat de
 * Outlook), plus un fallback VML pentru Outlook desktop (Word-engine-ul lui
 * ignoră `border-radius`/`padding` pe `<a>` fără el).
 */
function renderButton(label: string, href: string): string {
  return `
    <!--[if mso]>
    <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${href}" style="height:48px;v-text-anchor:middle;width:240px;" arcsize="12%" fillcolor="${BRAND.accent}" stroke="f">
      <w:anchorlock/>
      <center style="color:#ffffff; font-family:${BRAND.fontStack}; font-size:15px; font-weight:600;">${label}</center>
    </v:roundrect>
    <![endif]-->
    <!--[if !mso]><!-->
    <a href="${href}" target="_blank" style="background-color:${BRAND.accent}; border-radius:8px; color:#ffffff; display:inline-block; font-family:${BRAND.fontStack}; font-size:15px; font-weight:600; line-height:48px; text-align:center; text-decoration:none; width:240px; -webkit-text-size-adjust:none;">
      ${label}
    </a>
    <!--<![endif]-->`;
}

export interface WelcomeEmailInput {
  to: string;
  firstName: string;
  companyName: string;
}

/** Funcție pură — separată ca să poată fi testată fără rețea/cont Resend. */
export function buildWelcomeEmailHtml(input: WelcomeEmailInput): string {
  const firstName = escapeHtml(input.firstName);
  const companyName = escapeHtml(input.companyName);
  const bodyHtml = `
    <h1 style="margin:0 0 16px; font-size:22px; line-height:30px; color:${BRAND.ink}; font-weight:700;">
      Bine ai venit, ${firstName}!
    </h1>
    <p style="margin:0 0 16px; font-size:15px; line-height:24px; color:${BRAND.body};">
      Contul companiei <strong style="color:${BRAND.ink};">${companyName}</strong> a fost creat cu succes.
    </p>
    <p style="margin:0; font-size:15px; line-height:24px; color:${BRAND.body};">
      Ai 14 zile de trial gratuit ca să explorezi Angajați, Concedii, Proiecte, CRM, Inventar și Chat intern.
      Spor la treabă!
    </p>`;
  return renderEmailShell({
    preheader: `Contul companiei ${companyName} e gata — 14 zile de trial gratuit te așteaptă.`,
    bodyHtml,
  });
}

export interface PasswordResetEmailInput {
  to: string;
  firstName: string;
  resetUrl: string;
  /** Cât mai e valabil linkul, în minute — vine din backend (vezi AuthService), nu hardcodat aici. */
  expiresInMinutes: number;
}

/** Funcție pură — separată ca să poată fi testată fără rețea/cont Resend. */
export function buildPasswordResetEmailHtml(input: PasswordResetEmailInput): string {
  const firstName = escapeHtml(input.firstName);
  const bodyHtml = `
    <h1 style="margin:0 0 16px; font-size:22px; line-height:30px; color:${BRAND.ink}; font-weight:700;">
      Resetează-ți parola
    </h1>
    <p style="margin:0 0 24px; font-size:15px; line-height:24px; color:${BRAND.body};">
      Salut, ${firstName}. Am primit o cerere de resetare a parolei contului tău WorkSphere.
      Apasă pe butonul de mai jos ca să alegi o parolă nouă.
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;">
      <tr><td>${renderButton('Alege o parolă nouă', input.resetUrl)}</td></tr>
    </table>
    <p style="margin:0 0 8px; font-size:13px; line-height:20px; color:${BRAND.muted};">
      Dacă butonul nu funcționează, copiază acest link în browser:
    </p>
    <p style="margin:0 0 24px; font-size:13px; line-height:20px; word-break:break-all;">
      <a href="${input.resetUrl}" style="color:${BRAND.accentDark};">${input.resetUrl}</a>
    </p>
    <p style="margin:0; font-size:13px; line-height:20px; color:${BRAND.muted};">
      Linkul e valabil ${input.expiresInMinutes} de minute. Dacă nu ai cerut tu resetarea,
      poți ignora acest email în siguranță — parola ta rămâne neschimbată.
    </p>`;
  return renderEmailShell({
    preheader: `Am primit o cerere de resetare a parolei. Linkul e valabil ${input.expiresInMinutes} de minute.`,
    bodyHtml,
  });
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
