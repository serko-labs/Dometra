-- ============================================================
-- DOMETRA
-- LANDLORD PAYMENT CONFIRMATION
-- ============================================================
--
-- New lifecycle:
--
--   no claim
--      ↓
--   tenant presses Paid
--      ↓
--   tenant_payment_claims.status = REPORTED
--      ↓
--   invoice = ISSUED
--      ↓
--   landlord confirms
--      ↓
--   real payment + allocation are created
--      ↓
--   invoice = PAID
--      ↓
--   claim = CONFIRMED
--
-- If landlord rejects:
--
--   claim = REJECTED
--   invoice remains ISSUED
--   tenant may report payment again
--
-- ============================================================


-- ============================================================
-- EXTEND PAYMENT CLAIM
-- ============================================================

alter table public.tenant_payment_claims
add column if not exists confirmed_by uuid
references auth.users(id);


alter table public.tenant_payment_claims
add column if not exists confirmed_at timestamptz;


alter table public.tenant_payment_claims
add column if not exists rejected_by uuid
references auth.users(id);


alter table public.tenant_payment_claims
add column if not exists rejected_at timestamptz;


alter table public.tenant_payment_claims
add column if not exists rejection_note text;


-- ============================================================
-- REPLACE STATUS CHECK
-- ============================================================

do $$
declare
  v_constraint record;
begin

  for v_constraint in

    select
      c.conname

    from pg_constraint c

    where
      c.conrelid =
        'public.tenant_payment_claims'::regclass

      and c.contype =
        'c'

      and pg_get_constraintdef(
        c.oid
      ) ilike '%status%'

  loop

    execute format(
      'alter table public.tenant_payment_claims drop constraint %I',
      v_constraint.conname
    );

  end loop;

end $$;


alter table public.tenant_payment_claims
add constraint tenant_payment_claims_status_check
check (
  status in (
    'REPORTED',
    'CONFIRMED',
    'REJECTED',
    'CANCELLED'
  )
);


-- ============================================================
-- NORMALIZE OLD SELF-REPORTED PAYMENTS
-- ============================================================
--
-- Previous implementation could mark invoices PAID immediately
-- after the tenant pressed Paid.
--
-- Existing REPORTED claims are now moved back to ISSUED until
-- a landlord confirms them.
-- ============================================================

delete from public.payments p

using public.tenant_payment_claims c

where
  c.status =
    'REPORTED'

  and p.id =
    any(
      c.payment_ids
    )

  and p.reference in (
    'TENANT_REPORTED',
    'TENANT_REPORTED_CONFIRMED'
  );


update public.invoices i

set
  status =
    'ISSUED',

  base_paid_amount =
    0,

  base_balance_amount =
    i.base_total_amount,

  paid_at =
    null,

  updated_at =
    now()

from public.tenant_payment_claims c

where
  c.status =
    'REPORTED'

  and i.id =
    any(
      c.invoice_ids
    );


update public.tenant_payment_claims

set
  payment_ids =
    '{}',

  confirmed_by =
    null,

  confirmed_at =
    null,

  rejected_by =
    null,

  rejected_at =
    null,

  rejection_note =
    null,

  updated_at =
    now()

where
  status =
    'REPORTED';


-- ============================================================
-- TENANT REPORTS PAYMENT
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

  v_is_member boolean;

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

  -- ----------------------------------------------------------
  -- AUTH
  -- ----------------------------------------------------------

  if auth.uid() is null then
    raise exception
      'Authentication is required.';
  end if;


  v_period :=
    date_trunc(
      'month',
      p_billing_period
    )::date;


  -- ----------------------------------------------------------
  -- ACTIVE TENANCY
  -- ----------------------------------------------------------

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


  -- ----------------------------------------------------------
  -- LINKED TENANT
  -- ----------------------------------------------------------

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
    )

  into
    v_is_member;


  if not v_is_member then
    raise exception
      'Only a linked tenant can mark this bill as paid.';
  end if;


  -- ----------------------------------------------------------
  -- EXISTING ACTIVE CLAIM
  -- ----------------------------------------------------------

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

    and c.status in (
      'REPORTED',
      'CONFIRMED'
    );


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

        'claimStatus',
        v_claim.status,

        'alreadyReported',
        true,

        'invoices',
        v_result_invoices
      );

  end if;


  -- ----------------------------------------------------------
  -- BILL MUST BE READY
  -- ----------------------------------------------------------

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
      preview.is_ready =
        true

      and preview.amount
        is not null

      and preview.amount >
        0
  )
  then
    raise exception
      'There are no positive billable items for this period.';
  end if;


  -- ----------------------------------------------------------
  -- DUE DATE
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
      preview.is_ready =
        true

      and preview.amount
        is not null

      and preview.currency_code
        is not null

    group by
      preview.currency_code

    having
      sum(
        preview.amount
      ) >
      0

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


    if v_total <=
      0
    then
      continue;
    end if;


    v_invoice_id :=
      null;


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


    -- --------------------------------------------------------
    -- CREATE INVOICE
    -- --------------------------------------------------------

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
        'ISSUED',
        v_currency,
        v_total,
        0,
        v_total,
        'Tenant reported this bill as paid. Waiting for landlord confirmation.',
        now(),
        null,
        auth.uid()
      )

      returning
        id

      into
        v_invoice_id;


    -- --------------------------------------------------------
    -- UPDATE EXISTING INVOICE
    -- --------------------------------------------------------

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
          'ISSUED',

        base_total_amount =
          v_total,

        base_paid_amount =
          0,

        base_balance_amount =
          v_total,

        notes =
          'Tenant reported this bill as paid. Waiting for landlord confirmation.',

        issued_at =
          coalesce(
            issued_at,
            now()
          ),

        paid_at =
          null,

        updated_at =
          now()

      where
        id =
          v_invoice_id;

    end if;


    -- --------------------------------------------------------
    -- INVOICE LINES
    -- --------------------------------------------------------

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
        'TENANT_PAYMENT_REPORT',

        'billing_line_kind',
        preview.line_kind
      ),

      row_number()
      over (
        order by

          case
            preview.line_kind

            when 'RENT'
              then
                0

            when 'METERED'
              then
                1

            when 'FIXED'
              then
                2

            when 'VARIABLE'
              then
                3

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
      preview.is_ready =
        true

      and preview.amount
        is not null

      and preview.currency_code =
        v_currency;


    v_invoice_ids :=
      array_append(
        v_invoice_ids,
        v_invoice_id
      );

  end loop;


  if cardinality(
    v_invoice_ids
  ) =
    0
  then
    raise exception
      'No invoice could be generated for this billing period.';
  end if;


  -- ----------------------------------------------------------
  -- CLAIM
  -- ----------------------------------------------------------

  insert into public.tenant_payment_claims (
    tenancy_id,
    billing_period,
    status,
    invoice_ids,
    payment_ids,
    note,
    reported_by,
    reported_at,
    confirmed_by,
    confirmed_at,
    rejected_by,
    rejected_at,
    rejection_note
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
    now(),
    null,
    null,
    null,
    null,
    null
  )

  on conflict (
    tenancy_id,
    billing_period
  )

  do update

  set
    status =
      'REPORTED',

    invoice_ids =
      excluded.invoice_ids,

    payment_ids =
      '{}',

    note =
      excluded.note,

    reported_by =
      auth.uid(),

    reported_at =
      now(),

    confirmed_by =
      null,

    confirmed_at =
      null,

    rejected_by =
      null,

    rejected_at =
      null,

    rejection_note =
      null,

    updated_at =
      now()

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

      'claimStatus',
      v_claim.status,

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


-- ============================================================
-- LANDLORD CONFIRMS PAYMENT
-- ============================================================

create or replace function public.confirm_tenant_payment(
  p_claim_id uuid,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_claim
    public.tenant_payment_claims%rowtype;

  v_invoice
    public.invoices%rowtype;

  v_payment_id uuid;

  v_payment_ids uuid[] :=
    '{}';

  v_invoice_count integer :=
    0;

begin

  if auth.uid() is null then
    raise exception
      'Authentication is required.';
  end if;


  select
    *

  into
    v_claim

  from public.tenant_payment_claims

  where
    id =
      p_claim_id

  for update;


  if not found then
    raise exception
      'Payment report not found.';
  end if;


  if not public.can_manage_tenancy(
    v_claim.tenancy_id
  )
  then
    raise exception
      'You cannot confirm payments for this tenancy.';
  end if;


  if v_claim.status =
    'CONFIRMED'
  then

    return
      jsonb_build_object(
        'claimId',
        v_claim.id,

        'alreadyConfirmed',
        true,

        'paymentIds',
        v_claim.payment_ids
      );

  end if;


  if v_claim.status <>
    'REPORTED'
  then
    raise exception
      'Only a reported payment can be confirmed.';
  end if;


  for v_invoice in

    select
      i.*

    from public.invoices i

    where
      i.id =
      any(
        v_claim.invoice_ids
      )

      and i.tenancy_id =
        v_claim.tenancy_id

    order by
      i.base_currency

    for update

  loop

    v_invoice_count :=
      v_invoice_count +
      1;


    if v_invoice.base_total_amount <=
      0
    then
      continue;
    end if;


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
      v_invoice.workspace_id,
      v_invoice.tenancy_id,
      v_invoice.base_total_amount,
      v_invoice.base_currency,
      v_invoice.base_currency,
      1,
      v_invoice.base_total_amount,
      current_date,
      'OTHER',
      'INVOICE',
      'TENANT_REPORTED_CONFIRMED',

      coalesce(
        nullif(
          trim(
            p_note
          ),
          ''
        ),
        'Confirmed by landlord in Dometra.'
      ),

      auth.uid()
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
      v_invoice.id,
      null,
      v_invoice.base_total_amount,
      v_invoice.base_currency,
      v_invoice.base_total_amount,
      v_invoice.base_currency,
      1,
      v_invoice.base_total_amount,
      'MANUAL',
      auth.uid()
    );


    update public.invoices

    set
      status =
        'PAID',

      base_paid_amount =
        base_total_amount,

      base_balance_amount =
        0,

      paid_at =
        now(),

      notes =
        coalesce(
          nullif(
            trim(
              p_note
            ),
            ''
          ),
          'Tenant payment confirmed by landlord in Dometra.'
        ),

      updated_at =
        now()

    where
      id =
        v_invoice.id;


    v_payment_ids :=
      array_append(
        v_payment_ids,
        v_payment_id
      );

  end loop;


  if v_invoice_count =
    0
  then
    raise exception
      'No invoices are attached to this payment report.';
  end if;


  update public.tenant_payment_claims

  set
    status =
      'CONFIRMED',

    payment_ids =
      v_payment_ids,

    confirmed_by =
      auth.uid(),

    confirmed_at =
      now(),

    rejected_by =
      null,

    rejected_at =
      null,

    rejection_note =
      null,

    updated_at =
      now()

  where
    id =
      v_claim.id;


  return
    jsonb_build_object(
      'claimId',
      v_claim.id,

      'alreadyConfirmed',
      false,

      'paymentIds',
      v_payment_ids
    );

end;
$$;


-- ============================================================
-- LANDLORD REJECTS PAYMENT
-- ============================================================

create or replace function public.reject_tenant_payment(
  p_claim_id uuid,
  p_note text default null
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

  from public.tenant_payment_claims

  where
    id =
      p_claim_id

  for update;


  if not found then
    raise exception
      'Payment report not found.';
  end if;


  if not public.can_manage_tenancy(
    v_claim.tenancy_id
  )
  then
    raise exception
      'You cannot reject payments for this tenancy.';
  end if;


  if v_claim.status <>
    'REPORTED'
  then
    raise exception
      'Only a reported payment can be rejected.';
  end if;


  update public.invoices

  set
    status =
      'ISSUED',

    base_paid_amount =
      0,

    base_balance_amount =
      base_total_amount,

    paid_at =
      null,

    notes =
      coalesce(
        nullif(
          trim(
            p_note
          ),
          ''
        ),
        'Tenant payment report rejected by landlord.'
      ),

    updated_at =
      now()

  where
    id =
    any(
      v_claim.invoice_ids
    );


  update public.tenant_payment_claims

  set
    status =
      'REJECTED',

    payment_ids =
      '{}',

    confirmed_by =
      null,

    confirmed_at =
      null,

    rejected_by =
      auth.uid(),

    rejected_at =
      now(),

    rejection_note =
      nullif(
        trim(
          p_note
        ),
        ''
      ),

    updated_at =
      now()

  where
    id =
      v_claim.id;

end;
$$;


-- ============================================================
-- PAYMENT PROOF
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

    and c.status in (
      'REPORTED',
      'CONFIRMED'
    );


  if not found then
    raise exception
      'Active payment report not found.';
  end if;


  if not public.can_access_tenancy(
    v_claim.tenancy_id
  )
  then
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
on function public.report_tenant_payment(
  uuid,
  date,
  text
)
to authenticated;


grant execute
on function public.confirm_tenant_payment(
  uuid,
  text
)
to authenticated;


grant execute
on function public.reject_tenant_payment(
  uuid,
  text
)
to authenticated;


grant execute
on function public.set_tenant_payment_proof(
  uuid,
  text
)
to authenticated;