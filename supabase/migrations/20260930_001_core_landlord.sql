-- ============================================================
-- DOMETRA
-- Core landlord backend
-- 2026-09-30
--
-- Supabase is the source of truth.
--
-- Includes:
--   users/settings
--   personal workspaces
--   properties
--   property services
--   meters/registers
--   tariffs
--   variable monthly service values
--   meter readings
--   meter photos metadata
--   business audit log
--   RLS
--   Storage policies
-- ============================================================

create extension if not exists pgcrypto;


-- ============================================================
-- ENUMS
-- ============================================================

do $$
begin
  create type public.app_mode
    as enum (
      'LANDLORD',
      'TENANT'
    );
exception
  when duplicate_object then null;
end $$;


do $$
begin
  create type public.workspace_role
    as enum (
      'OWNER',
      'ADMIN',
      'MANAGER',
      'VIEWER'
    );
exception
  when duplicate_object then null;
end $$;


do $$
begin
  create type public.property_status
    as enum (
      'ACTIVE',
      'INACTIVE',
      'ARCHIVED'
    );
exception
  when duplicate_object then null;
end $$;


do $$
begin
  create type public.calculation_method
    as enum (
      'METER',
      'FIXED',
      'MANUAL'
    );
exception
  when duplicate_object then null;
end $$;


do $$
begin
  create type public.meter_status
    as enum (
      'ACTIVE',
      'REPLACED',
      'INACTIVE'
    );
exception
  when duplicate_object then null;
end $$;


do $$
begin
  create type public.reading_status
    as enum (
      'DRAFT',
      'SUBMITTED',
      'CONFIRMED',
      'REJECTED'
    );
exception
  when duplicate_object then null;
end $$;


-- ============================================================
-- UPDATED_AT
-- ============================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();

  return new;
end;
$$;


-- ============================================================
-- USER PROFILE
-- ============================================================

create table if not exists public.profiles (
  id uuid
    primary key
    references auth.users(id)
    on delete cascade,

  display_name text,

  created_at timestamptz
    not null
    default now(),

  updated_at timestamptz
    not null
    default now()
);


create table if not exists public.user_settings (
  user_id uuid
    primary key
    references auth.users(id)
    on delete cascade,

  language_code varchar(10)
    not null
    default 'uk',

  region_code varchar(10)
    not null
    default 'UA',

  timezone text
    not null
    default 'Europe/Kyiv',

  display_currency char(3)
    not null
    default 'UAH',

  active_mode public.app_mode
    not null
    default 'LANDLORD',

  push_enabled boolean
    not null
    default true,

  created_at timestamptz
    not null
    default now(),

  updated_at timestamptz
    not null
    default now()
);


-- ============================================================
-- SUBSCRIPTION / WORKSPACE
-- ============================================================

create table if not exists public.subscription_plans (
  code text
    primary key,

  name text
    not null,

  max_active_properties integer,

  created_at timestamptz
    not null
    default now()
);


insert into public.subscription_plans (
  code,
  name,
  max_active_properties
)
values
  (
    'FREE',
    'Free',
    4
  ),
  (
    'PRO',
    'Pro',
    null
  )
on conflict (code)
do update set
  name =
    excluded.name,
  max_active_properties =
    excluded.max_active_properties;


create table if not exists public.workspaces (
  id uuid
    primary key
    default gen_random_uuid(),

  name text
    not null,

  owner_user_id uuid
    not null
    references auth.users(id),

  base_currency char(3)
    not null
    default 'UAH',

  default_timezone text
    not null
    default 'Europe/Kyiv',

  status text
    not null
    default 'ACTIVE'
    check (
      status in (
        'ACTIVE',
        'SUSPENDED',
        'ARCHIVED'
      )
    ),

  created_at timestamptz
    not null
    default now(),

  updated_at timestamptz
    not null
    default now()
);


create table if not exists public.workspace_members (
  workspace_id uuid
    not null
    references public.workspaces(id)
    on delete cascade,

  user_id uuid
    not null
    references auth.users(id)
    on delete cascade,

  role public.workspace_role
    not null
    default 'VIEWER',

  created_at timestamptz
    not null
    default now(),

  primary key (
    workspace_id,
    user_id
  )
);


create index if not exists
  idx_workspace_members_user
on public.workspace_members (
  user_id,
  workspace_id
);


create table if not exists public.workspace_subscriptions (
  workspace_id uuid
    primary key
    references public.workspaces(id)
    on delete cascade,

  plan_code text
    not null
    references public.subscription_plans(code),

  status text
    not null
    default 'ACTIVE',

  created_at timestamptz
    not null
    default now(),

  updated_at timestamptz
    not null
    default now()
);


-- ============================================================
-- PROPERTIES
--
-- "title" = optional user-visible property name.
-- If no custom name is supplied, frontend displays address.
--
-- "street" stores our current full Address field.
-- ============================================================

create table if not exists public.properties (
  id uuid
    primary key
    default gen_random_uuid(),

  workspace_id uuid
    not null
    references public.workspaces(id)
    on delete cascade,

  title text
    not null,

  property_type text
    not null
    default 'APARTMENT',

  city text
    not null,

  street text
    not null,

  area_m2 numeric(10, 2),

  status public.property_status
    not null
    default 'ACTIVE',

  created_by uuid
    not null
    references auth.users(id),

  created_at timestamptz
    not null
    default now(),

  updated_at timestamptz
    not null
    default now()
);


create index if not exists
  idx_properties_workspace_status
on public.properties (
  workspace_id,
  status
);


-- ============================================================
-- PROPERTY SERVICES
--
-- Electricity / Water / Gas:
--   calculation_method = METER
--
-- Custom Fixed:
--   calculation_method = FIXED
--
-- Custom Variable:
--   calculation_method = MANUAL
-- ============================================================

create table if not exists public.property_services (
  id uuid
    primary key
    default gen_random_uuid(),

  property_id uuid
    not null
    references public.properties(id)
    on delete cascade,

  service_code text
    not null,

  custom_name text,

  calculation_method
    public.calculation_method
    not null,

  unit text,

  currency_code char(3)
    not null
    default 'UAH',

  sort_order integer
    not null
    default 0,

  is_active boolean
    not null
    default true,

  created_at timestamptz
    not null
    default now(),

  updated_at timestamptz
    not null
    default now()
);


create index if not exists
  idx_property_services_property
on public.property_services (
  property_id,
  is_active
);


-- ============================================================
-- METERS
-- ============================================================

create table if not exists public.meters (
  id uuid
    primary key
    default gen_random_uuid(),

  property_id uuid
    not null
    references public.properties(id)
    on delete cascade,

  property_service_id uuid
    references public.property_services(id)
    on delete set null,

  name text
    not null,

  category text
    not null,

  serial_number text,

  unit text
    not null,

  status public.meter_status
    not null
    default 'ACTIVE',

  installed_at date,

  removed_at date,

  created_at timestamptz
    not null
    default now(),

  updated_at timestamptz
    not null
    default now()
);


create index if not exists
  idx_meters_property
on public.meters (
  property_id,
  status
);


create index if not exists
  idx_meters_service
on public.meters (
  property_service_id,
  status
);


-- ============================================================
-- METER REGISTERS
-- ============================================================

create table if not exists public.meter_registers (
  id uuid
    primary key
    default gen_random_uuid(),

  meter_id uuid
    not null
    references public.meters(id)
    on delete cascade,

  code text
    not null,

  name text
    not null,

  unit text
    not null,

  sort_order integer
    not null
    default 0,

  photo_required boolean
    not null
    default true,

  active boolean
    not null
    default true,

  created_at timestamptz
    not null
    default now(),

  unique (
    meter_id,
    code
  )
);


-- ============================================================
-- SERVICE TARIFFS
--
-- Electricity T1/T2:
-- meter_register_id points to T1/T2.
--
-- Single tariff:
-- meter_register_id points to TOTAL.
--
-- Custom fixed service:
-- meter_register_id = null
-- unit = month
-- ============================================================

create table if not exists public.service_tariffs (
  id uuid
    primary key
    default gen_random_uuid(),

  property_service_id uuid
    not null
    references public.property_services(id)
    on delete cascade,

  meter_register_id uuid
    references public.meter_registers(id)
    on delete cascade,

  price numeric(18, 6)
    not null
    check (
      price >= 0
    ),

  currency_code char(3)
    not null,

  unit text
    not null,

  valid_from date
    not null,

  valid_to date,

  created_at timestamptz
    not null
    default now(),

  check (
    valid_to is null
    or
    valid_to >= valid_from
  )
);


create index if not exists
  idx_service_tariffs_service_dates
on public.service_tariffs (
  property_service_id,
  valid_from desc
);


create index if not exists
  idx_service_tariffs_register_dates
on public.service_tariffs (
  meter_register_id,
  valid_from desc
);


-- ============================================================
-- VARIABLE / MANUAL MONTHLY SERVICES
--
-- Example:
-- Central heating September = 1375 UAH
-- Central heating October   = 920 UAH
--
-- Never overwrite historical months.
-- ============================================================

create table if not exists public.service_period_values (
  id uuid
    primary key
    default gen_random_uuid(),

  property_service_id uuid
    not null
    references public.property_services(id)
    on delete cascade,

  billing_period date
    not null,

  amount numeric(14, 2)
    not null
    check (
      amount >= 0
    ),

  currency_code char(3)
    not null,

  submitted_by uuid
    not null
    references auth.users(id),

  submitted_at timestamptz
    not null
    default now(),

  created_at timestamptz
    not null
    default now(),

  updated_at timestamptz
    not null
    default now(),

  unique (
    property_service_id,
    billing_period
  )
);


-- ============================================================
-- STORAGE METADATA
-- ============================================================

create table if not exists public.media_files (
  id uuid
    primary key
    default gen_random_uuid(),

  workspace_id uuid
    not null
    references public.workspaces(id)
    on delete cascade,

  property_id uuid
    not null
    references public.properties(id)
    on delete cascade,

  bucket text
    not null,

  storage_path text
    not null,

  mime_type text,

  size_bytes bigint,

  captured_at timestamptz,

  uploaded_by uuid
    not null
    references auth.users(id),

  created_at timestamptz
    not null
    default now(),

  unique (
    bucket,
    storage_path
  )
);


-- ============================================================
-- METER READING SESSION
-- ============================================================

create table if not exists public.meter_reading_sessions (
  id uuid
    primary key
    default gen_random_uuid(),

  meter_id uuid
    not null
    references public.meters(id)
    on delete cascade,

  billing_period date
    not null,

  reading_date date
    not null,

  status public.reading_status
    not null
    default 'SUBMITTED',

  submitted_by uuid
    not null
    references auth.users(id),

  submitted_at timestamptz
    not null
    default now(),

  created_at timestamptz
    not null
    default now(),

  updated_at timestamptz
    not null
    default now(),

  unique (
    meter_id,
    billing_period
  )
);


create index if not exists
  idx_meter_reading_sessions_meter_period
on public.meter_reading_sessions (
  meter_id,
  billing_period desc
);


create table if not exists public.meter_register_readings (
  id uuid
    primary key
    default gen_random_uuid(),

  reading_session_id uuid
    not null
    references public.meter_reading_sessions(id)
    on delete cascade,

  meter_register_id uuid
    not null
    references public.meter_registers(id)
    on delete restrict,

  previous_value numeric(18, 6),

  current_value numeric(18, 6)
    not null,

  consumption numeric(18, 6),

  created_at timestamptz
    not null
    default now(),

  updated_at timestamptz
    not null
    default now(),

  unique (
    reading_session_id,
    meter_register_id
  ),

  check (
    previous_value is null
    or
    current_value >= previous_value
  )
);


create index if not exists
  idx_meter_register_readings_register
on public.meter_register_readings (
  meter_register_id,
  created_at desc
);


create table if not exists public.meter_reading_photos (
  id uuid
    primary key
    default gen_random_uuid(),

  register_reading_id uuid
    not null
    references public.meter_register_readings(id)
    on delete cascade,

  media_file_id uuid
    not null
    references public.media_files(id)
    on delete cascade,

  photo_type text
    not null
    default 'READING',

  created_at timestamptz
    not null
    default now()
);


-- ============================================================
-- BUSINESS AUDIT LOG
--
-- Supabase Auth already logs authentication events.
-- This table logs business-data changes.
-- ============================================================

create table if not exists public.audit_log (
  id bigint
    generated by default as identity
    primary key,

  workspace_id uuid,

  user_id uuid,

  session_id uuid,

  table_name text
    not null,

  entity_id uuid,

  action text
    not null,

  before_data jsonb,

  after_data jsonb,

  created_at timestamptz
    not null
    default now()
);


alter table public.audit_log
  add column if not exists
    session_id uuid;


alter table public.audit_log
  add column if not exists
    table_name text;


create index if not exists
  idx_audit_workspace_created
on public.audit_log (
  workspace_id,
  created_at desc
);


create index if not exists
  idx_audit_user_created
on public.audit_log (
  user_id,
  created_at desc
);


create index if not exists
  idx_audit_session
on public.audit_log (
  session_id,
  created_at desc
);


-- ============================================================
-- ACCESS HELPERS
-- ============================================================

create or replace function public.is_workspace_member(
  p_workspace_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1

    from public.workspace_members wm

    where
      wm.workspace_id =
        p_workspace_id

      and

      wm.user_id =
        (select auth.uid())
  );
$$;


create or replace function public.can_manage_workspace(
  p_workspace_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1

    from public.workspace_members wm

    where
      wm.workspace_id =
        p_workspace_id

      and

      wm.user_id =
        (select auth.uid())

      and

      wm.role in (
        'OWNER',
        'ADMIN',
        'MANAGER'
      )
  );
$$;


create or replace function public.can_access_property(
  p_property_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1

    from public.properties p

    where
      p.id =
        p_property_id

      and

      public.is_workspace_member(
        p.workspace_id
      )
  );
$$;


create or replace function public.can_manage_property(
  p_property_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1

    from public.properties p

    where
      p.id =
        p_property_id

      and

      public.can_manage_workspace(
        p.workspace_id
      )
  );
$$;


create or replace function public.current_plan_max_properties(
  p_workspace_id uuid
)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select
    sp.max_active_properties

  from
    public.workspace_subscriptions ws

  join
    public.subscription_plans sp
      on
        sp.code =
        ws.plan_code

  where
    ws.workspace_id =
      p_workspace_id

    and

    ws.status =
      'ACTIVE'

  limit 1;
$$;


create or replace function public.can_add_active_property(
  p_workspace_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_limit integer;
  v_count integer;
begin
  select
    public.current_plan_max_properties(
      p_workspace_id
    )
  into
    v_limit;

  if
    v_limit is null
  then
    return true;
  end if;

  select
    count(*)
  into
    v_count
  from
    public.properties
  where
    workspace_id =
      p_workspace_id
    and
    status =
      'ACTIVE';

  return
    v_count <
    v_limit;
end;
$$;


-- ============================================================
-- WORKSPACE BOOTSTRAP
-- ============================================================

create or replace function public.bootstrap_workspace()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.workspace_members (
    workspace_id,
    user_id,
    role
  )
  values (
    new.id,
    new.owner_user_id,
    'OWNER'
  )
  on conflict do nothing;


  insert into public.workspace_subscriptions (
    workspace_id,
    plan_code,
    status
  )
  values (
    new.id,
    'FREE',
    'ACTIVE'
  )
  on conflict (
    workspace_id
  )
  do nothing;


  return new;
end;
$$;


drop trigger if exists
  trg_workspace_bootstrap
on public.workspaces;


create trigger
  trg_workspace_bootstrap
after insert
on public.workspaces
for each row
execute function
  public.bootstrap_workspace();


-- ============================================================
-- AUTH USER BOOTSTRAP
--
-- Every Dometra user gets:
-- profile
-- settings
-- personal landlord workspace
-- FREE subscription
-- ============================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_workspace_id uuid;
begin
  insert into public.profiles (
    id,
    display_name
  )
  values (
    new.id,

    coalesce(
      new.raw_user_meta_data ->>
        'full_name',

      new.raw_user_meta_data ->>
        'name',

      split_part(
        new.email,
        '@',
        1
      )
    )
  )
  on conflict (
    id
  )
  do nothing;


  insert into public.user_settings (
    user_id
  )
  values (
    new.id
  )
  on conflict (
    user_id
  )
  do nothing;


  select
    w.id
  into
    v_workspace_id
  from
    public.workspaces w
  where
    w.owner_user_id =
      new.id
  order by
    w.created_at
  limit 1;


  if
    v_workspace_id is null
  then
    insert into public.workspaces (
      name,
      owner_user_id
    )
    values (
      'My properties',
      new.id
    )
    returning
      id
    into
      v_workspace_id;
  end if;


  return new;
end;
$$;


drop trigger if exists
  on_auth_user_created
on auth.users;


create trigger
  on_auth_user_created
after insert
on auth.users
for each row
execute function
  public.handle_new_user();


-- ============================================================
-- BACKFILL EXISTING USERS
--
-- Important for the account you already created.
-- ============================================================

do $$
declare
  v_user record;
  v_workspace_id uuid;
begin
  for v_user in
    select
      id,
      email,
      raw_user_meta_data

    from
      auth.users
  loop

    insert into public.profiles (
      id,
      display_name
    )
    values (
      v_user.id,

      coalesce(
        v_user.raw_user_meta_data ->>
          'full_name',

        v_user.raw_user_meta_data ->>
          'name',

        split_part(
          v_user.email,
          '@',
          1
        )
      )
    )
    on conflict (
      id
    )
    do nothing;


    insert into public.user_settings (
      user_id
    )
    values (
      v_user.id
    )
    on conflict (
      user_id
    )
    do nothing;


    select
      id
    into
      v_workspace_id
    from
      public.workspaces

    where
      owner_user_id =
        v_user.id

    order by
      created_at

    limit 1;


    if
      v_workspace_id is null
    then
      insert into public.workspaces (
        name,
        owner_user_id
      )
      values (
        'My properties',
        v_user.id
      );
    end if;

  end loop;
end;
$$;


-- ============================================================
-- UPDATED_AT TRIGGERS
-- ============================================================

do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'profiles',
    'user_settings',
    'workspaces',
    'workspace_subscriptions',
    'properties',
    'property_services',
    'meters',
    'service_period_values',
    'meter_reading_sessions',
    'meter_register_readings'
  ]
  loop
    execute format(
      'drop trigger if exists trg_%I_updated_at on public.%I',
      v_table,
      v_table
    );

    execute format(
      'create trigger trg_%I_updated_at
       before update on public.%I
       for each row
       execute function public.set_updated_at()',
      v_table,
      v_table
    );
  end loop;
end;
$$;


-- ============================================================
-- BUSINESS AUDIT
--
-- session_id comes from the Supabase JWT.
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

  v_entity_id uuid;

  v_user_id uuid;

  v_session_id uuid;
begin
  v_row :=
    case
      when tg_op =
        'DELETE'
      then
        to_jsonb(old)
      else
        to_jsonb(new)
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
        (select auth.jwt()) ->>
          'session_id',
        ''
      )::uuid;
  exception
    when others then
      v_session_id :=
        null;
  end;


  if
    tg_table_name =
    'properties'
  then
    v_workspace_id :=
      nullif(
        v_row ->>
          'workspace_id',
        ''
      )::uuid;


  elsif
    tg_table_name =
    'property_services'
  then
    select
      p.workspace_id

    into
      v_workspace_id

    from
      public.properties p

    where
      p.id =
        nullif(
          v_row ->>
            'property_id',
          ''
        )::uuid;


  elsif
    tg_table_name =
    'meters'
  then
    select
      p.workspace_id

    into
      v_workspace_id

    from
      public.properties p

    where
      p.id =
        nullif(
          v_row ->>
            'property_id',
          ''
        )::uuid;


  elsif
    tg_table_name =
    'meter_registers'
  then
    select
      p.workspace_id

    into
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
        nullif(
          v_row ->>
            'meter_id',
          ''
        )::uuid;


  elsif
    tg_table_name =
    'service_tariffs'
  then
    select
      p.workspace_id

    into
      v_workspace_id

    from
      public.property_services ps

    join
      public.properties p
        on
          p.id =
          ps.property_id

    where
      ps.id =
        nullif(
          v_row ->>
            'property_service_id',
          ''
        )::uuid;


  elsif
    tg_table_name =
    'service_period_values'
  then
    select
      p.workspace_id

    into
      v_workspace_id

    from
      public.property_services ps

    join
      public.properties p
        on
          p.id =
          ps.property_id

    where
      ps.id =
        nullif(
          v_row ->>
            'property_service_id',
          ''
        )::uuid;


  elsif
    tg_table_name =
    'meter_reading_sessions'
  then
    select
      p.workspace_id

    into
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
        nullif(
          v_row ->>
            'meter_id',
          ''
        )::uuid;


  elsif
    tg_table_name =
    'meter_register_readings'
  then
    select
      p.workspace_id

    into
      v_workspace_id

    from
      public.meter_reading_sessions s

    join
      public.meters m
        on
          m.id =
          s.meter_id

    join
      public.properties p
        on
          p.id =
          m.property_id

    where
      s.id =
        nullif(
          v_row ->>
            'reading_session_id',
          ''
        )::uuid;


  elsif
    tg_table_name =
    'media_files'
  then
    v_workspace_id :=
      nullif(
        v_row ->>
          'workspace_id',
        ''
      )::uuid;


  elsif
    tg_table_name =
    'meter_reading_photos'
  then
    select
      p.workspace_id

    into
      v_workspace_id

    from
      public.meter_register_readings rr

    join
      public.meter_reading_sessions s
        on
          s.id =
          rr.reading_session_id

    join
      public.meters m
        on
          m.id =
          s.meter_id

    join
      public.properties p
        on
          p.id =
          m.property_id

    where
      rr.id =
        nullif(
          v_row ->>
            'register_reading_id',
          ''
        )::uuid;

  end if;


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

    v_user_id,

    v_session_id,

    tg_table_name,

    v_entity_id,

    case
      when tg_op =
        'INSERT'
      then
        'CREATE'

      when tg_op =
        'UPDATE'
      then
        'UPDATE'

      when tg_op =
        'DELETE'
      then
        'DELETE'
    end,

    case
      when tg_op in (
        'UPDATE',
        'DELETE'
      )
      then
        to_jsonb(old)
      else
        null
    end,

    case
      when tg_op in (
        'INSERT',
        'UPDATE'
      )
      then
        to_jsonb(new)
      else
        null
    end
  );


  if
    tg_op =
    'DELETE'
  then
    return old;
  end if;


  return new;
end;
$$;


do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'properties',
    'property_services',
    'meters',
    'meter_registers',
    'service_tariffs',
    'service_period_values',
    'meter_reading_sessions',
    'meter_register_readings',
    'media_files',
    'meter_reading_photos'
  ]
  loop
    execute format(
      'drop trigger if exists trg_%I_audit on public.%I',
      v_table,
      v_table
    );

    execute format(
      'create trigger trg_%I_audit
       after insert or update or delete
       on public.%I
       for each row
       execute function public.audit_business_change()',
      v_table,
      v_table
    );
  end loop;
end;
$$;


-- ============================================================
-- CURRENT TARIFF VIEW
-- ============================================================

create or replace view
  public.v_current_service_tariffs
with (
  security_invoker =
    true
)
as
select distinct on (
  st.property_service_id,
  st.meter_register_id
)

  st.id,

  st.property_service_id,

  st.meter_register_id,

  st.price,

  st.currency_code,

  st.unit,

  st.valid_from,

  st.valid_to

from
  public.service_tariffs st

where
  st.valid_from <=
    current_date

  and

  (
    st.valid_to is null

    or

    st.valid_to >=
      current_date
  )

order by
  st.property_service_id,

  st.meter_register_id,

  st.valid_from desc,

  st.created_at desc;


-- ============================================================
-- LATEST METER READING VIEW
-- ============================================================

create or replace view
  public.v_latest_meter_register_readings
with (
  security_invoker =
    true
)
as
select distinct on (
  rr.meter_register_id
)

  rr.id,

  rr.meter_register_id,

  rs.meter_id,

  rs.billing_period,

  rs.reading_date,

  rr.previous_value,

  rr.current_value,

  rr.consumption,

  rr.created_at,

  mf.storage_path as photo_path,

  mf.mime_type as photo_mime_type

from
  public.meter_register_readings rr

join
  public.meter_reading_sessions rs
    on
      rs.id =
      rr.reading_session_id

left join
  public.meter_reading_photos rp
    on
      rp.register_reading_id =
      rr.id

left join
  public.media_files mf
    on
      mf.id =
      rp.media_file_id

where
  rs.status in (
    'SUBMITTED',
    'CONFIRMED'
  )

order by
  rr.meter_register_id,

  rs.reading_date desc,

  rr.created_at desc;


-- ============================================================
-- LATEST MANUAL SERVICE VALUE
-- ============================================================

create or replace view
  public.v_latest_service_period_values
with (
  security_invoker =
    true
)
as
select distinct on (
  spv.property_service_id
)

  spv.id,

  spv.property_service_id,

  spv.billing_period,

  spv.amount,

  spv.currency_code,

  spv.submitted_by,

  spv.submitted_at

from
  public.service_period_values spv

order by
  spv.property_service_id,

  spv.billing_period desc,

  spv.submitted_at desc;


-- ============================================================
-- SAVE / EDIT METER OR CUSTOM SERVICE
--
-- Returns property_service.id
--
-- p_billing_mode:
--   METERED
--   FIXED
--   VARIABLE
--
-- If tariff structure changes after readings already exist,
-- old meter becomes REPLACED and a new meter is created.
-- Historical readings stay untouched.
-- ============================================================

create or replace function public.save_property_service(
  p_service_id uuid,

  p_property_id uuid,

  p_category text,

  p_custom_name text,

  p_billing_mode text,

  p_currency char(3),

  p_tariff numeric,

  p_tariff_t1 numeric,

  p_tariff_t2 numeric
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_service_id uuid;

  v_calculation_method
    public.calculation_method;

  v_unit text;

  v_name text;

  v_meter_id uuid;

  v_existing_codes text[];

  v_target_codes text[];

  v_total_register_id uuid;

  v_t1_register_id uuid;

  v_t2_register_id uuid;
begin
  if
    not public.can_manage_property(
      p_property_id
    )
  then
    raise exception
      'Not allowed to manage this property';
  end if;


  if
    p_category =
    'CUSTOM'
  then

    if
      nullif(
        trim(
          p_custom_name
        ),
        ''
      )
      is null
    then
      raise exception
        'Custom service name is required';
    end if;


    if
      p_billing_mode =
      'FIXED'
    then
      v_calculation_method :=
        'FIXED';

    elsif
      p_billing_mode =
      'VARIABLE'
    then
      v_calculation_method :=
        'MANUAL';

    else
      raise exception
        'Invalid custom billing mode';
    end if;


    v_unit :=
      case
        when
          p_billing_mode =
          'FIXED'
        then
          'month'
        else
          null
      end;

    v_name :=
      trim(
        p_custom_name
      );

  else

    if
      p_category not in (
        'ELECTRICITY',
        'WATER',
        'GAS'
      )
    then
      raise exception
        'Invalid meter category';
    end if;


    v_calculation_method :=
      'METER';


    v_unit :=
      case
        when
          p_category =
          'ELECTRICITY'
        then
          'kWh'

        else
          'm³'
      end;


    v_name :=
      case
        when
          p_category =
          'ELECTRICITY'
        then
          'Electricity'

        when
          p_category =
          'WATER'
        then
          'Water'

        when
          p_category =
          'GAS'
        then
          'Gas'
      end;

  end if;


  if
    p_service_id is null
  then

    insert into public.property_services (
      property_id,
      service_code,
      custom_name,
      calculation_method,
      unit,
      currency_code
    )
    values (
      p_property_id,
      p_category,

      case
        when
          p_category =
          'CUSTOM'
        then
          v_name
        else
          null
      end,

      v_calculation_method,
      v_unit,
      p_currency
    )
    returning
      id
    into
      v_service_id;

  else

    select
      ps.id
    into
      v_service_id
    from
      public.property_services ps
    where
      ps.id =
        p_service_id
      and
      ps.property_id =
        p_property_id
    for update;


    if
      v_service_id is null
    then
      raise exception
        'Service not found';
    end if;


    update public.property_services
    set
      service_code =
        p_category,

      custom_name =
        case
          when
            p_category =
            'CUSTOM'
          then
            v_name
          else
            null
        end,

      calculation_method =
        v_calculation_method,

      unit =
        v_unit,

      currency_code =
        p_currency,

      is_active =
        true

    where
      id =
        v_service_id;

  end if;


  -- Replace tariffs created today.
  delete from public.service_tariffs
  where
    property_service_id =
      v_service_id

    and

    valid_from =
      current_date;


  -- Close historical/current tariffs.
  update public.service_tariffs
  set
    valid_to =
      current_date - 1
  where
    property_service_id =
      v_service_id

    and

    valid_to is null

    and

    valid_from <
      current_date;


  -- ----------------------------------------------------------
  -- CUSTOM
  -- ----------------------------------------------------------

  if
    p_category =
    'CUSTOM'
  then

    update public.meters
    set
      status =
        'REPLACED',

      removed_at =
        current_date

    where
      property_service_id =
        v_service_id

      and

      status =
        'ACTIVE';


    if
      p_billing_mode =
        'FIXED'
    then

      if
        p_tariff is null
        or
        p_tariff < 0
      then
        raise exception
          'Fixed amount is required';
      end if;


      insert into public.service_tariffs (
        property_service_id,
        meter_register_id,
        price,
        currency_code,
        unit,
        valid_from
      )
      values (
        v_service_id,
        null,
        p_tariff,
        p_currency,
        'month',
        current_date
      );

    end if;


    return
      v_service_id;

  end if;


  -- ----------------------------------------------------------
  -- METERED
  -- ----------------------------------------------------------

  if
    p_category =
      'ELECTRICITY'
    and
    p_tariff_t1 is not null
    and
    p_tariff_t2 is not null
  then
    v_target_codes :=
      array[
        'T1',
        'T2'
      ];

  else
    v_target_codes :=
      array[
        'TOTAL'
      ];
  end if;


  select
    m.id
  into
    v_meter_id
  from
    public.meters m
  where
    m.property_service_id =
      v_service_id

    and

    m.status =
      'ACTIVE'
  order by
    m.created_at desc
  limit 1;


  if
    v_meter_id is not null
  then

    select
      array_agg(
        mr.code
        order by
          mr.code
      )
    into
      v_existing_codes
    from
      public.meter_registers mr
    where
      mr.meter_id =
        v_meter_id

      and

      mr.active;


    if
      (
        select
          m.category
        from
          public.meters m
        where
          m.id =
            v_meter_id
      )
      <>
      p_category

      or

      coalesce(
        v_existing_codes,
        array[]::text[]
      )
      <>
      (
        select
          array_agg(
            value
            order by
              value
          )
        from
          unnest(
            v_target_codes
          ) value
      )
    then

      update public.meters
      set
        status =
          'REPLACED',

        removed_at =
          current_date

      where
        id =
          v_meter_id;


      v_meter_id :=
        null;

    end if;

  end if;


  if
    v_meter_id is null
  then

    insert into public.meters (
      property_id,
      property_service_id,
      name,
      category,
      unit,
      status,
      installed_at
    )
    values (
      p_property_id,
      v_service_id,
      v_name,
      p_category,
      v_unit,
      'ACTIVE',
      current_date
    )
    returning
      id
    into
      v_meter_id;


    if
      v_target_codes =
      array[
        'T1',
        'T2'
      ]
    then

      insert into public.meter_registers (
        meter_id,
        code,
        name,
        unit,
        sort_order
      )
      values
        (
          v_meter_id,
          'T1',
          'Day',
          'kWh',
          10
        ),
        (
          v_meter_id,
          'T2',
          'Night',
          'kWh',
          20
        );


    else

      insert into public.meter_registers (
        meter_id,
        code,
        name,
        unit,
        sort_order
      )
      values (
        v_meter_id,
        'TOTAL',
        'Total',
        v_unit,
        10
      );

    end if;

  end if;


  select
    id
  into
    v_total_register_id
  from
    public.meter_registers
  where
    meter_id =
      v_meter_id
    and
    code =
      'TOTAL';


  select
    id
  into
    v_t1_register_id
  from
    public.meter_registers
  where
    meter_id =
      v_meter_id
    and
    code =
      'T1';


  select
    id
  into
    v_t2_register_id
  from
    public.meter_registers
  where
    meter_id =
      v_meter_id
    and
    code =
      'T2';


  if
    v_total_register_id is not null
  then

    if
      p_tariff is null
      or
      p_tariff < 0
    then
      raise exception
        'Tariff is required';
    end if;


    insert into public.service_tariffs (
      property_service_id,
      meter_register_id,
      price,
      currency_code,
      unit,
      valid_from
    )
    values (
      v_service_id,
      v_total_register_id,
      p_tariff,
      p_currency,
      v_unit,
      current_date
    );

  else

    if
      p_tariff_t1 is null
      or
      p_tariff_t1 < 0
      or
      p_tariff_t2 is null
      or
      p_tariff_t2 < 0
    then
      raise exception
        'T1 and T2 tariffs are required';
    end if;


    insert into public.service_tariffs (
      property_service_id,
      meter_register_id,
      price,
      currency_code,
      unit,
      valid_from
    )
    values
      (
        v_service_id,
        v_t1_register_id,
        p_tariff_t1,
        p_currency,
        'kWh',
        current_date
      ),
      (
        v_service_id,
        v_t2_register_id,
        p_tariff_t2,
        p_currency,
        'kWh',
        current_date
      );

  end if;


  return
    v_service_id;
end;
$$;


-- ============================================================
-- REMOVE SERVICE
--
-- Soft-remove.
-- Keeps historical readings/tariffs.
-- ============================================================

create or replace function public.archive_property_service(
  p_service_id uuid
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_property_id uuid;
begin
  select
    property_id

  into
    v_property_id

  from
    public.property_services

  where
    id =
      p_service_id;


  if
    v_property_id is null
  then
    raise exception
      'Service not found';
  end if;


  if
    not public.can_manage_property(
      v_property_id
    )
  then
    raise exception
      'Not allowed';
  end if;


  update public.property_services
  set
    is_active =
      false
  where
    id =
      p_service_id;


  update public.meters
  set
    status =
      'INACTIVE',

    removed_at =
      current_date

  where
    property_service_id =
      p_service_id

    and

    status =
      'ACTIVE';
end;
$$;


-- ============================================================
-- SAVE VARIABLE SERVICE VALUE
-- ============================================================

create or replace function public.save_service_period_value(
  p_service_id uuid,

  p_billing_period date,

  p_amount numeric
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_property_id uuid;

  v_currency char(3);

  v_id uuid;
begin
  select
    property_id,
    currency_code

  into
    v_property_id,
    v_currency

  from
    public.property_services

  where
    id =
      p_service_id

    and

    is_active;


  if
    v_property_id is null
  then
    raise exception
      'Service not found';
  end if;


  if
    not public.can_access_property(
      v_property_id
    )
  then
    raise exception
      'Not allowed';
  end if;


  insert into public.service_period_values (
    property_service_id,
    billing_period,
    amount,
    currency_code,
    submitted_by,
    submitted_at
  )
  values (
    p_service_id,

    date_trunc(
      'month',
      p_billing_period
    )::date,

    p_amount,

    v_currency,

    (select auth.uid()),

    now()
  )

  on conflict (
    property_service_id,
    billing_period
  )

  do update set
    amount =
      excluded.amount,

    currency_code =
      excluded.currency_code,

    submitted_by =
      excluded.submitted_by,

    submitted_at =
      now()

  returning
    id
  into
    v_id;


  return
    v_id;
end;
$$;


-- ============================================================
-- SAVE METER READINGS
--
-- p_readings example:
--
-- [
--   {
--     "register_id": "...",
--     "current_value": 1234.5,
--     "photo_path": "...",
--     "mime_type": "image/jpeg"
--   }
-- ]
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
      on conflict
      do nothing;

    end if;

  end loop;


  return
    v_session_id;
end;
$$;


-- ============================================================
-- RLS
-- ============================================================

alter table public.profiles
  enable row level security;

alter table public.user_settings
  enable row level security;

alter table public.workspaces
  enable row level security;

alter table public.workspace_members
  enable row level security;

alter table public.workspace_subscriptions
  enable row level security;

alter table public.properties
  enable row level security;

alter table public.property_services
  enable row level security;

alter table public.meters
  enable row level security;

alter table public.meter_registers
  enable row level security;

alter table public.service_tariffs
  enable row level security;

alter table public.service_period_values
  enable row level security;

alter table public.media_files
  enable row level security;

alter table public.meter_reading_sessions
  enable row level security;

alter table public.meter_register_readings
  enable row level security;

alter table public.meter_reading_photos
  enable row level security;

alter table public.audit_log
  enable row level security;


-- ============================================================
-- PROFILE / SETTINGS POLICIES
-- ============================================================

drop policy if exists
  profiles_self_read
on public.profiles;


create policy
  profiles_self_read
on public.profiles
for select
to authenticated
using (
  id =
  (select auth.uid())
);


drop policy if exists
  profiles_self_update
on public.profiles;


create policy
  profiles_self_update
on public.profiles
for update
to authenticated
using (
  id =
  (select auth.uid())
)
with check (
  id =
  (select auth.uid())
);


drop policy if exists
  settings_self_all
on public.user_settings;


create policy
  settings_self_all
on public.user_settings
for all
to authenticated
using (
  user_id =
  (select auth.uid())
)
with check (
  user_id =
  (select auth.uid())
);


-- ============================================================
-- WORKSPACE POLICIES
-- ============================================================

drop policy if exists
  workspaces_read
on public.workspaces;


create policy
  workspaces_read
on public.workspaces
for select
to authenticated
using (
  public.is_workspace_member(
    id
  )
);


drop policy if exists
  workspace_members_read
on public.workspace_members;


create policy
  workspace_members_read
on public.workspace_members
for select
to authenticated
using (
  public.is_workspace_member(
    workspace_id
  )
);


drop policy if exists
  workspace_subscriptions_read
on public.workspace_subscriptions;


create policy
  workspace_subscriptions_read
on public.workspace_subscriptions
for select
to authenticated
using (
  public.is_workspace_member(
    workspace_id
  )
);


-- ============================================================
-- PROPERTY POLICIES
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
  public.is_workspace_member(
    workspace_id
  )
);


drop policy if exists
  properties_insert
on public.properties;


create policy
  properties_insert
on public.properties
for insert
to authenticated
with check (
  public.can_manage_workspace(
    workspace_id
  )

  and

  (
    status <>
      'ACTIVE'

    or

    public.can_add_active_property(
      workspace_id
    )
  )

  and

  created_by =
    (select auth.uid())
);


drop policy if exists
  properties_update
on public.properties;


create policy
  properties_update
on public.properties
for update
to authenticated
using (
  public.can_manage_workspace(
    workspace_id
  )
)
with check (
  public.can_manage_workspace(
    workspace_id
  )
);


-- ============================================================
-- SERVICE POLICIES
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
  public.can_access_property(
    property_id
  )
);


drop policy if exists
  property_services_manage
on public.property_services;


create policy
  property_services_manage
on public.property_services
for all
to authenticated
using (
  public.can_manage_property(
    property_id
  )
)
with check (
  public.can_manage_property(
    property_id
  )
);


-- ============================================================
-- METER POLICIES
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
  public.can_access_property(
    property_id
  )
);


drop policy if exists
  meters_manage
on public.meters;


create policy
  meters_manage
on public.meters
for all
to authenticated
using (
  public.can_manage_property(
    property_id
  )
)
with check (
  public.can_manage_property(
    property_id
  )
);


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

    from
      public.meters m

    where
      m.id =
        meter_id

      and

      public.can_access_property(
        m.property_id
      )
  )
);


drop policy if exists
  meter_registers_manage
on public.meter_registers;


create policy
  meter_registers_manage
on public.meter_registers
for all
to authenticated
using (
  exists (
    select 1

    from
      public.meters m

    where
      m.id =
        meter_id

      and

      public.can_manage_property(
        m.property_id
      )
  )
)
with check (
  exists (
    select 1

    from
      public.meters m

    where
      m.id =
        meter_id

      and

      public.can_manage_property(
        m.property_id
      )
  )
);


-- ============================================================
-- TARIFF POLICIES
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

    from
      public.property_services ps

    where
      ps.id =
        property_service_id

      and

      public.can_access_property(
        ps.property_id
      )
  )
);


drop policy if exists
  service_tariffs_manage
on public.service_tariffs;


create policy
  service_tariffs_manage
on public.service_tariffs
for all
to authenticated
using (
  exists (
    select 1

    from
      public.property_services ps

    where
      ps.id =
        property_service_id

      and

      public.can_manage_property(
        ps.property_id
      )
  )
)
with check (
  exists (
    select 1

    from
      public.property_services ps

    where
      ps.id =
        property_service_id

      and

      public.can_manage_property(
        ps.property_id
      )
  )
);


-- ============================================================
-- VARIABLE SERVICE POLICIES
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

    from
      public.property_services ps

    where
      ps.id =
        property_service_id

      and

      public.can_access_property(
        ps.property_id
      )
  )
);


drop policy if exists
  service_period_values_write
on public.service_period_values;


create policy
  service_period_values_write
on public.service_period_values
for all
to authenticated
using (
  exists (
    select 1

    from
      public.property_services ps

    where
      ps.id =
        property_service_id

      and

      public.can_access_property(
        ps.property_id
      )
  )
)
with check (
  submitted_by =
    (select auth.uid())

  and

  exists (
    select 1

    from
      public.property_services ps

    where
      ps.id =
        property_service_id

      and

      public.can_access_property(
        ps.property_id
      )
  )
);


-- ============================================================
-- READING POLICIES
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

    from
      public.meters m

    where
      m.id =
        meter_id

      and

      public.can_access_property(
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
  submitted_by =
    (select auth.uid())

  or

  exists (
    select 1

    from
      public.meters m

    where
      m.id =
        meter_id

      and

      public.can_manage_property(
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

    from
      public.meters m

    where
      m.id =
        meter_id

      and

      public.can_access_property(
        m.property_id
      )
  )
);


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

    from
      public.meter_reading_sessions rs

    join
      public.meters m
        on
          m.id =
          rs.meter_id

    where
      rs.id =
        reading_session_id

      and

      public.can_access_property(
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

    from
      public.meter_reading_sessions rs

    join
      public.meters m
        on
          m.id =
          rs.meter_id

    where
      rs.id =
        reading_session_id

      and

      public.can_access_property(
        m.property_id
      )
  )
)
with check (
  exists (
    select 1

    from
      public.meter_reading_sessions rs

    join
      public.meters m
        on
          m.id =
          rs.meter_id

    where
      rs.id =
        reading_session_id

      and

      public.can_access_property(
        m.property_id
      )
  )
);


-- ============================================================
-- MEDIA POLICIES
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
  public.can_access_property(
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

  public.can_access_property(
    property_id
  )
);


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

    from
      public.meter_register_readings rr

    join
      public.meter_reading_sessions rs
        on
          rs.id =
          rr.reading_session_id

    join
      public.meters m
        on
          m.id =
          rs.meter_id

    where
      rr.id =
        register_reading_id

      and

      public.can_access_property(
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

    from
      public.meter_register_readings rr

    join
      public.meter_reading_sessions rs
        on
          rs.id =
          rr.reading_session_id

    join
      public.meters m
        on
          m.id =
          rs.meter_id

    where
      rr.id =
        register_reading_id

      and

      public.can_access_property(
        m.property_id
      )
  )
)
with check (
  exists (
    select 1

    from
      public.meter_register_readings rr

    join
      public.meter_reading_sessions rs
        on
          rs.id =
          rr.reading_session_id

    join
      public.meters m
        on
          m.id =
          rs.meter_id

    where
      rr.id =
        register_reading_id

      and

      public.can_access_property(
        m.property_id
      )
  )
);


-- ============================================================
-- AUDIT READ ONLY
-- ============================================================

drop policy if exists
  audit_read
on public.audit_log;


create policy
  audit_read
on public.audit_log
for select
to authenticated
using (
  workspace_id is not null

  and

  public.can_manage_workspace(
    workspace_id
  )
);


revoke
  insert,
  update,
  delete
on
  public.audit_log
from
  authenticated,
  anon;


grant
  select
on
  public.audit_log
to
  authenticated;


-- ============================================================
-- STORAGE
--
-- Private bucket.
-- Files are accessed through authenticated requests / signed URL.
-- ============================================================

insert into storage.buckets (
  id,
  name,
  public
)
values (
  'meter-photos',
  'meter-photos',
  false
)
on conflict (
  id
)
do update set
  public =
    false;


-- Path:
--
-- {workspaceId}/
-- {propertyId}/
-- {meterId}/
-- {YYYY-MM}/
-- {registerCode}/
-- {uuid}.jpg


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

  public.can_access_property(
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

  public.can_access_property(
    (
      storage.foldername(
        name
      )
    )[2]::uuid
  )
);


drop policy if exists
  dometra_meter_photos_delete
on storage.objects;


create policy
  dometra_meter_photos_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id =
    'meter-photos'

  and

  public.can_manage_property(
    (
      storage.foldername(
        name
      )
    )[2]::uuid
  )
);