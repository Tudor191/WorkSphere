import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { PrismaClient, SubscriptionStatus } from '@worksphere/database';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../common/tenant/tenant-context';
import { CreateCheckoutDto } from './dto/create-checkout.dto';

/** Stripe folosește string-uri proprii de status — mapate explicit, nu 1:1 cu enumul nostru. */
const STRIPE_STATUS_MAP: Record<string, SubscriptionStatus> = {
  trialing: 'TRIALING',
  active: 'ACTIVE',
  past_due: 'PAST_DUE',
  canceled: 'CANCELED',
  unpaid: 'PAST_DUE',
  incomplete: 'INCOMPLETE',
  incomplete_expired: 'CANCELED',
  paused: 'CANCELED',
};

/** Timestamp unix (secunde) → `Date`, sau `undefined` dacă lipsește/e invalid — nu lasă niciodată un "Invalid Date" să ajungă la Prisma. */
function toSafeDate(unixSeconds: number | null | undefined): Date | undefined {
  if (unixSeconds == null || Number.isNaN(unixSeconds)) return undefined;
  const date = new Date(unixSeconds * 1000);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);
  private readonly client: Stripe | null;
  private readonly webhookSecret: string;
  private readonly frontendUrl: string;

  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const secretKey = config.get<string>('app.stripe.secretKey') ?? '';
    this.webhookSecret = config.get<string>('app.stripe.webhookSecret') ?? '';
    this.frontendUrl = config.get<string>('app.frontendUrl') ?? 'http://localhost:3000';
    // La fel ca la AiService — fără cheie, clientul rămâne `null` și fiecare
    // metodă publică respinge clar cu 503, în loc să lase SDK-ul Stripe să
    // eșueze criptic sau aplicația să crape la boot.
    this.client = secretKey ? new Stripe(secretKey) : null;
  }

  private requireClient(): Stripe {
    if (!this.client) {
      throw new ServiceUnavailableException(
        'Facturarea Stripe nu este configurată — lipsește STRIPE_SECRET_KEY pe server.',
      );
    }
    return this.client;
  }

  async createCheckoutSession(dto: CreateCheckoutDto) {
    const stripe = this.requireClient();
    const companyId = TenantContext.requireCompanyId();

    const plan = await this.prisma.subscriptionPlan.findUnique({ where: { slug: dto.planSlug } });
    if (!plan) throw new BadRequestException('Plan inexistent.');

    const cycle = dto.billingCycle ?? 'MONTHLY';
    const priceId = cycle === 'YEARLY' ? plan.stripePriceIdYearly : plan.stripePriceIdMonthly;
    if (!priceId) {
      throw new BadRequestException(
        `Planul „${plan.name}” nu are un preț Stripe configurat pentru ciclul ${cycle} — rulează scriptul de setup (packages/database/scripts/setup-stripe-plans.ts) întâi.`,
      );
    }

    const subscription = await this.prisma.tenantScoped.subscription.findUniqueOrThrow({
      where: { companyId },
      include: { company: true },
    });

    let stripeCustomerId = subscription.stripeCustomerId;
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        name: subscription.company.name,
        email: subscription.company.email ?? undefined,
        metadata: { companyId },
      });
      stripeCustomerId = customer.id;
      await this.prisma.tenantScoped.subscription.update({
        where: { companyId },
        data: { stripeCustomerId },
      });
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: stripeCustomerId,
      line_items: [{ price: priceId, quantity: 1 }],
      // /dashboard/account, NU /dashboard/settings (aceea e "Setări companie",
      // o pagină diferită) — acolo trăiește selectorul de plan.
      success_url: `${this.frontendUrl}/dashboard/account?checkout=success`,
      cancel_url: `${this.frontendUrl}/dashboard/account?checkout=canceled`,
      // Redundant față de `stripeCustomerId` (deja unic per companie), dar
      // webhook-ul îl citește ca a doua sursă de adevăr — vezi
      // `resolveCompanyId` mai jos.
      subscription_data: { metadata: { companyId } },
    });

    if (!session.url) {
      throw new ServiceUnavailableException('Stripe nu a putut genera un link de checkout.');
    }
    return { url: session.url };
  }

  async createPortalSession() {
    const stripe = this.requireClient();
    const companyId = TenantContext.requireCompanyId();

    const subscription = await this.prisma.tenantScoped.subscription.findUniqueOrThrow({
      where: { companyId },
    });
    if (!subscription.stripeCustomerId) {
      throw new BadRequestException(
        'Nu există niciun cont de facturare Stripe încă — abonează-te la un plan plătit întâi.',
      );
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: subscription.stripeCustomerId,
      return_url: `${this.frontendUrl}/dashboard/account`,
    });
    return { url: session.url };
  }

  constructEvent(rawBody: Buffer, signature: string): Stripe.Event {
    const stripe = this.requireClient();
    if (!this.webhookSecret) {
      throw new ServiceUnavailableException('STRIPE_WEBHOOK_SECRET nu este configurat pe server.');
    }
    return stripe.webhooks.constructEvent(rawBody, signature, this.webhookSecret);
  }

  /**
   * Evenimentul vine direct de la Stripe, fără JWT — niciun `TenantContext`
   * nu există la acest punct. `runBypassingRls` (mai jos) e escape hatch-ul
   * pentru asta: căutări "narrow", după un identificator unic global
   * (`stripeCustomerId`/`stripeSubscriptionId`), niciodată liste.
   */
  async handleEvent(event: Stripe.Event): Promise<void> {
    switch (event.type) {
      case 'checkout.session.completed':
        await this.onCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        await this.onSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;
      case 'invoice.paid':
      case 'invoice.payment_failed':
        await this.onInvoiceEvent(event.data.object as Stripe.Invoice);
        break;
      default:
        this.logger.debug(`Eveniment Stripe ignorat: ${event.type}`);
    }
  }

  private async onCheckoutCompleted(session: Stripe.Checkout.Session) {
    const stripe = this.requireClient();
    if (!session.subscription || !session.customer) return;
    const stripeSubscriptionId =
      typeof session.subscription === 'string' ? session.subscription : session.subscription.id;
    const stripeSubscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
    await this.syncSubscription(stripeSubscription);
  }

  private async onSubscriptionUpdated(stripeSubscription: Stripe.Subscription) {
    await this.syncSubscription(stripeSubscription);
  }

  private async syncSubscription(stripeSubscription: Stripe.Subscription) {
    const companyId = await this.resolveCompanyId(stripeSubscription);
    if (!companyId) {
      this.logger.warn(`Nu am găsit nicio companie pentru subscription Stripe ${stripeSubscription.id}.`);
      return;
    }

    const priceId = stripeSubscription.items.data[0]?.price?.id;
    const plan = priceId
      ? await this.prisma.subscriptionPlan.findFirst({
          where: { OR: [{ stripePriceIdMonthly: priceId }, { stripePriceIdYearly: priceId }] },
        })
      : null;

    // Stripe a mutat `current_period_start`/`end` de pe Subscription pe
    // fiecare SubscriptionItem în versiuni de API mai noi — citim ambele
    // locuri, ca să funcționeze indiferent de versiunea API a contului
    // Stripe folosit. `toSafeDate` respinge explicit valori absente/invalide
    // în loc să lase un "Invalid Date" să ajungă la Prisma (ar arunca la
    // scriere, exact genul de eroare care apărea ca 500 pe webhook).
    const item = stripeSubscription.items.data[0];
    const legacyPeriod = stripeSubscription as unknown as {
      current_period_start?: number;
      current_period_end?: number;
    };
    const periodStartUnix = item?.current_period_start ?? legacyPeriod.current_period_start;
    const periodEndUnix = item?.current_period_end ?? legacyPeriod.current_period_end;

    // `updateMany` în loc de `update` — nu aruncă dacă 0 rânduri se
    // potrivesc (spre deosebire de `update`, care ar arunca P2025 exact
    // aici dacă `companyId` rezolvat nu se potrivește cu niciun rând).
    // Logăm explicit rezultatul, ca să distingem clar "nu s-a găsit nimic"
    // de o reușită reală, în loc să lăsăm un webhook Stripe să pice cu 500
    // pe o eroare opacă.
    const count = await this.runBypassingRls((tx) =>
      tx.subscription.updateMany({
        where: { companyId },
        data: {
          stripeSubscriptionId: stripeSubscription.id,
          status: STRIPE_STATUS_MAP[stripeSubscription.status] ?? 'INCOMPLETE',
          ...(plan ? { planId: plan.id } : {}),
          currentPeriodStart: toSafeDate(periodStartUnix),
          currentPeriodEnd: toSafeDate(periodEndUnix),
          cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
        },
      }).then((r) => r.count),
    );
    if (count === 0) {
      this.logger.warn(
        `Subscription Stripe ${stripeSubscription.id}: companyId rezolvat (${companyId}) nu se potrivește cu niciun rând din tabela subscriptions.`,
      );
    }
  }

  private async onInvoiceEvent(invoice: Stripe.Invoice) {
    if (!invoice.customer) return;
    const stripeCustomerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer.id;

    await this.runBypassingRls(async (tx) => {
      const subscription = await tx.subscription.findFirst({ where: { stripeCustomerId } });
      if (!subscription) {
        this.logger.warn(`Nu am găsit nicio companie pentru customer Stripe ${stripeCustomerId}.`);
        return;
      }
      await tx.invoice.upsert({
        where: { stripeInvoiceId: invoice.id ?? '' },
        create: {
          companyId: subscription.companyId,
          stripeInvoiceId: invoice.id,
          amountCents: invoice.amount_paid || invoice.amount_due,
          currency: invoice.currency.toUpperCase(),
          status: invoice.status ?? 'unknown',
          pdfUrl: invoice.invoice_pdf ?? undefined,
          issuedAt: toSafeDate(invoice.created) ?? new Date(),
        },
        update: {
          status: invoice.status ?? 'unknown',
          pdfUrl: invoice.invoice_pdf ?? undefined,
        },
      });
    });
  }

  /** Metadata de pe subscription (setată la checkout) e sursa principală; fallback pe stripeCustomerId. */
  private async resolveCompanyId(stripeSubscription: Stripe.Subscription): Promise<string | null> {
    const metadataCompanyId = stripeSubscription.metadata?.companyId;
    if (metadataCompanyId) return metadataCompanyId;

    const stripeCustomerId =
      typeof stripeSubscription.customer === 'string'
        ? stripeSubscription.customer
        : stripeSubscription.customer.id;
    const subscription = await this.runBypassingRls((tx) =>
      tx.subscription.findFirst({ where: { stripeCustomerId } }),
    );
    return subscription?.companyId ?? null;
  }

  /**
   * Escape hatch propriu al `BillingService` — independent de
   * `TenantContext.runAsBypass` + `this.prisma.tenantScoped` (care se
   * bazează pe `AsyncLocalStorage` + `$transaction` array-form; pentru
   * motive neclare, acel mecanism nu producea efectul așteptat aici).
   * Folosește tranzacția interactivă a Prisma (`$transaction(async tx =>
   * ...)`, garantat aceeași conexiune) și setează manual, explicit,
   * `app.bypass_rls = true` înainte de orice interogare — STRICT pentru
   * webhook-ul Stripe (fără JWT, fără `companyId` cunoscut dinainte).
   * Căutările rămase permise sub acest bypass trebuie să rămână "narrow"
   * (egalitate exactă pe un identificator unic global), niciodată liste.
   */
  private async runBypassingRls<T>(
    fn: (
      tx: Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>,
    ) => Promise<T>,
  ): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.bypass_rls', 'true', TRUE)`;
      return fn(tx);
    });
  }
}
