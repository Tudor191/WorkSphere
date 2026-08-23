'use client';

import * as React from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { Menu, X } from 'lucide-react';
import { Logo } from '@/components/logo';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const EASE_OUT = [0.23, 1, 0.32, 1] as const;

const links = [
  { href: '#beneficii', id: 'beneficii', label: 'Beneficii' },
  { href: '#functionalitati', id: 'functionalitati', label: 'Funcționalități' },
  { href: '#preturi', id: 'preturi', label: 'Prețuri' },
  { href: '#faq', id: 'faq', label: 'Întrebări' },
  { href: '#contact', id: 'contact', label: 'Contact' },
];
// Referință stabilă (calculată o singură dată, nu la fiecare randare) —
// `useActiveSection` o pasează ca dependență de efect; un array nou la
// fiecare randare (ex: `links.map(...)` inline) ar reconstrui
// IntersectionObserver-ul la fiecare scroll (`scrolled` schimbă starea des).
const sectionIds = links.map((l) => l.id);

/** True după ce pagina a fost scrolată suficient cât header-ul să merite un fundal solid. */
function useScrolled(threshold = 8) {
  const [scrolled, setScrolled] = React.useState(false);
  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > threshold);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [threshold]);
  return scrolled;
}

/** Secțiunea vizibilă curent, pe baza unei benzi orizontale în jurul centrului viewport-ului. */
function useActiveSection(ids: string[]) {
  const [active, setActive] = React.useState<string | null>(null);

  React.useEffect(() => {
    const elements = ids.map((id) => document.getElementById(id)).filter((el): el is HTMLElement => !!el);
    if (!elements.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: '-45% 0px -45% 0px', threshold: [0, 0.25, 0.5, 0.75, 1] },
    );
    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [ids]);

  return active;
}

export function Navbar() {
  const [open, setOpen] = React.useState(false);
  const scrolled = useScrolled();
  const activeSection = useActiveSection(sectionIds);

  return (
    <header
      className={cn(
        'sticky top-0 z-40 w-full border-b transition-colors duration-200',
        scrolled
          ? 'border-border/60 bg-background/80 shadow-sm backdrop-blur-lg'
          : 'border-transparent bg-transparent',
      )}
    >
      <div className="container flex h-16 items-center justify-between">
        <Link href="/" className="group">
          <motion.div whileHover={{ rotate: -4, scale: 1.04 }} transition={{ duration: 0.15, ease: 'easeOut' }}>
            <Logo />
          </motion.div>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className={cn(
                'relative rounded-full px-3.5 py-1.5 text-sm transition-colors',
                activeSection === link.id
                  ? 'text-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {activeSection === link.id && (
                <motion.span
                  layoutId="nav-active-pill"
                  className="absolute inset-0 rounded-full bg-accent"
                  transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                />
              )}
              <span className="relative">{link.label}</span>
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <ThemeToggle />
          <Button variant="ghost" asChild>
            <Link href="/login">Autentificare</Link>
          </Button>
          <Button asChild>
            <Link href="/register">Începe gratuit</Link>
          </Button>
        </div>

        <button className="p-2 md:hidden" aria-label="Meniu" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={open ? 'close' : 'open'}
              initial={{ opacity: 0, rotate: -45 }}
              animate={{ opacity: 1, rotate: 0 }}
              exit={{ opacity: 0, rotate: 45 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              className="block"
            >
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </motion.span>
          </AnimatePresence>
        </button>
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: EASE_OUT }}
            className="overflow-hidden border-t border-border bg-background md:hidden"
          >
            <nav className="flex flex-col gap-4 px-6 py-4">
              {links.map((link) => (
                <a key={link.href} href={link.href} className="text-sm" onClick={() => setOpen(false)}>
                  {link.label}
                </a>
              ))}
              <div className="mt-2 flex items-center gap-2">
                <Button variant="outline" className="flex-1" asChild>
                  <Link href="/login">Autentificare</Link>
                </Button>
                <Button className="flex-1" asChild>
                  <Link href="/register">Începe gratuit</Link>
                </Button>
              </div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
