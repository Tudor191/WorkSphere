import { useMutation } from '@tanstack/react-query';
import type { AuthUser } from '@worksphere/shared-types';
import { apiFetch } from '@/lib/api-client';

export interface UpdateProfileInput {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
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
