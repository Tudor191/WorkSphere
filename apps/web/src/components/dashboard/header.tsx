'use client';

import { Menu } from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/components/providers/auth-provider';

export function Header({ onMenuClick }: { onMenuClick: () => void }) {
  const { user, logout } = useAuth();
  const initials = user ? `${user.firstName[0] ?? ''}${user.lastName[0] ?? ''}` : '?';

  return (
    <header className="flex h-16 items-center justify-between border-b border-border bg-background px-4 sm:px-6">
      <button className="rounded-md p-2 hover:bg-accent lg:hidden" onClick={onMenuClick} aria-label="Deschide meniul">
        <Menu className="h-5 w-5" />
      </button>

      <div className="hidden text-sm text-muted-foreground lg:block">{user?.companySlug ?? ''}</div>

      <div className="flex items-center gap-2">
        <ThemeToggle />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="ml-1 flex items-center gap-2 rounded-full">
              <Avatar>
                <AvatarFallback>{initials.toUpperCase()}</AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>
              {user?.firstName} {user?.lastName}
              <p className="font-normal text-muted-foreground">{user?.role}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => logout()}>Deconectare</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
