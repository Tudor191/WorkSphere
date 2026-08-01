import { AsyncLocalStorage } from 'node:async_hooks';

export interface TenantStore {
  companyId: string;
  userId: string | null;
  roleId: string | null;
  /**
   * Setat doar de fluxul de impersonation al Super Admin-ului. Când e true,
   * `PrismaService` setează `app.bypass_rls = true` pentru tranzacția
   * curentă — folosit STRICT împreună cu o scriere obligatorie în
   * `AuditLog` (impusă de `PlatformImpersonationGuard`, nu opțională).
   */
  isPlatformBypass: boolean;
}

/**
 * Context per-request propagat prin AsyncLocalStorage — populat de
 * `TenantContextMiddleware` din JWT-ul cererii curente, citit de
 * `PrismaService` pentru a seta `app.current_company_id` la nivel de
 * conexiune Postgres (vezi migrația RLS). Evită să pasăm `companyId`
 * manual prin fiecare service/repository.
 */
export class TenantContext {
  private static readonly storage = new AsyncLocalStorage<TenantStore>();

  static run<T>(store: TenantStore, callback: () => T): T {
    return this.storage.run(store, callback);
  }

  static get(): TenantStore | undefined {
    return this.storage.getStore();
  }

  static requireCompanyId(): string {
    const store = this.storage.getStore();
    if (!store) {
      throw new Error(
        'TenantContext nu este inițializat — acest cod rulează în afara unei cereri HTTP autentificate.',
      );
    }
    return store.companyId;
  }

  /**
   * Escape hatch STRICT pentru fluxurile de autentificare (login/register/
   * refresh/Google OAuth), care trebuie să caute un `User` după email sau
   * un `RefreshToken` după hash înainte să existe orice context de tenant
   * (asta e literalmente ce stabilesc). Interogările permise sub bypass
   * trebuie să rămână "narrow" (egalitate exactă pe email/hash unic
   * global), niciodată liste filtrate doar parțial — altfel devine o gaură
   * de izolare reală. Nu folosi în afara `AuthService`.
   *
   * `BillingService` (webhook Stripe — nici un JWT, deci fără `companyId`
   * cunoscut dinainte) are aceeași nevoie, dar propriul lui escape hatch
   * (`runBypassingRls`, independent de `AsyncLocalStorage`) — vezi
   * comentariul de-acolo pentru motiv.
   */
  static runAsBypass<T>(callback: () => T): T {
    return this.storage.run(
      { companyId: '', userId: null, roleId: null, isPlatformBypass: true },
      callback,
    );
  }
}
