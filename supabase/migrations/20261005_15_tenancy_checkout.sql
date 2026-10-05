-- ============================================================
-- DOMETRA
-- TENANCY CHECKOUT / RENT TERMINATION
-- ============================================================
--
-- Flow:
--
-- ACTIVE tenancy
--     ↓
-- checkout started
--     ↓
-- tenancy_checkouts.status = PENDING
--     ↓
-- tenant submits final readings
--     ↓
-- landlord reviews readings + deposit settlement
--     ↓
-- checkout completed
--     ↓
-- tenancy.status = ENDED
--
-- IMPORTANT:
--
-- The tenancy itself remains ACTIVE while checkout is pending.
-- This keeps the existing occupancy logic and ACTIVE-tenancy
-- queries working until the landlord completes checkout.
--
-- The security deposit currently lives in rent_terms:
--
--   rent_terms.deposit_amount
--   rent_terms.deposit_currency
--
-- We intentionally do NOT depend on security_deposits or
-- security_deposit_transactions because those tables are not
-- present in the current production Supabase schema.
--
-- Deposit settlement is therefore stored directly inside
-- tenancy_checkouts for now.
--
-- ============================================================


-- ============================================================
-- TENANCY CHECKOUT
-- ============================================================

create table if not exists public.tenancy_checkouts (
  tenancy_id uuid
    primary key
    references public.tenancies(id)
    on delete cascade,

  status text
    not null
    default 'PENDING'
    check (
      status in (
        'PENDING',
        'COMPLETED',
        'CANCELLED'
      )
    ),

  checkout_date date
    not null,

  notes text,

  requested_by uuid
    not null
    references auth.users(id),

  requested_at timestamptz
    not null
    default now(),

  completed_by uuid
    references auth.users(id),

  completed_at timestamptz,

  cancelled_by uuid
    references auth.users(id),

  cancelled_at timestamptz,

  deposit_action text
    check (
      deposit_action is null
      or deposit_action in (
        'RETURNED',
        'PARTIALLY_RETURNED',
        'APPLIED',
        'WAIVED'
      )
    ),

  deposit_return_amount numeric(14,2)
    check (
      deposit_return_amount is null
      or deposit_return_amount >= 0
    ),

  settlement_notes text,

  created_at timestamptz
    not null
    default now(),

  updated_at timestamptz
    not null
    default now()
);


create index if not exists idx_tenancy_checkouts_status
on public.tenancy_checkouts (
  status,
  checkout_date
);


-- ============================================================
-- FINAL CHECKOUT METER READINGS
-- ============================================================

create table if not exists public.tenancy_checkout_readings (
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
    on delete cascade,

  reading_date date
    not null,

  value numeric(18,6)
    not null
    check (
      value >= 0
    ),

  submitted_by uuid
    not null
    references auth.users(id),

  submitted_at timestamptz
    not null
    default now(),

  confirmed_by uuid
    references auth.users(id),

  confirmed_at timestamptz,

  created_at timestamptz
    not null
    default now(),

  updated_at timestamptz
    not null
    default now(),

  unique (
    tenancy_id,
    meter_register_id
  )
);


create index if not exists idx_tenancy_checkout_readings_tenancy
on public.tenancy_checkout_readings (
  tenancy_id
);


create index if not exists idx_tenancy_checkout_readings_register
on public.tenancy_checkout_readings (
  meter_register_id
);


-- ============================================================
-- UPDATED_AT TRIGGERS
-- ============================================================

drop trigger if exists trg_tenancy_checkouts_updated_at
on public.tenancy_checkouts;


create trigger trg_tenancy_checkouts_updated_at
before update
on public.tenancy_checkouts
for each row
execute function public.set_updated_at();


drop trigger if exists trg_tenancy_checkout_readings_updated_at
on public.tenancy_checkout_readings;


create trigger trg_tenancy_checkout_readings_updated_at
before update
on public.tenancy_checkout_readings
for each row
execute function public.set_updated_at();


-- ============================================================
-- RLS
-- ============================================================

alter table public.tenancy_checkouts
enable row level security;


alter table public.tenancy_checkout_readings
enable row level security;


-- ============================================================
-- CHECKOUT RLS
-- ============================================================

drop policy if exists tenancy_checkouts_read
on public.tenancy_checkouts;


create policy tenancy_checkouts_read
on public.tenancy_checkouts
for select
to authenticated
using (
  public.can_access_tenancy(
    tenancy_id
  )
);


drop policy if exists tenancy_checkouts_manage
on public.tenancy_checkouts;


create policy tenancy_checkouts_manage
on public.tenancy_checkouts
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


-- ============================================================
-- CHECKOUT READINGS RLS
-- ============================================================

drop policy if exists checkout_readings_read
on public.tenancy_checkout_readings;


create policy checkout_readings_read
on public.tenancy_checkout_readings
for select
to authenticated
using (
  public.can_access_tenancy(
    tenancy_id
  )
);


drop policy if exists checkout_readings_manage_landlord
on public.tenancy_checkout_readings;


create policy checkout_readings_manage_landlord
on public.tenancy_checkout_readings
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


-- ============================================================
-- START TENANCY CHECKOUT
-- ============================================================

create or replace function public.start_tenancy_checkout(
  p_tenancy_id uuid,
  p_checkout_date date,
  p_notes text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenancy public.tenancies%rowtype;
begin

  if auth.uid() is null then
    raise exception
      'Authentication is required.';
  end if;


  if not public.can_manage_tenancy(
    p_tenancy_id
  ) then
    raise exception
      'You cannot manage this tenancy.';
  end if;


  select *
  into v_tenancy
  from public.tenancies
  where id = p_tenancy_id
  for update;


  if not found then
    raise exception
      'Tenancy not found.';
  end if;


  if v_tenancy.status <> 'ACTIVE' then
    raise exception
      'Only an active tenancy can be checked out.';
  end if;


  if p_checkout_date is null then
    raise exception
      'Checkout date is required.';
  end if;


  if p_checkout_date < v_tenancy.start_date then
    raise exception
      'Checkout date cannot be before the tenancy start date.';
  end if;


  insert into public.tenancy_checkouts (
    tenancy_id,
    status,
    checkout_date,
    notes,

    requested_by,
    requested_at,

    completed_by,
    completed_at,

    cancelled_by,
    cancelled_at,

    deposit_action,
    deposit_return_amount,

    settlement_notes
  )
  values (
    p_tenancy_id,
    'PENDING',
    p_checkout_date,

    nullif(
      trim(
        p_notes
      ),
      ''
    ),

    auth.uid(),
    now(),

    null,
    null,

    null,
    null,

    null,
    null,

    null
  )

  on conflict (
    tenancy_id
  )

  do update
  set
    status =
      'PENDING',

    checkout_date =
      excluded.checkout_date,

    notes =
      excluded.notes,

    requested_by =
      auth.uid(),

    requested_at =
      now(),

    completed_by =
      null,

    completed_at =
      null,

    cancelled_by =
      null,

    cancelled_at =
      null,

    deposit_action =
      null,

    deposit_return_amount =
      null,

    settlement_notes =
      null,

    updated_at =
      now();

end;
$$;


-- ============================================================
-- CANCEL TENANCY CHECKOUT
-- ============================================================

create or replace function public.cancel_tenancy_checkout(
  p_tenancy_id uuid
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


  if not public.can_manage_tenancy(
    p_tenancy_id
  ) then
    raise exception
      'You cannot manage this tenancy.';
  end if;


  if not exists (
    select
      1

    from public.tenancy_checkouts c

    join public.tenancies t
      on t.id =
        c.tenancy_id

    where
      c.tenancy_id =
        p_tenancy_id

      and c.status =
        'PENDING'

      and t.status =
        'ACTIVE'
  ) then
    raise exception
      'There is no pending checkout to cancel.';
  end if;


  update public.tenancy_checkouts
  set
    status =
      'CANCELLED',

    cancelled_by =
      auth.uid(),

    cancelled_at =
      now(),

    updated_at =
      now()

  where
    tenancy_id =
      p_tenancy_id;


  delete from public.tenancy_checkout_readings
  where
    tenancy_id =
      p_tenancy_id;

end;
$$;


-- ============================================================
-- SAVE FINAL CHECKOUT READINGS
-- ============================================================
--
-- May be used by:
--
--   - linked tenant
--   - landlord / workspace manager
--
-- Final readings are intentionally separate from the normal
-- monthly meter_reading_sessions table.
--
-- ============================================================

create or replace function public.save_tenancy_checkout_readings(
  p_tenancy_id uuid,
  p_reading_date date,
  p_readings jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_property_id uuid;
  v_checkout_date date;

  v_item jsonb;

  v_register_id uuid;
  v_value numeric(18,6);

  v_previous_value numeric(18,6);

  v_is_member boolean;
begin

  if auth.uid() is null then
    raise exception
      'Authentication is required.';
  end if;


  select
    t.property_id,
    c.checkout_date

  into
    v_property_id,
    v_checkout_date

  from public.tenancies t

  join public.tenancy_checkouts c
    on c.tenancy_id =
      t.id

  where
    t.id =
      p_tenancy_id

    and t.status =
      'ACTIVE'

    and c.status =
      'PENDING';


  if v_property_id is null then
    raise exception
      'Pending checkout not found.';
  end if;


  select exists (
    select
      1

    from public.tenancy_members tm

    where
      tm.tenancy_id =
        p_tenancy_id

      and tm.user_id =
        auth.uid()

      and tm.role in (
        'PRIMARY_TENANT',
        'TENANT'
      )
  )
  into
    v_is_member;


  if
    not v_is_member

    and not public.can_manage_tenancy(
      p_tenancy_id
    )
  then
    raise exception
      'You cannot submit checkout readings for this tenancy.';
  end if;


  if p_reading_date is null then
    raise exception
      'Reading date is required.';
  end if;


  if p_reading_date <> v_checkout_date then
    raise exception
      'Final reading date must match the checkout date.';
  end if;


  if
    p_readings is null

    or jsonb_typeof(
      p_readings
    ) <> 'array'
  then
    raise exception
      'Readings must be a JSON array.';
  end if;


  for v_item in
    select
      value

    from jsonb_array_elements(
      p_readings
    )

  loop

    begin

      v_register_id :=
        (
          v_item ->>
          'registerId'
        )::uuid;


      v_value :=
        (
          v_item ->>
          'value'
        )::numeric;

    exception
      when others then

        raise exception
          'Invalid checkout reading payload.';

    end;


    if
      v_value is null

      or v_value < 0
    then
      raise exception
        'Meter reading cannot be negative.';
    end if;


    if not exists (
      select
        1

      from public.meter_registers mr

      join public.meters m
        on m.id =
          mr.meter_id

      join public.property_services ps
        on ps.id =
          m.property_service_id

      where
        mr.id =
          v_register_id

        and mr.active =
          true

        and m.status =
          'ACTIVE'

        and m.property_id =
          v_property_id

        and ps.property_id =
          v_property_id

        and ps.is_active =
          true

        and ps.calculation_method =
          'METER'
    ) then
      raise exception
        'Meter register does not belong to this tenancy.';
    end if;


    v_previous_value :=
      null;


    select
      current_value::numeric

    into
      v_previous_value

    from public.v_latest_meter_register_readings

    where
      meter_register_id =
        v_register_id

    limit 1;


    if
      v_previous_value is not null

      and v_value <
        v_previous_value
    then
      raise exception
        'Final meter reading cannot be lower than the previous reading.';
    end if;


    insert into public.tenancy_checkout_readings (
      tenancy_id,

      meter_register_id,

      reading_date,

      value,

      submitted_by,

      submitted_at,

      confirmed_by,

      confirmed_at
    )
    values (
      p_tenancy_id,

      v_register_id,

      p_reading_date,

      v_value,

      auth.uid(),

      now(),

      null,

      null
    )

    on conflict (
      tenancy_id,
      meter_register_id
    )

    do update
    set
      reading_date =
        excluded.reading_date,

      value =
        excluded.value,

      submitted_by =
        auth.uid(),

      submitted_at =
        now(),

      confirmed_by =
        null,

      confirmed_at =
        null,

      updated_at =
        now();

  end loop;

end;
$$;


-- ============================================================
-- COMPLETE TENANCY CHECKOUT
-- ============================================================
--
-- Requirements:
--
--   1. tenancy must still be ACTIVE
--   2. checkout must be PENDING
--   3. every active meter register must have a final reading
--   4. if a deposit exists in rent_terms, landlord must select
--      a settlement action
--
-- On completion:
--
--   - checkout readings are confirmed
--   - checkout becomes COMPLETED
--   - deposit settlement is recorded
--   - tenancy becomes ENDED
--   - tenancy end_date becomes checkout_date
--   - auto_prolongation is disabled
--
-- ============================================================

create or replace function public.complete_tenancy_checkout(
  p_tenancy_id uuid,

  p_deposit_action text
    default null,

  p_deposit_return_amount numeric
    default null,

  p_settlement_notes text
    default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenancy public.tenancies%rowtype;

  v_checkout public.tenancy_checkouts%rowtype;

  v_expected integer :=
    0;

  v_submitted integer :=
    0;

  v_deposit_amount numeric(14,2);

  v_deposit_currency text;

  v_return_amount numeric(14,2) :=
    0;

begin

  -- ==========================================================
  -- AUTH
  -- ==========================================================

  if auth.uid() is null then
    raise exception
      'Authentication is required.';
  end if;


  if not public.can_manage_tenancy(
    p_tenancy_id
  ) then
    raise exception
      'You cannot manage this tenancy.';
  end if;


  -- ==========================================================
  -- TENANCY
  -- ==========================================================

  select *
  into
    v_tenancy

  from public.tenancies

  where
    id =
      p_tenancy_id

  for update;


  if not found then
    raise exception
      'Tenancy not found.';
  end if;


  if
    v_tenancy.status <>
    'ACTIVE'
  then
    raise exception
      'Only an active tenancy can be completed.';
  end if;


  -- ==========================================================
  -- CHECKOUT
  -- ==========================================================

  select *
  into
    v_checkout

  from public.tenancy_checkouts

  where
    tenancy_id =
      p_tenancy_id

    and status =
      'PENDING'

  for update;


  if not found then
    raise exception
      'Pending checkout not found.';
  end if;


  -- ==========================================================
  -- EXPECTED FINAL READINGS
  -- ==========================================================

  select
    count(*)

  into
    v_expected

  from public.meter_registers mr

  join public.meters m
    on m.id =
      mr.meter_id

  join public.property_services ps
    on ps.id =
      m.property_service_id

  where
    m.property_id =
      v_tenancy.property_id

    and m.status =
      'ACTIVE'

    and mr.active =
      true

    and ps.property_id =
      v_tenancy.property_id

    and ps.is_active =
      true

    and ps.calculation_method =
      'METER';


  -- ==========================================================
  -- SUBMITTED FINAL READINGS
  -- ==========================================================

  select
    count(*)

  into
    v_submitted

  from public.tenancy_checkout_readings cr

  join public.meter_registers mr
    on mr.id =
      cr.meter_register_id

  join public.meters m
    on m.id =
      mr.meter_id

  join public.property_services ps
    on ps.id =
      m.property_service_id

  where
    cr.tenancy_id =
      p_tenancy_id

    and m.property_id =
      v_tenancy.property_id

    and m.status =
      'ACTIVE'

    and mr.active =
      true

    and ps.property_id =
      v_tenancy.property_id

    and ps.is_active =
      true

    and ps.calculation_method =
      'METER';


  if
    v_submitted <
    v_expected
  then
    raise exception
      'All final meter readings must be submitted before checkout can be completed.';
  end if;


  -- ==========================================================
  -- LOAD DEPOSIT FROM CURRENT RENT TERMS
  -- ==========================================================

  select
    rt.deposit_amount,
    rt.deposit_currency

  into
    v_deposit_amount,
    v_deposit_currency

  from public.rent_terms rt

  where
    rt.tenancy_id =
      p_tenancy_id

    and rt.valid_to
      is null

  limit 1;


  -- ==========================================================
  -- NO DEPOSIT
  -- ==========================================================

  if
    v_deposit_amount is null

    or v_deposit_amount <=
      0

  then

    p_deposit_action :=
      null;

    p_deposit_return_amount :=
      null;

    v_return_amount :=
      0;


  -- ==========================================================
  -- DEPOSIT EXISTS
  -- ==========================================================

  else

    if
      p_deposit_action is null
    then
      raise exception
        'Choose how the security deposit is settled.';
    end if;


    if
      p_deposit_action not in (
        'RETURNED',
        'PARTIALLY_RETURNED',
        'APPLIED',
        'WAIVED'
      )
    then
      raise exception
        'Invalid deposit action.';
    end if;


    -- --------------------------------------------------------
    -- FULL RETURN
    -- --------------------------------------------------------

    if
      p_deposit_action =
      'RETURNED'
    then

      v_return_amount :=
        v_deposit_amount;


    -- --------------------------------------------------------
    -- PARTIAL RETURN
    -- --------------------------------------------------------

    elsif
      p_deposit_action =
      'PARTIALLY_RETURNED'
    then

      v_return_amount :=
        coalesce(
          p_deposit_return_amount,
          0
        );


      if
        v_return_amount <=
        0
      then
        raise exception
          'Partial deposit return must be greater than 0.';
      end if;


      if
        v_return_amount >=
        v_deposit_amount
      then
        raise exception
          'Partial deposit return must be lower than the full deposit.';
      end if;


    -- --------------------------------------------------------
    -- APPLIED / WAIVED
    -- --------------------------------------------------------

    else

      v_return_amount :=
        0;

    end if;

  end if;


  -- ==========================================================
  -- CONFIRM FINAL READINGS
  -- ==========================================================

  update public.tenancy_checkout_readings

  set
    confirmed_by =
      auth.uid(),

    confirmed_at =
      now(),

    updated_at =
      now()

  where
    tenancy_id =
      p_tenancy_id;


  -- ==========================================================
  -- COMPLETE CHECKOUT
  -- ==========================================================

  update public.tenancy_checkouts

  set
    status =
      'COMPLETED',

    completed_by =
      auth.uid(),

    completed_at =
      now(),

    deposit_action =
      p_deposit_action,

    deposit_return_amount =
      case

        when p_deposit_action
          is null
        then
          null


        when p_deposit_action =
          'RETURNED'
        then
          v_deposit_amount


        when p_deposit_action =
          'PARTIALLY_RETURNED'
        then
          v_return_amount


        else
          0

      end,

    settlement_notes =
      nullif(
        trim(
          p_settlement_notes
        ),
        ''
      ),

    updated_at =
      now()

  where
    tenancy_id =
      p_tenancy_id;


  -- ==========================================================
  -- END TENANCY
  -- ==========================================================

  update public.tenancies

  set
    status =
      'ENDED',

    end_date =
      v_checkout.checkout_date,

    auto_prolongation =
      false,

    updated_at =
      now()

  where
    id =
      p_tenancy_id;

end;
$$;


-- ============================================================
-- FUNCTION GRANTS
-- ============================================================

grant execute
on function public.start_tenancy_checkout(
  uuid,
  date,
  text
)
to authenticated;


grant execute
on function public.cancel_tenancy_checkout(
  uuid
)
to authenticated;


grant execute
on function public.save_tenancy_checkout_readings(
  uuid,
  date,
  jsonb
)
to authenticated;


grant execute
on function public.complete_tenancy_checkout(
  uuid,
  text,
  numeric,
  text
)
to authenticated;