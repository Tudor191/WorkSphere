-- Row Level Security (RLS) — a doua linie de apărare pentru izolarea
-- multi-tenant, dincolo de filtrarea din stratul aplicație (PrismaService).
--
-- Convenție:
--   `app.current_company_id`  — setat per-conexiune/tranzacție de backend
--                                 (SET LOCAL) din contextul cererii HTTP
--                                 curente (derivat din JWT).
--   `app.bypass_rls`          — setat la 'true' DOAR de fluxul de suport al
--                                 Super Admin-ului (impersonation), care
--                                 scrie obligatoriu în `audit_logs` la
--                                 fiecare acces (impus la nivel aplicație).
--
-- IMPORTANT (operațional): aceste politici NU se aplică conexiunilor făcute
-- cu un rol superuser (ex. `postgres`) — Postgres exceptează superuserii de
-- la RLS indiferent de FORCE ROW LEVEL SECURITY. În producție, aplicația
-- TREBUIE să se conecteze printr-un rol dedicat, non-superuser
-- (ex. `worksphere_app`), altfel RLS devine doar decorativ.
--
-- CREATE ROLE worksphere_app LOGIN PASSWORD '...';
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO worksphere_app;

-- Verifică dacă `current_setting(..., true)` e NULL => interzice implicit
-- (fail-closed): dacă backend-ul uită să seteze contextul de tenant, orice
-- query pe un tabel tenant-scoped nu întoarce niciun rând, în loc să scurgă
-- date din toate companiile.

DO $$
DECLARE
  tbl TEXT;
  direct_tables TEXT[] := ARRAY[
    'subscriptions', 'subscription_invoices', 'users', 'roles', 'api_keys',
    'departments', 'employees', 'leave_types', 'leave_requests',
    'leave_balances', 'attendance_records', 'calendar_events', 'documents',
    'clients', 'leads', 'pipeline_stages', 'crm_notes', 'products',
    'stock_movements', 'projects', 'tasks', 'time_entries', 'chat_channels',
    'notifications', 'audit_logs'
  ];
BEGIN
  FOREACH tbl IN ARRAY direct_tables LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', tbl);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I
         USING (
           "companyId" = current_setting(''app.current_company_id'', true)
           OR current_setting(''app.bypass_rls'', true) = ''true''
         )
         WITH CHECK (
           "companyId" = current_setting(''app.current_company_id'', true)
         )',
      tbl
    );
  END LOOP;
END $$;

-- Tabele copil fără coloană `companyId` proprie — izolarea se face prin
-- subquery către tabelul părinte care poartă `companyId`.

ALTER TABLE refresh_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE refresh_tokens FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON refresh_tokens
  USING (
    current_setting('app.bypass_rls', true) = 'true'
    OR "userId" IN (
      SELECT id FROM users WHERE "companyId" = current_setting('app.current_company_id', true)
    )
  );

ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON role_permissions
  USING (
    current_setting('app.bypass_rls', true) = 'true'
    OR "roleId" IN (
      SELECT id FROM roles WHERE "companyId" = current_setting('app.current_company_id', true)
    )
  );

ALTER TABLE calendar_event_attendees ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_event_attendees FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON calendar_event_attendees
  USING (
    current_setting('app.bypass_rls', true) = 'true'
    OR "eventId" IN (
      SELECT id FROM calendar_events WHERE "companyId" = current_setting('app.current_company_id', true)
    )
  );

ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_chunks FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON document_chunks
  USING (
    current_setting('app.bypass_rls', true) = 'true'
    OR "documentId" IN (
      SELECT id FROM documents WHERE "companyId" = current_setting('app.current_company_id', true)
    )
  );

ALTER TABLE document_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_embeddings FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON document_embeddings
  USING (
    current_setting('app.bypass_rls', true) = 'true'
    OR "documentChunkId" IN (
      SELECT dc.id FROM document_chunks dc
      JOIN documents d ON d.id = dc."documentId"
      WHERE d."companyId" = current_setting('app.current_company_id', true)
    )
  );

ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_members FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON project_members
  USING (
    current_setting('app.bypass_rls', true) = 'true'
    OR "projectId" IN (
      SELECT id FROM projects WHERE "companyId" = current_setting('app.current_company_id', true)
    )
  );

ALTER TABLE task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_comments FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON task_comments
  USING (
    current_setting('app.bypass_rls', true) = 'true'
    OR "taskId" IN (
      SELECT id FROM tasks WHERE "companyId" = current_setting('app.current_company_id', true)
    )
  );

ALTER TABLE task_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_attachments FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON task_attachments
  USING (
    current_setting('app.bypass_rls', true) = 'true'
    OR "taskId" IN (
      SELECT id FROM tasks WHERE "companyId" = current_setting('app.current_company_id', true)
    )
  );

ALTER TABLE chat_channel_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_channel_members FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON chat_channel_members
  USING (
    current_setting('app.bypass_rls', true) = 'true'
    OR "channelId" IN (
      SELECT id FROM chat_channels WHERE "companyId" = current_setting('app.current_company_id', true)
    )
  );

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON chat_messages
  USING (
    current_setting('app.bypass_rls', true) = 'true'
    OR "channelId" IN (
      SELECT id FROM chat_channels WHERE "companyId" = current_setting('app.current_company_id', true)
    )
  );

ALTER TABLE chat_message_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_message_attachments FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON chat_message_attachments
  USING (
    current_setting('app.bypass_rls', true) = 'true'
    OR "messageId" IN (
      SELECT cm.id FROM chat_messages cm
      JOIN chat_channels cc ON cc.id = cm."channelId"
      WHERE cc."companyId" = current_setting('app.current_company_id', true)
    )
  );

ALTER TABLE chat_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_reactions FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON chat_reactions
  USING (
    current_setting('app.bypass_rls', true) = 'true'
    OR "messageId" IN (
      SELECT cm.id FROM chat_messages cm
      JOIN chat_channels cc ON cc.id = cm."channelId"
      WHERE cc."companyId" = current_setting('app.current_company_id', true)
    )
  );

ALTER TABLE device_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_tokens FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON device_tokens
  USING (
    current_setting('app.bypass_rls', true) = 'true'
    OR "userId" IN (
      SELECT id FROM users WHERE "companyId" = current_setting('app.current_company_id', true)
    )
  );

-- `companies`, `subscription_plans`, `permissions`, `platform_admins` rămân
-- fără RLS — sunt tabele globale de platformă, nu tenant-scoped.
