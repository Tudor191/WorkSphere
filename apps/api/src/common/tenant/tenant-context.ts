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
   * Escape hatch STRICT — folosit doar de cod care trebuie să caute un rând
   * după un identificator unic global ÎNAINTE să existe vreun context de
   * tenant cunoscut:
   *   - `AuthService` (login/register/refresh/Google OAuth): caută un
   *     `User` după email sau un `RefreshToken` după hash.
   *   - `BillingService` (webhook Stripe): caută o `Subscription` după
   *     `stripeCustomerId`/`stripeSubscriptionId` — evenimentul vine de la
   *     Stripe, fără JWT, deci fără `companyId` cunoscut dinainte.
   * Interogările permise sub bypass trebuie să rămână "narrow" (egalitate
   * exactă pe un identificator unic global), niciodată liste filtrate doar
   * parțial — altfel devine o gaură de izolare reală. Nu extinde lista de
   * mai sus fără același raționament.
   */
  static runAsBypass<T>(callback: () => T): T {
    return this.storage.run(
      { companyId: '', userId: null, roleId: null, isPlatformBypass: true },
      callback,
    );
  }
}
