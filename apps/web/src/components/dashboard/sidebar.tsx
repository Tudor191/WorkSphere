'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Building2, CalendarClock, Clock, LayoutDashboard, Settings, Users } from 'lucide-react';
import { Logo } from '@/components/logo';
import { usePendingLeaveRequestsCount } from '@/hooks/use-leave-requests';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { href: '/dashboard/employees', label: 'Angajați', icon: Users },
  { href: '/dashboard/departments', label: 'Departamente', icon: Building2 },
  { href: '/dashboard/leave-requests', label: 'Concedii', icon: CalendarClock },
  { href: '/dashboard/attendance', label: 'Pontaj', icon: Clock },
  { href: '/dashboard/settings', label: 'Setări', icon: Settings },
];

export function Sidebar({ className }: { className?: string }) {
  const pathname = usePathname();
  // 403 pentru cine nu poate aproba concedii — isError rămâne true, nu afișăm nimic.
  const { data: pending } = usePendingLeaveRequestsCount();
  const pendingCount = pending?.count ?? 0;

  return (
    <aside className={cn('flex h-full w-64 flex-col border-r border-border bg-card', className)}>
      <div className="flex h-16 items-center border-b border-border px-6">
        <Link href="/dashboard">
          <Logo />
        </Link>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-4">
        {navItems.map((item) => {
          const active = item.href === '/dashboard' ? pathname === item.href : pathname?.startsWith(item.href);
          const showBadge = item.href === '/dashboard/leave-requests' && pendingCount > 0;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                active
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
              )}
            >
              <item.icon className="h-4 w-4" />
              <span className="flex-1">{item.label}</span>
              {showBadge && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-xs font-semibold text-destructive-foreground">
                  {pendingCount > 9 ? '9+' : pendingCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border p-4 text-xs text-muted-foreground">
        WorkSphere — v0.1.0
      </div>
    </aside>
  );
}
