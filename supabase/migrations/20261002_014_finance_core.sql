begin;

create extension if not exists pgcrypto;

do $$
begin
  create type public.invoice_status as enum (
    'DRAFT',
    'ISSUED',
    'PARTIALLY_PAID',
    'PAID',
    'OVERDUE',
    'VOID'
  );
exception
  when duplicate_object then
    null;
end
$$;

do $$
begin
  create type public.invoice_line_type as enum (
    'RENT',
    'UTILITY',
    'FIXED_CHARGE',
    'CUSTOM_CHARGE',
    'DISCOUNT',
    'CREDIT',
    'DEPOSIT',
    'OTHER'
  );
exception
  when duplicate_object then
    null;
end
$$;

do $$
begin
  create type public.payment_method as enum (
    'BANK_TRANSFER',
    'CASH',
    'CARD',
    'OTHER'
  );
exception
  when duplicate_object then
    null;
end
$$;

do $$
begin
  create type public.payment_purpose as enum (
    'AUTO',
    'INVOICE',
    'ADVANCE',
    'RENT',
    'UTILITY',
    'DEPOSIT',
    'OTHER'
  );
exception
  when duplicate_object then
    null;
end
$$;


/*
 * ============================================================
 * FX RATES
 * ============================================================
 */

create table if not exists public.fx_rates (
  id uuid primary key default gen_random_uuid(),

  rate_date date not null,

  base_currency char(3) not null,

  quote_currency char(3) not null,

  rate numeric(18, 8) not null
    check (rate > 0),

  source text not null default 'MANUAL',

  created_at timestamptz not null default now(),

  unique (
    rate_date,
    base_currency,
    quote_currency,
    source
  )
);


/*
 * ============================================================
 * INVOICES
 * ============================================================
 */

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),

  workspace_id uuid not null
    references public.workspaces(id)
    on delete cascade,

  property_id uuid not null
    references public.properties(id)
    on delete restrict,

  tenancy_id uuid not null
    references public.tenancies(id)
    on delete restrict,

  invoice_number text not null,

  billing_period date not null,

  issue_date date not null,

  due_date date,

  status public.invoice_status not null
    default 'DRAFT',

  language_code varchar(10) not null
    default 'en',

  base_currency char(3) not null,

  base_total_amount numeric(14, 2) not null
    default 0,

  base_paid_amount numeric(14, 2) not null
    default 0,

  base_balance_amount numeric(14, 2) not null
    default 0,

  template_version integer not null
    default 1,

  notes text,

  issued_at timestamptz,

  paid_at timestamptz,

  created_by uuid not null
    references auth.users(id),

  created_at timestamptz not null
    default now(),

  updated_at timestamptz not null
    default now(),

  unique (
    workspace_id,
    invoice_number
  ),

  unique (
    tenancy_id,
    billing_period
  )
);

create index if not exists idx_invoices_workspace_period
  on public.invoices(
    workspace_id,
    billing_period,
    status
  );

create index if not exists idx_invoices_property_period
  on public.invoices(
    property_id,
    billing_period desc
  );

create index if not exists idx_invoices_tenancy_period
  on public.invoices(
    tenancy_id,
    billing_period desc
  );


/*
 * ============================================================
 * INVOICE LINES
 * ============================================================
 */

create table if not exists public.invoice_lines (
  id uuid primary key default gen_random_uuid(),

  invoice_id uuid not null
    references public.invoices(id)
    on delete cascade,

  line_type public.invoice_line_type not null,

  property_service_id uuid
    references public.property_services(id)
    on delete set null,

  meter_register_reading_id uuid
    references public.meter_register_readings(id)
    on delete set null,

  description_key text,

  description_snapshot text not null,

  quantity numeric(18, 6),

  unit text,

  unit_price numeric(18, 6),

  amount numeric(14, 2) not null,

  currency_code char(3) not null,

  fx_rate_to_base numeric(18, 8) not null
    default 1
    check (fx_rate_to_base > 0),

  fx_rate_date date,

  fx_source text,

  base_amount numeric(14, 2) not null,

  metadata jsonb,

  sort_order integer not null
    default 0,

  created_at timestamptz not null
    default now()
);

create index if not exists idx_invoice_lines_invoice
  on public.invoice_lines(
    invoice_id,
    sort_order
  );


/*
 * ============================================================
 * PAYMENTS
 * ============================================================
 */

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),

  workspace_id uuid not null
    references public.workspaces(id)
    on delete cascade,

  tenancy_id uuid not null
    references public.tenancies(id)
    on delete restrict,

  amount numeric(14, 2) not null
    check (amount > 0),

  currency_code char(3) not null,

  base_currency char(3) not null,

  fx_rate_to_base numeric(18, 8) not null
    default 1
    check (fx_rate_to_base > 0),

  fx_rate_date date,

  fx_source text,

  base_amount numeric(14, 2) not null,

  payment_date date not null,

  method public.payment_method not null
    default 'BANK_TRANSFER',

  purpose public.payment_purpose not null
    default 'AUTO',

  reference text,

  note text,

  received_by uuid
    references auth.users(id),

  created_at timestamptz not null
    default now(),

  updated_at timestamptz not null
    default now()
);

create index if not exists idx_payments_workspace_date
  on public.payments(
    workspace_id,
    payment_date desc
  );

create index if not exists idx_payments_tenancy_date
  on public.payments(
    tenancy_id,
    payment_date desc
  );


/*
 * ============================================================
 * PAYMENT ALLOCATIONS
 * ============================================================
 */

create table if not exists public.payment_allocations (
  id uuid primary key default gen_random_uuid(),

  payment_id uuid not null
    references public.payments(id)
    on delete cascade,

  invoice_id uuid
    references public.invoices(id)
    on delete cascade,

  reserved_billing_period date,

  allocated_payment_amount numeric(14, 2) not null
    check (allocated_payment_amount > 0),

  payment_currency char(3) not null,

  allocated_invoice_amount numeric(14, 2),

  invoice_currency char(3),

  fx_rate numeric(18, 8),

  base_amount numeric(14, 2) not null
    check (base_amount > 0),

  allocation_type text not null
    default 'AUTO'
    check (
      allocation_type in (
        'AUTO',
        'MANUAL',
        'ADVANCE_RESERVATION'
      )
    ),

  created_by uuid not null
    references auth.users(id),

  created_at timestamptz not null
    default now(),

  check (
    (
      invoice_id is not null
      and reserved_billing_period is null
    )
    or
    (
      invoice_id is null
      and reserved_billing_period is not null
    )
  )
);

create index if not exists idx_payment_allocations_payment
  on public.payment_allocations(
    payment_id
  );

create index if not exists idx_payment_allocations_invoice
  on public.payment_allocations(
    invoice_id
  )
  where invoice_id is not null;


/*
 * ============================================================
 * RLS
 * ============================================================
 */

alter table public.invoices
  enable row level security;

alter table public.invoice_lines
  enable row level security;

alter table public.payments
  enable row level security;

alter table public.payment_allocations
  enable row level security;


drop policy if exists invoices_read
  on public.invoices;

create policy invoices_read
on public.invoices
for select
to authenticated
using (
  public.can_access_tenancy(
    tenancy_id
  )
);


drop policy if exists invoices_manage
  on public.invoices;

create policy invoices_manage
on public.invoices
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


drop policy if exists invoice_lines_read
  on public.invoice_lines;

create policy invoice_lines_read
on public.invoice_lines
for select
to authenticated
using (
  exists (
    select 1
    from public.invoices i
    where
      i.id = invoice_id
      and public.can_access_tenancy(
        i.tenancy_id
      )
  )
);


drop policy if exists invoice_lines_manage
  on public.invoice_lines;

create policy invoice_lines_manage
on public.invoice_lines
for all
to authenticated
using (
  exists (
    select 1
    from public.invoices i
    where
      i.id = invoice_id
      and public.can_manage_tenancy(
        i.tenancy_id
      )
  )
)
with check (
  exists (
    select 1
    from public.invoices i
    where
      i.id = invoice_id
      and public.can_manage_tenancy(
        i.tenancy_id
      )
  )
);


drop policy if exists payments_read
  on public.payments;

create policy payments_read
on public.payments
for select
to authenticated
using (
  public.can_access_tenancy(
    tenancy_id
  )
);


drop policy if exists payments_manage
  on public.payments;

create policy payments_manage
on public.payments
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


drop policy if exists payment_allocations_read
  on public.payment_allocations;

create policy payment_allocations_read
on public.payment_allocations
for select
to authenticated
using (
  exists (
    select 1
    from public.payments p
    where
      p.id = payment_id
      and public.can_access_tenancy(
        p.tenancy_id
      )
  )
);


drop policy if exists payment_allocations_manage
  on public.payment_allocations;

create policy payment_allocations_manage
on public.payment_allocations
for all
to authenticated
using (
  exists (
    select 1
    from public.payments p
    where
      p.id = payment_id
      and public.can_manage_tenancy(
        p.tenancy_id
      )
  )
)
with check (
  exists (
    select 1
    from public.payments p
    where
      p.id = payment_id
      and public.can_manage_tenancy(
        p.tenancy_id
      )
  )
);


/*
 * ============================================================
 * FX HELPER
 *
 * Returns amount of target/base currency
 * for one unit of source currency.
 * ============================================================
 */

create or replace function public.finance_fx_rate(
  p_currency char(3),
  p_base_currency char(3),
  p_date date
)
returns numeric
language plpgsql
stable
security invoker
set search_path = public, pg_temp
as $$
declare
  v_rate numeric;
begin
  if p_currency = p_base_currency then
    return 1;
  end if;

  select r.rate
  into v_rate
  from public.fx_rates r
  where
    r.base_currency = p_currency
    and r.quote_currency = p_base_currency
    and r.rate_date <= p_date
  order by
    r.rate_date desc,
    r.created_at desc
  limit 1;

  if v_rate is not null then
    return v_rate;
  end if;

  select 1 / r.rate
  into v_rate
  from public.fx_rates r
  where
    r.base_currency = p_base_currency
    and r.quote_currency = p_currency
    and r.rate_date <= p_date
  order by
    r.rate_date desc,
    r.created_at desc
  limit 1;

  if v_rate is not null then
    return v_rate;
  end if;

  raise exception
    'Missing FX rate from % to % for %',
    p_currency,
    p_base_currency,
    p_date;
end;
$$;


/*
 * ============================================================
 * RECALCULATE INVOICE
 * ============================================================
 */

create or replace function public.recalculate_invoice_balance(
  p_invoice_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_total numeric(14, 2);
  v_paid numeric(14, 2);
  v_balance numeric(14, 2);
  v_current_status text;
begin
  select
    coalesce(
      sum(il.base_amount),
      0
    )
  into v_total
  from public.invoice_lines il
  where
    il.invoice_id = p_invoice_id;

  select
    coalesce(
      sum(pa.base_amount),
      0
    )
  into v_paid
  from public.payment_allocations pa
  where
    pa.invoice_id = p_invoice_id;

  v_balance :=
    greatest(
      v_total - v_paid,
      0
    );

  select
    i.status::text
  into v_current_status
  from public.invoices i
  where
    i.id = p_invoice_id;

  update public.invoices
  set
    base_total_amount =
      v_total,

    base_paid_amount =
      least(
        v_paid,
        v_total
      ),

    base_balance_amount =
      v_balance,

    status =
      case
        when v_current_status = 'VOID'
          then status

        when v_total <= 0
          then 'PAID'::public.invoice_status

        when v_balance <= 0
          then 'PAID'::public.invoice_status

        when v_paid > 0
          then 'PARTIALLY_PAID'::public.invoice_status

        when due_date is not null
          and due_date < current_date
          then 'OVERDUE'::public.invoice_status

        else 'ISSUED'::public.invoice_status
      end,

    paid_at =
      case
        when v_balance <= 0
          then coalesce(
            paid_at,
            now()
          )

        else null
      end,

    updated_at =
      now()

  where
    id = p_invoice_id;
end;
$$;


/*
 * ============================================================
 * APPLY ONE PAYMENT TO OPEN INVOICES
 * ============================================================
 */

create or replace function public.allocate_payment_automatically(
  p_payment_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_payment public.payments%rowtype;

  v_used_base numeric(14, 2);

  v_available_base numeric(14, 2);

  v_allocate_base numeric(14, 2);

  v_allocate_payment numeric(14, 2);

  v_invoice record;
begin
  select *
  into v_payment
  from public.payments
  where id = p_payment_id
  for update;

  if not found then
    raise exception
      'Payment not found.';
  end if;

  select
    coalesce(
      sum(pa.base_amount),
      0
    )
  into v_used_base
  from public.payment_allocations pa
  where
    pa.payment_id =
      p_payment_id;

  v_available_base :=
    greatest(
      v_payment.base_amount -
      v_used_base,
      0
    );

  if v_available_base <= 0 then
    return;
  end if;

  for v_invoice in
    select
      i.id,
      i.base_currency,
      i.base_balance_amount
    from public.invoices i
    where
      i.tenancy_id =
        v_payment.tenancy_id

      and i.status::text
        in (
          'ISSUED',
          'PARTIALLY_PAID',
          'OVERDUE'
        )

      and i.base_balance_amount > 0

    order by
      i.due_date nulls last,
      i.billing_period,
      i.created_at

    for update
  loop
    exit when
      v_available_base <= 0;

    v_allocate_base :=
      least(
        v_available_base,
        v_invoice.base_balance_amount
      );

    v_allocate_payment :=
      round(
        v_allocate_base /
        v_payment.fx_rate_to_base,
        2
      );

    insert into public.payment_allocations (
      payment_id,
      invoice_id,
      allocated_payment_amount,
      payment_currency,
      allocated_invoice_amount,
      invoice_currency,
      fx_rate,
      base_amount,
      allocation_type,
      created_by
    )
    values (
      v_payment.id,
      v_invoice.id,
      v_allocate_payment,
      v_payment.currency_code,
      v_allocate_base,
      v_invoice.base_currency,
      v_payment.fx_rate_to_base,
      v_allocate_base,
      'AUTO',
      auth.uid()
    );

    perform public.recalculate_invoice_balance(
      v_invoice.id
    );

    v_available_base :=
      v_available_base -
      v_allocate_base;
  end loop;
end;
$$;


/*
 * ============================================================
 * APPLY EXISTING ADVANCE TO A NEW INVOICE
 * ============================================================
 */

create or replace function public.apply_tenancy_advance_to_invoice(
  p_invoice_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_invoice public.invoices%rowtype;

  v_payment record;

  v_invoice_balance numeric(14, 2);

  v_available_base numeric(14, 2);

  v_allocate_base numeric(14, 2);

  v_allocate_payment numeric(14, 2);
begin
  select *
  into v_invoice
  from public.invoices
  where id =
    p_invoice_id
  for update;

  if not found then
    raise exception
      'Invoice not found.';
  end if;

  perform public.recalculate_invoice_balance(
    p_invoice_id
  );

  select base_balance_amount
  into v_invoice_balance
  from public.invoices
  where id =
    p_invoice_id;

  if v_invoice_balance <= 0 then
    return;
  end if;

  for v_payment in
    select
      p.*,

      greatest(
        p.base_amount -
        coalesce(
          (
            select
              sum(pa.base_amount)
            from public.payment_allocations pa
            where
              pa.payment_id = p.id
          ),
          0
        ),
        0
      ) as available_base

    from public.payments p

    where
      p.tenancy_id =
        v_invoice.tenancy_id

    order by
      p.payment_date,
      p.created_at

    for update
  loop
    exit when
      v_invoice_balance <= 0;

    v_available_base :=
      v_payment.available_base;

    if v_available_base <= 0 then
      continue;
    end if;

    v_allocate_base :=
      least(
        v_available_base,
        v_invoice_balance
      );

    v_allocate_payment :=
      round(
        v_allocate_base /
        v_payment.fx_rate_to_base,
        2
      );

    insert into public.payment_allocations (
      payment_id,
      invoice_id,
      allocated_payment_amount,
      payment_currency,
      allocated_invoice_amount,
      invoice_currency,
      fx_rate,
      base_amount,
      allocation_type,
      created_by
    )
    values (
      v_payment.id,
      v_invoice.id,
      v_allocate_payment,
      v_payment.currency_code,
      v_allocate_base,
      v_invoice.base_currency,
      v_payment.fx_rate_to_base,
      v_allocate_base,
      'AUTO',
      auth.uid()
    );

    v_invoice_balance :=
      v_invoice_balance -
      v_allocate_base;
  end loop;

  perform public.recalculate_invoice_balance(
    p_invoice_id
  );
end;
$$;


/*
 * ============================================================
 * GENERATE MONTHLY INVOICE
 * ============================================================
 */

create or replace function public.generate_monthly_invoice_v1(
  p_property_id uuid,
  p_billing_period date default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid :=
    auth.uid();

  v_period date :=
    date_trunc(
      'month',
      coalesce(
        p_billing_period,
        current_date
      )
    )::date;

  v_period_end date :=
    (
      date_trunc(
        'month',
        coalesce(
          p_billing_period,
          current_date
        )
      )
      +
      interval '1 month'
      -
      interval '1 day'
    )::date;

  v_property record;

  v_workspace record;

  v_tenancy record;

  v_rent jsonb;

  v_rent_amount numeric(14, 2);

  v_rent_currency char(3);

  v_due_day integer;

  v_due_date date;

  v_language varchar(10);

  v_invoice_id uuid;

  v_existing_id uuid;

  v_invoice_number text;

  v_fx numeric(18, 8);

  v_base_amount numeric(14, 2);

  v_sort integer :=
    0;

  v_service record;

  v_tariff record;

  v_reading record;

  v_manual record;

  v_line_amount numeric(14, 2);

  v_line_currency char(3);
begin
  if v_user_id is null then
    raise exception
      'Authentication required.';
  end if;

  if not public.can_manage_property(
    p_property_id
  ) then
    raise exception
      'You cannot manage this property.';
  end if;

  select
    p.id,
    p.workspace_id,
    p.title
  into v_property
  from public.properties p
  where
    p.id =
      p_property_id
  limit 1;

  if not found then
    raise exception
      'Property not found.';
  end if;

  select
    w.id,
    w.base_currency
  into v_workspace
  from public.workspaces w
  where
    w.id =
      v_property.workspace_id;

  if not found then
    raise exception
      'Workspace not found.';
  end if;

  /*
   * An invoice belongs only to a real rental,
   * never to an invitation that has not been accepted.
   */
  select
    t.id,
    t.start_date,
    t.end_date
  into v_tenancy
  from public.tenancies t
  where
    t.property_id =
      p_property_id

    and t.status::text
      in (
        'ACTIVE',
        'CHECKOUT_PENDING'
      )

    and t.start_date <=
      v_period_end

    and (
      t.end_date is null
      or t.end_date >=
        v_period
    )

  order by
    t.start_date desc

  limit 1;

  if not found then
    raise exception
      'No active tenancy exists for this billing period.';
  end if;

  select i.id
  into v_existing_id
  from public.invoices i
  where
    i.tenancy_id =
      v_tenancy.id

    and i.billing_period =
      v_period

  limit 1;

  /*
   * Idempotent.
   *
   * Pressing Generate twice must not create
   * a duplicate monthly invoice.
   */
  if v_existing_id is not null then
    return v_existing_id;
  end if;

  /*
   * rent_terms changed during Dometra development.
   *
   * to_jsonb keeps this RPC compatible with:
   *
   * rent_amount / currency_code / payment_due_day
   * and
   * amount / rent_currency / due_day.
   */
  select
    to_jsonb(rt)
  into v_rent
  from public.rent_terms rt
  where
    rt.tenancy_id =
      v_tenancy.id

    and (
      to_jsonb(rt)->>'valid_from'
        is null

      or
      (
        to_jsonb(rt)->>'valid_from'
      )::date <=
        v_period_end
    )

    and (
      to_jsonb(rt)->>'valid_to'
        is null

      or
      (
        to_jsonb(rt)->>'valid_to'
      )::date >=
        v_period
    )

  order by
    coalesce(
      (
        to_jsonb(rt)->>'valid_from'
      )::date,
      v_period
    ) desc

  limit 1;

  if v_rent is null then
    raise exception
      'Rental terms are not configured.';
  end if;

  v_rent_amount :=
    coalesce(
      nullif(
        v_rent->>'rent_amount',
        ''
      )::numeric,

      nullif(
        v_rent->>'amount',
        ''
      )::numeric
    );

  v_rent_currency :=
    coalesce(
      nullif(
        v_rent->>'currency_code',
        ''
      ),

      nullif(
        v_rent->>'rent_currency',
        ''
      )
    )::char(3);

  v_due_day :=
    coalesce(
      nullif(
        v_rent->>'payment_due_day',
        ''
      )::integer,

      nullif(
        v_rent->>'due_day',
        ''
      )::integer,

      1
    );

  if v_rent_amount is null then
    raise exception
      'Rent amount is missing.';
  end if;

  if v_rent_currency is null then
    raise exception
      'Rent currency is missing.';
  end if;

  v_due_day :=
    greatest(
      1,
      least(
        31,
        v_due_day
      )
    );

  v_due_date :=
    least(
      (
        v_period
        +
        (
          v_due_day -
          1
        )
        *
        interval '1 day'
      )::date,

      v_period_end
    );

  select
    us.language_code
  into v_language
  from public.user_settings us
  where
    us.user_id =
      v_user_id;

  v_language :=
    coalesce(
      v_language,
      'en'
    );

  v_invoice_number :=
    'INV-'
    ||
    to_char(
      v_period,
      'YYYYMM'
    )
    ||
    '-'
    ||
    upper(
      substr(
        replace(
          v_tenancy.id::text,
          '-',
          ''
        ),
        1,
        8
      )
    );

  insert into public.invoices (
    workspace_id,
    property_id,
    tenancy_id,
    invoice_number,
    billing_period,
    issue_date,
    due_date,
    status,
    language_code,
    base_currency,
    base_total_amount,
    base_paid_amount,
    base_balance_amount,
    issued_at,
    created_by
  )
  values (
    v_property.workspace_id,
    p_property_id,
    v_tenancy.id,
    v_invoice_number,
    v_period,
    current_date,
    v_due_date,
    'ISSUED',
    v_language,
    v_workspace.base_currency,
    0,
    0,
    0,
    now(),
    v_user_id
  )
  returning id
  into v_invoice_id;

  /*
   * RENT
   */
  v_fx :=
    public.finance_fx_rate(
      v_rent_currency,
      v_workspace.base_currency,
      current_date
    );

  v_base_amount :=
    round(
      v_rent_amount *
      v_fx,
      2
    );

  v_sort :=
    v_sort +
    10;

  insert into public.invoice_lines (
    invoice_id,
    line_type,
    description_key,
    description_snapshot,
    quantity,
    unit,
    unit_price,
    amount,
    currency_code,
    fx_rate_to_base,
    fx_rate_date,
    fx_source,
    base_amount,
    sort_order
  )
  values (
    v_invoice_id,
    'RENT',
    'invoice.rent',
    'Rent',
    1,
    'month',
    v_rent_amount,
    v_rent_amount,
    v_rent_currency,
    v_fx,
    current_date,
    case
      when v_fx = 1
        then 'SAME_CURRENCY'
      else 'FX_RATES'
    end,
    v_base_amount,
    v_sort
  );

  /*
   * FIXED MONTHLY SERVICES
   */
  for v_service in
    select
      ps.id,
      ps.service_code,
      ps.custom_name,
      ps.currency_code,
      ps.unit
    from public.property_services ps
    where
      ps.property_id =
        p_property_id

      and ps.is_active =
        true

      and ps.calculation_method::text =
        'FIXED'

    order by
      ps.sort_order,
      ps.created_at
  loop
    select
      st.price,
      st.currency_code,
      st.unit
    into v_tariff
    from public.service_tariffs st
    where
      st.property_service_id =
        v_service.id

      and st.meter_register_id
        is null

      and st.valid_from <=
        v_period_end

      and (
        st.valid_to is null
        or st.valid_to >=
          v_period
      )

    order by
      st.valid_from desc

    limit 1;

    if v_tariff.price is null then
      continue;
    end if;

    v_line_amount :=
      v_tariff.price;

    v_line_currency :=
      v_tariff.currency_code;

    v_fx :=
      public.finance_fx_rate(
        v_line_currency,
        v_workspace.base_currency,
        current_date
      );

    v_sort :=
      v_sort +
      10;

    insert into public.invoice_lines (
      invoice_id,
      line_type,
      property_service_id,
      description_key,
      description_snapshot,
      quantity,
      unit,
      unit_price,
      amount,
      currency_code,
      fx_rate_to_base,
      fx_rate_date,
      fx_source,
      base_amount,
      sort_order
    )
    values (
      v_invoice_id,
      'FIXED_CHARGE',
      v_service.id,
      'invoice.fixedService',
      coalesce(
        v_service.custom_name,
        v_service.service_code
      ),
      1,
      coalesce(
        v_tariff.unit,
        'month'
      ),
      v_line_amount,
      v_line_amount,
      v_line_currency,
      v_fx,
      current_date,
      case
        when v_fx = 1
          then 'SAME_CURRENCY'
        else 'FX_RATES'
      end,
      round(
        v_line_amount *
        v_fx,
        2
      ),
      v_sort
    );
  end loop;

  /*
   * MANUAL / VARIABLE SERVICES
   *
   * The table already exists in the current
   * service flow. Use dynamic SQL so older
   * databases without the table still work.
   */
  if to_regclass(
    'public.service_period_values'
  ) is not null then

    for v_manual in
      execute
      $query$
        select
          spv.property_service_id,
          spv.amount,
          spv.currency_code,
          ps.service_code,
          ps.custom_name
        from public.service_period_values spv
        join public.property_services ps
          on ps.id =
             spv.property_service_id
        where
          ps.property_id = $1
          and ps.is_active = true
          and ps.calculation_method::text
              in ('MANUAL', 'VARIABLE')
          and spv.billing_period = $2
        order by
          ps.sort_order,
          spv.created_at desc
      $query$
      using
        p_property_id,
        v_period
    loop
      v_line_amount :=
        v_manual.amount;

      v_line_currency :=
        v_manual.currency_code;

      v_fx :=
        public.finance_fx_rate(
          v_line_currency,
          v_workspace.base_currency,
          current_date
        );

      v_sort :=
        v_sort +
        10;

      insert into public.invoice_lines (
        invoice_id,
        line_type,
        property_service_id,
        description_key,
        description_snapshot,
        quantity,
        unit,
        unit_price,
        amount,
        currency_code,
        fx_rate_to_base,
        fx_rate_date,
        fx_source,
        base_amount,
        sort_order
      )
      values (
        v_invoice_id,
        'CUSTOM_CHARGE',
        v_manual.property_service_id,
        'invoice.variableService',
        coalesce(
          v_manual.custom_name,
          v_manual.service_code
        ),
        1,
        'month',
        v_line_amount,
        v_line_amount,
        v_line_currency,
        v_fx,
        current_date,
        case
          when v_fx = 1
            then 'SAME_CURRENCY'
          else 'FX_RATES'
        end,
        round(
          v_line_amount *
          v_fx,
          2
        ),
        v_sort
      );
    end loop;
  end if;

  /*
   * METERED SERVICES
   *
   * Only readings belonging to the same
   * billing period are invoiced.
   */
  for v_reading in
    select
      ps.id as property_service_id,
      ps.service_code,
      ps.custom_name,

      mr.id as meter_register_id,
      mr.code as register_code,
      mr.name as register_name,
      mr.unit,

      mrr.id as meter_register_reading_id,

      coalesce(
        mrr.consumption,

        case
          when
            mrr.current_value is not null
            and mrr.previous_value is not null
          then
            mrr.current_value -
            mrr.previous_value

          else 0
        end
      ) as consumption,

      st.price,
      st.currency_code

    from public.property_services ps

    join public.meters m
      on m.property_service_id =
         ps.id

    join public.meter_registers mr
      on mr.meter_id =
         m.id

    join public.meter_reading_sessions mrs
      on mrs.meter_id =
         m.id

    join public.meter_register_readings mrr
      on mrr.reading_session_id =
         mrs.id

      and mrr.meter_register_id =
          mr.id

    join lateral (
      select
        tariff.price,
        tariff.currency_code
      from public.service_tariffs tariff
      where
        tariff.property_service_id =
          ps.id

        and (
          tariff.meter_register_id =
            mr.id

          or tariff.meter_register_id
            is null
        )

        and tariff.valid_from <=
          v_period_end

        and (
          tariff.valid_to is null
          or tariff.valid_to >=
            v_period
        )

      order by
        case
          when tariff.meter_register_id =
               mr.id
            then 0
          else 1
        end,

        tariff.valid_from desc

      limit 1
    ) st
      on true

    where
      ps.property_id =
        p_property_id

      and ps.is_active =
        true

      and ps.calculation_method::text =
        'METER'

      and m.status::text =
        'ACTIVE'

      and mr.active =
        true

      and mrs.billing_period =
        v_period

      and mrs.status::text
        in (
          'SUBMITTED',
          'CONFIRMED'
        )

    order by
      ps.sort_order,
      mr.sort_order
  loop
    if coalesce(
      v_reading.consumption,
      0
    ) < 0 then
      raise exception
        'Negative consumption detected for meter register %.',
        v_reading.register_code;
    end if;

    v_line_amount :=
      round(
        coalesce(
          v_reading.consumption,
          0
        )
        *
        v_reading.price,
        2
      );

    v_line_currency :=
      v_reading.currency_code;

    v_fx :=
      public.finance_fx_rate(
        v_line_currency,
        v_workspace.base_currency,
        current_date
      );

    v_sort :=
      v_sort +
      10;

    insert into public.invoice_lines (
      invoice_id,
      line_type,
      property_service_id,
      meter_register_reading_id,
      description_key,
      description_snapshot,
      quantity,
      unit,
      unit_price,
      amount,
      currency_code,
      fx_rate_to_base,
      fx_rate_date,
      fx_source,
      base_amount,
      metadata,
      sort_order
    )
    values (
      v_invoice_id,
      'UTILITY',
      v_reading.property_service_id,
      v_reading.meter_register_reading_id,
      'invoice.utility',
      coalesce(
        v_reading.custom_name,
        v_reading.service_code
      )
      ||
      case
        when v_reading.register_code
          is not null
        then
          ' • ' ||
          v_reading.register_code
        else ''
      end,
      v_reading.consumption,
      v_reading.unit,
      v_reading.price,
      v_line_amount,
      v_line_currency,
      v_fx,
      current_date,
      case
        when v_fx = 1
          then 'SAME_CURRENCY'
        else 'FX_RATES'
      end,
      round(
        v_line_amount *
        v_fx,
        2
      ),
      jsonb_build_object(
        'register_code',
        v_reading.register_code,

        'register_name',
        v_reading.register_name
      ),
      v_sort
    );
  end loop;

  perform public.recalculate_invoice_balance(
    v_invoice_id
  );

  /*
   * Any old unallocated payment becomes
   * credit for this invoice automatically.
   */
  perform public.apply_tenancy_advance_to_invoice(
    v_invoice_id
  );

  return v_invoice_id;
end;
$$;


/*
 * ============================================================
 * RECORD PAYMENT
 * ============================================================
 */

create or replace function public.record_property_payment_v1(
  p_property_id uuid,
  p_amount numeric,
  p_currency_code char(3),
  p_method text default 'BANK_TRANSFER',
  p_payment_date date default current_date,
  p_note text default null,
  p_reference text default null,
  p_fx_rate_to_base numeric default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid :=
    auth.uid();

  v_property record;

  v_tenancy record;

  v_base_currency char(3);

  v_fx numeric(18, 8);

  v_base_amount numeric(14, 2);

  v_payment_id uuid;
begin
  if v_user_id is null then
    raise exception
      'Authentication required.';
  end if;

  if p_amount is null
     or p_amount <= 0 then
    raise exception
      'Payment amount must be greater than zero.';
  end if;

  if p_method not in (
    'BANK_TRANSFER',
    'CASH',
    'CARD',
    'OTHER'
  ) then
    raise exception
      'Unsupported payment method.';
  end if;

  if not public.can_manage_property(
    p_property_id
  ) then
    raise exception
      'You cannot manage this property.';
  end if;

  select
    p.workspace_id
  into v_property
  from public.properties p
  where
    p.id =
      p_property_id;

  if not found then
    raise exception
      'Property not found.';
  end if;

  select
    t.id
  into v_tenancy
  from public.tenancies t
  where
    t.property_id =
      p_property_id

    and t.status::text
      in (
        'ACTIVE',
        'CHECKOUT_PENDING'
      )

  order by
    t.start_date desc

  limit 1;

  if not found then
    raise exception
      'There is no active tenancy for this property.';
  end if;

  select
    w.base_currency
  into v_base_currency
  from public.workspaces w
  where
    w.id =
      v_property.workspace_id;

  if p_currency_code =
     v_base_currency then
    v_fx :=
      1;

  elsif p_fx_rate_to_base is not null
        and p_fx_rate_to_base > 0 then
    v_fx :=
      p_fx_rate_to_base;

  else
    v_fx :=
      public.finance_fx_rate(
        p_currency_code,
        v_base_currency,
        p_payment_date
      );
  end if;

  v_base_amount :=
    round(
      p_amount *
      v_fx,
      2
    );

  insert into public.payments (
    workspace_id,
    tenancy_id,
    amount,
    currency_code,
    base_currency,
    fx_rate_to_base,
    fx_rate_date,
    fx_source,
    base_amount,
    payment_date,
    method,
    purpose,
    reference,
    note,
    received_by
  )
  values (
    v_property.workspace_id,
    v_tenancy.id,
    p_amount,
    p_currency_code,
    v_base_currency,
    v_fx,
    p_payment_date,

    case
      when p_currency_code =
           v_base_currency
        then 'SAME_CURRENCY'

      when p_fx_rate_to_base
           is not null
        then 'MANUAL'

      else 'FX_RATES'
    end,

    v_base_amount,
    p_payment_date,
    p_method::public.payment_method,
    'AUTO',
    nullif(
      trim(
        p_reference
      ),
      ''
    ),
    nullif(
      trim(
        p_note
      ),
      ''
    ),
    v_user_id
  )
  returning id
  into v_payment_id;

  /*
   * Oldest debt first.
   *
   * Any remaining amount is intentionally
   * left unallocated => tenant advance.
   */
  perform public.allocate_payment_automatically(
    v_payment_id
  );

  return v_payment_id;
end;
$$;


/*
 * ============================================================
 * PAYMENT CREDIT VIEW
 * ============================================================
 */

create or replace view public.v_payment_credit
with (
  security_invoker = true
)
as
select
  p.id as payment_id,

  p.workspace_id,

  p.tenancy_id,

  p.payment_date,

  p.currency_code,

  p.amount,

  p.base_currency,

  p.base_amount,

  coalesce(
    sum(
      pa.base_amount
    ),
    0
  )::numeric(14, 2)
    as allocated_base_amount,

  greatest(
    p.base_amount -
    coalesce(
      sum(
        pa.base_amount
      ),
      0
    ),
    0
  )::numeric(14, 2)
    as unallocated_advance_base_amount

from public.payments p

left join public.payment_allocations pa
  on pa.payment_id =
     p.id

group by
  p.id;


/*
 * ============================================================
 * WORKSPACE KPI VIEW
 * ============================================================
 */

create or replace view public.v_workspace_monthly_kpis
with (
  security_invoker = true
)
as
with invoice_month as (
  select
    workspace_id,

    billing_period,

    max(
      base_currency
    ) as base_currency,

    sum(
      base_total_amount
    )::numeric(14, 2)
      as expected_base,

    sum(
      base_paid_amount
    )::numeric(14, 2)
      as allocated_received_base,

    sum(
      greatest(
        base_balance_amount,
        0
      )
    )::numeric(14, 2)
      as outstanding_base

  from public.invoices

  where
    status::text <>
      'VOID'

  group by
    workspace_id,
    billing_period
),

payments_month as (
  select
    workspace_id,

    date_trunc(
      'month',
      payment_date
    )::date
      as billing_period,

    sum(
      base_amount
    )::numeric(14, 2)
      as cash_received_base

  from public.payments

  group by
    workspace_id,
    date_trunc(
      'month',
      payment_date
    )::date
),

advance as (
  select
    workspace_id,

    sum(
      unallocated_advance_base_amount
    )::numeric(14, 2)
      as advance_base

  from public.v_payment_credit

  group by
    workspace_id
)

select
  i.workspace_id,

  i.billing_period,

  i.base_currency,

  i.expected_base,

  coalesce(
    p.cash_received_base,
    0
  )::numeric(14, 2)
    as received_base,

  i.outstanding_base,

  coalesce(
    a.advance_base,
    0
  )::numeric(14, 2)
    as advance_base,

  case
    when i.expected_base > 0
      then round(
        (
          coalesce(
            p.cash_received_base,
            0
          )
          /
          i.expected_base
        )
        *
        100,
        2
      )

    else 0
  end
    as collection_rate_percent

from invoice_month i

left join payments_month p
  using (
    workspace_id,
    billing_period
  )

left join advance a
  using (
    workspace_id
  );


grant execute
on function public.generate_monthly_invoice_v1(
  uuid,
  date
)
to authenticated;

grant execute
on function public.record_property_payment_v1(
  uuid,
  numeric,
  char,
  text,
  date,
  text,
  text,
  numeric
)
to authenticated;

grant execute
on function public.finance_fx_rate(
  char,
  char,
  date
)
to authenticated;

commit;