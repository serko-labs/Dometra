-- ============================================================
-- DOMETRA
-- IN-APP NOTIFICATION CENTER
-- ============================================================
--
-- Existing public.notifications table remains the central
-- notification store.
--
-- PUSH / EMAIL / IN_APP are separate delivery channels.
--
-- This migration adds:
--
--   event_type
--   property_id
--   tenancy_id
--   read_at
--
-- and creates automatic IN_APP events for:
--
--   PAYMENT_REPORTED
--   PAYMENT_CONFIRMED
--   PAYMENT_REJECTED
--   CHECKOUT_STARTED
--   CHECKOUT_COMPLETED
--
-- ============================================================


-- ============================================================
-- NOTIFICATION METADATA
-- ============================================================

alter table public.notifications
add column if not exists
  event_type text;


alter table public.notifications
add column if not exists
  property_id uuid
  references public.properties(id)
  on delete set null;


alter table public.notifications
add column if not exists
  tenancy_id uuid
  references public.tenancies(id)
  on delete set null;


alter table public.notifications
add column if not exists
  read_at timestamptz;


-- ============================================================
-- INDEXES
-- ============================================================

create index if not exists
  idx_notifications_user_in_app_created

on public.notifications (
  user_id,
  created_at desc
)

where channel::text =
  'IN_APP';


create index if not exists
  idx_notifications_user_unread

on public.notifications (
  user_id,
  created_at desc
)

where
  channel::text =
    'IN_APP'

  and read_at
    is null;


create index if not exists
  idx_notifications_property

on public.notifications (
  property_id,
  created_at desc
);


create index if not exists
  idx_notifications_tenancy

on public.notifications (
  tenancy_id,
  created_at desc
);


-- ============================================================
-- RLS
-- ============================================================

alter table public.notifications
enable row level security;


drop policy if exists
  notifications_self_read
on public.notifications;


create policy
  notifications_self_read

on public.notifications

for select

to authenticated

using (
  user_id =
    auth.uid()
);


-- Direct UPDATE from the client stays disabled.
--
-- Read state is changed only through the RPC functions below.
-- This prevents the client from modifying event metadata.


-- ============================================================
-- INTERNAL NOTIFICATION CREATOR
-- ============================================================
--
-- Trigger-only helper.
--
-- DO NOT grant this function to authenticated users.
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

end;
$$;


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
-- MARK ONE NOTIFICATION READ
-- ============================================================

create or replace function public.mark_notification_read(
  p_notification_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin

  if auth.uid() is null then
    raise exception
      'Authentication is required.';
  end if;


  update public.notifications

  set
    read_at =
      coalesce(
        read_at,
        now()
      )

  where
    id =
      p_notification_id

    and user_id =
      auth.uid()

    and channel::text =
      'IN_APP';

end;
$$;


grant execute
on function public.mark_notification_read(uuid)
to authenticated;


-- ============================================================
-- MARK ALL NOTIFICATIONS READ
-- ============================================================

create or replace function public.mark_all_notifications_read()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin

  if auth.uid() is null then
    raise exception
      'Authentication is required.';
  end if;


  update public.notifications

  set
    read_at =
      now()

  where
    user_id =
      auth.uid()

    and channel::text =
      'IN_APP'

    and read_at
      is null;

end;
$$;


grant execute
on function public.mark_all_notifications_read()
to authenticated;


-- ============================================================
-- PAYMENT CLAIM NOTIFICATIONS
-- ============================================================

create or replace function public.handle_payment_claim_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_property_id uuid;

  v_property_name text;

  v_workspace_id uuid;

  v_user_id uuid;

  v_status_changed boolean;

begin

  v_status_changed :=
    tg_op =
      'INSERT'

    or old.status::text is distinct from
      new.status::text;


  if not v_status_changed then
    return new;
  end if;


  select
    p.id,
    coalesce(
      nullif(
        trim(
          p.title
        ),
        ''
      ),
      nullif(
        trim(
          p.street
        ),
        ''
      ),
      'Apartment'
    ),
    p.workspace_id

  into
    v_property_id,
    v_property_name,
    v_workspace_id

  from public.tenancies t

  join public.properties p
    on p.id =
      t.property_id

  where
    t.id =
      new.tenancy_id;


  if v_property_id is null then
    return new;
  end if;


  -- ----------------------------------------------------------
  -- TENANT REPORTED PAYMENT -> LANDLORD
  -- ----------------------------------------------------------

  if new.status::text =
    'REPORTED'
  then

    for v_user_id in

      select
        wm.user_id

      from public.workspace_members wm

      where
        wm.workspace_id =
          v_workspace_id

        and wm.role::text in (
          'OWNER',
          'ADMIN',
          'MANAGER'
        )

    loop

      perform
        public.create_in_app_notification(
          v_user_id,

          'PAYMENT_REPORTED',

          'notification.paymentReported.title',

          'notification.paymentReported.body',

          jsonb_build_object(
            'propertyName',
            v_property_name,

            'billingPeriod',
            new.billing_period,

            'claimId',
            new.id
          ),

          v_property_id,

          new.tenancy_id,

          null
        );

    end loop;


  -- ----------------------------------------------------------
  -- LANDLORD CONFIRMED PAYMENT -> TENANT
  -- ----------------------------------------------------------

  elsif new.status::text =
    'CONFIRMED'
  then

    for v_user_id in

      select
        tm.user_id

      from public.tenancy_members tm

      where
        tm.tenancy_id =
          new.tenancy_id

    loop

      perform
        public.create_in_app_notification(
          v_user_id,

          'PAYMENT_CONFIRMED',

          'notification.paymentConfirmed.title',

          'notification.paymentConfirmed.body',

          jsonb_build_object(
            'propertyName',
            v_property_name,

            'billingPeriod',
            new.billing_period,

            'claimId',
            new.id
          ),

          v_property_id,

          new.tenancy_id,

          null
        );

    end loop;


  -- ----------------------------------------------------------
  -- LANDLORD REJECTED PAYMENT -> TENANT
  -- ----------------------------------------------------------

  elsif new.status::text =
    'REJECTED'
  then

    for v_user_id in

      select
        tm.user_id

      from public.tenancy_members tm

      where
        tm.tenancy_id =
          new.tenancy_id

    loop

      perform
        public.create_in_app_notification(
          v_user_id,

          'PAYMENT_REJECTED',

          'notification.paymentRejected.title',

          'notification.paymentRejected.body',

          jsonb_build_object(
            'propertyName',
            v_property_name,

            'billingPeriod',
            new.billing_period,

            'claimId',
            new.id,

            'note',
            new.rejection_note
          ),

          v_property_id,

          new.tenancy_id,

          null
        );

    end loop;

  end if;


  return new;

end;
$$;


drop trigger if exists
  trg_tenant_payment_claim_notification
on public.tenant_payment_claims;


create trigger
  trg_tenant_payment_claim_notification

after insert or update of status
on public.tenant_payment_claims

for each row

execute function
  public.handle_payment_claim_notification();


-- ============================================================
-- CHECKOUT NOTIFICATIONS
-- ============================================================

create or replace function public.handle_checkout_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_property_id uuid;

  v_property_name text;

  v_user_id uuid;

  v_status_changed boolean;

begin

  v_status_changed :=
    tg_op =
      'INSERT'

    or old.status::text is distinct from
      new.status::text;


  if not v_status_changed then
    return new;
  end if;


  select
    p.id,
    coalesce(
      nullif(
        trim(
          p.title
        ),
        ''
      ),
      nullif(
        trim(
          p.street
        ),
        ''
      ),
      'Apartment'
    )

  into
    v_property_id,
    v_property_name

  from public.tenancies t

  join public.properties p
    on p.id =
      t.property_id

  where
    t.id =
      new.tenancy_id;


  if v_property_id is null then
    return new;
  end if;


  -- ----------------------------------------------------------
  -- CHECKOUT STARTED
  -- ----------------------------------------------------------

  if new.status::text =
    'PENDING'
  then

    for v_user_id in

      select
        tm.user_id

      from public.tenancy_members tm

      where
        tm.tenancy_id =
          new.tenancy_id

    loop

      perform
        public.create_in_app_notification(
          v_user_id,

          'CHECKOUT_STARTED',

          'notification.checkoutStarted.title',

          'notification.checkoutStarted.body',

          jsonb_build_object(
            'propertyName',
            v_property_name
          ),

          v_property_id,

          new.tenancy_id,

          null
        );

    end loop;


  -- ----------------------------------------------------------
  -- CHECKOUT COMPLETED
  -- ----------------------------------------------------------

  elsif new.status::text =
    'COMPLETED'
  then

    for v_user_id in

      select
        tm.user_id

      from public.tenancy_members tm

      where
        tm.tenancy_id =
          new.tenancy_id

    loop

      perform
        public.create_in_app_notification(
          v_user_id,

          'CHECKOUT_COMPLETED',

          'notification.checkoutCompleted.title',

          'notification.checkoutCompleted.body',

          jsonb_build_object(
            'propertyName',
            v_property_name
          ),

          v_property_id,

          new.tenancy_id,

          null
        );

    end loop;

  end if;


  return new;

end;
$$;


drop trigger if exists
  trg_tenancy_checkout_notification
on public.tenancy_checkouts;


create trigger
  trg_tenancy_checkout_notification

after insert or update of status
on public.tenancy_checkouts

for each row

execute function
  public.handle_checkout_notification();