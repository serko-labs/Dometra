-- ============================================================
-- DOMETRA
-- MONTHLY BILLING / VARIABLE EXPENSES / TENANT PAYMENT REPORTING
-- ============================================================
--
-- Goals:
--   * Landlord OR linked tenant may enter a monthly variable expense.
--   * A variable expense may have an optional photo/proof.
--   * Tenant sees rent + metered + fixed + variable charges separately.
--   * Totals are grouped by currency; currencies are never mixed.
--   * Tenant can mark the complete monthly bill as paid.
--   * When Paid is pressed, one invoice/payment is generated per currency.
--   * Optional payment proof may be attached after payment is reported.
--   * The app can then notify the landlord through the dedicated Edge Function.
--
-- Billing periods are always stored as the first day of a month.
-- Example: 2026-10-01.
-- ============================================================


-- ============================================================
-- VARIABLE / VOLATILE MONTHLY EXPENSES
-- ============================================================

create table if not exists public.monthly_variable_expenses (
  id uuid primary key default gen_random_uuid(),

  tenancy_id uuid not null
    references public.tenancies(id)
    on delete cascade,

  property_service_id uuid not null
    references public.property_services(id)
    on delete cascade,

  billing_period date not null,

  amount numeric(14,2) not null
    check (amount >= 0),

  currency_code char(3) not null,

  photo_path text,
  note text,

  submitted_by uuid not null
    references auth.users(id),

  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (
    tenancy_id,
    property_service_id,
    billing_period
  ),

  check (
    billing_period = date_trunc('month', billing_period)::date
  )
);

create index if not exists idx_monthly_variable_expenses_tenancy_period
on public.monthly_variable_expenses (
  tenancy_id,
  billing_period
);

create index if not exists idx_monthly_variable_expenses_service_period
on public.monthly_variable_expenses (
  property_service_id,
  billing_period
);


-- ============================================================
-- TENANT PAYMENT CLAIMS
-- ============================================================

create table if not exists public.tenant_payment_claims (
  id uuid primary key default gen_random_uuid(),

  tenancy_id uuid not null
    references public.tenancies(id)
    on delete cascade,

  billing_period date not null,

  status text not null default 'REPORTED'
    check (
      status in (
        'REPORTED',
        'CANCELLED'
      )
    ),

  invoice_ids uuid[] not null default '{}',
  payment_ids uuid[] not null default '{}',

  proof_path text,
  note text,

  reported_by uuid not null
    references auth.users(id),

  reported_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (
    tenancy_id,
    billing_period
  ),

  check (
    billing_period = date_trunc('month', billing_period)::date
  )
);

create index if not exists idx_tenant_payment_claims_tenancy_period
on public.tenant_payment_claims (
  tenancy_id,
  billing_period
);


-- ============================================================
-- UPDATED_AT TRIGGERS
-- ============================================================

drop trigger if exists trg_monthly_variable_expenses_updated_at
on public.monthly_variable_expenses;

create trigger trg_monthly_variable_expenses_updated_at
before update on public.monthly_variable_expenses
for each row
execute function public.set_updated_at();


drop trigger if exists trg_tenant_payment_claims_updated_at
on public.tenant_payment_claims;

create trigger trg_tenant_payment_claims_updated_at
before update on public.tenant_payment_claims
for each row
execute function public.set_updated_at();


-- ============================================================
-- RLS
-- ============================================================

alter table public.monthly_variable_expenses
  enable row level security;

alter table public.tenant_payment_claims
  enable row level security;


drop policy if exists monthly_variable_expenses_read
on public.monthly_variable_expenses;

create policy monthly_variable_expenses_read
on public.monthly_variable_expenses
for select
to authenticated
using (
  public.can_access_tenancy(tenancy_id)
);


drop policy if exists monthly_variable_expenses_landlord_delete
on public.monthly_variable_expenses;

create policy monthly_variable_expenses_landlord_delete
on public.monthly_variable_expenses
for delete
to authenticated
using (
  public.can_manage_tenancy(tenancy_id)
);


drop policy if exists tenant_payment_claims_read
on public.tenant_payment_claims;

create policy tenant_payment_claims_read
on public.tenant_payment_claims
for select
to authenticated
using (
  public.can_access_tenancy(tenancy_id)
);


-- ============================================================
-- PRIVATE STORAGE FOR EXPENSE / PAYMENT PROOFS
-- ============================================================
--
-- Path convention:
--   <tenancy-id>/variable/<file>
--   <tenancy-id>/payment/<file>
-- ============================================================

insert into storage.buckets (
  id,
  name,
  public
)
values (
  'billing-proofs',
  'billing-proofs',
  false
)
on conflict (id)
do update
set public = false;


drop policy if exists billing_proofs_read
on storage.objects;

create policy billing_proofs_read
on storage.objects
for select
to authenticated
using (
  bucket_id = 'billing-proofs'
  and name ~ '^[0-9a-fA-F-]{36}/'
  and public.can_access_tenancy(
    split_part(name, '/', 1)::uuid
  )
);


drop policy if exists billing_proofs_insert
on storage.objects;

create policy billing_proofs_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'billing-proofs'
  and name ~ '^[0-9a-fA-F-]{36}/'
  and public.can_access_tenancy(
    split_part(name, '/', 1)::uuid
  )
);


drop policy if exists billing_proofs_update
on storage.objects;

create policy billing_proofs_update
on storage.objects
for update
to authenticated
using (
  bucket_id = 'billing-proofs'
  and name ~ '^[0-9a-fA-F-]{36}/'
  and public.can_access_tenancy(
    split_part(name, '/', 1)::uuid
  )
)
with check (
  bucket_id = 'billing-proofs'
  and name ~ '^[0-9a-fA-F-]{36}/'
  and public.can_access_tenancy(
    split_part(name, '/', 1)::uuid
  )
);


drop policy if exists billing_proofs_delete
on storage.objects;

create policy billing_proofs_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'billing-proofs'
  and name ~ '^[0-9a-fA-F-]{36}/'
  and public.can_access_tenancy(
    split_part(name, '/', 1)::uuid
  )
);


-- ============================================================
-- EXISTING INVOICE UNIQUENESS
-- ============================================================
--
-- Dometra supports:
--
--   Rent       = USD
--   Utilities  = UAH
--
-- Therefore one billing month may produce multiple invoices,
-- one invoice per currency.
-- ============================================================

do $$
declare
  v_constraint record;
begin

  if to_regclass('public.invoices') is null then
    raise exception
      'public.invoices does not exist. Apply the finance schema before this migration.';
  end if;

  for v_constraint in
    select c.conname
    from pg_constraint c
    where c.conrelid = 'public.invoices'::regclass
      and c.contype = 'u'
      and pg_get_constraintdef(c.oid)
        ilike 'UNIQUE (tenancy_id, billing_period)%'
  loop

    execute format(
      'alter table public.invoices drop constraint %I',
      v_constraint.conname
    );

  end loop;

end $$;


-- Also remove a legacy standalone unique index if an older
-- schema created the same restriction as an index.

do $$
declare
  v_index record;
begin

  for v_index in
    select indexname
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'invoices'
      and indexdef ilike
        'CREATE UNIQUE INDEX%ON public.invoices USING btree (tenancy_id, billing_period)%'
  loop

    if v_index.indexname <>
      'uq_invoices_tenancy_period_currency'
    then

      execute format(
        'drop index if exists public.%I',
        v_index.indexname
      );

    end if;

  end loop;

end $$;


create unique index if not exists uq_invoices_tenancy_period_currency
on public.invoices (
  tenancy_id,
  billing_period,
  base_currency
);


-- ============================================================
-- MONTHLY BILL PREVIEW
-- ============================================================

create or replace function public.get_tenancy_billing_preview(
  p_tenancy_id uuid,
  p_billing_period date
)
returns table (
  line_key text,
  line_kind text,
  property_service_id uuid,
  meter_id uuid,
  meter_register_reading_id uuid,
  description text,
  quantity numeric,
  unit text,
  unit_price numeric,
  amount numeric,
  currency_code text,
  is_ready boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_period date;
  v_period_end date;
  v_property_id uuid;
begin

  if auth.uid() is null then
    raise exception
      'Authentication is required.';
  end if;

  v_period :=
    date_trunc(
      'month',
      p_billing_period
    )::date;

  v_period_end :=
    (
      v_period +
      interval '1 month - 1 day'
    )::date;


  select
    t.property_id
  into
    v_property_id
  from public.tenancies t
  where
    t.id =
      p_tenancy_id;


  if v_property_id is null then
    raise exception
      'Tenancy not found.';
  end if;


  if not public.can_access_tenancy(
    p_tenancy_id
  ) then
    raise exception
      'You cannot access this tenancy.';
  end if;


  return query

  -- ==========================================================
  -- RENT
  -- ==========================================================

  select
    'rent'::text,
    'RENT'::text,

    null::uuid,
    null::uuid,
    null::uuid,

    'Rent'::text,

    1::numeric,
    'month'::text,

    rt.rent_amount::numeric,
    rt.rent_amount::numeric,

    rt.currency_code::text,

    (
      rt.tenancy_id is not null
    )::boolean

  from (
    select
      t.id as tenancy_id

    from public.tenancies t

    where
      t.id =
        p_tenancy_id
  ) base

  left join lateral (
    select
      r.tenancy_id,
      r.rent_amount,
      r.currency_code,
      r.payment_due_day

    from public.rent_terms r

    where
      r.tenancy_id =
        p_tenancy_id

      and r.valid_from <=
        v_period_end

      and (
        r.valid_to is null
        or r.valid_to >=
          v_period
      )

    order by
      r.valid_from desc

    limit 1

  ) rt
    on true


  union all


  -- ==========================================================
  -- FIXED SERVICES
  -- ==========================================================

  select
    'fixed:' ||
      ps.id::text,

    'FIXED'::text,

    ps.id,

    null::uuid,
    null::uuid,

    coalesce(
      nullif(
        ps.custom_name,
        ''
      ),
      ps.service_code
    )::text,

    1::numeric,

    coalesce(
      nullif(
        ps.unit,
        ''
      ),
      'month'
    )::text,

    tariff.price::numeric,
    tariff.price::numeric,

    coalesce(
      tariff.currency_code,
      ps.currency_code
    )::text,

    (
      tariff.price
      is not null
    )::boolean

  from public.property_services ps

  left join lateral (
    select
      st.price,
      st.currency_code

    from public.service_tariffs st

    where
      st.property_service_id =
        ps.id

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

    limit 1

  ) tariff
    on true

  where
    ps.property_id =
      v_property_id

    and ps.is_active =
      true

    and ps.calculation_method =
      'FIXED'


  union all


  -- ==========================================================
  -- VARIABLE / MANUAL SERVICES
  -- ==========================================================

  select
    'variable:' ||
      ps.id::text,

    'VARIABLE'::text,

    ps.id,

    null::uuid,
    null::uuid,

    coalesce(
      nullif(
        ps.custom_name,
        ''
      ),
      ps.service_code
    )::text,

    1::numeric,

    coalesce(
      nullif(
        ps.unit,
        ''
      ),
      'month'
    )::text,

    coalesce(
      expense.amount,
      legacy.amount
    )::numeric,

    coalesce(
      expense.amount,
      legacy.amount
    )::numeric,

    coalesce(
      expense.currency_code,
      legacy.currency_code,
      ps.currency_code
    )::text,

    (
      expense.id is not null
      or legacy.property_service_id
        is not null
    )::boolean

  from public.property_services ps

  left join public.monthly_variable_expenses expense
    on expense.tenancy_id =
      p_tenancy_id

    and expense.property_service_id =
      ps.id

    and expense.billing_period =
      v_period


  -- Compatibility with the previous landlord-only
  -- variable-value flow.

  left join lateral (
    select
      legacy_value.property_service_id,
      legacy_value.amount,
      legacy_value.currency_code

    from public.v_latest_service_period_values legacy_value

    where
      legacy_value.property_service_id =
        ps.id

      and legacy_value.billing_period =
        v_period

    limit 1

  ) legacy
    on expense.id is null


  where
    ps.property_id =
      v_property_id

    and ps.is_active =
      true

    and ps.calculation_method =
      'MANUAL'


  union all


  -- ==========================================================
  -- METERED SERVICES
  -- ==========================================================

  select
    'meter:' ||
      mr.id::text,

    'METERED'::text,

    ps.id,

    m.id,

    rr.id,

    (
      coalesce(
        nullif(
          ps.custom_name,
          ''
        ),
        ps.service_code
      )

      ||

      case

        when
          register_count.total >
          1

        then
          ' · ' ||
          mr.code

        else
          ''

      end
    )::text,

    case

      when
        rr.current_value
          is not null

        and rr.previous_value
          is not null

      then
        greatest(
          rr.current_value -
          rr.previous_value,
          0
        )::numeric

      else
        null::numeric

    end,

    mr.unit::text,

    tariff.price::numeric,

    case

      when
        rr.current_value
          is not null

        and rr.previous_value
          is not null

        and tariff.price
          is not null

      then
        round(
          greatest(
            rr.current_value -
            rr.previous_value,
            0
          )
          *
          tariff.price,
          2
        )::numeric

      else
        null::numeric

    end,

    coalesce(
      tariff.currency_code,
      ps.currency_code
    )::text,

    (
      rr.id
        is not null

      and rr.current_value
        is not null

      and rr.previous_value
        is not null

      and tariff.price
        is not null
    )::boolean


  from public.property_services ps

  join public.meters m
    on m.property_service_id =
      ps.id

    and m.property_id =
      v_property_id

    and m.status =
      'ACTIVE'


  join public.meter_registers mr
    on mr.meter_id =
      m.id

    and mr.active =
      true


  left join public.meter_reading_sessions rs
    on rs.meter_id =
      m.id

    and rs.billing_period =
      v_period


  left join public.meter_register_readings rr
    on rr.reading_session_id =
      rs.id

    and rr.meter_register_id =
      mr.id


  left join lateral (
    select
      count(*)::integer
        as total

    from public.meter_registers mr_count

    where
      mr_count.meter_id =
        m.id

      and mr_count.active =
        true

  ) register_count
    on true


  left join lateral (
    select
      st.price,
      st.currency_code

    from public.service_tariffs st

    where
      st.property_service_id =
        ps.id

      and (
        st.meter_register_id =
          mr.id

        or st.meter_register_id
          is null
      )

      and st.valid_from <=
        v_period_end

      and (
        st.valid_to is null
        or st.valid_to >=
          v_period
      )

    order by

      case
        when
          st.meter_register_id =
          mr.id

        then
          0

        else
          1
      end,

      st.valid_from desc

    limit 1

  ) tariff
    on true


  where
    ps.property_id =
      v_property_id

    and ps.is_active =
      true

    and ps.calculation_method =
      'METER';

end;
$$;


-- ============================================================
-- SAVE / UPDATE VARIABLE EXPENSE
-- ============================================================

create or replace function public.save_monthly_variable_expense(
  p_tenancy_id uuid,
  p_property_service_id uuid,
  p_billing_period date,
  p_amount numeric,
  p_photo_path text default null,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_period date;
  v_property_id uuid;
  v_service_currency char(3);
  v_allowed boolean;
  v_id uuid;
begin

  if auth.uid() is null then
    raise exception
      'Authentication is required.';
  end if;


  if
    p_amount is null
    or p_amount < 0
  then
    raise exception
      'Expense amount must be zero or greater.';
  end if;


  v_period :=
    date_trunc(
      'month',
      p_billing_period
    )::date;


  select
    t.property_id

  into
    v_property_id

  from public.tenancies t

  where
    t.id =
      p_tenancy_id

    and t.status =
      'ACTIVE';


  if v_property_id is null then
    raise exception
      'Active tenancy not found.';
  end if;


  select
    exists (
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

    or

    public.can_manage_tenancy(
      p_tenancy_id
    )

  into
    v_allowed;


  if not v_allowed then
    raise exception
      'You cannot add expenses for this tenancy.';
  end if;


  select
    ps.currency_code

  into
    v_service_currency

  from public.property_services ps

  where
    ps.id =
      p_property_service_id

    and ps.property_id =
      v_property_id

    and ps.is_active =
      true

    and ps.calculation_method =
      'MANUAL';


  if v_service_currency is null then
    raise exception
      'Variable service not found.';
  end if;


  insert into public.monthly_variable_expenses (
    tenancy_id,
    property_service_id,
    billing_period,
    amount,
    currency_code,
    photo_path,
    note,
    submitted_by,
    submitted_at
  )
  values (
    p_tenancy_id,
    p_property_service_id,
    v_period,
    p_amount,
    v_service_currency,

    nullif(
      trim(
        p_photo_path
      ),
      ''
    ),

    nullif(
      trim(
        p_note
      ),
      ''
    ),

    auth.uid(),
    now()
  )

  on conflict (
    tenancy_id,
    property_service_id,
    billing_period
  )

  do update

  set
    amount =
      excluded.amount,

    currency_code =
      excluded.currency_code,

    photo_path =
      excluded.photo_path,

    note =
      excluded.note,

    submitted_by =
      auth.uid(),

    submitted_at =
      now(),

    updated_at =
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
-- REPORT MONTH AS PAID
-- ============================================================

create or replace function public.report_tenant_payment(
  p_tenancy_id uuid,
  p_billing_period date,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_period date;

  v_property_id uuid;
  v_workspace_id uuid;

  v_due_day integer;
  v_due_date date;

  v_is_tenant boolean;

  v_claim
    public.tenant_payment_claims%rowtype;

  v_currency text;
  v_total numeric(14,2);

  v_invoice_id uuid;
  v_payment_id uuid;
  v_invoice_number text;

  v_invoice_ids uuid[] :=
    '{}';

  v_payment_ids uuid[] :=
    '{}';

  v_result_invoices jsonb :=
    '[]'::jsonb;

begin

  if auth.uid() is null then
    raise exception
      'Authentication is required.';
  end if;


  v_period :=
    date_trunc(
      'month',
      p_billing_period
    )::date;


  select
    t.property_id,
    p.workspace_id

  into
    v_property_id,
    v_workspace_id

  from public.tenancies t

  join public.properties p
    on p.id =
      t.property_id

  where
    t.id =
      p_tenancy_id

    and t.status =
      'ACTIVE';


  if v_property_id is null then
    raise exception
      'Active tenancy not found.';
  end if;


  select
    exists (
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
    v_is_tenant;


  if not v_is_tenant then
    raise exception
      'Only the linked tenant can report this bill as paid.';
  end if;


  select
    *

  into
    v_claim

  from public.tenant_payment_claims c

  where
    c.tenancy_id =
      p_tenancy_id

    and c.billing_period =
      v_period

    and c.status =
      'REPORTED';


  if found then

    select
      coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id',
            i.id,

            'number',
            i.invoice_number,

            'currency',
            i.base_currency,

            'total',
            i.base_total_amount
          )

          order by
            i.base_currency
        ),

        '[]'::jsonb
      )

    into
      v_result_invoices

    from public.invoices i

    where
      i.id =
      any(
        v_claim.invoice_ids
      );


    return
      jsonb_build_object(
        'claimId',
        v_claim.id,

        'alreadyReported',
        true,

        'invoices',
        v_result_invoices
      );

  end if;


  if exists (
    select
      1

    from public.get_tenancy_billing_preview(
      p_tenancy_id,
      v_period
    ) preview

    where
      preview.is_ready =
        false
  )
  then
    raise exception
      'Complete all required readings and variable expenses before marking the bill as paid.';
  end if;


  if not exists (
    select
      1

    from public.get_tenancy_billing_preview(
      p_tenancy_id,
      v_period
    ) preview

    where
      preview.is_ready =
        true

      and preview.amount
        is not null
  )
  then
    raise exception
      'There are no billable items for this period.';
  end if;


  select
    coalesce(
      rt.payment_due_day,
      5
    )

  into
    v_due_day

  from public.rent_terms rt

  where
    rt.tenancy_id =
      p_tenancy_id

    and rt.valid_from <=
      (
        v_period +
        interval '1 month - 1 day'
      )::date

    and (
      rt.valid_to is null
      or rt.valid_to >=
        v_period
    )

  order by
    rt.valid_from desc

  limit 1;


  v_due_day :=
    coalesce(
      v_due_day,
      5
    );


  v_due_date :=
    make_date(
      extract(
        year
        from v_period
      )::integer,

      extract(
        month
        from v_period
      )::integer,

      least(
        v_due_day,

        extract(
          day
          from (
            v_period +
            interval '1 month - 1 day'
          )::date
        )::integer
      )
    );


  for v_currency in

    select distinct
      preview.currency_code

    from public.get_tenancy_billing_preview(
      p_tenancy_id,
      v_period
    ) preview

    where
      preview.is_ready =
        true

      and preview.amount
        is not null

      and preview.currency_code
        is not null

    order by
      preview.currency_code

  loop

    select
      round(
        sum(
          preview.amount
        ),
        2
      )

    into
      v_total

    from public.get_tenancy_billing_preview(
      p_tenancy_id,
      v_period
    ) preview

    where
      preview.is_ready =
        true

      and preview.amount
        is not null

      and preview.currency_code =
        v_currency;


    v_total :=
      coalesce(
        v_total,
        0
      );


    select
      i.id,
      i.invoice_number

    into
      v_invoice_id,
      v_invoice_number

    from public.invoices i

    where
      i.tenancy_id =
        p_tenancy_id

      and i.billing_period =
        v_period

      and i.base_currency =
        v_currency

    order by
      i.created_at desc

    limit 1;


    if v_invoice_id is null then

      v_invoice_number :=
        'DOM-' ||
        to_char(
          v_period,
          'YYYYMM'
        ) ||
        '-' ||
        upper(
          v_currency
        ) ||
        '-' ||
        upper(
          substr(
            replace(
              gen_random_uuid()::text,
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
        base_currency,
        base_total_amount,
        base_paid_amount,
        base_balance_amount,
        notes,
        issued_at,
        paid_at,
        created_by
      )
      values (
        v_workspace_id,
        v_property_id,
        p_tenancy_id,
        v_invoice_number,
        v_period,
        current_date,
        v_due_date,
        'PAID',
        v_currency,
        v_total,
        v_total,
        0,

        'Generated when tenant reported the monthly bill as paid in Dometra.',

        now(),
        now(),
        auth.uid()
      )

      returning
        id

      into
        v_invoice_id;

    else

      delete
      from public.invoice_lines
      where
        invoice_id =
          v_invoice_id;


      update public.invoices

      set
        issue_date =
          current_date,

        due_date =
          v_due_date,

        status =
          'PAID',

        base_total_amount =
          v_total,

        base_paid_amount =
          v_total,

        base_balance_amount =
          0,

        notes =
          'Generated when tenant reported the monthly bill as paid in Dometra.',

        issued_at =
          coalesce(
            issued_at,
            now()
          ),

        paid_at =
          now(),

        updated_at =
          now()

      where
        id =
          v_invoice_id;

    end if;


    insert into public.invoice_lines (
      invoice_id,
      line_type,
      property_service_id,
      meter_register_reading_id,
      description_snapshot,
      quantity,
      unit,
      unit_price,
      amount,
      currency_code,
      fx_rate_to_base,
      base_amount,
      metadata,
      sort_order
    )

    select
      v_invoice_id,

      case
        preview.line_kind

        when 'RENT'
          then
            'RENT'::invoice_line_type

        when 'METERED'
          then
            'UTILITY'::invoice_line_type

        when 'FIXED'
          then
            'FIXED_CHARGE'::invoice_line_type

        when 'VARIABLE'
          then
            'CUSTOM_CHARGE'::invoice_line_type

        else
          'OTHER'::invoice_line_type

      end,

      preview.property_service_id,
      preview.meter_register_reading_id,
      preview.description,

      coalesce(
        preview.quantity,
        1
      ),

      preview.unit,
      preview.unit_price,
      preview.amount,
      preview.currency_code,

      1,

      preview.amount,

      jsonb_build_object(
        'source',
        'TENANT_REPORTED_PAYMENT',

        'billing_line_kind',
        preview.line_kind
      ),

      row_number()
      over (
        order by

          case
            preview.line_kind

            when 'RENT'
              then 0

            when 'METERED'
              then 1

            when 'FIXED'
              then 2

            when 'VARIABLE'
              then 3

            else 4

          end,

          preview.description
      )::integer

    from public.get_tenancy_billing_preview(
      p_tenancy_id,
      v_period
    ) preview

    where
      preview.is_ready =
        true

      and preview.amount
        is not null

      and preview.currency_code =
        v_currency;


    insert into public.payments (
      workspace_id,
      tenancy_id,
      amount,
      currency_code,
      base_currency,
      fx_rate_to_base,
      base_amount,
      payment_date,
      method,
      purpose,
      reference,
      note,
      received_by
    )
    values (
      v_workspace_id,
      p_tenancy_id,
      v_total,
      v_currency,
      v_currency,
      1,
      v_total,
      current_date,
      'OTHER',
      'INVOICE',
      'TENANT_REPORTED',

      nullif(
        trim(
          p_note
        ),
        ''
      ),

      null
    )

    returning
      id

    into
      v_payment_id;


    insert into public.payment_allocations (
      payment_id,
      invoice_id,
      reserved_billing_period,
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
      v_payment_id,
      v_invoice_id,
      null,
      v_total,
      v_currency,
      v_total,
      v_currency,
      1,
      v_total,
      'AUTO',
      auth.uid()
    );


    v_invoice_ids :=
      array_append(
        v_invoice_ids,
        v_invoice_id
      );


    v_payment_ids :=
      array_append(
        v_payment_ids,
        v_payment_id
      );

  end loop;


  insert into public.tenant_payment_claims (
    tenancy_id,
    billing_period,
    status,
    invoice_ids,
    payment_ids,
    note,
    reported_by,
    reported_at
  )
  values (
    p_tenancy_id,
    v_period,
    'REPORTED',
    v_invoice_ids,
    v_payment_ids,

    nullif(
      trim(
        p_note
      ),
      ''
    ),

    auth.uid(),
    now()
  )

  returning
    *

  into
    v_claim;


  select
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id',
          i.id,

          'number',
          i.invoice_number,

          'currency',
          i.base_currency,

          'total',
          i.base_total_amount
        )

        order by
          i.base_currency
      ),

      '[]'::jsonb
    )

  into
    v_result_invoices

  from public.invoices i

  where
    i.id =
    any(
      v_claim.invoice_ids
    );


  return
    jsonb_build_object(
      'claimId',
      v_claim.id,

      'alreadyReported',
      false,

      'invoices',
      v_result_invoices
    );

end;
$$;


-- ============================================================
-- ATTACH / REMOVE PAYMENT PROOF
-- ============================================================

create or replace function public.set_tenant_payment_proof(
  p_claim_id uuid,
  p_proof_path text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_claim
    public.tenant_payment_claims%rowtype;
begin

  if auth.uid() is null then
    raise exception
      'Authentication is required.';
  end if;


  select
    *

  into
    v_claim

  from public.tenant_payment_claims c

  where
    c.id =
      p_claim_id

    and c.status =
      'REPORTED';


  if not found then
    raise exception
      'Payment report not found.';
  end if;


  if not public.can_access_tenancy(
    v_claim.tenancy_id
  ) then
    raise exception
      'You cannot access this payment report.';
  end if;


  if
    v_claim.reported_by <>
      auth.uid()

    and not public.can_manage_tenancy(
      v_claim.tenancy_id
    )
  then
    raise exception
      'You cannot modify this payment proof.';
  end if;


  update public.tenant_payment_claims

  set
    proof_path =
      nullif(
        trim(
          p_proof_path
        ),
        ''
      ),

    updated_at =
      now()

  where
    id =
      p_claim_id;

end;
$$;


-- ============================================================
-- GRANTS
-- ============================================================

grant execute
on function public.get_tenancy_billing_preview(
  uuid,
  date
)
to authenticated;


grant execute
on function public.save_monthly_variable_expense(
  uuid,
  uuid,
  date,
  numeric,
  text,
  text
)
to authenticated;


grant execute
on function public.report_tenant_payment(
  uuid,
  date,
  text
)
to authenticated;


grant execute
on function public.set_tenant_payment_proof(
  uuid,
  text
)
to authenticated;