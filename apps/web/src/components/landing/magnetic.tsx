'use client';

import * as React from 'react';
import { motion, useMotionValue, useSpring, useReducedMotion } from 'framer-motion';

/**
 * Înfășoară un CTA ca acesta să „tragă" ușor spre cursor — gest decorativ,
 * permis DOAR pentru elemente rare/prima-întâlnire (CTA-urile principale ale
 * unei pagini de prezentare, văzute o dată per vizită, nu de zeci de ori pe
 * zi — vezi treapta "Delight" din skill-ul `animate`). Spring, nu tranziție
 * cu durată fixă: gestul e întrerupt/reluat constant la fiecare mișcare a
 * mouse-ului, iar un spring duce viteza mai departe corect prin întrerupere.
 * Gate-uit pe `(hover: hover) and (pointer: fine)` — pe touch, mousemove nu
 * are sens, ar da doar un jitter la tap.
 */
export function Magnetic({ children, strength = 0.3 }: { children: React.ReactNode; strength?: number }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, { stiffness: 150, damping: 15, mass: 0.4 });
  const springY = useSpring(y, { stiffness: 150, damping: 15, mass: 0.4 });

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (reduceMotion || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    const rect = ref.current!.getBoundingClientRect();
    x.set((e.clientX - rect.left - rect.width / 2) * strength);
    y.set((e.clientY - rect.top - rect.height / 2) * strength);
  }

  function handleMouseLeave() {
    x.set(0);
    y.set(0);
  }

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ x: springX, y: springY }}
      className="inline-block"
    >
      {children}
    </motion.div>
  );
}
