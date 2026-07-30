import { cn } from '@/lib/utils';

export function Logo({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-2 font-semibold tracking-tight', className)}>
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="24" height="24" rx="7" className="fill-primary" />
        <path
          d="M7 12.5L10 16L17 8"
          stroke="hsl(var(--primary-foreground))"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span>WorkSphere</span>
    </div>
  );
}
