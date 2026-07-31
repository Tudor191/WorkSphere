#!/usr/bin/env bash
set -euo pipefail

# Rulat automat de imaginea oficială Postgres (docker-entrypoint-initdb.d),
# STRICT la primul boot al unui volum de date gol. Creează rolul dedicat al
# aplicației, separat de POSTGRES_USER — care e superuser (bootstrap-ul
# oficial al imaginii) și deci exceptat necondiționat de la Row Level
# Security, indiferent de FORCE ROW LEVEL SECURITY (vezi migrarea
# `enable_row_level_security`). Fără acest rol, aplicația ar rămâne pe
# superuser, iar toate politicile RLS ar deveni silențios decorative.

: "${POSTGRES_APP_USER:?variabilă obligatorie}"
: "${POSTGRES_APP_PASSWORD:?variabilă obligatorie}"

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
  DO \$\$
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${POSTGRES_APP_USER}') THEN
      CREATE ROLE "${POSTGRES_APP_USER}" LOGIN PASSWORD '${POSTGRES_APP_PASSWORD}'
        NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
    END IF;
  END
  \$\$;

  GRANT CONNECT ON DATABASE "${POSTGRES_DB}" TO "${POSTGRES_APP_USER}";
  GRANT USAGE ON SCHEMA public TO "${POSTGRES_APP_USER}";
  GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO "${POSTGRES_APP_USER}";
  GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO "${POSTGRES_APP_USER}";
  ALTER DEFAULT PRIVILEGES FOR ROLE "$POSTGRES_USER" IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO "${POSTGRES_APP_USER}";
  ALTER DEFAULT PRIVILEGES FOR ROLE "$POSTGRES_USER" IN SCHEMA public
    GRANT USAGE, SELECT ON SEQUENCES TO "${POSTGRES_APP_USER}";
EOSQL
