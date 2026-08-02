import { z } from 'zod';

export const registerSchema = z.object({
  companyName: z.string().min(2, 'Numele companiei e prea scurt').max(120),
  firstName: z.string().min(1, 'Prenumele e obligatoriu').max(60),
  lastName: z.string().min(1, 'Numele e obligatoriu').max(60),
  email: z.string().email('Email invalid'),
  password: z
    .string()
    .min(10, 'Minim 10 caractere')
    .max(72)
    .regex(/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Trebuie literă mică, literă mare și cifră'),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().email('Email invalid'),
  password: z.string().min(1, 'Parola e obligatorie'),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const completeGoogleRegistrationSchema = z.object({
  token: z.string().min(1),
  companyName: z.string().min(2, 'Numele companiei e prea scurt').max(120),
});
export type CompleteGoogleRegistrationInput = z.infer<typeof completeGoogleRegistrationSchema>;

export const forgotPasswordSchema = z.object({
  email: z.string().email('Email invalid'),
});
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  newPassword: z
    .string()
    .min(10, 'Minim 10 caractere')
    .max(72)
    .regex(/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Trebuie literă mică, literă mare și cifră'),
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const confirmAccountDeletionSchema = z.object({
  email: z.string().email('Email invalid'),
  code: z.string().min(6, 'Codul are 6 cifre'),
  password: z.string().min(1, 'Parola e obligatorie'),
});
export type ConfirmAccountDeletionInput = z.infer<typeof confirmAccountDeletionSchema>;

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  companyId: string;
  companySlug: string;
  role: string;
  mustChangePassword: boolean;
  hasPassword: boolean;
}

export interface AuthResponse {
  accessToken: string;
  user: AuthUser;
}
