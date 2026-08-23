'use client';

import { Clock, ShieldCheck, Sparkles, TrendingUp } from 'lucide-react';
import { SectionHeading } from './section-heading';
import { Reveal } from './reveal';

const benefits = [
  {
    icon: Clock,
    title: 'Ore economisite săptămânal',
    description:
      'Pontaj, concedii și rapoarte automate — echipa ta scapă de fișierele Excel și emailurile pierdute.',
  },
  {
    icon: Sparkles,
    title: 'AI care cunoaște compania',
    description:
      'Întreabă „cine lipsește azi" sau „câte zile mai are Andrei" și primești răspunsul instant, pe baza datelor reale.',
  },
  {
    icon: ShieldCheck,
    title: 'Izolare completă a datelor',
    description:
      'Arhitectură multi-tenant cu izolare la nivel de bază de date — datele firmei tale nu ating niciodată altă companie.',
  },
  {
    icon: TrendingUp,
    title: 'Crește odată cu firma ta',
    description: 'De la 5 la 500 de angajați, fără să schimbi platforma sau să migrezi date.',
  },
];

export function Benefits() {
  return (
    <section id="beneficii" className="py-24 sm:py-32">
      <div className="container">
        <Reveal>
          <SectionHeading
            eyebrow="De ce WorkSphere"
            title="Mai puțin administrativ, mai multă claritate"
            description="Fiecare funcționalitate e gândită să reducă timpul pierdut cu sarcini repetitive."
          />
        </Reveal>

        <div className="mt-16 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {benefits.map((benefit, i) => (
            <Reveal
              key={benefit.title}
              delay={i * 0.08}
              className="group rounded-2xl border border-border bg-card p-6 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-md"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary transition-transform duration-200 group-hover:-rotate-6 group-hover:scale-110">
                <benefit.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-semibold">{benefit.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{benefit.description}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
