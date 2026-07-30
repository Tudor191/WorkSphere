'use client';

import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/components/providers/auth-provider';
import { useChangePassword, useUpdateProfile } from '@/hooks/use-account';
import { useSubscription, useUpdateSubscription } from '@/hooks/use-subscription';
import { ApiError } from '@/lib/api-client';

function centsToRon(cents: number) {
  return (cents / 100).toLocaleString('ro-RO', { minimumFractionDigits: 0 });
}

export default function AccountSettingsPage() {
  const { user, refreshProfile } = useAuth();
  const updateProfile = useUpdateProfile();
  const changePassword = useChangePassword();
  const {
    data: subscriptionData,
    isLoading: subscriptionLoading,
    error: subscriptionQueryError,
  } = useSubscription();
  const canManageBilling = !(subscriptionQueryError instanceof ApiError && subscriptionQueryError.status === 403);
  const updateSubscription = useUpdateSubscription();

  const [profileForm, setProfileForm] = React.useState({ firstName: '', lastName: '', email: '' });
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
      setProfileForm({ firstName: user.firstName, lastName: user.lastName, email: user.email });
    }
  }, [user]);

  const onSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileMessage(null);
    setProfileError(null);
    try {
      await updateProfile.mutateAsync(profileForm);
      await refreshProfile();
      setProfileMessage('Profil actualizat.');
    } catch (err) {
      setProfileError(err instanceof ApiError ? err.message : 'Eroare la salvare.');
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

  const onSelectPlan = async (planSlug: string) => {
    setPlanError(null);
    setPendingPlanSlug(planSlug);
    try {
      await updateSubscription.mutateAsync(planSlug);
    } catch (err) {
      setPlanError(err instanceof ApiError ? err.message : 'Eroare la schimbarea planului.');
    } finally {
      setPendingPlanSlug(null);
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

            {profileMessage && <p className="text-sm text-success">{profileMessage}</p>}
            {profileError && <p className="text-sm text-destructive">{profileError}</p>}

            <Button type="submit" disabled={updateProfile.isPending}>
              {updateProfile.isPending ? 'Se salvează...' : 'Salvează profilul'}
            </Button>
          </form>
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

          {canManageBilling && planError && <p className="text-sm text-destructive">{planError}</p>}

          {canManageBilling && (
            <>
              <div className="grid gap-4 sm:grid-cols-3">
                {subscriptionData?.plans.map((plan) => {
                  const isCurrent = subscriptionData.subscription?.plan.slug === plan.slug;
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
                        onClick={() => onSelectPlan(plan.slug)}
                      >
                        {isCurrent ? 'Plan activ' : pendingPlanSlug === plan.slug ? 'Se schimbă...' : 'Alege planul'}
                      </Button>
                    </div>
                  );
                })}
              </div>

              <p className="text-xs text-muted-foreground">
                Schimbarea planului e instantă, fără procesare de plată — facturarea Stripe reală
                urmează (vezi roadmap).
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
