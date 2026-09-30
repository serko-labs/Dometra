-- ============================================================
-- DOMETRA
-- Property-scoped history
--
-- Makes audit_log directly queryable by apartment/property.
-- The audit log remains append-only.
-- ============================================================


-- ============================================================
-- PROPERTY ID IN AUDIT LOG
-- ============================================================

alter table public.audit_log
add column if not exists property_id uuid;


create index if not exists
  idx_audit_property_created
on public.audit_log (
  property_id,
  created_at desc
);


-- ============================================================
-- REPLACE BUSINESS AUDIT FUNCTION
--
-- Every business event now stores:
--
-- workspace_id
-- property_id
-- user_id
-- session_id
-- table_name
-- entity_id
-- action
-- before_data
-- after_data
-- created_at
-- ============================================================

create or replace function public.audit_business_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row jsonb;

  v_workspace_id uuid;

  v_property_id uuid;

  v_entity_id uuid;

  v_user_id uuid;

  v_session_id uuid;
begin

  v_row :=
    case
      when tg_op = 'DELETE'
      then to_jsonb(old)
      else to_jsonb(new)
    end;


  v_entity_id :=
    nullif(
      v_row ->> 'id',
      ''
    )::uuid;


  v_user_id :=
    (select auth.uid());


  begin
    v_session_id :=
      nullif(
        (select auth.jwt()) ->> 'session_id',
        ''
      )::uuid;
  exception
    when others then
      v_session_id := null;
  end;


  -- ----------------------------------------------------------
  -- PROPERTY
  -- ----------------------------------------------------------

  if tg_table_name = 'properties'
  then

    v_property_id :=
      v_entity_id;

    v_workspace_id :=
      nullif(
        v_row ->> 'workspace_id',
        ''
      )::uuid;


  -- ----------------------------------------------------------
  -- PROPERTY SERVICE
  -- ----------------------------------------------------------

  elsif tg_table_name = 'property_services'
  then

    v_property_id :=
      nullif(
        v_row ->> 'property_id',
        ''
      )::uuid;

    select
      p.workspace_id
    into
      v_workspace_id
    from public.properties p
    where
      p.id = v_property_id;


  -- ----------------------------------------------------------
  -- METER
  -- ----------------------------------------------------------

  elsif tg_table_name = 'meters'
  then

    v_property_id :=
      nullif(
        v_row ->> 'property_id',
        ''
      )::uuid;

    select
      p.workspace_id
    into
      v_workspace_id
    from public.properties p
    where
      p.id = v_property_id;


  -- ----------------------------------------------------------
  -- METER REGISTER
  -- ----------------------------------------------------------

  elsif tg_table_name = 'meter_registers'
  then

    select
      m.property_id,
      p.workspace_id
    into
      v_property_id,
      v_workspace_id
    from public.meters m

    join public.properties p
      on p.id = m.property_id

    where
      m.id =
      nullif(
        v_row ->> 'meter_id',
        ''
      )::uuid;


  -- ----------------------------------------------------------
  -- SERVICE TARIFF
  -- ----------------------------------------------------------

  elsif tg_table_name = 'service_tariffs'
  then

    select
      ps.property_id,
      p.workspace_id
    into
      v_property_id,
      v_workspace_id
    from public.property_services ps

    join public.properties p
      on p.id = ps.property_id

    where
      ps.id =
      nullif(
        v_row ->> 'property_service_id',
        ''
      )::uuid;


  -- ----------------------------------------------------------
  -- VARIABLE SERVICE VALUE
  -- ----------------------------------------------------------

  elsif tg_table_name = 'service_period_values'
  then

    select
      ps.property_id,
      p.workspace_id
    into
      v_property_id,
      v_workspace_id
    from public.property_services ps

    join public.properties p
      on p.id = ps.property_id

    where
      ps.id =
      nullif(
        v_row ->> 'property_service_id',
        ''
      )::uuid;


  -- ----------------------------------------------------------
  -- READING SESSION
  -- ----------------------------------------------------------

  elsif tg_table_name = 'meter_reading_sessions'
  then

    select
      m.property_id,
      p.workspace_id
    into
      v_property_id,
      v_workspace_id
    from public.meters m

    join public.properties p
      on p.id = m.property_id

    where
      m.id =
      nullif(
        v_row ->> 'meter_id',
        ''
      )::uuid;


  -- ----------------------------------------------------------
  -- REGISTER READING
  -- ----------------------------------------------------------

  elsif tg_table_name = 'meter_register_readings'
  then

    select
      m.property_id,
      p.workspace_id
    into
      v_property_id,
      v_workspace_id
    from public.meter_reading_sessions rs

    join public.meters m
      on m.id = rs.meter_id

    join public.properties p
      on p.id = m.property_id

    where
      rs.id =
      nullif(
        v_row ->> 'reading_session_id',
        ''
      )::uuid;


  -- ----------------------------------------------------------
  -- MEDIA
  -- ----------------------------------------------------------

  elsif tg_table_name = 'media_files'
  then

    v_property_id :=
      nullif(
        v_row ->> 'property_id',
        ''
      )::uuid;

    v_workspace_id :=
      nullif(
        v_row ->> 'workspace_id',
        ''
      )::uuid;


  -- ----------------------------------------------------------
  -- READING PHOTO
  -- ----------------------------------------------------------

  elsif tg_table_name = 'meter_reading_photos'
  then

    select
      m.property_id,
      p.workspace_id
    into
      v_property_id,
      v_workspace_id
    from public.meter_register_readings rr

    join public.meter_reading_sessions rs
      on rs.id = rr.reading_session_id

    join public.meters m
      on m.id = rs.meter_id

    join public.properties p
      on p.id = m.property_id

    where
      rr.id =
      nullif(
        v_row ->> 'register_reading_id',
        ''
      )::uuid;

  end if;


  insert into public.audit_log (
    workspace_id,
    property_id,
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
    v_property_id,
    v_user_id,
    v_session_id,
    tg_table_name,
    v_entity_id,

    case
      when tg_op = 'INSERT'
      then 'CREATE'

      when tg_op = 'UPDATE'
      then 'UPDATE'

      when tg_op = 'DELETE'
      then 'DELETE'
    end,

    case
      when tg_op in (
        'UPDATE',
        'DELETE'
      )
      then to_jsonb(old)

      else null
    end,

    case
      when tg_op in (
        'INSERT',
        'UPDATE'
      )
      then to_jsonb(new)

      else null
    end
  );


  if tg_op = 'DELETE'
  then
    return old;
  end if;


  return new;
end;
$$;


-- ============================================================
-- BACKFILL EXISTING AUDIT RECORDS
-- ============================================================

update public.audit_log
set
  property_id = entity_id
where
  table_name = 'properties'
  and
  property_id is null;


update public.audit_log
set
  property_id =
    coalesce(
      nullif(
        after_data ->> 'property_id',
        ''
      )::uuid,

      nullif(
        before_data ->> 'property_id',
        ''
      )::uuid
    )
where
  table_name in (
    'property_services',
    'meters',
    'media_files'
  )
  and
  property_id is null;


update public.audit_log al
set
  property_id = m.property_id
from public.meters m
where
  al.table_name =
    'meter_reading_sessions'

  and

  al.property_id is null

  and

  m.id =
    coalesce(
      nullif(
        al.after_data ->> 'meter_id',
        ''
      )::uuid,

      nullif(
        al.before_data ->> 'meter_id',
        ''
      )::uuid
    );


update public.audit_log al
set
  property_id =
    ps.property_id
from public.property_services ps
where
  al.table_name =
    'service_period_values'

  and

  al.property_id is null

  and

  ps.id =
    coalesce(
      nullif(
        al.after_data ->> 'property_service_id',
        ''
      )::uuid,

      nullif(
        al.before_data ->> 'property_service_id',
        ''
      )::uuid
    );