-- ============================================================
-- DOMETRA
-- 012
--
-- MONTHLY METER SUBMISSION STATUS
-- PUSH NOTIFICATION INFRASTRUCTURE
-- METER READING REMINDER QUEUE
--
-- Rules:
--
-- 1. Every new month starts with meter status = missing.
--
-- 2. Meter becomes submitted when:
--      - every active register has a value
--      - every register with photo_required = true
--        has at least one photo
--
-- 3. Tenant reminder:
--      - 1st day of month
--      - 3rd day of month
--      - only if readings are still missing
--
-- 4. Deadline shown in UI:
--      before 5th day of month
--
-- 5. This migration DOES NOT configure pg_cron.
--    Cron / Edge Function scheduling will be configured
--    separately after this migration succeeds.
-- ============================================================

begin;


-- ============================================================
-- 1. WORKSPACE TIMEZONE
-- ============================================================

alter table public.workspaces
add column if not exists default_timezone text
not null
default 'Europe/Kyiv';


-- ============================================================
-- 2. DEVICE PUSH TOKENS
--
-- ExpoPushToken is stored here.
-- One user may have several devices.
-- ============================================================

create table if not exists public.device_push_tokens (
  id uuid primary key
    default gen_random_uuid(),

  user_id uuid not null
    references auth.users(id)
    on delete cascade,

  platform text not null
    check (
      platform in (
        'IOS',
        'ANDROID',
        'WEB'
      )
    ),

  token text not null,

  device_id text,

  enabled boolean not null
    default true,

  last_seen_at timestamptz,

  created_at timestamptz
    not null
    default now(),

  unique(token)
);


create index if not exists
  idx_device_push_tokens_user
on public.device_push_tokens (
  user_id
);


create index if not exists
  idx_device_push_tokens_enabled
on public.device_push_tokens (
  user_id,
  enabled
);


-- ============================================================
-- 3. NOTIFICATION OUTBOX
--
-- This is our server-side notification queue.
--
-- We deliberately use TEXT statuses/channels here instead of
-- depending on old enum definitions that may not exist in the
-- current production database.
-- ============================================================

create table if not exists public.notifications (
  id uuid primary key
    default gen_random_uuid(),

  user_id uuid not null
    references auth.users(id)
    on delete cascade,

  reminder_rule_id uuid,

  channel text not null
    default 'PUSH'
    check (
      channel in (
        'PUSH',
        'EMAIL',
        'IN_APP'
      )
    ),

  status text not null
    default 'QUEUED'
    check (
      status in (
        'QUEUED',
        'SENT',
        'DELIVERED',
        'FAILED',
        'CANCELLED'
      )
    ),

  language_code text
    not null
    default 'uk',

  title_key text,

  body_key text,

  template_data jsonb
    not null
    default '{}'::jsonb,

  deep_link text,

  scheduled_at timestamptz
    not null
    default now(),

  sent_at timestamptz,

  delivered_at timestamptz,

  failure_reason text,

  deduplication_key text,

  created_at timestamptz
    not null
    default now()
);


-- Existing DB compatibility.

alter table public.notifications
add column if not exists reminder_rule_id uuid;

alter table public.notifications
add column if not exists channel text;

alter table public.notifications
add column if not exists status text;

alter table public.notifications
add column if not exists language_code text;

alter table public.notifications
add column if not exists title_key text;

alter table public.notifications
add column if not exists body_key text;

alter table public.notifications
add column if not exists template_data jsonb;

alter table public.notifications
add column if not exists deep_link text;

alter table public.notifications
add column if not exists scheduled_at timestamptz;

alter table public.notifications
add column if not exists sent_at timestamptz;

alter table public.notifications
add column if not exists delivered_at timestamptz;

alter table public.notifications
add column if not exists failure_reason text;

alter table public.notifications
add column if not exists deduplication_key text;

alter table public.notifications
add column if not exists created_at timestamptz;


create index if not exists
  idx_notifications_queue
on public.notifications (
  status,
  scheduled_at
);


create index if not exists
  idx_notifications_user
on public.notifications (
  user_id,
  created_at desc
);


create unique index if not exists
  idx_notifications_deduplication_key
on public.notifications (
  deduplication_key
)
where
  deduplication_key is not null;


-- ============================================================
-- 4. RLS — PUSH TOKENS
-- ============================================================

alter table public.device_push_tokens
enable row level security;


drop policy if exists
  device_push_tokens_self
on public.device_push_tokens;


create policy device_push_tokens_self
on public.device_push_tokens
for all
to authenticated
using (
  user_id = auth.uid()
)
with check (
  user_id = auth.uid()
);


-- ============================================================
-- 5. RLS — NOTIFICATIONS
--
-- Users may read their own notifications.
--
-- Creation / dispatch is done by server-side code.
-- ============================================================

alter table public.notifications
enable row level security;


drop policy if exists
  notifications_self_read
on public.notifications;


create policy notifications_self_read
on public.notifications
for select
to authenticated
using (
  user_id = auth.uid()
);


-- ============================================================
-- 6. INTERNAL MONTHLY METER STATUS VIEW
--
-- This is the source of truth for:
--
-- Tenant:
--   RED   = Need to send values
--   GREEN = Submitted
--
-- Landlord:
--   RED   = Tenant has not submitted
--   GREEN = Tenant submitted
--
-- Billing period is automatically recalculated each month.
-- No monthly RESET job is required.
-- ============================================================

create or replace view
public.v_meter_monthly_submission_status_internal
as

with active_tenancies as (

  select distinct on (
    t.property_id
  )

    t.id as tenancy_id,

    t.property_id

  from public.tenancies t

  where
    t.status = 'ACTIVE'

  order by
    t.property_id,
    t.created_at desc

),

meter_base as (

  select

    m.id as meter_id,

    m.property_id,

    at.tenancy_id,

    p.workspace_id,

    p.title as property_name,

    coalesce(
      w.default_timezone,
      'Europe/Kyiv'
    ) as timezone,

    date_trunc(
      'month',

      now()
      at time zone
      coalesce(
        w.default_timezone,
        'Europe/Kyiv'
      )
    )::date as billing_period

  from public.meters m

  join public.properties p
    on p.id =
       m.property_id

  join public.workspaces w
    on w.id =
       p.workspace_id

  join active_tenancies at
    on at.property_id =
       m.property_id

  join public.property_services ps
    on ps.id =
       m.property_service_id

  where
    m.status =
      'ACTIVE'

    and ps.is_active =
      true

    and ps.calculation_method =
      'METER'

)

select

  mb.meter_id,

  mb.property_id,

  mb.tenancy_id,

  mb.workspace_id,

  mb.property_name,

  mb.timezone,

  mb.billing_period,


  -- ==========================================================
  -- NUMBER OF ACTIVE REGISTERS
  -- ==========================================================

  (
    select
      count(*)

    from public.meter_registers mr

    where
      mr.meter_id =
        mb.meter_id

      and mr.active =
        true
  )::integer
  as required_register_count,


  -- ==========================================================
  -- REGISTERS WITH VALUE FOR CURRENT MONTH
  -- ==========================================================

  (
    select
      count(
        distinct mr.id
      )

    from public.meter_registers mr

    join public.meter_register_readings rr
      on rr.meter_register_id =
         mr.id

    join public.meter_reading_sessions rs
      on rs.id =
         rr.reading_session_id

    where
      mr.meter_id =
        mb.meter_id

      and mr.active =
        true

      and rs.meter_id =
        mb.meter_id

      and rs.billing_period =
        mb.billing_period

      and rr.current_value
        is not null
  )::integer
  as submitted_register_count,


  -- ==========================================================
  -- NUMBER OF REQUIRED PHOTOS
  -- ==========================================================

  (
    select
      count(*)

    from public.meter_registers mr

    where
      mr.meter_id =
        mb.meter_id

      and mr.active =
        true

      and mr.photo_required =
        true
  )::integer
  as required_photo_count,


  -- ==========================================================
  -- REQUIRED REGISTERS THAT HAVE PHOTOS
  -- ==========================================================

  (
    select
      count(
        distinct mr.id
      )

    from public.meter_registers mr

    join public.meter_register_readings rr
      on rr.meter_register_id =
         mr.id

    join public.meter_reading_sessions rs
      on rs.id =
         rr.reading_session_id

    join public.meter_reading_photos rp
      on rp.register_reading_id =
         rr.id

    where
      mr.meter_id =
        mb.meter_id

      and mr.active =
        true

      and mr.photo_required =
        true

      and rs.meter_id =
        mb.meter_id

      and rs.billing_period =
        mb.billing_period
  )::integer
  as submitted_photo_count,


  -- ==========================================================
  -- SUBMISSION DATE
  -- ==========================================================

  (
    select
      coalesce(
        rs.submitted_at,
        rs.updated_at,
        rs.created_at
      )

    from public.meter_reading_sessions rs

    where
      rs.meter_id =
        mb.meter_id

      and rs.billing_period =
        mb.billing_period

    order by
      coalesce(
        rs.submitted_at,
        rs.updated_at,
        rs.created_at
      )
      desc

    limit 1
  )
  as submitted_at,


  -- ==========================================================
  -- WHO SUBMITTED
  -- ==========================================================

  (
    select
      rs.submitted_by

    from public.meter_reading_sessions rs

    where
      rs.meter_id =
        mb.meter_id

      and rs.billing_period =
        mb.billing_period

    order by
      coalesce(
        rs.submitted_at,
        rs.updated_at,
        rs.created_at
      )
      desc

    limit 1
  )
  as submitted_by,


  -- ==========================================================
  -- WAS IT SUBMITTED BY THE TENANT?
  -- ==========================================================

  exists (

    select
      1

    from public.meter_reading_sessions rs

    join public.tenancy_members tm
      on tm.tenancy_id =
         mb.tenancy_id

      and tm.user_id =
         rs.submitted_by

      and tm.role =
         'TENANT'

    where
      rs.meter_id =
        mb.meter_id

      and rs.billing_period =
        mb.billing_period

  )
  as submitted_by_tenant,


  -- ==========================================================
  -- COMPLETE STATUS
  --
  -- ALL active registers must have values.
  --
  -- ALL photo_required registers must have photos.
  -- ==========================================================

  (

    (
      select
        count(*)

      from public.meter_registers mr

      where
        mr.meter_id =
          mb.meter_id

        and mr.active =
          true

    ) > 0


    and


    (

      select
        count(
          distinct mr.id
        )

      from public.meter_registers mr

      join public.meter_register_readings rr
        on rr.meter_register_id =
           mr.id

      join public.meter_reading_sessions rs
        on rs.id =
           rr.reading_session_id

      where
        mr.meter_id =
          mb.meter_id

        and mr.active =
          true

        and rs.meter_id =
          mb.meter_id

        and rs.billing_period =
          mb.billing_period

        and rr.current_value
          is not null

    )

    =

    (

      select
        count(*)

      from public.meter_registers mr

      where
        mr.meter_id =
          mb.meter_id

        and mr.active =
          true

    )


    and


    (

      select
        count(
          distinct mr.id
        )

      from public.meter_registers mr

      join public.meter_register_readings rr
        on rr.meter_register_id =
           mr.id

      join public.meter_reading_sessions rs
        on rs.id =
           rr.reading_session_id

      join public.meter_reading_photos rp
        on rp.register_reading_id =
           rr.id

      where
        mr.meter_id =
          mb.meter_id

        and mr.active =
          true

        and mr.photo_required =
          true

        and rs.meter_id =
          mb.meter_id

        and rs.billing_period =
          mb.billing_period

    )

    =

    (

      select
        count(*)

      from public.meter_registers mr

      where
        mr.meter_id =
          mb.meter_id

        and mr.active =
          true

        and mr.photo_required =
          true

    )

  )
  as submitted


from meter_base mb;


-- Clients should access this through the RPC,
-- not directly through the internal view.

revoke all
on public.v_meter_monthly_submission_status_internal
from anon;

revoke all
on public.v_meter_monthly_submission_status_internal
from authenticated;


-- ============================================================
-- 7. CLIENT RPC
--
-- Used by:
--
-- Tenant Home
-- Tenant Readings
-- Landlord Property Details
-- ============================================================

create or replace function
public.get_meter_submission_statuses(
  p_property_id uuid
  default null
)

returns table (

  meter_id uuid,

  property_id uuid,

  tenancy_id uuid,

  billing_period date,

  required_register_count integer,

  submitted_register_count integer,

  required_photo_count integer,

  submitted_photo_count integer,

  submitted boolean,

  submitted_at timestamptz,

  submitted_by_tenant boolean

)

language sql
stable
security definer

set search_path =
  public

as $$

  select

    s.meter_id,

    s.property_id,

    s.tenancy_id,

    s.billing_period,

    s.required_register_count,

    s.submitted_register_count,

    s.required_photo_count,

    s.submitted_photo_count,

    s.submitted,

    s.submitted_at,

    s.submitted_by_tenant

  from
    public.v_meter_monthly_submission_status_internal s

  where

    (
      p_property_id
        is null

      or

      s.property_id =
        p_property_id
    )

    and

    public.can_access_property(
      s.property_id
    )

  order by

    s.property_id,

    s.meter_id;

$$;


revoke all
on function
public.get_meter_submission_statuses(uuid)
from public;


grant execute
on function
public.get_meter_submission_statuses(uuid)
to authenticated;


-- ============================================================
-- 8. QUEUE METER REMINDERS
--
-- IMPORTANT:
--
-- This function does NOT send push notifications.
--
-- It only creates notification rows.
--
-- Edge Function:
--
--   send-meter-reminders
--
-- will later send QUEUED rows through Expo.
--
-- Logic:
--
-- 1st day:
--   queue reminder if anything is missing
--
-- 3rd day:
--   queue another reminder if anything is still missing
--
-- Different timezone per user is supported.
-- ============================================================

create or replace function
public.queue_meter_reading_reminders()

returns integer

language plpgsql

security definer

set search_path =
  public

as $$

declare

  v_inserted integer :=
    0;

begin

  with missing_by_property as (

    select

      s.tenancy_id,

      s.property_id,

      s.billing_period,

      s.property_name,

      count(*) filter (
        where
          s.submitted =
            false
      )::integer
      as missing_meter_count

    from
      public.v_meter_monthly_submission_status_internal s

    group by

      s.tenancy_id,

      s.property_id,

      s.billing_period,

      s.property_name

  ),


  recipients as (

    select

      mbp.tenancy_id,

      mbp.property_id,

      mbp.billing_period,

      mbp.property_name,

      mbp.missing_meter_count,

      tm.user_id,

      coalesce(
        us.language_code,
        'uk'
      )
      as language_code,

      coalesce(
        us.timezone,
        'Europe/Kyiv'
      )
      as timezone,

      coalesce(
        us.push_enabled,
        true
      )
      as push_enabled

    from
      missing_by_property mbp

    join public.tenancy_members tm

      on tm.tenancy_id =
         mbp.tenancy_id

      and tm.role =
         'TENANT'

    left join public.user_settings us

      on us.user_id =
         tm.user_id

    where

      mbp.missing_meter_count >
        0

  ),


  due as (

    select

      r.*,

      (
        now()
        at time zone
        r.timezone
      )::date
      as local_date,

      extract(
        hour
        from
          now()
          at time zone
          r.timezone
      )::integer
      as local_hour

    from
      recipients r

    where

      r.push_enabled =
        true

  ),


  notifications_due as (

    select
      *

    from
      due

    where

      extract(
        day
        from local_date
      )::integer
      in (
        1,
        3
      )

      and

      local_hour >=
        9

  ),


  inserted as (

    insert into
      public.notifications (

        user_id,

        channel,

        status,

        language_code,

        title_key,

        body_key,

        template_data,

        deep_link,

        scheduled_at,

        deduplication_key

      )

    select

      d.user_id,

      'PUSH',

      'QUEUED',

      d.language_code,

      'meter_readings_due',

      'meter_readings_due',

      jsonb_build_object(

        'property_id',
        d.property_id,

        'property_name',
        d.property_name,

        'tenancy_id',
        d.tenancy_id,

        'billing_period',
        d.billing_period,

        'missing_meter_count',
        d.missing_meter_count,

        'due_day',
        5,

        'reminder_day',
        extract(
          day
          from d.local_date
        )::integer

      ),

      null,

      now(),

      format(

        'meter-readings:%s:%s:%s:%s',

        d.tenancy_id,

        d.user_id,

        to_char(
          d.billing_period,
          'YYYY-MM'
        ),

        extract(
          day
          from d.local_date
        )::integer

      )

    from
      notifications_due d

    on conflict (
      deduplication_key
    )
    where
      deduplication_key
      is not null

    do nothing

    returning
      1

  )

  select
    count(*)

  into
    v_inserted

  from
    inserted;


  return
    v_inserted;

end;

$$;


-- Only server-side execution.
-- Mobile clients must NOT manually queue notifications.

revoke all
on function
public.queue_meter_reading_reminders()
from public;


revoke all
on function
public.queue_meter_reading_reminders()
from authenticated;


grant execute
on function
public.queue_meter_reading_reminders()
to service_role;


commit;


-- ============================================================
-- VERIFICATION
-- ============================================================


-- ------------------------------------------------------------
-- Notification tables
-- ------------------------------------------------------------

select

  table_name

from
  information_schema.tables

where
  table_schema =
    'public'

  and table_name in (

    'notifications',

    'device_push_tokens'

  )

order by
  table_name;


-- ------------------------------------------------------------
-- RPCs
-- ------------------------------------------------------------

select

  routine_name

from
  information_schema.routines

where
  routine_schema =
    'public'

  and routine_name in (

    'get_meter_submission_statuses',

    'queue_meter_reading_reminders'

  )

order by
  routine_name;


-- ------------------------------------------------------------
-- Current meter status
-- ------------------------------------------------------------

select

  meter_id,

  property_id,

  tenancy_id,

  billing_period,

  required_register_count,

  submitted_register_count,

  required_photo_count,

  submitted_photo_count,

  submitted,

  submitted_at,

  submitted_by_tenant

from
  public.v_meter_monthly_submission_status_internal

order by
  property_id,
  meter_id;