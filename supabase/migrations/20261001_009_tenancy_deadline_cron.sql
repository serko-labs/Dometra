-- ============================================================
-- DOMETRA
-- TENANCY DEADLINE + CHECKOUT ACCESS + CRON
--
-- Prerequisites:
--   008a - CHECKOUT_PENDING enum value
--   008b - process_due_tenancy_checkouts()
--
-- This migration:
--   1. Enables pg_cron
--   2. Keeps tenant/property access while checkout is pending
--   3. Creates an idempotent hourly deadline job
-- ============================================================


-- ============================================================
-- 1. ENABLE PG_CRON
-- ============================================================

create extension if not exists pg_cron;


-- ============================================================
-- 2. PROPERTY ACCESS
--
-- Landlord:
--   workspace member -> access
--
-- Dometra tenant:
--   ACTIVE            -> access
--   CHECKOUT_PENDING  -> access
--   ENDED             -> historical access
--
-- Manual tenants do not have auth.users accounts and therefore
-- do not use this RLS branch.
-- ============================================================

create or replace function public.can_access_property(
  p_property_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select

    exists (
      select
        1

      from public.properties p

      join public.workspace_members wm
        on wm.workspace_id =
           p.workspace_id

      where
        p.id =
          p_property_id

        and wm.user_id =
          auth.uid()
    )

    or

    exists (
      select
        1

      from public.tenancies t

      join public.tenancy_members tm
        on tm.tenancy_id =
           t.id

      where
        t.property_id =
          p_property_id

        and tm.user_id =
          auth.uid()

        and t.status in (
          'ACTIVE',
          'CHECKOUT_PENDING',
          'ENDED'
        )
    );
$$;


-- ============================================================
-- 3. REMOVE EXISTING JOB WITH SAME NAME
--
-- Makes migration safe to run again.
-- ============================================================

do $$
declare
  v_job_id bigint;
begin

  select
    jobid
  into
    v_job_id

  from cron.job

  where
    jobname =
      'dometra-process-due-tenancy-checkouts'

  limit 1;


  if
    v_job_id is not null
  then
    perform cron.unschedule(
      v_job_id
    );
  end if;

end;
$$;


-- ============================================================
-- 4. CREATE DEADLINE JOB
--
-- Runs every hour at minute 15.
--
-- process_due_tenancy_checkouts() uses the workspace timezone,
-- so the tenancy will move to CHECKOUT_PENDING shortly after
-- the contractual end date begins in that property's timezone.
-- ============================================================

select cron.schedule(
  'dometra-process-due-tenancy-checkouts',
  '15 * * * *',
  $$
    select
      public.process_due_tenancy_checkouts();
  $$
);