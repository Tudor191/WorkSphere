'use client';

import { motion } from 'framer-motion';
import { Star } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { SectionHeading } from './section-heading';

const testimonials = [
  {
    name: 'Andreea Munteanu',
    role: 'HR Manager, agenție de marketing (34 angajați)',
    quote:
      'Am renunțat la 3 fișiere Excel diferite pentru pontaj și concedii. Acum totul e într-un singur loc, iar aprobările se fac în câteva secunde.',
  },
  {
    name: 'Radu Constantin',
    role: 'Fondator, firmă de construcții (67 angajați)',
    quote:
      'AI Assistant-ul ne rezumă rapoartele lunare în câteva minute. Ce dura o zi întreagă contabilului nostru, acum durează 10 minute.',
  },
  {
    name: 'Ioana Dobre',
    role: 'Operations Lead, startup SaaS (18 angajați)',
    quote:
      'Am migrat de pe 4 unelte diferite. Onboarding-ul unui angajat nou a scăzut de la o zi la 20 de minute.',
  },
];

export function Testimonials() {
  return (
    <section className="py-24 sm:py-32">
      <div className="container">
        <SectionHeading
          eyebrow="Testimoniale"
          title="Firme din România care lucrează deja cu noi"
        />

        <div className="mt-16 grid grid-cols-1 gap-6 lg:grid-cols-3">
          {testimonials.map((t, i) => (
            <motion.div
              key={t.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="flex flex-col rounded-2xl border border-border bg-card p-6 shadow-sm"
            >
              <div className="flex gap-0.5 text-warning">
                {Array.from({ length: 5 }).map((_, idx) => (
                  <Star key={idx} className="h-4 w-4 fill-current" />
                ))}
              </div>
              <p className="mt-4 flex-1 text-sm text-foreground/90">&ldquo;{t.quote}&rdquo;</p>
              <div className="mt-6 flex items-center gap-3">
                <Avatar>
                  <AvatarFallback>
                    {t.name
                      .split(' ')
                      .map((n) => n[0])
                      .join('')}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium">{t.name}</p>
                  <p className="text-xs text-muted-foreground">{t.role}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
