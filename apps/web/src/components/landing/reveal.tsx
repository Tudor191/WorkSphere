'use client';

import { motion, type Variants } from 'framer-motion';
import { cn } from '@/lib/utils';

const EASE_OUT = [0.23, 1, 0.32, 1] as const;

/**
 * Reveal la scroll, standardizat — orice secțiune care apare pe măsură ce
 * utilizatorul dă scroll folosește asta, în loc să reimplementeze aceleași
 * `initial`/`whileInView`/`transition` de fiecare dată. `once: true`:
 * conținutul intră o singură dată, nu reintră la fiecare scroll în sus/jos
 * peste el (ar deveni obositor pe o pagină lungă).
 */
export function Reveal({
  children,
  className,
  delay = 0,
  y = 20,
  duration = 0.5,
  as: Tag = 'div',
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  y?: number;
  duration?: number;
  as?: 'div' | 'li';
}) {
  const variants: Variants = {
    hidden: { opacity: 0, y },
    visible: { opacity: 1, y: 0, transition: { duration, delay, ease: EASE_OUT } },
  };

  const MotionTag = Tag === 'li' ? motion.li : motion.div;

  return (
    <MotionTag
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-80px' }}
      variants={variants}
      className={cn(className)}
    >
      {children}
    </MotionTag>
  );
}

/**
 * Container de stagger — copiii marcați cu variantele `revealItem` intră
 * eșalonat (30-80ms recomandat de skill-ul `animate`; 60ms aici) în loc de
 * toți deodată. Folosește asta când ai o listă de 3+ elemente similare.
 */
export const staggerContainer: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06 } },
};

export const revealItem: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE_OUT } },
};

export { EASE_OUT };
