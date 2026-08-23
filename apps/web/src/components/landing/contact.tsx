'use client';

import * as React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, Loader2, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SectionHeading } from './section-heading';
import { Reveal } from './reveal';

const EASE_OUT = [0.23, 1, 0.32, 1] as const;

/**
 * Formular de contact — UI complet funcțional client-side; nu există încă
 * un endpoint backend de contact (necesită Resend/coadă email, vezi
 * `docs/ROADMAP.md`). Simulăm confirmarea local pentru a nu bloca UX-ul
 * paginii de prezentare pe integrarea de email.
 */
export function Contact() {
  const [submitted, setSubmitted] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setSubmitted(true);
    }, 600);
  };

  return (
    <section id="contact" className="py-24 sm:py-32">
      <div className="container max-w-2xl">
        <Reveal>
          <SectionHeading
            eyebrow="Contact"
            title="Ai întrebări? Scrie-ne"
            description="Răspundem în maxim 24 de ore lucrătoare."
          />
        </Reveal>

        <Reveal delay={0.1} className="mt-12 rounded-2xl border border-border bg-card p-8 shadow-sm">
          <AnimatePresence mode="wait" initial={false}>
          {submitted ? (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3, ease: EASE_OUT }}
              className="flex flex-col items-center gap-3 py-8 text-center"
            >
              <motion.div
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', duration: 0.5, bounce: 0.35, delay: 0.1 }}
              >
                <CheckCircle2 className="h-10 w-10 text-success" />
              </motion.div>
              <p className="font-medium">Mulțumim! Am primit mesajul tău.</p>
              <p className="text-sm text-muted-foreground">Te vom contacta în cel mai scurt timp.</p>
            </motion.div>
          ) : (
            <motion.form
              key="form"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onSubmit={handleSubmit}
              className="grid grid-cols-1 gap-5 sm:grid-cols-2"
            >
              <div className="space-y-2">
                <Label htmlFor="contact-name">Nume</Label>
                <Input id="contact-name" required placeholder="Numele tău" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contact-email">Email</Label>
                <Input id="contact-email" type="email" required placeholder="nume@companie.ro" />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="contact-company">Companie</Label>
                <Input id="contact-company" placeholder="Numele companiei" />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="contact-message">Mesaj</Label>
                <textarea
                  id="contact-message"
                  required
                  rows={4}
                  placeholder="Cu ce te putem ajuta?"
                  className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
              <Button type="submit" size="lg" className="sm:col-span-2" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                {loading ? 'Se trimite...' : 'Trimite mesajul'}
              </Button>
            </motion.form>
          )}
          </AnimatePresence>
        </Reveal>
      </div>
    </section>
  );
}
