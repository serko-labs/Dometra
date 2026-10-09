-- ============================================================
-- DOMETRA
-- NOTIFICATION CENTER HOTFIX
-- ============================================================
--
-- Fixes:
--
-- 1. Older/live user_settings schemas may not contain:
--
--      in_app_enabled
--
-- 2. Notification creation must NEVER break a business action
--    such as:
--
--      confirm payment
--      reject payment
--      start checkout
--      complete checkout
--
-- Notification delivery is secondary.
-- Core business operations must still succeed if notification
-- creation fails.
--
-- ============================================================


-- ============================================================
-- USER SETTINGS
-- ============================================================

alter table public.user_settings
add column if not exists
  in_app_enabled boolean
  not null
  default true;


-- Make sure old rows are valid as well.

update public.user_settings
set
  in_app_enabled = true
where
  in_app_enabled is null;


-- ============================================================
-- SAFE IN-APP NOTIFICATION CREATOR
-- ============================================================

create or replace function public.create_in_app_notification(
  p_user_id uuid,
  p_event_type text,
  p_title_key text,
  p_body_key text,
  p_template_data jsonb default '{}'::jsonb,
  p_property_id uuid default null,
  p_tenancy_id uuid default null,
  p_deep_link text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_language_code varchar(10);

  v_enabled boolean;

  v_notification_id uuid;

begin

  if p_user_id is null then
    return null;
  end if;


  -- ----------------------------------------------------------
  -- USER SETTINGS
  -- ----------------------------------------------------------

  select
    us.language_code,
    us.in_app_enabled

  into
    v_language_code,
    v_enabled

  from public.user_settings us

  where
    us.user_id =
      p_user_id;


  v_language_code :=
    coalesce(
      v_language_code,
      'uk'
    );


  v_enabled :=
    coalesce(
      v_enabled,
      true
    );


  if not v_enabled then
    return null;
  end if;


  -- ----------------------------------------------------------
  -- CREATE IN-APP NOTIFICATION
  -- ----------------------------------------------------------

  insert into public.notifications (
    user_id,
    channel,
    status,
    language_code,
    title_key,
    body_key,
    template_data,
    deep_link,
    scheduled_at,
    sent_at,
    delivered_at,
    event_type,
    property_id,
    tenancy_id,
    read_at
  )
  values (
    p_user_id,
    'IN_APP',
    'DELIVERED',
    v_language_code,
    p_title_key,
    p_body_key,
    coalesce(
      p_template_data,
      '{}'::jsonb
    ),
    p_deep_link,
    now(),
    now(),
    now(),
    p_event_type,
    p_property_id,
    p_tenancy_id,
    null
  )

  returning
    id

  into
    v_notification_id;


  return
    v_notification_id;


-- ============================================================
-- IMPORTANT
-- ============================================================
--
-- Notifications are secondary.
--
-- A notification failure must NOT rollback:
--
--   payment confirmation
--   payment rejection
--   checkout
--   or any future business operation
--
-- ============================================================

exception
  when others then

    raise warning
      'Dometra notification creation failed for user %, event %: %',
      p_user_id,
      p_event_type,
      sqlerrm;

    return null;

end;
$$;


-- ============================================================
-- SECURITY
-- ============================================================

revoke all
on function public.create_in_app_notification(
  uuid,
  text,
  text,
  text,
  jsonb,
  uuid,
  uuid,
  text
)
from public;


revoke all
on function public.create_in_app_notification(
  uuid,
  text,
  text,
  text,
  jsonb,
  uuid,
  uuid,
  text
)
from anon;


revoke all
on function public.create_in_app_notification(
  uuid,
  text,
  text,
  text,
  jsonb,
  uuid,
  uuid,
  text
)
from authenticated;


-- ============================================================
-- VALIDATION
-- ============================================================

do $$
declare
  v_exists boolean;
begin

  select exists (
    select
      1

    from information_schema.columns

    where
      table_schema =
        'public'

      and table_name =
        'user_settings'

      and column_name =
        'in_app_enabled'
  )

  into
    v_exists;


  if not v_exists then
    raise exception
      'user_settings.in_app_enabled was not created.';
  end if;

end
$$;