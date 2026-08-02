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
}

export interface AuthResponse {
  accessToken: string;
  user: AuthUser;
}
