'use client';

import * as React from 'react';
import { animate, useInView, useReducedMotion } from 'framer-motion';

const EASE_OUT = [0.23, 1, 0.32, 1] as const;

/**
 * Numărătoare care „urcă" spre valoarea finală când intră în viewport —
 * pornește o singură dată (`once: true`), nu la fiecare scroll peste ea.
 * Scrie direct în `textContent` (nu re-randează React la fiecare frame) —
 * evită sute de re-render-uri pe durata animației, pentru un singur număr
 * care oricum nu are alt conținut interactiv de reconciliat.
 */
export function AnimatedCounter({
  value,
  suffix = '',
  duration = 1.2,
  className,
}: {
  value: number;
  suffix?: string;
  duration?: number;
  className?: string;
}) {
  const ref = React.useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-80px' });
  const reduceMotion = useReducedMotion();

  React.useEffect(() => {
    const node = ref.current;
    if (!node || !isInView) return;

    if (reduceMotion) {
      node.textContent = `${value}${suffix}`;
      return;
    }

    const controls = animate(0, value, {
      duration,
      ease: EASE_OUT,
      onUpdate(latest) {
        node.textContent = `${Math.round(latest)}${suffix}`;
      },
    });
    return () => controls.stop();
  }, [isInView, value, suffix, duration, reduceMotion]);

  return (
    <span ref={ref} className={className}>
      0{suffix}
    </span>
  );
}
