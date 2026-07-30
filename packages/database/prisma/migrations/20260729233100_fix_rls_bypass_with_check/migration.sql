-- Corectează un bug real: clauza WITH CHECK a politicilor RLS pentru
-- tabelele cu coloană `companyId` directă nu includea condiția de bypass
-- (`app.bypass_rls = true`), deși clauza USING o includea. Efect: orice
-- INSERT/UPDATE rulat sub `TenantContext.runAsBypass` (fluxurile de auth —
-- login/register/refresh, care nu au încă un `companyId` real de tenant)
-- era respins de Postgres cu "new row violates row-level security policy",
-- chiar dacă citirea (SELECT) funcționa corect.

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
    EXECUTE format(
      'ALTER POLICY tenant_isolation ON %I
         WITH CHECK (
           "companyId" = current_setting(''app.current_company_id'', true)
           OR current_setting(''app.bypass_rls'', true) = ''true''
         )',
      tbl
    );
  END LOOP;
END $$;
