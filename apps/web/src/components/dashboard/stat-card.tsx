import type { LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export function StatCard({
  label,
  value,
  icon: Icon,
  tone = 'default',
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  tone?: 'default' | 'success' | 'warning';
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-6">
        <div
          className={cn(
            'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl',
            tone === 'success' && 'bg-success/10 text-success',
            tone === 'warning' && 'bg-warning/10 text-warning',
            tone === 'default' && 'bg-primary/10 text-primary',
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-2xl font-semibold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
