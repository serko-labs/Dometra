-- ============================================================
-- DOMETRA
-- FINAL CHECKOUT BILLING
-- ============================================================
--
-- Final checkout billing is an ADJUSTMENT invoice.
--
-- It includes only meter consumption between:
--
--   last regular meter reading
--       ->
--   final checkout meter reading
--
-- Existing rent / fixed / manually entered charges remain in
-- their existing monthly invoices.
--
-- This avoids double billing.
--
-- ============================================================


-- ============================================================
-- CHECKOUT BILLING STATE
-- ============================================================

alter table public.tenancy_checkouts
add column if not exists
  final_invoice_ids uuid[]
  not null
  default '{}'::uuid[];


alter table public.tenancy_checkouts
add column if not exists
  final_billing_generated_at timestamptz;


alter table public.tenancy_checkouts
add column if not exists
  final_billing_generated_by uuid
  references auth.users(id)
  on delete set null;


-- ============================================================
-- INDEX
-- ============================================================

create index if not exists
  idx_checkout_final_invoice_ids
on public.tenancy_checkouts
using gin (
  final_invoice_ids
);


-- ============================================================
-- FINAL BILL PREVIEW
-- ============================================================
--
-- One row per active meter register.
--
-- previous_value:
--
--   latest normal monthly reading
--
-- fallback:
--
--   tenancy MOVE_IN reading
--
--
-- final_value:
--
--   tenancy_checkout_readings.value
--
--
-- consumption:
--
--   final_value - previous_value
--
-- ============================================================

create or replace function public.get_checkout_final_bill_preview(
  p_tenancy_id uuid
)
returns table (

  meter_register_id uuid,

  meter_id uuid,

  property_service_id uuid,

  service_name text,

  register_code text,

  register_name text,

  unit text,

  previous_value numeric,

  final_value numeric,

  consumption numeric,

  unit_price numeric,

  currency_code text,

  amount numeric,

  is_ready boolean,

  issue text

)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_property_id uuid;

  v_checkout_status text;

begin

  if auth.uid() is null then
    raise exception
      'Authentication is required.';
  end if;


  if not public.can_manage_tenancy(
    p_tenancy_id
  ) then
    raise exception
      'You are not allowed to manage this tenancy.';
  end if;


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
      'Tenancy was not found.';
  end if;


  select
    c.status::text

  into
    v_checkout_status

  from public.tenancy_checkouts c

  where
    c.tenancy_id =
      p_tenancy_id

  limit 1;


  if v_checkout_status is null then
    raise exception
      'Checkout has not been started.';
  end if;


  return query

  with checkout_values as (

    select
      cr.meter_register_id,

      cr.value
        as checkout_value,

      cr.reading_date

    from public.tenancy_checkout_readings cr

    where
      cr.tenancy_id =
        p_tenancy_id

  ),


  register_data as (

    select
      mr.id
        as register_id,

      mr.meter_id,

      mr.code,

      mr.name
        as register_name,

      mr.unit,

      m.property_service_id,

      m.name
        as meter_name,

      ps.service_code,

      ps.custom_name

    from public.meter_registers mr

    join public.meters m
      on m.id =
        mr.meter_id

    left join public.property_services ps
      on ps.id =
        m.property_service_id

    where
      m.property_id =
        v_property_id

      and m.status::text =
        'ACTIVE'

      and mr.active =
        true

  ),


  data as (

    select
      rd.register_id,

      rd.meter_id,

      rd.property_service_id,

      coalesce(
        nullif(
          trim(
            rd.custom_name
          ),
          ''
        ),

        nullif(
          trim(
            rd.meter_name
          ),
          ''
        ),

        nullif(
          trim(
            rd.service_code
          ),
          ''
        ),

        'Utility'
      )
        as resolved_service_name,

      rd.code,

      rd.register_name,

      rd.unit,

      cv.checkout_value,

      cv.reading_date,


      -- ------------------------------------------------------
      -- LAST REGULAR READING
      -- ------------------------------------------------------

      coalesce(

        (

          select
            mrr.current_value

          from public.meter_register_readings mrr

          join public.meter_reading_sessions mrs
            on mrs.id =
              mrr.reading_session_id

          where
            mrr.meter_register_id =
              rd.register_id

            and mrr.current_value
              is not null

            and mrs.status::text in (
              'SUBMITTED',
              'CONFIRMED'
            )

            and (
              cv.reading_date is null
              or mrs.reading_date <=
                cv.reading_date
            )

          order by
            mrs.reading_date desc,
            mrs.billing_period desc,
            mrr.id desc

          limit 1

        ),


        -- ----------------------------------------------------
        -- FALLBACK: MOVE-IN READING
        -- ----------------------------------------------------

        (

          select
            tmr.value

          from public.tenancy_meter_readings tmr

          where
            tmr.tenancy_id =
              p_tenancy_id

            and tmr.meter_register_id =
              rd.register_id

            and tmr.reading_type::text =
              'MOVE_IN'

          order by
            tmr.reading_date desc,
            tmr.id desc

          limit 1

        )

      )
        as resolved_previous_value,


      -- ------------------------------------------------------
      -- CURRENT TARIFF
      -- ------------------------------------------------------

      tariff.price,

      tariff.currency_code

    from register_data rd

    left join checkout_values cv
      on cv.meter_register_id =
        rd.register_id

    left join lateral (

      select
        st.price,

        st.currency_code::text
          as currency_code

      from public.service_tariffs st

      where
        st.property_service_id =
          rd.property_service_id

        and (
          st.meter_register_id =
            rd.register_id

          or st.meter_register_id
            is null
        )

        and (
          cv.reading_date is null

          or st.valid_from <=
            cv.reading_date
        )

        and (
          st.valid_to is null

          or cv.reading_date is null

          or st.valid_to >=
            cv.reading_date
        )

      order by

        case
          when st.meter_register_id =
            rd.register_id
          then 0

          else 1
        end,

        st.valid_from desc,

        st.created_at desc

      limit 1

    ) tariff
      on true

  )


  select
    d.register_id,

    d.meter_id,

    d.property_service_id,

    d.resolved_service_name,

    d.code,

    d.register_name,

    d.unit,

    d.resolved_previous_value,

    d.checkout_value,

    case
      when
        d.checkout_value
          is not null

        and d.resolved_previous_value
          is not null

        and d.checkout_value >=
          d.resolved_previous_value

      then
        d.checkout_value -
        d.resolved_previous_value

      else null
    end
      as consumption,

    d.price,

    d.currency_code,

    case
      when
        d.checkout_value
          is not null

        and d.resolved_previous_value
          is not null

        and d.checkout_value >=
          d.resolved_previous_value

        and d.price
          is not null

      then round(
        (
          (
            d.checkout_value -
            d.resolved_previous_value
          )
          *
          d.price
        )::numeric,
        2
      )

      else null
    end
      as amount,

    (
      d.checkout_value
        is not null

      and d.resolved_previous_value
        is not null

      and d.checkout_value >=
        d.resolved_previous_value

      and d.price
        is not null

      and d.currency_code
        is not null

      and d.property_service_id
        is not null
    )
      as is_ready,

    case

      when d.checkout_value
        is null
      then
        'Final checkout reading is missing.'

      when d.resolved_previous_value
        is null
      then
        'Previous meter reading is missing.'

      when d.checkout_value <
        d.resolved_previous_value
      then
        'Final reading cannot be lower than the previous reading.'

      when d.property_service_id
        is null
      then
        'Meter is not connected to a property service.'

      when d.price
        is null
      then
        'Tariff is missing for this meter register.'

      when d.currency_code
        is null
      then
        'Tariff currency is missing.'

      else
        null

    end
      as issue

  from data d

  order by
    d.resolved_service_name,
    d.code;

end;
$$;


grant execute
on function public.get_checkout_final_bill_preview(uuid)
to authenticated;


-- ============================================================
-- GENERATE FINAL CHECKOUT ADJUSTMENT INVOICE
-- ============================================================
--
-- Current MVP rule:
--
-- Meter checkout adjustments must use ONE utility currency.
--
-- Normal Dometra setup:
--
--   rent      -> USD / EUR / UAH monthly invoice
--   utilities -> UAH checkout adjustment
--
-- Existing monthly rent invoices are not modified.
--
-- ============================================================

create or replace function public.generate_checkout_final_invoice(
  p_tenancy_id uuid
)
returns table (

  invoice_id uuid,

  currency_code text,

  total_amount numeric

)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_property_id uuid;

  v_workspace_id uuid;

  v_checkout_date date;

  v_checkout_status text;

  v_existing_invoice_ids uuid[];

  v_currency text;

  v_currency_count integer;

  v_total numeric(14,2);

  v_invoice_id uuid;

  v_invoice_number text;

  v_preview_count integer;

begin

  if auth.uid() is null then
    raise exception
      'Authentication is required.';
  end if;


  if not public.can_manage_tenancy(
    p_tenancy_id
  ) then
    raise exception
      'You are not allowed to manage this tenancy.';
  end if;


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
      p_tenancy_id;


  if v_property_id is null then
    raise exception
      'Tenancy was not found.';
  end if;


  select
    c.checkout_date,
    c.status::text,
    c.final_invoice_ids

  into
    v_checkout_date,
    v_checkout_status,
    v_existing_invoice_ids

  from public.tenancy_checkouts c

  where
    c.tenancy_id =
      p_tenancy_id

  limit 1;


  if v_checkout_status is null then
    raise exception
      'Checkout has not been started.';
  end if;


  if v_checkout_status <>
    'PENDING'
  then
    raise exception
      'Final billing can only be generated for a pending checkout.';
  end if;


  -- ----------------------------------------------------------
  -- IDEMPOTENT RETURN
  -- ----------------------------------------------------------

  if coalesce(
    array_length(
      v_existing_invoice_ids,
      1
    ),
    0
  ) > 0
  then

    return query

    select
      i.id,

      i.base_currency::text,

      i.base_total_amount

    from public.invoices i

    where
      i.id =
        any(
          v_existing_invoice_ids
        );

    return;

  end if;


  -- ----------------------------------------------------------
  -- PREVIEW VALIDATION
  -- ----------------------------------------------------------

  select
    count(*)

  into
    v_preview_count

  from public.get_checkout_final_bill_preview(
    p_tenancy_id
  );


  if v_preview_count =
    0
  then

    update public.tenancy_checkouts

    set
      final_billing_generated_at =
        now(),

      final_billing_generated_by =
        auth.uid()

    where
      tenancy_id =
        p_tenancy_id;


    return;

  end if;


  if exists (

    select
      1

    from public.get_checkout_final_bill_preview(
      p_tenancy_id
    ) preview

    where
      preview.is_ready =
        false
  )
  then
    raise exception
      'Final checkout bill is not ready. Resolve all meter-reading or tariff issues first.';
  end if;


  -- ----------------------------------------------------------
  -- POSITIVE CHARGES ONLY
  -- ----------------------------------------------------------

  select
    count(
      distinct preview.currency_code
    )

  into
    v_currency_count

  from public.get_checkout_final_bill_preview(
    p_tenancy_id
  ) preview

  where
    coalesce(
      preview.amount,
      0
    ) > 0;


  if v_currency_count >
    1
  then
    raise exception
      'Final checkout meter charges use more than one currency. Multi-currency checkout adjustment invoices are not enabled yet.';
  end if;


  if v_currency_count =
    0
  then

    update public.tenancy_checkouts

    set
      final_billing_generated_at =
        now(),

      final_billing_generated_by =
        auth.uid()

    where
      tenancy_id =
        p_tenancy_id;


    return;

  end if;


  select
    preview.currency_code,

    round(
      sum(
        preview.amount
      )::numeric,
      2
    )

  into
    v_currency,
    v_total

  from public.get_checkout_final_bill_preview(
    p_tenancy_id
  ) preview

  where
    coalesce(
      preview.amount,
      0
    ) > 0

  group by
    preview.currency_code

  limit 1;


  -- ----------------------------------------------------------
  -- DETERMINISTIC CHECKOUT INVOICE NUMBER
  -- ----------------------------------------------------------

  v_invoice_number :=
    'CHK-' ||
    to_char(
      v_checkout_date,
      'YYYYMMDD'
    ) ||
    '-' ||
    upper(
      substr(
        replace(
          p_tenancy_id::text,
          '-',
          ''
        ),
        1,
        8
      )
    );


  -- ----------------------------------------------------------
  -- SAFETY
  --
  -- billing_period uses the real checkout date instead of the
  -- first day of the month.
  --
  -- This keeps the adjustment separate from the ordinary
  -- monthly invoice for that tenancy.
  -- ----------------------------------------------------------

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

    notes,

    issued_at,

    created_by

  )
  values (

    v_workspace_id,

    v_property_id,

    p_tenancy_id,

    v_invoice_number,

    v_checkout_date,

    current_date,

    v_checkout_date,

    'ISSUED',

    'uk',

    v_currency,

    v_total,

    0,

    v_total,

    'Final checkout meter adjustment',

    now(),

    auth.uid()

  )

  returning
    id

  into
    v_invoice_id;


  -- ----------------------------------------------------------
  -- FINAL METER LINES
  -- ----------------------------------------------------------

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

    'UTILITY',

    preview.property_service_id,

    null,

    preview.service_name ||
      case
        when coalesce(
          preview.register_code,
          ''
        ) <> ''
        then
          ' · ' ||
          preview.register_code

        else
          ''
      end,

    preview.consumption,

    preview.unit,

    preview.unit_price,

    preview.amount,

    preview.currency_code,

    1,

    preview.amount,

    jsonb_build_object(

      'source',
      'CHECKOUT_FINAL_READING',

      'meterId',
      preview.meter_id,

      'meterRegisterId',
      preview.meter_register_id,

      'previousValue',
      preview.previous_value,

      'finalValue',
      preview.final_value

    ),

    row_number()
      over (
        order by
          preview.service_name,
          preview.register_code
      )::integer

  from public.get_checkout_final_bill_preview(
    p_tenancy_id
  ) preview

  where
    preview.is_ready =
      true

    and coalesce(
      preview.amount,
      0
    ) > 0;


  -- ----------------------------------------------------------
  -- CONNECT INVOICE TO CHECKOUT
  -- ----------------------------------------------------------

  update public.tenancy_checkouts

  set
    final_invoice_ids =
      array[
        v_invoice_id
      ]::uuid[],

    final_billing_generated_at =
      now(),

    final_billing_generated_by =
      auth.uid()

  where
    tenancy_id =
      p_tenancy_id;


  return query

  select
    v_invoice_id,

    v_currency,

    v_total;

end;
$$;


grant execute
on function public.generate_checkout_final_invoice(uuid)
to authenticated;