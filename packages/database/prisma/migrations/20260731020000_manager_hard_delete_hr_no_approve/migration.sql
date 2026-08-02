-- Trei schimbări de RBAC cerute explicit:
-- 1. HR nu mai poate aproba/respinge cereri de concediu — rămâne doar la
--    Manager și Admin (HR păstrează celelalte drepturi, inclusiv vizualizarea
--    tuturor cererilor).
-- 2. Manager (nivel 4) primește dreptul de a dezactiva angajați
--    (`employees:delete` — îl avea deja Admin/HR, dar nu și Manager).
-- 3. Manager și Admin (nivelurile 4 și 5) primesc un drept nou,
--    `employees:hard_delete` — ștergere definitivă din baza de date a unui
--    cont DEJA dezactivat, ca email-ul să poată fi refolosit la un cont nou.
--
-- Vezi packages/database/src/permissions.ts pentru sursa de adevăr la
-- companiile create de-acum înainte; această migrație aplică retroactiv
-- pentru companiile deja existente.

SELECT set_config('app.bypass_rls', 'true', false);

-- Catalogul global de permisiuni normal se sincronizează din `seed.ts`, dar
-- acel script rulează separat (`pnpm db:seed`), nu automat la `migrate` — nu
-- ne bazăm pe cineva să-l ruleze din nou, inserăm direct rândul necesar.
INSERT INTO permissions (id, resource, action, description)
VALUES (
  gen_random_uuid()::text,
  'employees',
  'hard_delete',
  'Ștergere definitivă din baza de date (ireversibil, doar după dezactivare)'
)
ON CONFLICT (resource, action) DO NOTHING;

-- (1) HR pierde dreptul de aprobare/respingere.
DELETE FROM role_permissions
WHERE "permissionId" = (SELECT id FROM permissions WHERE resource = 'leave_requests' AND action = 'approve')
  AND "roleId" IN (SELECT id FROM roles WHERE "systemKey" = 'HR');

-- (2) + (3) Manager primește employees:delete și employees:hard_delete.
INSERT INTO role_permissions ("roleId", "permissionId")
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON (p.resource, p.action) IN (
  ('employees', 'delete'),
  ('employees', 'hard_delete')
)
WHERE r."systemKey" = 'MANAGER'
ON CONFLICT DO NOTHING;

-- Admin are acces total prin definiție (PERMISSION_CATALOG complet) — dar
-- rolurile Admin existente au fost seed-uite ÎNAINTE ca `employees:hard_delete`
-- să existe în catalog, deci nu au primit-o automat. O adăugăm explicit.
INSERT INTO role_permissions ("roleId", "permissionId")
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.resource = 'employees' AND p.action = 'hard_delete'
WHERE r."systemKey" = 'ADMIN'
ON CONFLICT DO NOTHING;
