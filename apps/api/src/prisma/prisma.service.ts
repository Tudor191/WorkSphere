import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@worksphere/database';
import { TenantContext } from '../common/tenant/tenant-context';

/**
 * Client Prisma cu izolare multi-tenant automată.
 *
 * De ce `$transaction` pentru fiecare operație (nu doar un `WHERE`
 * injectat): PostgreSQL Row Level Security se bazează pe variabila de
 * sesiune `app.current_company_id`, setată prin `SET LOCAL` — care e
 * valabilă STRICT în cadrul unei singure tranzacții. Prisma nu garantează
 * că două apeluri consecutive (`SET LOCAL` + query-ul propriu-zis) refolosesc
 * aceeași conexiune din pool dacă nu sunt explicit grupate într-o
 * tranzacție. De aceea fiecare operație e automat împachetată într-un
 * `$transaction([setConfig, query])` — cost: un round-trip suplimentar per
 * query, acceptabil pentru un strat de siguranță (filtrarea principală,
 * din motive de performanță, tot se face explicit din service-uri cu
 * `where: { companyId }`).
 *
 * Pentru operații de business care necesită mai mulți pași atomici (ex:
 * aprobare cerere de concediu + scădere sold), NU folosi `$transaction`
 * direct pe acest client — folosește `runInTenantTransaction()`, care
 * setează contextul de tenant o singură dată la începutul tranzacției și
 * oferă un client `tx` pe care rulează toți pașii.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  readonly tenantScoped: PrismaClient;

  constructor(config: ConfigService) {
    // IMPORTANT: `datasourceUrl` e trecut explicit (nu lăsăm Prisma să
    // rezolve `env("DATABASE_URL")` singur). Motiv: clientul generat în
    // `@worksphere/database` își încarcă la require() propriul `.env` din
    // directorul acelui pachet (folosit pentru comenzi CLI Prisma directe,
    // ex. `prisma migrate`) — acel `.env` conține conexiunea superuser
    // folosită doar pentru operații de schema. Dacă acel superuser ajunge
    // să fie conexiunea reală a API-ului, RLS e complet bypass-uit
    // silențios (superuserii ocolesc RLS necondiționat). Citind explicit
    // din `ConfigService` (care încarcă `.env`-ul APLICAȚIEI, cu rolul
    // limitat `worksphere_app`), eliminăm orice ambiguitate.
    super({
      datasourceUrl: config.get<string>('app.databaseUrl'),
      log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    });

    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const base = this;
    this.tenantScoped = this.$extends({
      query: {
        $allModels: {
          async $allOperations({ args, query }) {
            const store = TenantContext.get();
            if (!store) {
              // Nicio cerere HTTP autentificată în context (ex: seed, cron
              // de sistem) — rulează fără SET LOCAL; RLS blochează implicit
              // orice tabel tenant-scoped dacă rolul de conexiune nu e
              // superuser (fail-closed).
              return query(args);
            }
            const [, result] = await base.$transaction([
              base.$executeRaw`SELECT set_config('app.current_company_id', ${store.companyId}, TRUE),
                                       set_config('app.bypass_rls', ${store.isPlatformBypass ? 'true' : 'false'}, TRUE)`,
              query(args),
            ]);
            return result;
          },
        },
      },
    }) as unknown as PrismaClient;
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Conectat la PostgreSQL.');
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  /**
   * Escape hatch pentru operații care traversează DELIBERAT granița de
   * tenant, pe un identificator unic GLOBAL (nu per-companie) — ex.
   * webhook Stripe (fără JWT, deci fără `companyId` cunoscut — vezi
   * `BillingService`), sau un `fcmToken` de device push care se poate
   * realoca legitim între companii diferite (același browser/dispozitiv
   * folosit succesiv pentru conturi din companii diferite — vezi
   * `NotificationsService.registerDeviceToken`, unde RLS blochează corect
   * un UPDATE in-place peste un rând al altei companii, pentru că nu-l
   * poate "vedea"). Interogările din `fn` trebuie să rămână "narrow"
   * (egalitate exactă pe un identificator unic global), niciodată liste
   * filtrate doar parțial — altfel devine o gaură de izolare reală.
   *
   * Folosește tranzacția interactivă a Prisma (`$transaction(async tx =>
   * ...)`, garantat aceeași conexiune), NU `this.tenantScoped` +
   * `TenantContext.runAsBypass` — acela se bazează pe `$transaction`
   * "array-form" (`$transaction([setConfig, query])`), care în practică nu
   * a produs mereu efectul așteptat pentru operații în afara fluxului de
   * auth (motivul exact rămâne neclar; forma interactivă de mai jos s-a
   * dovedit fiabilă în ambele cazuri găsite până acum — webhook Stripe și
   * device tokens).
   */
  async runBypassingRls<T>(
    fn: (
      tx: Omit<
        PrismaClient,
        '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
      >,
    ) => Promise<T>,
  ): Promise<T> {
    return this.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.bypass_rls', 'true', TRUE)`;
      return fn(tx);
    });
  }

  /**
   * Rulează un set de operații într-o singură tranzacție, cu contextul de
   * tenant setat o singură dată la început. Folosește asta pentru orice
   * mutație multi-pas care trebuie să fie atomică (ex: aprobare concediu).
   */
  async runInTenantTransaction<T>(
    callback: (
      tx: Omit<
        PrismaClient,
        '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
      >,
    ) => Promise<T>,
  ): Promise<T> {
    const store = TenantContext.get();
    return this.$transaction(async (tx) => {
      if (store) {
        await tx.$executeRaw`SELECT set_config('app.current_company_id', ${store.companyId}, TRUE),
                                     set_config('app.bypass_rls', ${store.isPlatformBypass ? 'true' : 'false'}, TRUE)`;
      }
      return callback(tx);
    });
  }
}
