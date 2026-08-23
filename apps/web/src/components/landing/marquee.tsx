import { cn } from '@/lib/utils';

/**
 * Bandă orizontală în buclă continuă (CSS `animation`, nu Motion — rulează
 * off-thread, rămâne fluidă chiar dacă pagina e ocupată în altă parte; vezi
 * skill-ul `animate`, "CSS animation" pentru mișcare predeterminată). Se
 * oprește la hover, ca utilizatorul să poată citi un testimonial fără să
 * „fugă" de sub el. `prefers-reduced-motion` e gestionat global, în
 * `globals.css` (`.animate-marquee`).
 *
 * Conținutul se randează de două ori — a doua copie e STRICT vizuală
 * (`aria-hidden`), ca bucla să pară continuă fără gol; un cititor de ecran
 * vede lista o singură dată.
 */
export function Marquee({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'group relative overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]',
        className,
      )}
    >
      <div className="flex w-max animate-marquee gap-6 group-hover:[animation-play-state:paused] motion-reduce:animate-none">
        <div className="flex shrink-0 gap-6">{children}</div>
        <div className="flex shrink-0 gap-6" aria-hidden="true">
          {children}
        </div>
      </div>
    </div>
  );
}
