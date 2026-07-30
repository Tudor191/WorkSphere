'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

const highlights = ['Trial 14 zile, fără card', 'Setup în 5 minute', 'Anulezi oricând'];

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="bg-grid pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,black,transparent)]" />
      <div className="pointer-events-none absolute left-1/2 top-0 h-[500px] w-[800px] -translate-x-1/2 rounded-full bg-primary/20 blur-[120px]" />

      <div className="container relative py-24 sm:py-32">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mx-auto flex max-w-3xl flex-col items-center text-center"
        >
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-sm text-muted-foreground shadow-sm">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
            </span>
            Construit pentru firmele din România
          </div>

          <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-6xl">
            Toată activitatea firmei tale,{' '}
            <span className="bg-gradient-to-r from-primary to-purple-400 bg-clip-text text-transparent">
              într-un singur loc
            </span>
          </h1>

          <p className="mt-6 max-w-xl text-balance text-lg text-muted-foreground">
            HR, pontaj, concedii, CRM, proiecte, chat intern și un AI assistant care cunoaște datele
            companiei tale. Mai puțin timp cu administrativul, mai mult timp cu ce contează.
          </p>

          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row">
            <Button size="lg" asChild>
              <Link href="/register">
                Începe trial-ul gratuit
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <a href="#functionalitati">Vezi funcționalitățile</a>
            </Button>
          </div>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
            {highlights.map((h) => (
              <div key={h} className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-success" />
                {h}
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="relative mx-auto mt-20 max-w-5xl"
        >
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
            <div className="flex items-center gap-1.5 border-b border-border bg-muted/50 px-4 py-3">
              <div className="h-3 w-3 rounded-full bg-destructive/60" />
              <div className="h-3 w-3 rounded-full bg-warning/60" />
              <div className="h-3 w-3 rounded-full bg-success/60" />
            </div>
            <div className="grid grid-cols-1 gap-px bg-border sm:grid-cols-3">
              {[
                { label: 'Angajați activi', value: '128', tone: 'text-primary' },
                { label: 'Task-uri finalizate luna asta', value: '412', tone: 'text-success' },
                { label: 'Cereri de concediu în așteptare', value: '5', tone: 'text-warning' },
              ].map((stat) => (
                <div key={stat.label} className="bg-card p-6">
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <p className={`mt-2 text-3xl font-semibold ${stat.tone}`}>{stat.value}</p>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
