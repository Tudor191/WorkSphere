-- Manager, Resurse Umane și Contabil nu puteau, până acum, să-și ceară
-- propriul concediu sau să-și facă propriul pontaj — `leave_requests:create`
-- și `attendance:create` lipseau din `DEFAULT_ROLE_PERMISSIONS` pentru aceste
-- roluri (vezi packages/database/src/permissions.ts). Acel fișier e sursa de
-- adevăr doar pentru companiile create DE ACUM ÎNAINTE (register/seed);
-- această migrație aplică retroactiv fix-ul pentru toate companiile deja
-- existente. `ON CONFLICT DO NOTHING` — idempotent, sigur de rulat oricând.
--
-- `roles` are RLS activat (vezi migrația `enable_row_level_security`) — fără
-- bypass explicit, sesiunea de migrare nu are niciun `app.current_company_id`
-- setat, deci SELECT-ul de mai jos ar întoarce 0 rânduri din toate companiile
-- (fail-closed by design), iar INSERT-ul ar deveni un no-op silențios.

SELECT set_config('app.bypass_rls', 'true', false);

INSERT INTO role_permissions ("roleId", "permissionId")
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON (p.resource, p.action) IN (
  ('leave_requests', 'create'),
  ('attendance', 'create')
)
WHERE r."systemKey" IN ('MANAGER', 'HR')
ON CONFLICT DO NOTHING;

-- Contabilul nu avea deloc acces la concedii/pontaj (nici măcar citire).
INSERT INTO role_permissions ("roleId", "permissionId")
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON (p.resource, p.action) IN (
  ('leave_requests', 'create'),
  ('leave_requests', 'read'),
  ('attendance', 'create'),
  ('attendance', 'read')
)
WHERE r."systemKey" = 'ACCOUNTANT'
ON CONFLICT DO NOTHING;
