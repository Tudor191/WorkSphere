/**
 * `Prisma.UserSelect` care exclude câmpurile sensibile (`passwordHash`,
 * `twoFactorSecret`, `googleId`). Folosește asta în loc de `user: true` în
 * orice `include`/`select` a cărui rezultat ajunge într-un răspuns HTTP —
 * altfel hash-ul parolei ajunge în JSON-ul returnat clientului.
 */
export const SAFE_USER_SELECT = {
  id: true,
  companyId: true,
  email: true,
  firstName: true,
  lastName: true,
  avatarUrl: true,
  phone: true,
  roleId: true,
  status: true,
  twoFactorEnabled: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
} as const;
