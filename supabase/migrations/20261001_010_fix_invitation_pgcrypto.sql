-- ============================================================
-- DOMETRA
-- FIX TENANT INVITATION CRYPTO FUNCTIONS
--
-- Problem:
--   create_tenant_invitation_v2() calls gen_random_bytes()
--   and digest(), which are provided by pgcrypto.
--
-- Supabase commonly installs extensions into the
-- "extensions" schema, while our SECURITY DEFINER functions
-- use search_path = public.
--
-- Result:
--   ERROR 42883:
--   function gen_random_bytes(integer) does not exist
--
-- This migration:
--   1. Ensures pgcrypto is installed.
--   2. Makes invitation RPCs able to resolve pgcrypto functions.
--   3. Does not change invitation business logic.
-- ============================================================


begin;


-- ============================================================
-- 1. EXTENSIONS SCHEMA
-- ============================================================

create schema if not exists extensions;


-- ============================================================
-- 2. PGCRYPTO
--
-- If pgcrypto does not exist yet, install it into extensions.
--
-- If it already exists in another schema, PostgreSQL leaves
-- the existing installation intact.
-- ============================================================

create extension if not exists pgcrypto
with schema extensions;


-- ============================================================
-- 3. FIX SEARCH_PATH FOR INVITATION FUNCTIONS
--
-- We intentionally discover the exact function signatures from
-- pg_proc instead of hard-coding argument types.
--
-- This makes the migration compatible with the functions
-- already deployed in the current Dometra database.
-- ============================================================

do $$
declare
  v_function record;
begin

  for v_function in

    select
      n.nspname as schema_name,
      p.proname as function_name,
      pg_get_function_identity_arguments(
        p.oid
      ) as identity_arguments

    from pg_proc p

    join pg_namespace n
      on n.oid =
         p.pronamespace

    where
      n.nspname =
        'public'

      and p.proname in (
        'create_tenant_invitation_v2',
        'get_tenant_invitation',
        'accept_tenant_invitation',
        'revoke_tenant_invitation'
      )

  loop

    execute format(
      'alter function %I.%I(%s) set search_path = public, extensions',
      v_function.schema_name,
      v_function.function_name,
      v_function.identity_arguments
    );

  end loop;

end;
$$;


commit;


-- ============================================================
-- VERIFICATION
-- ============================================================

select
  e.extname,
  n.nspname as extension_schema

from pg_extension e

join pg_namespace n
  on n.oid =
     e.extnamespace

where
  e.extname =
    'pgcrypto';


select
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_identity_arguments(
    p.oid
  ) as arguments,
  p.proconfig

from pg_proc p

join pg_namespace n
  on n.oid =
     p.pronamespace

where
  n.nspname =
    'public'

  and p.proname in (
    'create_tenant_invitation_v2',
    'get_tenant_invitation',
    'accept_tenant_invitation',
    'revoke_tenant_invitation'
  )

order by
  p.proname;