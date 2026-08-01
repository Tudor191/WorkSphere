'use client';

import * as React from 'react';
import { Bell, BellRing, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
  useRegisterDeviceToken,
  useUnreadNotificationsCount,
} from '@/hooks/use-notifications';
import { isPushConfigured, isPushSupportedByBrowser, onForegroundPush, requestPushToken } from '@/lib/push-notifications';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return 'acum';
  if (minutes < 60) return `acum ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `acum ${hours} h`;
  return new Date(iso).toLocaleDateString('ro-RO');
}

export function NotificationBell() {
  const queryClient = useQueryClient();
  const { data: notifications } = useNotifications();
  const { data: unread } = useUnreadNotificationsCount();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const registerDeviceToken = useRegisterDeviceToken();
  const [pushEnabled, setPushEnabled] = React.useState(false);
  const [pushError, setPushError] = React.useState<string | null>(null);

  const unreadCount = unread?.count ?? 0;
  // Deliberat NU verificăm și `Notification.permission !== 'granted'` aici —
  // permisiunea browserului acordată nu înseamnă că am reușit vreodată să
  // obținem și să înregistrăm un token FCM valid (poate eșua independent,
  // ex. probleme de configurare Firebase). Butonul rămâne disponibil ca să
  // poată fi reîncercat, indiferent de starea permisiunii.
  const canOfferPush = isPushConfigured && isPushSupportedByBrowser();

  React.useEffect(() => {
    return onForegroundPush(() => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const enablePush = async () => {
    setPushError(null);
    try {
      const token = await requestPushToken();
      if (token) {
        await registerDeviceToken.mutateAsync({ fcmToken: token, platform: 'web' });
        setPushEnabled(true);
      } else {
        setPushError(
          'Ai refuzat permisiunea de notificări a browserului — activeaz-o din setările site-ului dacă te răzgândești.',
        );
      }
    } catch (err) {
      setPushError(err instanceof Error ? err.message : 'Eroare la activarea notificărilor push.');
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="relative rounded-md p-2 hover:bg-accent" aria-label="Notificări">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between">
          Notificări
          {unreadCount > 0 && (
            <button
              className="flex items-center gap-1 text-xs font-normal text-muted-foreground hover:text-foreground"
              onClick={() => markAllRead.mutate()}
            >
              <Check className="h-3 w-3" />
              Marchează tot citit
            </button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {canOfferPush && !pushEnabled && (
          <>
            <DropdownMenuItem
              onSelect={(e) => {
                // Previne închiderea automată a meniului (comportamentul
                // implicit Radix la selecție) — altfel mesajul de eroare de
                // mai jos n-ar mai apuca să fie văzut niciodată.
                e.preventDefault();
                enablePush();
              }}
              className="gap-2"
            >
              <BellRing className="h-4 w-4" />
              Activează notificările push
            </DropdownMenuItem>
            {pushError && <p className="px-2 pb-2 text-xs text-destructive">{pushError}</p>}
            <DropdownMenuSeparator />
          </>
        )}

        <div className="max-h-80 overflow-y-auto">
          {(!notifications || notifications.length === 0) && (
            <p className="px-2 py-4 text-center text-sm text-muted-foreground">Nicio notificare încă.</p>
          )}
          {notifications?.map((n) => (
            <DropdownMenuItem
              key={n.id}
              className={cn('flex flex-col items-start gap-0.5 whitespace-normal', !n.isRead && 'bg-accent/50')}
              onClick={() => !n.isRead && markRead.mutate(n.id)}
            >
              <p className="text-sm font-medium">{n.title}</p>
              <p className="text-xs text-muted-foreground">{n.body}</p>
              <p className="text-[10px] text-muted-foreground">{timeAgo(n.createdAt)}</p>
            </DropdownMenuItem>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
