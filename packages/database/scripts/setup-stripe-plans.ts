import { config as loadEnv } from 'dotenv';
import path from 'node:path';

// Ordinea contează: primul `loadEnv()` ia DATABASE_URL din .env-ul acestui
// pachet; al doilea completează STRIPE_SECRET_KEY din apps/api/.env, FĂRĂ
// să suprascrie ce a fost deja setat (dotenv nu suprascrie implicit) — nu
// trebuie duplicată cheia Stripe în două fișiere .env.
loadEnv();
loadEnv({ path: path.resolve(__dirname, '../../../apps/api/.env') });

import Stripe from 'stripe';
import { PrismaClient } from '../prisma/generated/client';

const prisma = new PrismaClient();

/**
 * Creează în Stripe (test sau live, după cheia folosită) câte un Product +
 * două Price-uri (lunar/anual) pentru fiecare plan plătit din
 * `SubscriptionPlan`, apoi salvează ID-urile rezultate înapoi în DB
 * (`stripePriceIdMonthly`/`stripePriceIdYearly`) — fără ele, checkout-ul
 * din `BillingService` nu are ce plan Stripe să vândă.
 *
 * NU e idempotent: rulat de două ori creează produse/prețuri duplicate în
 * Stripe (nu există un "upsert după nume" în API-ul lor). Rulează o
 * singură dată per mediu (test vs. live); dacă trebuie refăcut, arhivează
 * manual produsele vechi din Dashboard mai întâi.
 */
async function main() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    console.error(
      'STRIPE_SECRET_KEY lipsește — pune cheia de test (sk_test_...) în apps/api/.env înainte de a rula acest script.',
    );
    process.exit(1);
  }
  const stripe = new Stripe(secretKey);

  const plans = await prisma.subscriptionPlan.findMany({
    where: { slug: { in: ['basic', 'pro'] }, isActive: true },
  });
  if (plans.length === 0) {
    console.log('Niciun plan "basic"/"pro" găsit — rulează pnpm db:seed întâi.');
    return;
  }

  for (const plan of plans) {
    const product = await stripe.products.create({ name: `WorkSphere — ${plan.name}` });
    const monthlyPrice = await stripe.prices.create({
      product: product.id,
      currency: plan.currency.toLowerCase(),
      unit_amount: plan.priceMonthlyCents,
      recurring: { interval: 'month' },
    });
    const yearlyPrice = await stripe.prices.create({
      product: product.id,
      currency: plan.currency.toLowerCase(),
      unit_amount: plan.priceYearlyCents,
      recurring: { interval: 'year' },
    });

    await prisma.subscriptionPlan.update({
      where: { id: plan.id },
      data: { stripePriceIdMonthly: monthlyPrice.id, stripePriceIdYearly: yearlyPrice.id },
    });

    console.log(`${plan.slug}: product=${product.id} monthly=${monthlyPrice.id} yearly=${yearlyPrice.id}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
