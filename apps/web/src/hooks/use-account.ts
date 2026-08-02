import { useMutation } from '@tanstack/react-query';
import type { AuthUser, ForgotPasswordInput, ResetPasswordInput } from '@worksphere/shared-types';
import { apiFetch } from '@/lib/api-client';

export interface UpdateProfileInput {
  firstName?: string;
  lastName?: string;
  email?: string;
  /** `null` explicit șterge numărul salvat — `undefined` (câmp omis) lasă valoarea neschimbată. */
  phone?: string | null;
}

export function useUpdateProfile() {
  return useMutation({
    mutationFn: (input: UpdateProfileInput) =>
      apiFetch<AuthUser>('/auth/me', { method: 'PATCH', body: JSON.stringify(input) }),
  });
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (input: ChangePasswordInput) =>
      apiFetch<void>('/auth/change-password', { method: 'POST', body: JSON.stringify(input) }),
  });
}

/** Ecranul obligatoriu de la prima autentificare cu parolă temporară — nu cere parola veche. */
export function useSetPassword() {
  return useMutation({
    mutationFn: (newPassword: string) =>
      apiFetch<void>('/auth/set-password', { method: 'POST', body: JSON.stringify({ newPassword }) }),
  });
}

/**
 * "Ai uitat parola?" — răspunsul API e mereu 204, indiferent dacă emailul
 * are sau nu un cont (nu trebuie să dezvăluim asta), deci UI-ul arată
 * mereu același mesaj de succes, nu doar la reușită.
 */
export function useForgotPassword() {
  return useMutation({
    mutationFn: (input: ForgotPasswordInput) =>
      apiFetch<void>('/auth/forgot-password', { method: 'POST', body: JSON.stringify(input) }),
  });
}

export function useResetPassword() {
  return useMutation({
    mutationFn: (input: ResetPasswordInput) =>
      apiFetch<void>('/auth/reset-password', { method: 'POST', body: JSON.stringify(input) }),
  });
}
