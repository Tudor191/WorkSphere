import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { App, cert, getApp, initializeApp } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';

const FIREBASE_APP_NAME = 'worksphere';

/**
 * Trimite push notifications prin Firebase Cloud Messaging. Fără cheile de
 * service account configurate, `sendToTokens` devine un no-op (loghează și
 * întoarce imediat) — notificările tot se salvează normal în tabelul
 * `Notification`, doar push-ul efectiv nu pleacă. Nicio metodă publică nu
 * aruncă dacă nu-i configurat: push-ul e un bonus, nu trebuie să strice
 * fluxul care îl declanșează (ex. aprobarea unei cereri de concediu).
 */
@Injectable()
export class FirebaseService {
  private readonly logger = new Logger(FirebaseService.name);
  private readonly app: App | null;

  constructor(config: ConfigService) {
    const projectId = config.get<string>('app.firebase.projectId') ?? '';
    const clientEmail = config.get<string>('app.firebase.clientEmail') ?? '';
    const privateKey = config.get<string>('app.firebase.privateKey') ?? '';

    if (!projectId || !clientEmail || !privateKey) {
      this.app = null;
      return;
    }

    try {
      this.app = initializeApp(
        { credential: cert({ projectId, clientEmail, privateKey }) },
        FIREBASE_APP_NAME,
      );
    } catch {
      // Deja inițializat (ex. hot-reload în dev) — refolosim instanța.
      this.app = getApp(FIREBASE_APP_NAME);
    }
  }

  get isConfigured(): boolean {
    return this.app !== null;
  }

  /**
   * Întoarce token-urile pe care Firebase le-a raportat ca nevalide/expirate — apelantul le poate șterge din DB.
   *
   * Trimitem STRICT `data` (niciun câmp `notification` la nivelul mesajului
   * FCM) — cu un payload `notification`, SDK-ul Firebase din service worker
   * afișează automat notificarea PE LÂNGĂ ce afișează manual handler-ul
   * nostru `onBackgroundMessage`, rezultând în 2 notificări native identice
   * pentru un singur mesaj (vezi `docs/ISSUES.md` #24 — nu era despre
   * token-uri duplicate, cum părea inițial). Cu payload strict `data`, doar
   * handler-ul nostru din `firebase-messaging-sw.js` afișează notificarea.
   */
  async sendToTokens(
    tokens: string[],
    notification: { title: string; body: string },
    data?: Record<string, string>,
  ): Promise<{ invalidTokens: string[] }> {
    if (!this.app || tokens.length === 0) return { invalidTokens: [] };

    try {
      const response = await getMessaging(this.app).sendEachForMulticast({
        tokens,
        data: { title: notification.title, body: notification.body, ...data },
      });
      const invalidTokens: string[] = [];
      response.responses.forEach((r, i) => {
        const code = r.error?.code;
        if (
          !r.success &&
          (code === 'messaging/registration-token-not-registered' ||
            code === 'messaging/invalid-registration-token')
        ) {
          invalidTokens.push(tokens[i]!);
        }
      });
      return { invalidTokens };
    } catch (error) {
      this.logger.warn(`Trimitere push eșuată: ${error instanceof Error ? error.message : error}`);
      return { invalidTokens: [] };
    }
  }
}
