-- Dedicated SELECT-only Postgres role for the Ask IntelliSource harness.
-- Layer 1 of the 5-layer read-only invariant (see ASK_INTELLISOURCE_HARNESS_PLAN.md).
-- Run once against the target DB as a superuser/owner:
--   psql "$DATABASE_URL" -f backend/scripts/setup_harness_ro_role.sql
--
-- Local dev default target: postgresql://postgres:1234@localhost:5432/intellisource

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'intellisource_harness_ro') THEN
        CREATE ROLE intellisource_harness_ro WITH LOGIN PASSWORD 'harness_ro_pw' NOSUPERUSER NOCREATEDB NOCREATEROLE;
    END IF;
END
$$;

-- Reject writes even if a future GRANT mistake happens: default to read-only transactions.
ALTER ROLE intellisource_harness_ro SET default_transaction_read_only = on;

GRANT CONNECT ON DATABASE intellisource TO intellisource_harness_ro;
GRANT USAGE ON SCHEMA public TO intellisource_harness_ro;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO intellisource_harness_ro;

-- Cover tables created after this script runs (e.g. future schema.sql additions).
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO intellisource_harness_ro;

-- Explicitly no write/DDL grants of any kind — verified by scripts/verify_harness_ro_role.sql.
