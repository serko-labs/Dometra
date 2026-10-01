-- ============================================================
-- DOMETRA
-- Tenancy lifecycle - stage 1
--
-- - auto prolongation
-- - MOVE_IN meter snapshots
-- - audit manual tenant edits
-- - audit tenancy meter snapshots
-- - v2 tenancy creation RPCs
-- ============================================================


-- ============================================================
-- AUDIT LOG COMPATIBILITY
-- ============================================================

alter table public.audit_log
add column if not exists table_name text;

alter table public.audit_log
add column if not exists entity_type text;

alter table public.audit_log
add column if not exists property_id uuid;


-- ============================================================
-- AUTO PROLONGATION
-- ============================================================

alter table public.tenancies
add column if not exists auto_prolongation boolean
not null
default false;


-- ============================================================
-- TENANCY METER SNAPSHOT TYPE
-- ============================================================

do $$
begin
  create type public.tenancy_reading_type
    as enum (
      'MOVE_IN',
      'MOVE_OUT'
    );
exception
  when duplicate_object then null;
end $$;


-- ============================================================
-- TENANCY METER READINGS
--
-- These are NOT monthly meter readings.
--
-- They are tenancy boundary snapshots:
--
-- MOVE_IN
-- MOVE_OUT
-- ============================================================

create table if not exists public.tenancy_meter_readings (
  id uuid
    primary key
    default gen_random_uuid(),

  tenancy_id uuid
    not null
    references public.tenancies(id)
    on delete cascade,

  meter_register_id uuid
    not null
    references public.meter_registers(id)
    on delete restrict,

  reading_type public.tenancy_reading_type
    not null,

  reading_date date
    not null,

  value numeric
    not null
    check (
      value >= 0
    ),

  created_by uuid
    not null
    references auth.users(id),

  created_at timestamptz
    not null
    default now(),

  updated_at timestamptz
    not null
    default now(),

  unique (
    tenancy_id,
    meter_register_id,
    reading_type
  )
);


create index if not exists
  idx_tenancy_meter_readings_tenancy
on public.tenancy_meter_readings (
  tenancy_id,
  reading_type
);


drop trigger if exists
  trg_tenancy_meter_readings_updated_at
on public.tenancy_meter_readings;


create trigger
  trg_tenancy_meter_readings_updated_at
before update
on public.tenancy_meter_readings
for each row
execute function
  public.set_updated_at();


-- ============================================================
-- RLS
-- ============================================================

alter table public.tenancy_meter_readings
enable row level security;


drop policy if exists
  tenancy_meter_readings_read
on public.tenancy_meter_readings;


create policy
  tenancy_meter_readings_read
on public.tenancy_meter_readings
for select
to authenticated
using (
  public.can_access_tenancy(
    tenancy_id
  )
);


drop policy if exists
  tenancy_meter_readings_manage
on public.tenancy_meter_readings;


create policy
  tenancy_meter_readings_manage
on public.tenancy_meter_readings
for all
to authenticated
using (
  public.can_manage_tenancy(
    tenancy_id
  )
)
with check (
  public.can_manage_tenancy(
    tenancy_id
  )
);


grant select, insert, update, delete
on public.tenancy_meter_readings
to authenticated;


-- ============================================================
-- EXTENDED TENANCY AUDIT
--
-- Includes:
--
-- tenancies
-- rent_terms
-- tenancy_members
-- tenancy_invitations
-- tenancy_meter_readings
-- manual_tenant_contacts
-- ============================================================

create or replace function public.audit_tenancy_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row jsonb;

  v_property_id uuid;

  v_workspace_id uuid;

  v_tenancy_id uuid;

  v_entity_id uuid;

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


  -- ----------------------------------------------------------
  -- TENANCY
  -- ----------------------------------------------------------

  if
    tg_table_name =
      'tenancies'
  then

    v_tenancy_id :=
      v_entity_id;

    v_property_id :=
      nullif(
        v_row ->> 'property_id',
        ''
      )::uuid;


  -- ----------------------------------------------------------
  -- MANUAL TENANT
  -- ----------------------------------------------------------

  elsif
    tg_table_name =
      'manual_tenant_contacts'
  then

    select
      t.id,
      t.property_id

    into
      v_tenancy_id,
      v_property_id

    from public.tenancies t

    where
      t.manual_tenant_contact_id =
        v_entity_id

    order by
      t.created_at desc

    limit 1;


  -- ----------------------------------------------------------
  -- TENANCY CHILD TABLES
  -- ----------------------------------------------------------

  elsif
    tg_table_name in (
      'rent_terms',
      'tenancy_members',
      'tenancy_invitations',
      'tenancy_meter_readings'
    )
  then

    v_tenancy_id :=
      nullif(
        v_row ->> 'tenancy_id',
        ''
      )::uuid;


    select
      t.property_id

    into
      v_property_id

    from public.tenancies t

    where
      t.id =
        v_tenancy_id;

  end if;


  if
    v_property_id is not null
  then

    select
      p.workspace_id

    into
      v_workspace_id

    from public.properties p

    where
      p.id =
        v_property_id;

  end if;


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
    property_id,
    user_id,
    session_id,
    table_name,
    entity_type,
    entity_id,
    action,
    before_data,
    after_data
  )
  values (
    v_workspace_id,

    v_property_id,

    (select auth.uid()),

    v_session_id,

    tg_table_name,

    tg_table_name,

    v_entity_id,

    case
      when tg_op = 'INSERT'
      then 'CREATE'

      when tg_op = 'UPDATE'
      then 'UPDATE'

      else 'DELETE'
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


  if
    tg_op = 'DELETE'
  then
    return old;
  end if;


  return new;

end;
$$;


-- ============================================================
-- RECREATE TENANCY AUDIT TRIGGERS
-- ============================================================

do $$
declare
  v_table text;
begin

  foreach v_table in array array[
    'tenancies',
    'rent_terms',
    'tenancy_members',
    'tenancy_invitations',
    'tenancy_meter_readings',
    'manual_tenant_contacts'
  ]

  loop

    execute format(
      'drop trigger if exists trg_%I_tenancy_audit on public.%I',
      v_table,
      v_table
    );


    execute format(
      'create trigger trg_%I_tenancy_audit
       after insert or update or delete
       on public.%I
       for each row
       execute function public.audit_tenancy_change()',
      v_table,
      v_table
    );

  end loop;

end;
$$;


-- ============================================================
-- CREATE MANUAL TENANCY V2
-- ============================================================

create or replace function public.create_manual_tenancy_v2(
  p_property_id uuid,

  p_first_name text,

  p_last_name text,

  p_phone text,

  p_email text,

  p_passport_id_number text,

  p_passport_photo_path text,

  p_emergency_contact text,

  p_notes text,

  p_rent_amount numeric,

  p_currency char(3),

  p_start_date date,

  p_payment_due_day integer,

  p_end_date date,

  p_deposit_amount numeric,

  p_deposit_currency char(3),

  p_agreement_path text,

  p_auto_prolongation boolean,

  p_opening_readings jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_workspace_id uuid;

  v_contact_id uuid;

  v_tenancy_id uuid;

  v_item jsonb;

  v_register_id uuid;

  v_value numeric;
begin

  if
    not public.can_manage_property(
      p_property_id
    )
  then
    raise exception
      'Not allowed to manage this property';
  end if;


  if exists (
    select 1

    from public.tenancies t

    where
      t.property_id =
        p_property_id

      and

      t.status in (
        'PENDING',
        'ACTIVE'
      )
  )
  then
    raise exception
      'This apartment already has an active or pending tenancy';
  end if;


  if
    nullif(
      trim(
        p_first_name
      ),
      ''
    )
    is null
  then
    raise exception
      'First name is required';
  end if;


  if
    nullif(
      trim(
        p_last_name
      ),
      ''
    )
    is null
  then
    raise exception
      'Last name is required';
  end if;


  if
    nullif(
      trim(
        p_phone
      ),
      ''
    )
    is null
  then
    raise exception
      'Phone is required';
  end if;


  if
    nullif(
      trim(
        p_email
      ),
      ''
    )
    is null
  then
    raise exception
      'Email is required';
  end if;


  select
    p.workspace_id

  into
    v_workspace_id

  from public.properties p

  where
    p.id =
      p_property_id;


  insert into public.manual_tenant_contacts (
    workspace_id,
    first_name,
    last_name,
    phone,
    email,
    passport_id_number,
    passport_photo_path,
    emergency_contact,
    notes,
    created_by
  )
  values (
    v_workspace_id,

    trim(
      p_first_name
    ),

    trim(
      p_last_name
    ),

    trim(
      p_phone
    ),

    lower(
      trim(
        p_email
      )
    ),

    nullif(
      trim(
        p_passport_id_number
      ),
      ''
    ),

    nullif(
      trim(
        p_passport_photo_path
      ),
      ''
    ),

    nullif(
      trim(
        p_emergency_contact
      ),
      ''
    ),

    nullif(
      trim(
        p_notes
      ),
      ''
    ),

    (select auth.uid())
  )

  returning
    id

  into
    v_contact_id;


  insert into public.tenancies (
    property_id,
    manual_tenant_contact_id,
    status,
    start_date,
    end_date,
    agreement_path,
    auto_prolongation,
    created_by
  )
  values (
    p_property_id,

    v_contact_id,

    'ACTIVE',

    p_start_date,

    p_end_date,

    nullif(
      trim(
        p_agreement_path
      ),
      ''
    ),

    coalesce(
      p_auto_prolongation,
      false
    ),

    (select auth.uid())
  )

  returning
    id

  into
    v_tenancy_id;


  insert into public.rent_terms (
    tenancy_id,
    rent_amount,
    currency_code,
    payment_due_day,
    deposit_amount,
    deposit_currency,
    valid_from
  )
  values (
    v_tenancy_id,

    p_rent_amount,

    p_currency,

    p_payment_due_day,

    p_deposit_amount,

    case
      when
        p_deposit_amount is null
      then
        null
      else
        coalesce(
          p_deposit_currency,
          p_currency
        )
    end,

    p_start_date
  );


  -- ----------------------------------------------------------
  -- OPTIONAL MOVE-IN READINGS
  -- ----------------------------------------------------------

  for v_item in
    select value

    from jsonb_array_elements(
      coalesce(
        p_opening_readings,
        '[]'::jsonb
      )
    )
  loop

    v_register_id :=
      (
        v_item ->>
          'meter_register_id'
      )::uuid;


    v_value :=
      (
        v_item ->>
          'value'
      )::numeric;


    if
      v_value < 0
    then
      raise exception
        'Meter value cannot be negative';
    end if;


    if
      not exists (
        select 1

        from public.meter_registers mr

        join public.meters m
          on
            m.id =
            mr.meter_id

        where
          mr.id =
            v_register_id

          and

          m.property_id =
            p_property_id
      )
    then
      raise exception
        'Meter register does not belong to this property';
    end if;


    insert into public.tenancy_meter_readings (
      tenancy_id,
      meter_register_id,
      reading_type,
      reading_date,
      value,
      created_by
    )
    values (
      v_tenancy_id,

      v_register_id,

      'MOVE_IN',

      p_start_date,

      v_value,

      (select auth.uid())
    );

  end loop;


  return
    v_tenancy_id;

end;
$$;


-- ============================================================
-- CREATE TENANT INVITATION V2
-- ============================================================

create or replace function public.create_tenant_invitation_v2(
  p_property_id uuid,

  p_rent_amount numeric,

  p_currency char(3),

  p_start_date date,

  p_payment_due_day integer,

  p_end_date date,

  p_deposit_amount numeric,

  p_deposit_currency char(3),

  p_agreement_path text,

  p_auto_prolongation boolean,

  p_opening_readings jsonb
)
returns table (
  tenancy_id uuid,

  invitation_id uuid,

  token text,

  expires_at timestamptz
)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_tenancy_id uuid;

  v_invitation_id uuid;

  v_token text;

  v_token_hash text;

  v_expires_at timestamptz;

  v_item jsonb;

  v_register_id uuid;

  v_value numeric;
begin

  if
    not public.can_manage_property(
      p_property_id
    )
  then
    raise exception
      'Not allowed to manage this property';
  end if;


  if exists (
    select 1

    from public.tenancies t

    where
      t.property_id =
        p_property_id

      and

      t.status in (
        'PENDING',
        'ACTIVE'
      )
  )
  then
    raise exception
      'This apartment already has an active or pending tenancy';
  end if;


  insert into public.tenancies (
    property_id,
    status,
    start_date,
    end_date,
    agreement_path,
    auto_prolongation,
    created_by
  )
  values (
    p_property_id,

    'PENDING',

    p_start_date,

    p_end_date,

    nullif(
      trim(
        p_agreement_path
      ),
      ''
    ),

    coalesce(
      p_auto_prolongation,
      false
    ),

    (select auth.uid())
  )

  returning
    id

  into
    v_tenancy_id;


  insert into public.rent_terms (
    tenancy_id,
    rent_amount,
    currency_code,
    payment_due_day,
    deposit_amount,
    deposit_currency,
    valid_from
  )
  values (
    v_tenancy_id,

    p_rent_amount,

    p_currency,

    p_payment_due_day,

    p_deposit_amount,

    case
      when
        p_deposit_amount is null
      then
        null
      else
        coalesce(
          p_deposit_currency,
          p_currency
        )
    end,

    p_start_date
  );


  -- ----------------------------------------------------------
  -- OPTIONAL MOVE-IN READINGS
  -- ----------------------------------------------------------

  for v_item in
    select value

    from jsonb_array_elements(
      coalesce(
        p_opening_readings,
        '[]'::jsonb
      )
    )
  loop

    v_register_id :=
      (
        v_item ->>
          'meter_register_id'
      )::uuid;


    v_value :=
      (
        v_item ->>
          'value'
      )::numeric;


    if
      not exists (
        select 1

        from public.meter_registers mr

        join public.meters m
          on
            m.id =
            mr.meter_id

        where
          mr.id =
            v_register_id

          and

          m.property_id =
            p_property_id
      )
    then
      raise exception
        'Meter register does not belong to property';
    end if;


    insert into public.tenancy_meter_readings (
      tenancy_id,
      meter_register_id,
      reading_type,
      reading_date,
      value,
      created_by
    )
    values (
      v_tenancy_id,

      v_register_id,

      'MOVE_IN',

      p_start_date,

      v_value,

      (select auth.uid())
    );

  end loop;


  -- ----------------------------------------------------------
  -- INVITATION
  -- ----------------------------------------------------------

  v_token :=
    encode(
      gen_random_bytes(
        32
      ),
      'hex'
    );


  v_token_hash :=
    encode(
      digest(
        v_token,
        'sha256'
      ),
      'hex'
    );


  v_expires_at :=
    now() +
    interval '7 days';


  insert into public.tenancy_invitations (
    tenancy_id,
    token_hash,
    status,
    invited_by,
    expires_at
  )
  values (
    v_tenancy_id,

    v_token_hash,

    'PENDING',

    (select auth.uid()),

    v_expires_at
  )

  returning
    id

  into
    v_invitation_id;


  return query
  select
    v_tenancy_id,
    v_invitation_id,
    v_token,
    v_expires_at;

end;
$$;


-- ============================================================
-- GRANTS
-- ============================================================

revoke execute
on function public.create_manual_tenancy_v2(
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  numeric,
  char,
  date,
  integer,
  date,
  numeric,
  char,
  text,
  boolean,
  jsonb
)
from public, anon;


grant execute
on function public.create_manual_tenancy_v2(
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  numeric,
  char,
  date,
  integer,
  date,
  numeric,
  char,
  text,
  boolean,
  jsonb
)
to authenticated;


revoke execute
on function public.create_tenant_invitation_v2(
  uuid,
  numeric,
  char,
  date,
  integer,
  date,
  numeric,
  char,
  text,
  boolean,
  jsonb
)
from public, anon;


grant execute
on function public.create_tenant_invitation_v2(
  uuid,
  numeric,
  char,
  date,
  integer,
  date,
  numeric,
  char,
  text,
  boolean,
  jsonb
)
to authenticated;