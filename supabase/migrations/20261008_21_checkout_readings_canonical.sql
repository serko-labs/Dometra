-- ============================================================
-- DOMETRA
-- CHECKOUT READINGS AS CANONICAL METER BASELINE
-- ============================================================
--
-- Goal:
--
-- After a tenancy checkout is completed, its final meter
-- readings must become the canonical latest readings.
--
-- Example:
--
--   monthly reading before checkout = 1200
--   final checkout reading          = 1247
--
-- The next tenancy must use:
--
--   previous value = 1247
--
--
-- Why the view is recreated instead of CREATE OR REPLACE:
--
-- An older Dometra version of:
--
--   v_latest_meter_register_readings
--
-- contains a different set of columns.
--
-- PostgreSQL does not allow CREATE OR REPLACE VIEW to remove
-- existing columns:
--
--   ERROR 42P16:
--   cannot drop columns from view
--
-- Therefore this migration explicitly drops the old view and
-- creates the canonical version again.
--
-- We DO NOT use CASCADE.
--
-- ============================================================


-- ============================================================
-- SUPPORTING INDEXES
-- ============================================================

create index if not exists
  idx_tenancy_checkout_readings_register_date

on public.tenancy_checkout_readings (
  meter_register_id,
  reading_date desc
);


create index if not exists
  idx_meter_reading_sessions_meter_date

on public.meter_reading_sessions (
  meter_id,
  reading_date desc
);


create index if not exists
  idx_meter_register_readings_register

on public.meter_register_readings (
  meter_register_id
);


-- ============================================================
-- REMOVE HELPER FIRST
-- ============================================================
--
-- If an earlier execution created the helper successfully,
-- remove it before recreating the view.
--
-- This also prevents a dependency from blocking DROP VIEW.
-- ============================================================

drop function if exists
  public.get_latest_meter_register_value(uuid);


-- ============================================================
-- REMOVE OLD VIEW
-- ============================================================

drop view if exists
  public.v_latest_meter_register_readings;


-- ============================================================
-- CREATE CANONICAL LATEST READING VIEW
-- ============================================================
--
-- Sources:
--
-- 1. MONTHLY
--
--    meter_reading_sessions
--      +
--    meter_register_readings
--
--
-- 2. CHECKOUT
--
--    tenancy_checkout_readings
--      +
--    tenancy_checkouts
--
--
-- Only COMPLETED checkout readings participate.
--
--
-- For monthly:
--
--   previous_value = recorded previous value
--   current_value  = recorded current value
--
--
-- For checkout:
--
--   previous_value = final checkout value
--   current_value  = final checkout value
--
--
-- Setting both checkout values to the final reading is
-- intentional.
--
-- It ensures that the next tenancy receives the checkout
-- reading as its baseline even if:
--
--   Tenant A moves out in October
--   Tenant B moves in during October
--
--
-- Ordering:
--
--   1. reading_date DESC
--   2. checkout wins over monthly on the same date
--   3. source UUID provides a deterministic final tie-breaker
--
-- ============================================================

create view public.v_latest_meter_register_readings
with (
  security_invoker = true
)
as

with monthly_readings as (

  select
    r.id
      as source_id,

    r.meter_register_id,

    s.meter_id,

    s.billing_period,

    s.reading_date,

    r.previous_value,

    r.current_value,

    1
      as source_priority

  from public.meter_register_readings r

  join public.meter_reading_sessions s
    on s.id =
      r.reading_session_id

  where
    r.current_value
      is not null

    and s.status::text
      in (
        'SUBMITTED',
        'CONFIRMED'
      )

),


checkout_readings as (

  select
    cr.id
      as source_id,

    cr.meter_register_id,

    mr.meter_id,

    date_trunc(
      'month',
      cr.reading_date
    )::date
      as billing_period,

    cr.reading_date,

    cr.value
      as previous_value,

    cr.value
      as current_value,

    2
      as source_priority

  from public.tenancy_checkout_readings cr

  join public.tenancy_checkouts c
    on c.tenancy_id =
      cr.tenancy_id

  join public.meter_registers mr
    on mr.id =
      cr.meter_register_id

  where
    c.status::text =
      'COMPLETED'

    and cr.value
      is not null

),


all_readings as (

  select
    source_id,

    meter_register_id,

    meter_id,

    billing_period,

    reading_date,

    previous_value,

    current_value,

    source_priority

  from monthly_readings


  union all


  select
    source_id,

    meter_register_id,

    meter_id,

    billing_period,

    reading_date,

    previous_value,

    current_value,

    source_priority

  from checkout_readings

),


ranked as (

  select
    source_id,

    meter_register_id,

    meter_id,

    billing_period,

    reading_date,

    previous_value,

    current_value,

    source_priority,

    row_number()
    over (
      partition by
        meter_register_id

      order by
        reading_date desc,

        source_priority desc,

        source_id desc
    )
      as rn

  from all_readings

)


select
  meter_register_id,

  meter_id,

  billing_period,

  reading_date,

  previous_value,

  current_value

from ranked

where
  rn =
    1;


-- ============================================================
-- ACCESS
-- ============================================================

grant select
on public.v_latest_meter_register_readings
to authenticated;


-- ============================================================
-- HELPER
-- ============================================================
--
-- Returns the current canonical value of one meter register.
--
-- This can be reused later for:
--
--   * move-in readings
--   * creating a new tenancy
--   * meter replacement
--   * checkout validation
--   * diagnostics
--
-- ============================================================

create or replace function public.get_latest_meter_register_value(
  p_meter_register_id uuid
)
returns numeric
language sql
stable
security invoker
set search_path = public
as $$

  select
    latest.current_value

  from public.v_latest_meter_register_readings latest

  where
    latest.meter_register_id =
      p_meter_register_id

  limit 1;

$$;


grant execute
on function public.get_latest_meter_register_value(
  uuid
)
to authenticated;