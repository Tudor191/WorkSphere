-- Adaugă permisiunile noi `company:export` și `company:delete` (GDPR —
-- portabilitate + drept la ștergere, la nivel de companie). Fișierul
-- packages/database/src/permissions.ts e sursa de adevăr doar pentru
-- companiile create DE ACUM ÎNAINTE (seed-ul rulează `permission.upsert`
-- pe `PERMISSION_CATALOG` — vezi prisma/seed.ts) — dar seed-ul rulează
-- DUPĂ migrații în CI ("Rulează migrațiile" apoi "Rulează seed-ul"), iar
-- companiile deja existente au deja rândurile din `role_permissions`
-- materializate, deci trebuie inserate explicit aici, nu doar lăsate pe
-- seama seed-ului.
--
-- `permissions.id` nu are un default la nivel de bază de date
-- (`@default(cuid())` e doar client-side în Prisma) — folosim literali
-- expliciți. `ON CONFLICT` pe indexul unic `permissions_resource_action_key`
-- face inserarea idempotentă (sigur de rulat și dacă seed-ul a ajuns primul).
--
-- `role_permissions` are RLS activat — fără bypass explicit, sesiunea de
-- migrare nu are niciun `app.current_company_id` setat, deci SELECT-ul de
-- mai jos ar întoarce 0 rânduri (fail-closed by design) și INSERT-ul ar
-- deveni un no-op silențios.

INSERT INTO "permissions" ("id", "resource", "action", "description") VALUES
  ('cm_perm_company_export_gdpr', 'company', 'export', 'Export date companie (GDPR, portabilitate)'),
  ('cm_perm_company_delete_gdpr', 'company', 'delete', 'Ștergere definitivă a companiei (GDPR, drept la ștergere)')
ON CONFLICT ("resource", "action") DO NOTHING;

SELECT set_config('app.bypass_rls', 'true', false);

INSERT INTO role_permissions ("roleId", "permissionId")
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON (p.resource, p.action) IN (
  ('company', 'export'),
  ('company', 'delete')
)
WHERE r."systemKey" = 'ADMIN'
ON CONFLICT DO NOTHING;
