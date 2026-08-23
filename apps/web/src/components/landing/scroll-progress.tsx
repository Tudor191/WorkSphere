'use client';

import { motion, useScroll, useSpring } from 'framer-motion';

/**
 * Bară de progres a scroll-ului — nu e gate-uită pe `prefers-reduced-motion`:
 * mișcarea ei e derivată STRICT din scroll-ul propriu al utilizatorului (o
 * proprie acțiune), nu autoplay decorativ, la fel ca un scrollbar nativ.
 * Spring-ul doar o face să urmărească lin, nu introduce mișcare proprie.
 */
export function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 200, damping: 30, restDelta: 0.001 });

  return (
    <motion.div
      style={{ scaleX, transformOrigin: '0%' }}
      className="fixed inset-x-0 top-0 z-50 h-0.5 bg-gradient-to-r from-primary to-purple-400"
    />
  );
}
