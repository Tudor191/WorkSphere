'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/components/providers/auth-provider';
import { useChangePassword, useUpdateProfile } from '@/hooks/use-account';
import { useCompany } from '@/hooks/use-company';
import { useNotificationPreferences, useUpdateNotificationPreferences } from '@/hooks/use-notifications';
import { useCreateCheckout, useCreatePortal, useSubscription, useUpdateSubscription } from '@/hooks/use-subscription';
import { ApiError } from '@/lib/api-client';
import type { SubscriptionPlan } from '@worksphere/shared-types';

function centsToRon(cents: number) {
  return (cents / 100).toLocaleString('ro-RO', { minimumFractionDigits: 0 });
}

export default function AccountSettingsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, refreshProfile } = useAuth();
  const { data: company } = useCompany();
  const updateProfile = useUpdateProfile();
  const changePassword = useChangePassword();
  const { data: notificationPreferences } = useNotificationPreferences();
  const updateNotificationPreferences = useUpdateNotificationPreferences();
  const {
    data: subscriptionData,
    isLoading: subscriptionLoading,
    error: subscriptionQueryError,
    refetch: refetchSubscription,
  } = useSubscription();
  const canManageBilling = !(subscriptionQueryError instanceof ApiError && subscriptionQueryError.status === 403);
  const updateSubscription = useUpdateSubscription();
  const createCheckout = useCreateCheckout();
  const createPortal = useCreatePortal();
  const [portalError, setPortalError] = React.useState<string | null>(null);
  const [checkoutNotice, setCheckoutNotice] = React.useState<'success' | 'canceled' | null>(null);
  const [planToConfirm, setPlanToConfirm] = React.useState<SubscriptionPlan | null>(null);

  // La întoarcerea din Stripe Checkout (`?checkout=success|canceled`): arată
  // un mesaj clar pe pagina noastră, apoi curăță URL-ul ca un refresh să nu
  // repete mesajul. Webhook-ul Stripe actualizează planul asincron, deci mai
  // dăm câteva refetch-uri la interval scurt, ca planul nou să apară fără
  // ca userul să trebuiască să reîmprospăteze manual pagina.
  React.useEffect(() => {
    const checkout = searchParams.get('checkout');
    if (checkout === 'success' || checkout === 'canceled') {
      setCheckoutNotice(checkout);
      router.replace('/dashboard/account');
    }
    if (checkout === 'success') {
      const timers = [1500, 3500, 6000].map((delay) => setTimeout(() => refetchSubscription(), delay));
      return () => timers.forEach(clearTimeout);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [profileForm, setProfileForm] = React.useState({ firstName: '', lastName: '', email: '', phone: '' });
  const [profileMessage, setProfileMessage] = React.useState<string | null>(null);
  const [profileError, setProfileError] = React.useState<string | null>(null);

  const [passwordForm, setPasswordForm] = React.useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [passwordMessage, setPasswordMessage] = React.useState<string | null>(null);
  const [passwordError, setPasswordError] = React.useState<string | null>(null);

  const [planError, setPlanError] = React.useState<string | null>(null);
  const [pendingPlanSlug, setPendingPlanSlug] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (user) {
      setProfileForm({
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone ?? '',
      });
    }
  }, [user]);

  const onSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileMessage(null);
    setProfileError(null);
    try {
      await updateProfile.mutateAsync({
        ...profileForm,
        phone: profileForm.phone.trim() || undefined,
      });
      await refreshProfile();
      setProfileMessage('Profil actualizat.');
    } catch (err) {
      setProfileError(err instanceof ApiError ? err.message : 'Eroare la salvare.');
    }
  };

  const [smsError, setSmsError] = React.useState<string | null>(null);
  const onToggleSms = async (checked: boolean) => {
    setSmsError(null);
    try {
      await updateNotificationPreferences.mutateAsync({ smsNotificationsEnabled: checked });
    } catch (err) {
      setSmsError(err instanceof ApiError ? err.message : 'Eroare la salvarea preferinței.');
    }
  };

  const onChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMessage(null);
    setPasswordError(null);
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('Parolele noi nu coincid.');
      return;
    }
    try {
      await changePassword.mutateAsync({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      setPasswordMessage('Parolă schimbată cu succes.');
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      setPasswordError(err instanceof ApiError ? err.message : 'Eroare la schimbarea parolei.');
    }
  };

  const onSelectPlan = async (plan: SubscriptionPlan, isPaid: boolean) => {
    setPlanError(null);
    if (isPaid) {
      // Nu redirecționăm direct — arătăm întâi datele firmei ca userul să
      // confirme că plătește pentru compania corectă, înainte de Stripe.
      setPlanToConfirm(plan);
      return;
    }
    setPendingPlanSlug(plan.slug);
    try {
      await updateSubscription.mutateAsync(plan.slug);
    } catch (err) {
      setPlanError(err instanceof ApiError ? err.message : 'Eroare la schimbarea planului.');
    } finally {
      setPendingPlanSlug(null);
    }
  };

  const confirmCheckout = async () => {
    if (!planToConfirm) return;
    setPlanError(null);
    setPendingPlanSlug(planToConfirm.slug);
    try {
      const { url } = await createCheckout.mutateAsync({ planSlug: planToConfirm.slug });
      window.location.href = url;
    } catch (err) {
      setPlanError(err instanceof ApiError ? err.message : 'Eroare la inițierea plății.');
      setPendingPlanSlug(null);
    }
  };

  const onManageBilling = async () => {
    setPortalError(null);
    try {
      const { url } = await createPortal.mutateAsync();
      window.location.href = url;
    } catch (err) {
      setPortalError(err instanceof ApiError ? err.message : 'Eroare la deschiderea portalului de facturare.');
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Setările contului</h1>
        <p className="text-sm text-muted-foreground">Profilul tău, securitatea și abonamentul companiei.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Profil</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSaveProfile} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Prenume</Label>
                <Input
                  value={profileForm.firstName}
                  onChange={(e) => setProfileForm((f) => ({ ...f, firstName: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Nume</Label>
                <Input
                  value={profileForm.lastName}
                  onChange={(e) => setProfileForm((f) => ({ ...f, lastName: e.target.value }))}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={profileForm.email}
                onChange={(e) => setProfileForm((f) => ({ ...f, email: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Telefon</Label>
              <Input
                type="tel"
                placeholder="+40712345678"
                value={profileForm.phone}
                onChange={(e) => setProfileForm((f) => ({ ...f, phone: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">
                Format internațional (+40...) — necesar ca să poți primi notificări prin SMS.
              </p>
            </div>

            {profileMessage && <p className="text-sm text-success">{profileMessage}</p>}
            {profileError && <p className="text-sm text-destructive">{profileError}</p>}

            <Button type="submit" disabled={updateProfile.isPending}>
              {updateProfile.isPending ? 'Se salvează...' : 'Salvează profilul'}
            </Button>
          </form>

          <div className="mt-6 flex items-center justify-between gap-2 border-t border-border pt-4">
            <div>
              <p className="text-sm font-medium">Notificări prin SMS</p>
              <p className="text-xs text-muted-foreground">
                {user?.phone
                  ? 'Primești SMS pentru evenimente importante (ex. aprobare/respingere concediu).'
                  : 'Setează mai întâi un număr de telefon mai sus ca să poți activa asta.'}
              </p>
            </div>
            <Switch
              checked={notificationPreferences?.smsNotificationsEnabled ?? false}
              disabled={
                !user?.phone || !notificationPreferences || updateNotificationPreferences.isPending
              }
              onCheckedChange={onToggleSms}
            />
          </div>
          {smsError && <p className="mt-2 text-sm text-destructive">{smsError}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Securitate</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onChangePassword} className="space-y-4">
            <div className="space-y-2">
              <Label>Parola curentă</Label>
              <Input
                type="password"
                value={passwordForm.currentPassword}
                onChange={(e) => setPasswordForm((f) => ({ ...f, currentPassword: e.target.value }))}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Parolă nouă</Label>
                <Input
                  type="password"
                  value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm((f) => ({ ...f, newPassword: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Confirmă parola nouă</Label>
                <Input
                  type="password"
                  value={passwordForm.confirmPassword}
                  onChange={(e) => setPasswordForm((f) => ({ ...f, confirmPassword: e.target.value }))}
                  required
                />
              </div>
            </div>

            {passwordMessage && <p className="text-sm text-success">{passwordMessage}</p>}
            {passwordError && <p className="text-sm text-destructive">{passwordError}</p>}

            <Button type="submit" disabled={changePassword.isPending}>
              {changePassword.isPending ? 'Se schimbă...' : 'Schimbă parola'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Abonament</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {checkoutNotice === 'success' && (
            <p className="rounded-lg bg-success/10 px-3 py-2 text-sm text-success">
              Plată reușită! Abonamentul se activează în câteva secunde — pagina se actualizează
              automat.
            </p>
          )}
          {checkoutNotice === 'canceled' && (
            <p className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
              Ai anulat procesul de plată — planul tău a rămas neschimbat. Poți relua oricând.
            </p>
          )}

          {!canManageBilling && (
            <p className="text-sm text-muted-foreground">
              Nu ai permisiunea de a vedea sau schimba abonamentul companiei — contactează un
              administrator.
            </p>
          )}

          {canManageBilling && subscriptionLoading && (
            <p className="text-sm text-muted-foreground">Se încarcă...</p>
          )}

          {canManageBilling && !subscriptionLoading && subscriptionData?.subscription && (
            <p className="text-sm text-muted-foreground">
              Plan curent:{' '}
              <span className="font-medium text-foreground">{subscriptionData.subscription.plan.name}</span>{' '}
              <Badge variant="secondary">{subscriptionData.subscription.status}</Badge>
            </p>
          )}

          {canManageBilling && (planError || portalError) && (
            <p className="text-sm text-destructive">{planError || portalError}</p>
          )}

          {canManageBilling && (
            <>
              <div className="grid gap-4 sm:grid-cols-3">
                {subscriptionData?.plans.map((plan) => {
                  const isCurrent = subscriptionData.subscription?.plan.slug === plan.slug;
                  const isPaid = plan.priceMonthlyCents > 0;
                  return (
                    <div key={plan.id} className="rounded-lg border border-border p-4">
                      <p className="font-medium">{plan.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {centsToRon(plan.priceMonthlyCents)} {plan.currency}/lună
                      </p>
                      <p className="text-xs text-muted-foreground">Max {plan.maxEmployees} angajați</p>
                      <Button
                        className="mt-3 w-full"
                        variant={isCurrent ? 'secondary' : 'outline'}
                        disabled={isCurrent || pendingPlanSlug === plan.slug}
                        onClick={() => onSelectPlan(plan, isPaid)}
                      >
                        {isCurrent
                          ? 'Plan activ'
                          : pendingPlanSlug === plan.slug
                            ? 'Se redirecționează...'
                            : isPaid
                              ? 'Abonează-te'
                              : 'Alege planul'}
                      </Button>
                    </div>
                  );
                })}
              </div>

              {subscriptionData?.subscription?.stripeCustomerId && (
                <Button variant="outline" onClick={onManageBilling} disabled={createPortal.isPending}>
                  {createPortal.isPending ? 'Se deschide...' : 'Gestionează facturarea'}
                </Button>
              )}

              <p className="text-xs text-muted-foreground">
                Planurile plătite se confirmă aici, apoi plata se face pe pagina securizată a
                Stripe.
              </p>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!planToConfirm} onOpenChange={(v) => !v && setPlanToConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmă abonarea</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs text-muted-foreground">Firma care va fi abonată</p>
              <p className="font-medium">{company?.name}</p>
              {company?.cui && <p className="text-xs text-muted-foreground">CUI: {company.cui}</p>}
              {company?.email && <p className="text-xs text-muted-foreground">{company.email}</p>}
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs text-muted-foreground">Plan ales</p>
              <p className="font-medium">{planToConfirm?.name}</p>
              {planToConfirm && (
                <p className="text-xs text-muted-foreground">
                  {centsToRon(planToConfirm.priceMonthlyCents)} {planToConfirm.currency}/lună
                </p>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              La pasul următor vei fi redirecționat pe pagina securizată de plată a Stripe.
            </p>
          </div>
          {planError && <p className="text-sm text-destructive">{planError}</p>}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPlanToConfirm(null)}>
              Anulează
            </Button>
            <Button onClick={confirmCheckout} disabled={createCheckout.isPending}>
              {createCheckout.isPending ? 'Se redirecționează...' : 'Continuă spre plată'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
