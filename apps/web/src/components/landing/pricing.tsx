'use client';

import * as React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { SectionHeading } from './section-heading';

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

export function Pricing() {
  const [yearly, setYearly] = React.useState(false);

  return (
    <section id="preturi" className="py-24 sm:py-32">
      <div className="container">
        <SectionHeading
          eyebrow="Prețuri"
          title="Simplu, transparent, fără costuri ascunse"
          description="14 zile trial gratuit pe orice plan. Nu ai nevoie de card pentru a începe."
        />

        <div className="mt-10 flex items-center justify-center gap-3">
          <span className={cn('text-sm', !yearly && 'font-medium text-foreground')}>Lunar</span>
          <Switch checked={yearly} onCheckedChange={setYearly} aria-label="Comută facturare anuală" />
          <span className={cn('text-sm', yearly && 'font-medium text-foreground')}>
            Anual <span className="text-success">(2 luni gratis)</span>
          </span>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-6 lg:grid-cols-3">
          {plans.map((plan, i) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className={cn(
                'relative flex flex-col rounded-2xl border p-8 shadow-sm',
                plan.highlighted ? 'border-primary bg-card shadow-lg ring-1 ring-primary' : 'border-border bg-card',
              )}
            >
              {plan.highlighted && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">
                  Cel mai popular
                </span>
              )}
              <h3 className="font-semibold">{plan.name}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{plan.description}</p>

              <div className="mt-6">
                {plan.priceMonthly ? (
                  <>
                    <span className="text-4xl font-semibold">
                      {yearly ? Math.round(plan.priceYearly! / 12) : plan.priceMonthly}
                    </span>
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

              <Button className="mt-8" variant={plan.highlighted ? 'default' : 'outline'} asChild>
                <Link href={plan.priceMonthly ? '/register' : '#contact'}>
                  {plan.priceMonthly ? 'Începe trial-ul gratuit' : 'Contactează-ne'}
                </Link>
              </Button>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
