-- ============================================================
-- DOMETRA
-- Tenant portal access
-- 2026-09-30
--
-- Allows an ACTIVE tenancy member to:
--
-- - read their apartment
-- - read meters/services/tariffs
-- - read historical meter values
-- - upload meter reading photos
-- - submit meter readings
--
-- Landlord management permissions remain unchanged.
-- ============================================================


-- ============================================================
-- PROPERTY ACCESS HELPER
-- ============================================================

create or replace function public.can_view_property(
  p_property_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.can_access_property(
      p_property_id
    )

    or

    public.has_tenant_access_to_property(
      p_property_id
    );
$$;


revoke execute
on function public.can_view_property(uuid)
from public, anon;


grant execute
on function public.can_view_property(uuid)
to authenticated;


-- ============================================================
-- PROPERTIES
-- ============================================================

drop policy if exists
  properties_read
on public.properties;


create policy
  properties_read
on public.properties
for select
to authenticated
using (
  public.can_view_property(
    id
  )
);


-- ============================================================
-- PROPERTY SERVICES
-- ============================================================

drop policy if exists
  property_services_read
on public.property_services;


create policy
  property_services_read
on public.property_services
for select
to authenticated
using (
  public.can_view_property(
    property_id
  )
);


-- ============================================================
-- METERS
-- ============================================================

drop policy if exists
  meters_read
on public.meters;


create policy
  meters_read
on public.meters
for select
to authenticated
using (
  public.can_view_property(
    property_id
  )
);


-- ============================================================
-- METER REGISTERS
-- ============================================================

drop policy if exists
  meter_registers_read
on public.meter_registers;


create policy
  meter_registers_read
on public.meter_registers
for select
to authenticated
using (
  exists (
    select 1

    from public.meters m

    where
      m.id =
        meter_id

      and

      public.can_view_property(
        m.property_id
      )
  )
);


-- ============================================================
-- SERVICE TARIFFS
-- ============================================================

drop policy if exists
  service_tariffs_read
on public.service_tariffs;


create policy
  service_tariffs_read
on public.service_tariffs
for select
to authenticated
using (
  exists (
    select 1

    from public.property_services ps

    where
      ps.id =
        property_service_id

      and

      public.can_view_property(
        ps.property_id
      )
  )
);


-- ============================================================
-- VARIABLE SERVICE VALUES
-- ============================================================

drop policy if exists
  service_period_values_read
on public.service_period_values;


create policy
  service_period_values_read
on public.service_period_values
for select
to authenticated
using (
  exists (
    select 1

    from public.property_services ps

    where
      ps.id =
        property_service_id

      and

      public.can_view_property(
        ps.property_id
      )
  )
);


-- ============================================================
-- READING SESSIONS
-- ============================================================

drop policy if exists
  reading_sessions_read
on public.meter_reading_sessions;


create policy
  reading_sessions_read
on public.meter_reading_sessions
for select
to authenticated
using (
  exists (
    select 1

    from public.meters m

    where
      m.id =
        meter_id

      and

      public.can_view_property(
        m.property_id
      )
  )
);


drop policy if exists
  reading_sessions_write
on public.meter_reading_sessions;


create policy
  reading_sessions_write
on public.meter_reading_sessions
for all
to authenticated
using (
  exists (
    select 1

    from public.meters m

    where
      m.id =
        meter_id

      and

      public.can_view_property(
        m.property_id
      )
  )
)
with check (
  submitted_by =
    (select auth.uid())

  and

  exists (
    select 1

    from public.meters m

    where
      m.id =
        meter_id

      and

      public.can_view_property(
        m.property_id
      )
  )
);


-- ============================================================
-- REGISTER READINGS
-- ============================================================

drop policy if exists
  register_readings_read
on public.meter_register_readings;


create policy
  register_readings_read
on public.meter_register_readings
for select
to authenticated
using (
  exists (
    select 1

    from public.meter_reading_sessions rs

    join public.meters m
      on
        m.id =
        rs.meter_id

    where
      rs.id =
        reading_session_id

      and

      public.can_view_property(
        m.property_id
      )
  )
);


drop policy if exists
  register_readings_write
on public.meter_register_readings;


create policy
  register_readings_write
on public.meter_register_readings
for all
to authenticated
using (
  exists (
    select 1

    from public.meter_reading_sessions rs

    join public.meters m
      on
        m.id =
        rs.meter_id

    where
      rs.id =
        reading_session_id

      and

      public.can_view_property(
        m.property_id
      )
  )
)
with check (
  exists (
    select 1

    from public.meter_reading_sessions rs

    join public.meters m
      on
        m.id =
        rs.meter_id

    where
      rs.id =
        reading_session_id

      and

      public.can_view_property(
        m.property_id
      )
  )
);


-- ============================================================
-- MEDIA FILES
-- ============================================================

drop policy if exists
  media_files_read
on public.media_files;


create policy
  media_files_read
on public.media_files
for select
to authenticated
using (
  public.can_view_property(
    property_id
  )
);


drop policy if exists
  media_files_insert
on public.media_files;


create policy
  media_files_insert
on public.media_files
for insert
to authenticated
with check (
  uploaded_by =
    (select auth.uid())

  and

  public.can_view_property(
    property_id
  )
);


-- ============================================================
-- READING PHOTOS
-- ============================================================

drop policy if exists
  meter_reading_photos_read
on public.meter_reading_photos;


create policy
  meter_reading_photos_read
on public.meter_reading_photos
for select
to authenticated
using (
  exists (
    select 1

    from public.meter_register_readings rr

    join public.meter_reading_sessions rs
      on
        rs.id =
        rr.reading_session_id

    join public.meters m
      on
        m.id =
        rs.meter_id

    where
      rr.id =
        register_reading_id

      and

      public.can_view_property(
        m.property_id
      )
  )
);


drop policy if exists
  meter_reading_photos_write
on public.meter_reading_photos;


create policy
  meter_reading_photos_write
on public.meter_reading_photos
for all
to authenticated
using (
  exists (
    select 1

    from public.meter_register_readings rr

    join public.meter_reading_sessions rs
      on
        rs.id =
        rr.reading_session_id

    join public.meters m
      on
        m.id =
        rs.meter_id

    where
      rr.id =
        register_reading_id

      and

      public.can_view_property(
        m.property_id
      )
  )
)
with check (
  exists (
    select 1

    from public.meter_register_readings rr

    join public.meter_reading_sessions rs
      on
        rs.id =
        rr.reading_session_id

    join public.meters m
      on
        m.id =
        rs.meter_id

    where
      rr.id =
        register_reading_id

      and

      public.can_view_property(
        m.property_id
      )
  )
);


-- ============================================================
-- METER PHOTO STORAGE
-- ============================================================

drop policy if exists
  dometra_meter_photos_select
on storage.objects;


create policy
  dometra_meter_photos_select
on storage.objects
for select
to authenticated
using (
  bucket_id =
    'meter-photos'

  and

  public.can_view_property(
    (
      storage.foldername(
        name
      )
    )[2]::uuid
  )
);


drop policy if exists
  dometra_meter_photos_insert
on storage.objects;


create policy
  dometra_meter_photos_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id =
    'meter-photos'

  and

  public.can_view_property(
    (
      storage.foldername(
        name
      )
    )[2]::uuid
  )
);


-- Delete remains landlord-only.
-- Existing dometra_meter_photos_delete policy is not changed.


-- ============================================================
-- SAVE METER READINGS
--
-- Same RPC is now usable by:
--
-- - landlord / workspace manager
-- - active tenant of the apartment
--
-- Previous reading is calculated in PostgreSQL.
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

  from public.meters m

  join public.properties p
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
    not public.can_view_property(
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

    from jsonb_array_elements(
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

        from public.meter_registers mr

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


    -- Previous reading must come from an earlier
    -- billing period, not from another edit of
    -- the current month.

    select
      rr.current_value

    into
      v_previous

    from public.meter_register_readings rr

    join public.meter_reading_sessions rs
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
      rs.reading_date desc,
      rr.created_at desc

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