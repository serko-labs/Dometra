-- ============================================================
-- DOMETRA
-- Mobile core follow-up
-- ============================================================


-- ============================================================
-- EXPLICIT API GRANTS
-- RLS still decides which rows are accessible.
-- ============================================================

grant usage
on schema public
to authenticated;


grant select, update
on public.profiles
to authenticated;


grant select, update
on public.user_settings
to authenticated;


grant select
on public.workspaces
to authenticated;


grant select
on public.workspace_members
to authenticated;


grant select
on public.workspace_subscriptions
to authenticated;


grant select, insert, update
on public.properties
to authenticated;


grant select, insert, update
on public.property_services
to authenticated;


grant select, insert, update
on public.meters
to authenticated;


grant select, insert, update
on public.meter_registers
to authenticated;


grant select, insert, update
on public.service_tariffs
to authenticated;


grant select, insert, update
on public.service_period_values
to authenticated;


grant select, insert
on public.media_files
to authenticated;


grant select, insert, update
on public.meter_reading_sessions
to authenticated;


grant select, insert, update
on public.meter_register_readings
to authenticated;


grant select, insert, update, delete
on public.meter_reading_photos
to authenticated;


grant select
on public.audit_log
to authenticated;


grant select
on public.v_current_service_tariffs
to authenticated;


grant select
on public.v_latest_meter_register_readings
to authenticated;


grant select
on public.v_latest_service_period_values
to authenticated;


-- ============================================================
-- RPC PERMISSIONS
-- ============================================================

revoke execute
on function public.save_property_service(
  uuid,
  uuid,
  text,
  text,
  text,
  char,
  numeric,
  numeric,
  numeric
)
from public, anon;


grant execute
on function public.save_property_service(
  uuid,
  uuid,
  text,
  text,
  text,
  char,
  numeric,
  numeric,
  numeric
)
to authenticated;


revoke execute
on function public.archive_property_service(uuid)
from public, anon;


grant execute
on function public.archive_property_service(uuid)
to authenticated;


revoke execute
on function public.save_service_period_value(
  uuid,
  date,
  numeric
)
from public, anon;


grant execute
on function public.save_service_period_value(
  uuid,
  date,
  numeric
)
to authenticated;


revoke execute
on function public.save_meter_readings(
  uuid,
  date,
  date,
  jsonb
)
from public, anon;


grant execute
on function public.save_meter_readings(
  uuid,
  date,
  date,
  jsonb
)
to authenticated;


-- ============================================================
-- USER SETTINGS AUDIT
--
-- Settings are also business/user data and should not depend
-- on client-side logging.
-- ============================================================

create or replace function public.audit_user_settings_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_workspace_id uuid;
  v_session_id uuid;
begin

  select
    id
  into
    v_workspace_id
  from
    public.workspaces
  where
    owner_user_id =
      new.user_id
  order by
    created_at
  limit 1;


  begin
    v_session_id :=
      nullif(
        (select auth.jwt()) ->> 'session_id',
        ''
      )::uuid;

  exception
    when others then
      v_session_id :=
        null;
  end;


  insert into public.audit_log (
    workspace_id,
    user_id,
    session_id,
    table_name,
    entity_id,
    action,
    before_data,
    after_data
  )
  values (
    v_workspace_id,
    (select auth.uid()),
    v_session_id,
    'user_settings',
    new.user_id,
    'UPDATE',
    to_jsonb(old),
    to_jsonb(new)
  );


  return new;
end;
$$;


drop trigger if exists
  trg_user_settings_audit
on public.user_settings;


create trigger
  trg_user_settings_audit
after update
on public.user_settings
for each row
execute function
  public.audit_user_settings_change();


-- ============================================================
-- ONE PHOTO ASSOCIATION PER SAVED REGISTER READING
--
-- Replacing a photo updates the relation instead of producing
-- multiple active photos for the same reading.
-- ============================================================

delete from public.meter_reading_photos a
using public.meter_reading_photos b
where
  a.register_reading_id =
    b.register_reading_id
  and
  a.id < b.id;


create unique index if not exists
  uq_meter_reading_photo_register
on public.meter_reading_photos (
  register_reading_id
);


-- ============================================================
-- SAVE METER READINGS
-- Replaces the photo relation when a reading is edited.
-- ============================================================

create or replace function public.save_meter_readings(
  p_meter_id uuid,

  p_billing_period date,

  p_reading_date date,

  p_readings jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_property_id uuid;

  v_workspace_id uuid;

  v_session_id uuid;

  v_item jsonb;

  v_register_id uuid;

  v_current numeric;

  v_previous numeric;

  v_register_reading_id uuid;

  v_photo_path text;

  v_mime_type text;

  v_media_id uuid;
begin

  select
    m.property_id,
    p.workspace_id
  into
    v_property_id,
    v_workspace_id
  from
    public.meters m

  join
    public.properties p
      on
        p.id =
        m.property_id

  where
    m.id =
      p_meter_id

    and

    m.status =
      'ACTIVE';


  if
    v_property_id is null
  then
    raise exception
      'Meter not found';
  end if;


  if
    not public.can_access_property(
      v_property_id
    )
  then
    raise exception
      'Not allowed';
  end if;


  insert into public.meter_reading_sessions (
    meter_id,
    billing_period,
    reading_date,
    status,
    submitted_by,
    submitted_at
  )
  values (
    p_meter_id,

    date_trunc(
      'month',
      p_billing_period
    )::date,

    p_reading_date,

    'SUBMITTED',

    (select auth.uid()),

    now()
  )

  on conflict (
    meter_id,
    billing_period
  )

  do update set
    reading_date =
      excluded.reading_date,

    status =
      'SUBMITTED',

    submitted_by =
      excluded.submitted_by,

    submitted_at =
      now()

  returning
    id
  into
    v_session_id;


  for v_item in
    select
      value
    from
      jsonb_array_elements(
        p_readings
      )
  loop

    v_register_id :=
      (
        v_item ->>
          'register_id'
      )::uuid;


    v_current :=
      (
        v_item ->>
          'current_value'
      )::numeric;


    if
      not exists (
        select 1
        from
          public.meter_registers mr
        where
          mr.id =
            v_register_id
          and
          mr.meter_id =
            p_meter_id
          and
          mr.active
      )
    then
      raise exception
        'Register does not belong to meter';
    end if;


    select
      rr.current_value
    into
      v_previous
    from
      public.meter_register_readings rr

    join
      public.meter_reading_sessions rs
        on
          rs.id =
          rr.reading_session_id

    where
      rr.meter_register_id =
        v_register_id

      and

      rs.meter_id =
        p_meter_id

      and

      rs.billing_period <
        date_trunc(
          'month',
          p_billing_period
        )::date

    order by
      rs.billing_period desc,
      rs.reading_date desc

    limit 1;


    v_previous :=
      coalesce(
        v_previous,
        0
      );


    if
      v_current <
      v_previous
    then
      raise exception
        'Current reading cannot be less than previous reading';
    end if;


    insert into public.meter_register_readings (
      reading_session_id,
      meter_register_id,
      previous_value,
      current_value,
      consumption
    )
    values (
      v_session_id,
      v_register_id,
      v_previous,
      v_current,
      v_current -
        v_previous
    )

    on conflict (
      reading_session_id,
      meter_register_id
    )

    do update set
      previous_value =
        excluded.previous_value,

      current_value =
        excluded.current_value,

      consumption =
        excluded.consumption

    returning
      id
    into
      v_register_reading_id;


    v_photo_path :=
      nullif(
        v_item ->>
          'photo_path',
        ''
      );


    v_mime_type :=
      nullif(
        v_item ->>
          'mime_type',
        ''
      );


    if
      v_photo_path is not null
    then

      insert into public.media_files (
        workspace_id,
        property_id,
        bucket,
        storage_path,
        mime_type,
        captured_at,
        uploaded_by
      )
      values (
        v_workspace_id,
        v_property_id,
        'meter-photos',
        v_photo_path,
        v_mime_type,
        now(),
        (select auth.uid())
      )

      on conflict (
        bucket,
        storage_path
      )

      do update set
        mime_type =
          excluded.mime_type

      returning
        id
      into
        v_media_id;


      insert into public.meter_reading_photos (
        register_reading_id,
        media_file_id
      )
      values (
        v_register_reading_id,
        v_media_id
      )

      on conflict (
        register_reading_id
      )

      do update set
        media_file_id =
          excluded.media_file_id;

    end if;

  end loop;


  return
    v_session_id;
end;
$$;


grant execute
on function public.save_meter_readings(
  uuid,
  date,
  date,
  jsonb
)
to authenticated;