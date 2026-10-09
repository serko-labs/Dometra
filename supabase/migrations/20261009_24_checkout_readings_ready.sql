-- ============================================================
-- DOMETRA
-- CHECKOUT FINAL READINGS -> LANDLORD READY NOTIFICATION
-- ============================================================
--
-- Current checkout lifecycle:
--
--   PENDING
--      ↓
--   tenant submits final readings
--      ↓
--   landlord reviews
--      ↓
--   landlord completes checkout
--      ↓
--   COMPLETED / tenancy ENDED
--
--
-- IMPORTANT:
--
-- Tenant submission does NOT automatically complete checkout.
--
-- Landlord still needs to:
--
--   * review final meter values
--   * review photos if present
--   * settle the security deposit
--   * confirm tenancy termination
--
--
-- This migration adds the missing signal:
--
--   all final readings submitted
--          ↓
--   landlord receives IN_APP notification
--
-- ============================================================


-- ============================================================
-- CHECK WHETHER A CHECKOUT HAS ALL REQUIRED READINGS
-- ============================================================

create or replace function public.checkout_has_all_final_readings(
  p_tenancy_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_property_id uuid;

  v_required_count integer := 0;

  v_submitted_count integer := 0;

begin

  select
    t.property_id

  into
    v_property_id

  from public.tenancies t

  where
    t.id =
      p_tenancy_id;


  if v_property_id is null then
    return false;
  end if;


  -- ----------------------------------------------------------
  -- Required active registers
  -- ----------------------------------------------------------

  select
    count(*)

  into
    v_required_count

  from public.meter_registers mr

  join public.meters m
    on m.id =
      mr.meter_id

  where
    m.property_id =
      v_property_id

    and m.status::text =
      'ACTIVE'

    and mr.active =
      true;


  if v_required_count =
    0
  then
    return true;
  end if;


  -- ----------------------------------------------------------
  -- Submitted final readings
  -- ----------------------------------------------------------

  select
    count(
      distinct cr.meter_register_id
    )

  into
    v_submitted_count

  from public.tenancy_checkout_readings cr

  join public.meter_registers mr
    on mr.id =
      cr.meter_register_id

  join public.meters m
    on m.id =
      mr.meter_id

  where
    cr.tenancy_id =
      p_tenancy_id

    and cr.value
      is not null

    and m.property_id =
      v_property_id

    and m.status::text =
      'ACTIVE'

    and mr.active =
      true;


  return
    v_submitted_count >=
    v_required_count;

end;
$$;


revoke all
on function public.checkout_has_all_final_readings(uuid)
from public;

grant execute
on function public.checkout_has_all_final_readings(uuid)
to authenticated;


-- ============================================================
-- NOTIFY LANDLORD
-- ============================================================

create or replace function public.notify_checkout_readings_ready()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_checkout_status text;

  v_property_id uuid;

  v_property_name text;

  v_workspace_id uuid;

  v_manager_user_id uuid;

begin

  /*
   * Notifications must NEVER block saving meter readings.
   */

  select
    c.status::text

  into
    v_checkout_status

  from public.tenancy_checkouts c

  where
    c.tenancy_id =
      new.tenancy_id

  limit 1;


  if v_checkout_status is distinct from
    'PENDING'
  then
    return new;
  end if;


  if not public.checkout_has_all_final_readings(
    new.tenancy_id
  )
  then
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


  if v_workspace_id is null then
    return new;
  end if;


  -- ----------------------------------------------------------
  -- Notify every manager once.
  -- ----------------------------------------------------------

  for v_manager_user_id in

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

    if not exists (

      select
        1

      from public.notifications n

      where
        n.user_id =
          v_manager_user_id

        and n.channel::text =
          'IN_APP'

        and n.event_type =
          'CHECKOUT_READINGS_SUBMITTED'

        and n.tenancy_id =
          new.tenancy_id

    )
    then

      perform
        public.create_in_app_notification(
          v_manager_user_id,

          'CHECKOUT_READINGS_SUBMITTED',

          'notification.checkoutReadingsSubmitted.title',

          'notification.checkoutReadingsSubmitted.body',

          jsonb_build_object(
            'propertyName',
            v_property_name
          ),

          v_property_id,

          new.tenancy_id,

          null
        );

    end if;

  end loop;


  return new;


exception
  when others then

    raise warning
      'Unable to notify landlord that checkout readings are ready for tenancy %: %',
      new.tenancy_id,
      sqlerrm;

    return new;

end;
$$;


drop trigger if exists
  trg_checkout_readings_ready
on public.tenancy_checkout_readings;


create trigger
  trg_checkout_readings_ready

after insert or update of value
on public.tenancy_checkout_readings

for each row

execute function
  public.notify_checkout_readings_ready();


-- ============================================================
-- BACKFILL CURRENT PENDING CHECKOUTS
-- ============================================================
--
-- Important for a checkout where the tenant already submitted
-- all readings BEFORE this migration was installed.
--
-- ============================================================

do $$
declare
  v_checkout record;

  v_property_id uuid;

  v_property_name text;

  v_workspace_id uuid;

  v_manager_user_id uuid;

begin

  for v_checkout in

    select
      c.tenancy_id

    from public.tenancy_checkouts c

    where
      c.status::text =
        'PENDING'

  loop

    if public.checkout_has_all_final_readings(
      v_checkout.tenancy_id
    )
    then

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
          v_checkout.tenancy_id;


      for v_manager_user_id in

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

        if not exists (

          select
            1

          from public.notifications n

          where
            n.user_id =
              v_manager_user_id

            and n.channel::text =
              'IN_APP'

            and n.event_type =
              'CHECKOUT_READINGS_SUBMITTED'

            and n.tenancy_id =
              v_checkout.tenancy_id

        )
        then

          perform
            public.create_in_app_notification(
              v_manager_user_id,

              'CHECKOUT_READINGS_SUBMITTED',

              'notification.checkoutReadingsSubmitted.title',

              'notification.checkoutReadingsSubmitted.body',

              jsonb_build_object(
                'propertyName',
                v_property_name
              ),

              v_property_id,

              v_checkout.tenancy_id,

              null
            );

        end if;

      end loop;

    end if;

  end loop;

end
$$;