-- ============================================================
-- DOMETRA
-- FIX TENANT PAYMENT REPORTING
-- ============================================================
--
-- This migration fixes the tenant "Paid" flow.
--
-- Important design rule:
--   A tenant pressing Paid is a tenant-reported payment claim.
--   It generates/updates invoices and marks those invoices paid for
--   the tenant-facing flow, but it does NOT create accounting payment
--   allocations yet. A landlord-confirmation lifecycle can add the
--   final accounting payment record later.
--
-- This keeps the tenant action independent from stricter payment /
-- allocation constraints and prevents one failed accounting insert
-- from breaking the whole user action.
-- ============================================================


-- ============================================================
-- ALLOW ONE INVOICE PER TENANCY / MONTH / CURRENCY
-- ============================================================

do $$
declare
  v_constraint record;
begin
  if to_regclass('public.invoices') is null then
    raise exception
      'public.invoices does not exist. Apply the finance schema first.';
  end if;

  for v_constraint in
    select
      c.conname
    from pg_constraint c
    where
      c.conrelid = 'public.invoices'::regclass
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


do $$
declare
  v_index record;
begin
  for v_index in
    select
      indexname
    from pg_indexes
    where
      schemaname = 'public'
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
-- REPLACE TENANT PAYMENT REPORT RPC
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
  v_invoice_number text;

  v_invoice_ids uuid[] :=
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
    on p.id = t.property_id
  where
    t.id = p_tenancy_id
    and t.status = 'ACTIVE';


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
        tm.tenancy_id = p_tenancy_id
        and tm.user_id = auth.uid()
        and tm.role in (
          'PRIMARY_TENANT',
          'TENANT'
        )
    )
  into
    v_is_tenant;


  if not v_is_tenant then
    raise exception
      'Only the linked tenant can mark this bill as paid.';
  end if;


  -- ----------------------------------------------------------
  -- IDEMPOTENT RETRY
  -- ----------------------------------------------------------

  select
    *
  into
    v_claim
  from public.tenant_payment_claims c
  where
    c.tenancy_id = p_tenancy_id
    and c.billing_period = v_period
    and c.status = 'REPORTED';


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
      i.id = any(
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


  -- ----------------------------------------------------------
  -- BILL MUST BE COMPLETE
  -- ----------------------------------------------------------

  if exists (
    select
      1
    from public.get_tenancy_billing_preview(
      p_tenancy_id,
      v_period
    ) preview
    where
      preview.is_ready = false
  )
  then
    raise exception
      'Complete all required readings, tariffs and variable expenses before marking the bill as paid.';
  end if;


  if not exists (
    select
      1
    from public.get_tenancy_billing_preview(
      p_tenancy_id,
      v_period
    ) preview
    where
      preview.is_ready = true
      and preview.amount is not null
      and preview.amount > 0
  )
  then
    raise exception
      'There are no positive billable items for this period.';
  end if;


  -- ----------------------------------------------------------
  -- PAYMENT DUE DATE
  -- ----------------------------------------------------------

  select
    coalesce(
      rt.payment_due_day,
      5
    )
  into
    v_due_day
  from public.rent_terms rt
  where
    rt.tenancy_id = p_tenancy_id
    and rt.valid_from <=
      (
        v_period +
        interval '1 month - 1 day'
      )::date
    and (
      rt.valid_to is null
      or rt.valid_to >= v_period
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


  -- ----------------------------------------------------------
  -- ONE INVOICE PER CURRENCY
  -- ----------------------------------------------------------

  for v_currency in
    select
      preview.currency_code
    from public.get_tenancy_billing_preview(
      p_tenancy_id,
      v_period
    ) preview
    where
      preview.is_ready = true
      and preview.amount is not null
      and preview.currency_code is not null
    group by
      preview.currency_code
    having
      sum(
        preview.amount
      ) > 0
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
      preview.is_ready = true
      and preview.amount is not null
      and preview.currency_code = v_currency;


    v_total :=
      coalesce(
        v_total,
        0
      );


    if v_total <= 0 then
      continue;
    end if;


    v_invoice_id :=
      null;

    v_invoice_number :=
      null;


    select
      i.id,
      i.invoice_number
    into
      v_invoice_id,
      v_invoice_number
    from public.invoices i
    where
      i.tenancy_id = p_tenancy_id
      and i.billing_period = v_period
      and i.base_currency = v_currency
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
        'Tenant reported this monthly bill as paid in Dometra.',
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
        invoice_id = v_invoice_id;


      update public.invoices
      set
        issue_date = current_date,
        due_date = v_due_date,
        status = 'PAID',
        base_total_amount = v_total,
        base_paid_amount = v_total,
        base_balance_amount = 0,
        notes = 'Tenant reported this monthly bill as paid in Dometra.',
        issued_at = coalesce(
          issued_at,
          now()
        ),
        paid_at = now(),
        updated_at = now()
      where
        id = v_invoice_id;
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
          then 'RENT'::invoice_line_type

        when 'METERED'
          then 'UTILITY'::invoice_line_type

        when 'FIXED'
          then 'FIXED_CHARGE'::invoice_line_type

        when 'VARIABLE'
          then 'CUSTOM_CHARGE'::invoice_line_type

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

            else
              4
          end,

          preview.description
      )::integer

    from public.get_tenancy_billing_preview(
      p_tenancy_id,
      v_period
    ) preview
    where
      preview.is_ready = true
      and preview.amount is not null
      and preview.currency_code = v_currency;


    v_invoice_ids :=
      array_append(
        v_invoice_ids,
        v_invoice_id
      );
  end loop;


  if cardinality(
    v_invoice_ids
  ) = 0
  then
    raise exception
      'No invoice could be generated for this billing period.';
  end if;


  -- ----------------------------------------------------------
  -- TENANT PAYMENT CLAIM
  -- ----------------------------------------------------------

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
    '{}',
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
    billing_period
  )
  do update
  set
    status = 'REPORTED',
    invoice_ids = excluded.invoice_ids,
    payment_ids = '{}',
    note = excluded.note,
    reported_by = auth.uid(),
    reported_at = now(),
    updated_at = now()
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
    i.id = any(
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

exception
  when others then
    raise exception using
      message =
        'Unable to report tenant payment: ' ||
        sqlerrm,

      detail =
        'SQLSTATE ' ||
        sqlstate;
end;
$$;


grant execute
on function public.report_tenant_payment(
  uuid,
  date,
  text
)
to authenticated;