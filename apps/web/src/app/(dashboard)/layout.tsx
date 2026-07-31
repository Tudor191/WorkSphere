'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/dashboard/sidebar';
import { Header } from '@/components/dashboard/header';
import { useAuth } from '@/components/providers/auth-provider';
import { cn } from '@/lib/utils';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading, sessionConflict } = useAuth();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = React.useState(false);

  React.useEffect(() => {
    if (!isLoading && !user) {
      router.replace(sessionConflict ? '/login?session=replaced' : '/login');
    } else if (!isLoading && user?.mustChangePassword) {
      router.replace('/set-password');
    }
  }, [isLoading, user, sessionConflict, router]);

  if (isLoading || !user || user.mustChangePassword) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Se încarcă...
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar className="hidden lg:flex" />

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <Sidebar className={cn('relative z-10 flex')} />
        </div>
      )}

      <div className="flex flex-1 flex-col overflow-hidden">
        <Header onMenuClick={() => setMobileOpen(true)} />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
