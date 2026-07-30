import { cn } from '@/lib/utils';

export function SectionHeading({
  eyebrow,
  title,
  description,
  className,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  className?: string;
}) {
  return (
    <div className={cn('mx-auto max-w-2xl text-center', className)}>
      <p className="text-sm font-medium uppercase tracking-wider text-primary">{eyebrow}</p>
      <h2 className="mt-3 text-balance text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h2>
      {description && <p className="mt-4 text-balance text-muted-foreground">{description}</p>}
    </div>
  );
}
