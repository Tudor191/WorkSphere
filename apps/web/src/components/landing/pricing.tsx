'use client';

import * as React from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { SectionHeading } from './section-heading';
import { Reveal } from './reveal';
import { Magnetic } from './magnetic';

const EASE_OUT = [0.23, 1, 0.32, 1] as const;

const plans = [
  {
    name: 'Basic',
    priceMonthly: 149,
    priceYearly: 1490,
    description: 'Pentru echipe mici care vor să scape de Excel și WhatsApp.',
    features: ['Până la 25 angajați', 'HR, Pontaj, Concedii', 'Proiecte & Task-uri', 'Suport pe email'],
    highlighted: false,
  },
  {
    name: 'Pro',
    priceMonthly: 349,
    priceYearly: 3490,
    description: 'Pentru firme care vor CRM, Inventar și AI Assistant.',
    features: [
      'Până la 100 angajați',
      'Tot din Basic',
      'CRM & Inventar',
      'Chat intern',
      'AI Assistant (RAG)',
      'Suport prioritar',
    ],
    highlighted: true,
  },
  {
    name: 'Enterprise',
    priceMonthly: null,
    priceYearly: null,
    description: 'Pentru firme cu peste 100 de angajați sau nevoi de integrare custom.',
    features: ['Angajați nelimitați', 'SLA dedicat', 'Integrări custom', 'Manager de cont dedicat'],
    highlighted: false,
  },
];

/** Preț care se derulează vertical la comutarea lunar/anual, în loc să sară instant. */
function PriceTag({ amount, yearly }: { amount: number; yearly: boolean }) {
  return (
    <span className="relative inline-grid overflow-hidden align-bottom [line-height:1]">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={`${amount}-${yearly}`}
          initial={{ y: 16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -16, opacity: 0 }}
          transition={{ duration: 0.2, ease: EASE_OUT }}
          className="col-start-1 row-start-1 text-4xl font-semibold"
        >
          {amount}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

export function Pricing() {
  const [yearly, setYearly] = React.useState(false);

  return (
    <section id="preturi" className="py-24 sm:py-32">
      <div className="container">
        <Reveal>
          <SectionHeading
            eyebrow="Prețuri"
            title="Simplu, transparent, fără costuri ascunse"
            description="14 zile trial gratuit pe orice plan. Nu ai nevoie de card pentru a începe."
          />
        </Reveal>

        <div className="mt-10 flex items-center justify-center gap-3">
          <span className={cn('text-sm', !yearly && 'font-medium text-foreground')}>Lunar</span>
          <Switch checked={yearly} onCheckedChange={setYearly} aria-label="Comută facturare anuală" />
          <span className={cn('text-sm', yearly && 'font-medium text-foreground')}>
            Anual <span className="text-success">(2 luni gratis)</span>
          </span>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-6 lg:grid-cols-3">
          {plans.map((plan, i) => (
            <Reveal
              key={plan.name}
              delay={i * 0.1}
              className={cn(
                'relative flex flex-col rounded-2xl border p-8 shadow-sm transition-all duration-200 hover:-translate-y-1',
                plan.highlighted
                  ? 'border-primary bg-card shadow-lg ring-1 ring-primary hover:shadow-xl'
                  : 'border-border bg-card hover:shadow-md',
              )}
            >
              {plan.highlighted && (
                <motion.span
                  initial={{ opacity: 0, y: -6 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.2, duration: 0.4, ease: EASE_OUT }}
                  className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground"
                >
                  Cel mai popular
                </motion.span>
              )}
              <h3 className="font-semibold">{plan.name}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{plan.description}</p>

              <div className="mt-6">
                {plan.priceMonthly ? (
                  <>
                    <PriceTag amount={yearly ? Math.round(plan.priceYearly! / 12) : plan.priceMonthly} yearly={yearly} />
                    <span className="text-muted-foreground"> RON/lună</span>
                    {yearly && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        facturat anual, {plan.priceYearly} RON/an
                      </p>
                    )}
                  </>
                ) : (
                  <span className="text-3xl font-semibold">La cerere</span>
                )}
              </div>

              <ul className="mt-6 flex-1 space-y-3">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                    {feature}
                  </li>
                ))}
              </ul>

              {plan.highlighted ? (
                <Magnetic strength={0.15}>
                  <Button className="mt-8" asChild>
                    <Link href="/register">Începe trial-ul gratuit</Link>
                  </Button>
                </Magnetic>
              ) : (
                <Button className="mt-8" variant="outline" asChild>
                  <Link href={plan.priceMonthly ? '/register' : '#contact'}>
                    {plan.priceMonthly ? 'Începe trial-ul gratuit' : 'Contactează-ne'}
                  </Link>
                </Button>
              )}
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
