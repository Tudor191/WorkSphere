import { Bricolage_Grotesque, Inter } from 'next/font/google';

/**
 * Încărcate STRICT pentru pagina principală (nu în `app/layout.tsx`) — restul
 * aplicației (dashboard) rămâne pe fallback-ul de sistem existent, ca să nu
 * schimbăm vizual nimic în afara paginii refăcute aici. `next/font/google`
 * auto-hostează fișierele la build (niciun request către Google la runtime).
 */
export const inter = Inter({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-inter',
  display: 'swap',
});

export const display = Bricolage_Grotesque({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-display',
  weight: ['500', '600', '700', '800'],
  display: 'swap',
});
