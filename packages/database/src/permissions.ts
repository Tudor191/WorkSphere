/**
 * Catalog de permisiuni granulare (resource:action) + mapare implicită pe
 * rolurile de sistem. Folosit atât de `seed.ts` (populare inițială) cât și
 * de backend (`@RequirePermission('resource:action')` — vezi
 * `apps/api/src/common/rbac`).
 *
 * De ce nu e un enum fix în cod: permisiunile trebuie gestionate granular
 * (cerință explicită) — o companie poate crea roluri custom cu orice
 * combinație din acest catalog, deci sursa de adevăr e tabelul `Permission`,
 * nu un switch/enum hard-codat în TypeScript.
 */

export const PERMISSION_CATALOG: Array<{
  resource: string;
  action: string;
  description: string;
}> = [
  // Companie & setări
  { resource: 'company', action: 'read', description: 'Vizualizare setări companie' },
  { resource: 'company', action: 'update', description: 'Editare setări companie' },
  { resource: 'billing', action: 'read', description: 'Vizualizare abonament și facturi' },
  { resource: 'billing', action: 'update', description: 'Schimbare plan / metodă de plată' },

  // Utilizatori & roluri
  { resource: 'users', action: 'invite', description: 'Invitare utilizatori noi' },
  { resource: 'users', action: 'read', description: 'Vizualizare utilizatori' },
  { resource: 'users', action: 'update', description: 'Editare utilizatori' },
  { resource: 'users', action: 'delete', description: 'Dezactivare/ștergere utilizatori' },
  { resource: 'roles', action: 'manage', description: 'Creare/editare roluri și permisiuni' },
  { resource: 'audit_logs', action: 'read', description: 'Vizualizare jurnal de audit' },
  { resource: 'api_keys', action: 'manage', description: 'Creare/revocare chei API' },

  // Angajați & departamente
  { resource: 'employees', action: 'create', description: 'Adăugare angajați' },
  { resource: 'employees', action: 'read', description: 'Vizualizare angajați' },
  { resource: 'employees', action: 'update', description: 'Editare angajați' },
  { resource: 'employees', action: 'delete', description: 'Ștergere angajați' },
  { resource: 'departments', action: 'manage', description: 'Creare/editare/ștergere departamente' },

  // Concedii
  { resource: 'leave_requests', action: 'create', description: 'Creare cerere de concediu proprie' },
  { resource: 'leave_requests', action: 'read', description: 'Vizualizare cereri de concediu proprii' },
  {
    resource: 'leave_requests',
    action: 'read_all',
    description: 'Vizualizare cereri de concediu ale întregii companii',
  },
  { resource: 'leave_requests', action: 'approve', description: 'Aprobare/respingere cereri de concediu' },
  { resource: 'leave_types', action: 'manage', description: 'Configurare tipuri de concediu' },

  // Pontaj
  { resource: 'attendance', action: 'create', description: 'Check-in / check-out' },
  { resource: 'attendance', action: 'read', description: 'Vizualizare rapoarte de pontaj' },
  { resource: 'attendance', action: 'manage', description: 'Corectare manuală pontaje' },

  // Calendar
  { resource: 'calendar_events', action: 'manage', description: 'Creare/editare evenimente de calendar' },

  // Documente
  { resource: 'documents', action: 'create', description: 'Upload documente' },
  { resource: 'documents', action: 'read', description: 'Vizualizare/descărcare documente' },
  { resource: 'documents', action: 'delete', description: 'Ștergere documente' },

  // CRM
  { resource: 'clients', action: 'manage', description: 'Gestionare clienți' },
  { resource: 'leads', action: 'manage', description: 'Gestionare lead-uri și pipeline' },

  // Inventar
  { resource: 'products', action: 'manage', description: 'Gestionare produse și stoc' },

  // Proiecte & taskuri
  { resource: 'projects', action: 'manage', description: 'Creare/editare proiecte' },
  { resource: 'tasks', action: 'create', description: 'Creare task-uri' },
  { resource: 'tasks', action: 'read', description: 'Vizualizare task-uri' },
  { resource: 'tasks', action: 'update', description: 'Editare task-uri (proprii sau alocate)' },
  { resource: 'tasks', action: 'delete', description: 'Ștergere task-uri' },

  // Chat & notificări
  { resource: 'chat', action: 'use', description: 'Acces la chat intern' },
  { resource: 'notifications', action: 'read', description: 'Vizualizare notificări proprii' },

  // AI Assistant
  { resource: 'ai_assistant', action: 'use', description: 'Acces la AI Assistant' },
];

export const SYSTEM_ROLES = ['ADMIN', 'MANAGER', 'HR', 'ACCOUNTANT', 'EMPLOYEE'] as const;
export type SystemRole = (typeof SYSTEM_ROLES)[number];

/** Permisiuni implicite per rol de sistem, la crearea unei companii noi. */
export const DEFAULT_ROLE_PERMISSIONS: Record<SystemRole, string[]> = {
  // Admin de companie: acces total.
  ADMIN: PERMISSION_CATALOG.map((p) => `${p.resource}:${p.action}`),

  MANAGER: [
    'employees:read',
    'departments:manage',
    'leave_requests:read',
    'leave_requests:read_all',
    'leave_requests:approve',
    'attendance:read',
    'calendar_events:manage',
    'documents:create',
    'documents:read',
    'clients:manage',
    'leads:manage',
    'projects:manage',
    'tasks:create',
    'tasks:read',
    'tasks:update',
    'tasks:delete',
    'chat:use',
    'notifications:read',
    'ai_assistant:use',
  ],

  HR: [
    'users:invite',
    'users:read',
    'employees:create',
    'employees:read',
    'employees:update',
    'employees:delete',
    'departments:manage',
    'leave_requests:read',
    'leave_requests:read_all',
    'leave_requests:approve',
    'leave_types:manage',
    'attendance:read',
    'attendance:manage',
    'calendar_events:manage',
    'documents:create',
    'documents:read',
    'documents:delete',
    'chat:use',
    'notifications:read',
    'ai_assistant:use',
  ],

  ACCOUNTANT: [
    'billing:read',
    'employees:read',
    'clients:manage',
    'documents:create',
    'documents:read',
    'products:manage',
    'chat:use',
    'notifications:read',
    'ai_assistant:use',
  ],

  EMPLOYEE: [
    'leave_requests:create',
    'leave_requests:read',
    'attendance:create',
    'attendance:read',
    'calendar_events:manage',
    'documents:read',
    'tasks:read',
    'tasks:update',
    'chat:use',
    'notifications:read',
    'ai_assistant:use',
  ],
};
