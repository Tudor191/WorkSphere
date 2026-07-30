/**
 * Etichete/descrieri în română + ierarhie pentru rolurile de sistem
 * (`SYSTEM_ROLES` din `@worksphere/database`). Strict pentru afișare în UI —
 * sursa de adevăr pentru PERMISIUNI rămâne `DEFAULT_ROLE_PERMISSIONS`
 * (packages/database/src/permissions.ts). Când se adaugă selectarea limbii
 * (EN), acest fișier devine punctul de extindere natural (labelEn etc.),
 * nu o schimbare a numelui stocat în DB.
 */

export type SystemRoleKey = 'ADMIN' | 'MANAGER' | 'HR' | 'ACCOUNTANT' | 'EMPLOYEE';

export interface RoleInfo {
  key: SystemRoleKey;
  labelRo: string;
  descriptionRo: string;
  /** 5 = cel mai înalt rang, 1 = cel mai jos. */
  level: 1 | 2 | 3 | 4 | 5;
}

export const ROLE_INFO: Record<SystemRoleKey, RoleInfo> = {
  ADMIN: {
    key: 'ADMIN',
    labelRo: 'Administrator',
    descriptionRo:
      'Acces total: gestionează compania, angajații, rolurile, facturarea și toate modulele.',
    level: 5,
  },
  MANAGER: {
    key: 'MANAGER',
    labelRo: 'Manager',
    descriptionRo:
      'Gestionează departamente, proiecte, clienți/lead-uri și aprobă cererile de concediu.',
    level: 4,
  },
  HR: {
    key: 'HR',
    labelRo: 'Resurse Umane',
    descriptionRo: 'Gestionează fișele angajaților (adăugare/editare/demitere), departamente și pontaje.',
    level: 3,
  },
  ACCOUNTANT: {
    key: 'ACCOUNTANT',
    labelRo: 'Contabil',
    descriptionRo: 'Acces la facturare/abonament, clienți și produse/stoc.',
    level: 2,
  },
  EMPLOYEE: {
    key: 'EMPLOYEE',
    labelRo: 'Angajat',
    descriptionRo: 'Cere concediu, pontează și lucrează la task-urile proprii.',
    level: 1,
  },
};

/** Ordine de afișare recomandată — de la cel mai înalt rang la cel mai jos. */
export const ROLE_ORDER: SystemRoleKey[] = ['ADMIN', 'MANAGER', 'HR', 'ACCOUNTANT', 'EMPLOYEE'];

export function isSystemRoleKey(value: string | null | undefined): value is SystemRoleKey {
  return !!value && value in ROLE_INFO;
}

export function roleLabelRo(systemKey: string | null | undefined, fallback?: string): string {
  if (isSystemRoleKey(systemKey)) return ROLE_INFO[systemKey].labelRo;
  return fallback ?? systemKey ?? '—';
}
