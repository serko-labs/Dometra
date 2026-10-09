-- ============================================================
-- DOMETRA
-- RESTORE LATEST READING VIEW + CANONICAL CHECKOUT BASELINE
-- ============================================================
--
-- TWO DIFFERENT VIEWS:
--
-- 1. v_latest_meter_register_readings
--
--    Existing MONTHLY reading compatibility view.
--    Billing/RPC code depends on this contract.
--
--
-- 2. v_canonical_latest_meter_register_readings
--
--    Latest physical meter value including COMPLETED checkout
--    readings.
--
--    Used as the baseline for the next tenancy.
--
-- ============================================================


-- ============================================================
-- INDEXES
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
-- REMOVE OBJECTS CREATED BY PREVIOUS ATTEMPTS
-- ============================================================

drop function if exists
  public.get_latest_meter_register_value(uuid);


drop view if exists
  public.v_canonical_latest_meter_register_readings;


drop view if exists
  public.v_latest_meter_register_readings;


-- ============================================================
-- RESTORE MONTHLY LATEST-READING VIEW
-- ============================================================
--
-- Compatibility fields:
--
--   meter_register_reading_id
--   reading_session_id
--   meter_register_id
--   meter_id
--   billing_period
--   reading_date
--   previous_value
--   current_value
--   consumption
--   photo_bucket
--   photo_path
--   photo_mime_type
--
-- Photo information comes from:
--
--   meter_register_readings
--      -> meter_reading_photos
--      -> media_files
--
-- We intentionally do NOT depend on:
--
--   meter_reading_photos.sort_order
--   meter_reading_photos.created_at
--   meter_reading_sessions.tenancy_id
--   meter_reading_sessions.confirmed_at
--
-- ============================================================

create view public.v_latest_meter_register_readings
with (
  security_invoker = true
)
as

with ranked as (

  select
    r.id
      as meter_register_reading_id,

    r.reading_session_id,

    r.meter_register_id,

    s.meter_id,

    s.billing_period,

    s.reading_date,

    r.previous_value,

    r.current_value,

    r.consumption,

    photo.photo_bucket,

    photo.photo_path,

    photo.photo_mime_type,

    row_number()
    over (
      partition by
        r.meter_register_id

      order by
        s.reading_date desc,
        s.billing_period desc,
        r.id desc
    )
      as rn

  from public.meter_register_readings r

  join public.meter_reading_sessions s
    on s.id =
      r.reading_session_id


  -- ----------------------------------------------------------
  -- Pick one attached photo deterministically.
  --
  -- Only media_files columns are used for ordering because
  -- their presence is known:
  --
  --   id
  --   bucket
  --   storage_path
  --   mime_type
  --
  -- ----------------------------------------------------------

  left join lateral (

    select
      mf.bucket
        as photo_bucket,

      mf.storage_path
        as photo_path,

      mf.mime_type
        as photo_mime_type

    from public.meter_reading_photos mrp

    join public.media_files mf
      on mf.id =
        mrp.media_file_id

    where
      mrp.register_reading_id =
        r.id

    order by
      mf.storage_path asc,
      mf.id asc

    limit 1

  ) photo
    on true


  where
    r.current_value
      is not null

    and s.status::text in (
      'SUBMITTED',
      'CONFIRMED'
    )

)

select
  meter_register_reading_id,

  reading_session_id,

  meter_register_id,

  meter_id,

  billing_period,

  reading_date,

  previous_value,

  current_value,

  consumption,

  photo_bucket,

  photo_path,

  photo_mime_type

from ranked

where
  rn =
    1;


grant select
on public.v_latest_meter_register_readings
to authenticated;


-- ============================================================
-- CANONICAL PHYSICAL LATEST READING
-- ============================================================
--
-- Monthly example:
--
--   previous = 1200
--   current  = 1240
--
-- Checkout:
--
--   final = 1247
--
-- Canonical:
--
--   previous_value = 1247
--   current_value  = 1247
--   source_kind    = CHECKOUT
--
-- ============================================================

create view public.v_canonical_latest_meter_register_readings
with (
  security_invoker = true
)
as

with monthly_readings as (

  select
    latest.meter_register_reading_id
      as source_id,

    latest.meter_register_id,

    latest.meter_id,

    latest.billing_period,

    latest.reading_date,

    latest.previous_value,

    latest.current_value,

    'MONTHLY'::text
      as source_kind,

    1
      as source_priority

  from public.v_latest_meter_register_readings latest

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

    'CHECKOUT'::text
      as source_kind,

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

    source_kind,

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

    source_kind,

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

    source_kind,

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

  current_value,

  source_kind

from ranked

where
  rn =
    1;


grant select
on public.v_canonical_latest_meter_register_readings
to authenticated;


-- ============================================================
-- CANONICAL VALUE HELPER
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

  from public.v_canonical_latest_meter_register_readings latest

  where
    latest.meter_register_id =
      p_meter_register_id

  limit 1;

$$;


grant execute
on function public.get_latest_meter_register_value(uuid)
to authenticated;


-- ============================================================
-- VALIDATION
-- ============================================================

do $$
begin

  perform
    latest.meter_register_reading_id,
    latest.reading_session_id,
    latest.meter_register_id,
    latest.meter_id,
    latest.billing_period,
    latest.reading_date,
    latest.previous_value,
    latest.current_value,
    latest.consumption,
    latest.photo_bucket,
    latest.photo_path,
    latest.photo_mime_type

  from public.v_latest_meter_register_readings latest

  limit 1;


  perform
    canonical.meter_register_id,
    canonical.meter_id,
    canonical.billing_period,
    canonical.reading_date,
    canonical.previous_value,
    canonical.current_value,
    canonical.source_kind

  from public.v_canonical_latest_meter_register_readings canonical

  limit 1;

end
$$;