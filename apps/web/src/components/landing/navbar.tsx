'use client';

import * as React from 'react';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';
import { Logo } from '@/components/logo';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';

const links = [
  { href: '#beneficii', label: 'Beneficii' },
  { href: '#functionalitati', label: 'Funcționalități' },
  { href: '#preturi', label: 'Prețuri' },
  { href: '#faq', label: 'Întrebări' },
  { href: '#contact', label: 'Contact' },
];

export function Navbar() {
  const [open, setOpen] = React.useState(false);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/80 backdrop-blur-lg">
      <div className="container flex h-16 items-center justify-between">
        <Link href="/">
          <Logo />
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {link.label}
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

        <button
          className="p-2 md:hidden"
          aria-label="Meniu"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div className="border-t border-border bg-background px-6 py-4 md:hidden">
          <nav className="flex flex-col gap-4">
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
        </div>
      )}
    </header>
  );
}
