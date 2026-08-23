'use client';

import * as React from 'react';
import Link from 'next/link';
import { motion, useReducedMotion, useSpring } from 'framer-motion';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Magnetic } from '@/components/landing/magnetic';
import { AnimatedCounter } from '@/components/landing/animated-counter';
import { staggerContainer, revealItem } from '@/components/landing/reveal';

const highlights = ['Trial 14 zile, fără card', 'Setup în 5 minute', 'Anulezi oricând'];

const stats = [
  { label: 'Angajați activi', value: 128, tone: 'text-primary' },
  { label: 'Task-uri finalizate luna asta', value: 412, tone: 'text-success' },
  { label: 'Cereri de concediu în așteptare', value: 5, tone: 'text-warning' },
];

/** Înclinare 3D a panoului de previzualizare, spre cursor — vezi `Magnetic` pentru raționamentul gate-ului pe hover fin. */
function useTilt(strength = 8) {
  const ref = React.useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const rotateX = useSpring(0, { stiffness: 150, damping: 20 });
  const rotateY = useSpring(0, { stiffness: 150, damping: 20 });

  function onMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (reduceMotion || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    const rect = ref.current!.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    rotateY.set(px * strength);
    rotateX.set(-py * strength);
  }

  function onMouseLeave() {
    rotateX.set(0);
    rotateY.set(0);
  }

  return { ref, rotateX, rotateY, onMouseMove, onMouseLeave };
}

export function Hero() {
  const tilt = useTilt();

  return (
    <section className="relative overflow-hidden">
      <div className="bg-grid pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,black,transparent)]" />
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 h-[500px] w-[800px] -translate-x-1/2 animate-drift rounded-full bg-primary/20 blur-[120px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute right-0 top-40 h-[360px] w-[500px] animate-drift rounded-full bg-purple-400/15 blur-[110px] [animation-delay:-8s]"
      />

      <div className="container relative py-24 sm:py-32">
        <motion.div
          initial="hidden"
          animate="visible"
          variants={staggerContainer}
          className="mx-auto flex max-w-3xl flex-col items-center text-center"
        >
          <motion.div
            variants={revealItem}
            className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-sm text-muted-foreground shadow-sm"
          >
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
            </span>
            Construit pentru firmele din România
          </motion.div>

          <motion.h1
            variants={revealItem}
            className="font-landing-display text-balance text-4xl font-semibold tracking-tight sm:text-6xl"
          >
            Toată activitatea firmei tale,{' '}
            <span className="bg-gradient-to-r from-primary to-purple-400 bg-clip-text text-transparent">
              într-un singur loc
            </span>
          </motion.h1>

          <motion.p variants={revealItem} className="mt-6 max-w-xl text-balance text-lg text-muted-foreground">
            HR, pontaj, concedii, CRM, proiecte, chat intern și un AI assistant care cunoaște datele
            companiei tale. Mai puțin timp cu administrativul, mai mult timp cu ce contează.
          </motion.p>

          <motion.div variants={revealItem} className="mt-10 flex flex-col items-center gap-4 sm:flex-row">
            <Magnetic>
              <Button size="lg" asChild>
                <Link href="/register">
                  Începe trial-ul gratuit
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </Magnetic>
            <Button size="lg" variant="outline" asChild>
              <a href="#functionalitati">Vezi funcționalitățile</a>
            </Button>
          </motion.div>

          <motion.div
            variants={revealItem}
            className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground"
          >
            {highlights.map((h) => (
              <div key={h} className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-success" />
                {h}
              </div>
            ))}
          </motion.div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.35, ease: [0.23, 1, 0.32, 1] }}
          className="relative mx-auto mt-20 max-w-5xl [perspective:1200px]"
        >
          <motion.div
            ref={tilt.ref}
            onMouseMove={tilt.onMouseMove}
            onMouseLeave={tilt.onMouseLeave}
            style={{ rotateX: tilt.rotateX, rotateY: tilt.rotateY, transformStyle: 'preserve-3d' }}
            className="overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
          >
            <div className="flex items-center gap-1.5 border-b border-border bg-muted/50 px-4 py-3">
              <div className="h-3 w-3 rounded-full bg-destructive/60" />
              <div className="h-3 w-3 rounded-full bg-warning/60" />
              <div className="h-3 w-3 rounded-full bg-success/60" />
            </div>
            <div className="grid grid-cols-1 gap-px bg-border sm:grid-cols-3">
              {stats.map((stat) => (
                <div key={stat.label} className="bg-card p-6">
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <p className={`mt-2 text-3xl font-semibold ${stat.tone}`}>
                    <AnimatedCounter value={stat.value} />
                  </p>
                </div>
              ))}
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
