import Link from 'next/link';
import { Logo } from '@/components/logo';

const columns = [
  {
    title: 'Produs',
    links: [
      { label: 'Funcționalități', href: '#functionalitati' },
      { label: 'Prețuri', href: '#preturi' },
      { label: 'Întrebări frecvente', href: '#faq' },
    ],
  },
  {
    title: 'Companie',
    links: [
      { label: 'Contact', href: '#contact' },
      { label: 'Termeni și condiții', href: '/legal/termeni' },
      { label: 'Politică de confidențialitate', href: '/legal/confidentialitate' },
    ],
  },
  {
    title: 'Cont',
    links: [
      { label: 'Autentificare', href: '/login' },
      { label: 'Creează cont', href: '/register' },
    ],
  },
];

export function Footer() {
  return (
    <footer className="border-t border-border py-16">
      <div className="container">
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
          <div className="col-span-2 sm:col-span-1">
            <Logo />
            <p className="mt-4 max-w-xs text-sm text-muted-foreground">
              Platforma SaaS care administrează activitatea firmei tale — HR, CRM, proiecte și AI, într-un
              singur loc.
            </p>
          </div>
          {columns.map((col) => (
            <div key={col.title}>
              <h4 className="text-sm font-semibold">{col.title}</h4>
              <ul className="mt-4 space-y-3">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <Link href={link.href} className="text-sm text-muted-foreground hover:text-foreground">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-border pt-8 sm:flex-row">
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} WorkSphere. Toate drepturile rezervate.
          </p>
          <p className="text-sm text-muted-foreground">Făcut cu grijă pentru firmele din România</p>
        </div>
      </div>
    </footer>
  );
}
