-- ============================================================
-- DOMETRA
-- CHECKOUT DEPOSIT SETTLEMENT + ATOMIC COMPLETION
-- ============================================================
--
-- Complete checkout transaction:
--
--   validate final readings
--   validate final billing
--   settle deposit
--   apply deposit credit to outstanding invoices
--   record returned / retained deposit
--   complete checkout
--   end tenancy
--
-- Everything happens in ONE PostgreSQL transaction.
-- ============================================================


-- ============================================================
-- CHECKOUT SETTLEMENT SNAPSHOT
-- ============================================================

alter table public.tenancy_checkouts
add column if not exists
  deposit_settlement_mode text;


alter table public.tenancy_checkouts
add column if not exists
  deposit_currency_code text;


alter table public.tenancy_checkouts
add column if not exists
  deposit_applied_amount numeric(14,2)
  not null
  default 0;


alter table public.tenancy_checkouts
add column if not exists
  deposit_returned_amount numeric(14,2)
  not null
  default 0;


alter table public.tenancy_checkouts
add column if not exists
  deposit_retained_amount numeric(14,2)
  not null
  default 0;


alter table public.tenancy_checkouts
add column if not exists
  deposit_settled_at timestamptz;


alter table public.tenancy_checkouts
add column if not exists
  deposit_settled_by uuid
  references auth.users(id)
  on delete set null;


alter table public.tenancy_checkouts
add column if not exists
  deposit_settlement_note text;


-- ============================================================
-- CHECKOUT SETTLEMENT PREVIEW
-- ============================================================

create or replace function public.get_checkout_deposit_settlement_preview(
  p_tenancy_id uuid
)
returns table (

  checkout_date date,

  checkout_status text,

  readings_ready boolean,

  final_billing_ready boolean,

  deposit_id uuid,

  deposit_amount numeric,

  deposit_currency text,

  outstanding_amount numeric

)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_checkout_date date;

  v_checkout_status text;

  v_final_billing_at timestamptz;

  v_deposit_id uuid;

  v_deposit_amount numeric := 0;

  v_deposit_currency text;

  v_received numeric := 0;

  v_returned numeric := 0;

  v_applied numeric := 0;

  v_adjusted numeric := 0;

  v_outstanding numeric := 0;

  v_rent_json jsonb;

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
    c.checkout_date,
    c.status::text,
    c.final_billing_generated_at

  into
    v_checkout_date,
    v_checkout_status,
    v_final_billing_at

  from public.tenancy_checkouts c

  where
    c.tenancy_id =
      p_tenancy_id

  limit 1;


  if v_checkout_status is null then
    raise exception
      'Checkout has not been started.';
  end if;


  -- ----------------------------------------------------------
  -- DEPOSIT LEDGER
  -- ----------------------------------------------------------

  select
    d.id,
    d.required_amount,
    d.currency_code::text

  into
    v_deposit_id,
    v_deposit_amount,
    v_deposit_currency

  from public.security_deposits d

  where
    d.tenancy_id =
      p_tenancy_id

  limit 1;


  -- ----------------------------------------------------------
  -- FALLBACK FOR OLDER DOMETRA TENANCIES
  --
  -- Some older tenancy creation flows stored the deposit only
  -- inside rent_terms.
  --
  -- to_jsonb() intentionally avoids coupling this migration to
  -- one historical rent_terms column layout.
  -- ----------------------------------------------------------

  if v_deposit_id is null then

    select
      to_jsonb(rt)

    into
      v_rent_json

    from public.rent_terms rt

    where
      rt.tenancy_id =
        p_tenancy_id

    order by
      coalesce(
        (
          to_jsonb(rt)
            ->> 'valid_from'
        )::date,
        date '1900-01-01'
      ) desc

    limit 1;


    if v_rent_json is not null then

      begin

        v_deposit_amount :=
          coalesce(
            nullif(
              v_rent_json
                ->> 'deposit_amount',
              ''
            )::numeric,
            0
          );

      exception
        when others then

          v_deposit_amount :=
            0;

      end;


      v_deposit_currency :=
        coalesce(
          nullif(
            v_rent_json
              ->> 'deposit_currency',
            ''
          ),

          nullif(
            v_rent_json
              ->> 'currency_code',
            ''
          ),

          nullif(
            v_rent_json
              ->> 'rent_currency',
            ''
          )
        );

    end if;

  else

    select
      coalesce(
        sum(
          case
            when tx.tx_type::text =
              'RECEIVED'
            then tx.amount
            else 0
          end
        ),
        0
      ),

      coalesce(
        sum(
          case
            when tx.tx_type::text =
              'RETURNED'
            then tx.amount
            else 0
          end
        ),
        0
      ),

      coalesce(
        sum(
          case
            when tx.tx_type::text =
              'APPLIED_TO_INVOICE'
            then tx.amount
            else 0
          end
        ),
        0
      ),

      coalesce(
        sum(
          case
            when tx.tx_type::text =
              'ADJUSTMENT'
            then tx.amount
            else 0
          end
        ),
        0
      )

    into
      v_received,
      v_returned,
      v_applied,
      v_adjusted

    from public.security_deposit_transactions tx

    where
      tx.security_deposit_id =
        v_deposit_id;


    /*
     * If RECEIVED transactions exist, they are the canonical
     * amount actually held.
     *
     * Older tenancies may have no RECEIVED transaction, so
     * required_amount is used as the legacy held balance.
     */

    if v_received > 0 then

      v_deposit_amount :=
        greatest(
          v_received
          -
          v_returned
          -
          v_applied
          -
          v_adjusted,
          0
        );

    else

      v_deposit_amount :=
        greatest(
          v_deposit_amount
          -
          v_returned
          -
          v_applied
          -
          v_adjusted,
          0
        );

    end if;

  end if;


  -- ----------------------------------------------------------
  -- OUTSTANDING BALANCE IN DEPOSIT CURRENCY
  --
  -- No implicit FX at checkout.
  -- ----------------------------------------------------------

  if v_deposit_currency is not null then

    select
      coalesce(
        sum(
          i.base_balance_amount
        ),
        0
      )

    into
      v_outstanding

    from public.invoices i

    where
      i.tenancy_id =
        p_tenancy_id

      and i.status::text not in (
        'PAID',
        'VOID'
      )

      and i.base_balance_amount >
        0

      and i.base_currency::text =
        v_deposit_currency;

  end if;


  return query

  select
    v_checkout_date,

    v_checkout_status,

    public.checkout_has_all_final_readings(
      p_tenancy_id
    ),

    v_final_billing_at
      is not null,

    v_deposit_id,

    round(
      coalesce(
        v_deposit_amount,
        0
      ),
      2
    ),

    v_deposit_currency,

    round(
      coalesce(
        v_outstanding,
        0
      ),
      2
    );

end;
$$;


grant execute
on function public.get_checkout_deposit_settlement_preview(uuid)
to authenticated;


-- ============================================================
-- ATOMIC COMPLETE CHECKOUT
-- ============================================================

create or replace function public.complete_checkout_with_settlement(

  p_tenancy_id uuid,

  p_apply_amount numeric default 0,

  p_return_amount numeric default 0,

  p_retain_amount numeric default 0,

  p_note text default null

)
returns table (

  checkout_status text,

  tenancy_status text,

  applied_amount numeric,

  returned_amount numeric,

  retained_amount numeric

)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_checkout record;

  v_preview record;

  v_deposit_id uuid;

  v_deposit_amount numeric := 0;

  v_currency text;

  v_sum numeric := 0;

  v_remaining_apply numeric := 0;

  v_invoice record;

  v_apply_to_invoice numeric := 0;

  v_new_balance numeric := 0;

  v_new_total numeric := 0;

  v_security_status text;

  v_mode text;

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


  -- ----------------------------------------------------------
  -- LOCK CHECKOUT
  -- ----------------------------------------------------------

  select
    *

  into
    v_checkout

  from public.tenancy_checkouts c

  where
    c.tenancy_id =
      p_tenancy_id

  for update;


  if not found then
    raise exception
      'Checkout has not been started.';
  end if;


  -- Idempotent completion.

  if v_checkout.status::text =
    'COMPLETED'
  then

    return query

    select
      'COMPLETED'::text,

      'ENDED'::text,

      coalesce(
        v_checkout.deposit_applied_amount,
        0
      ),

      coalesce(
        v_checkout.deposit_returned_amount,
        0
      ),

      coalesce(
        v_checkout.deposit_retained_amount,
        0
      );

    return;

  end if;


  if v_checkout.status::text <>
    'PENDING'
  then
    raise exception
      'Checkout is not pending.';
  end if;


  -- ----------------------------------------------------------
  -- READINGS
  -- ----------------------------------------------------------

  if not public.checkout_has_all_final_readings(
    p_tenancy_id
  )
  then
    raise exception
      'All final meter readings must be submitted before checkout can be completed.';
  end if;


  -- ----------------------------------------------------------
  -- FINAL BILLING
  -- ----------------------------------------------------------

  if v_checkout.final_billing_generated_at
    is null
  then
    raise exception
      'Confirm the final checkout bill before completing checkout.';
  end if;


  -- ----------------------------------------------------------
  -- LOAD DEPOSIT PREVIEW
  -- ----------------------------------------------------------

  select
    *

  into
    v_preview

  from public.get_checkout_deposit_settlement_preview(
    p_tenancy_id
  );


  v_deposit_id :=
    v_preview.deposit_id;

  v_deposit_amount :=
    coalesce(
      v_preview.deposit_amount,
      0
    );

  v_currency :=
    v_preview.deposit_currency;


  -- ----------------------------------------------------------
  -- NORMALIZE INPUT
  -- ----------------------------------------------------------

  p_apply_amount :=
    round(
      greatest(
        coalesce(
          p_apply_amount,
          0
        ),
        0
      ),
      2
    );


  p_return_amount :=
    round(
      greatest(
        coalesce(
          p_return_amount,
          0
        ),
        0
      ),
      2
    );


  p_retain_amount :=
    round(
      greatest(
        coalesce(
          p_retain_amount,
          0
        ),
        0
      ),
      2
    );


  v_sum :=
    round(
      p_apply_amount
      +
      p_return_amount
      +
      p_retain_amount,
      2
    );


  if abs(
    v_sum -
    v_deposit_amount
  ) > 0.01
  then
    raise exception
      'Deposit settlement must equal the available deposit amount. Available: %, settlement: %.',
      v_deposit_amount,
      v_sum;
  end if;


  if p_apply_amount >
    coalesce(
      v_preview.outstanding_amount,
      0
    )
    +
    0.01
  then
    raise exception
      'Deposit amount applied to debt exceeds the outstanding balance in the same currency.';
  end if;


  if p_apply_amount > 0
    and v_currency is null
  then
    raise exception
      'Deposit currency is required when applying deposit to invoices.';
  end if;


  -- ----------------------------------------------------------
  -- CREATE LEGACY DEPOSIT ROW WHEN REQUIRED
  -- ----------------------------------------------------------

  if v_deposit_amount > 0
    and v_deposit_id is null
  then

    insert into public.security_deposits (

      tenancy_id,

      required_amount,

      currency_code,

      status

    )
    values (

      p_tenancy_id,

      v_deposit_amount,

      v_currency,

      'HELD'

    )

    returning
      id

    into
      v_deposit_id;

  end if;


  -- ----------------------------------------------------------
  -- APPLY DEPOSIT TO OUTSTANDING INVOICES
  --
  -- IMPORTANT:
  --
  -- This is NOT a new payment.
  --
  -- The deposit was already held before checkout, therefore
  -- creating a payment here would incorrectly increase cash
  -- received statistics.
  --
  -- Instead we add a CREDIT invoice line and record
  -- APPLIED_TO_INVOICE in the deposit ledger.
  -- ----------------------------------------------------------

  v_remaining_apply :=
    p_apply_amount;


  if v_remaining_apply > 0 then

    for v_invoice in

      select
        i.id,
        i.base_currency::text
          as currency_code,
        i.base_total_amount,
        i.base_paid_amount,
        i.base_balance_amount,
        i.status::text
          as status

      from public.invoices i

      where
        i.tenancy_id =
          p_tenancy_id

        and i.status::text not in (
          'PAID',
          'VOID'
        )

        and i.base_balance_amount >
          0

        and i.base_currency::text =
          v_currency

      order by
        i.due_date nulls first,
        i.issue_date,
        i.created_at,
        i.id

      for update

    loop

      exit when
        v_remaining_apply <=
          0;


      v_apply_to_invoice :=
        least(
          v_remaining_apply,
          v_invoice.base_balance_amount
        );


      if v_apply_to_invoice <= 0 then
        continue;
      end if;


      -- ------------------------------------------------------
      -- CREDIT LINE
      -- ------------------------------------------------------

      insert into public.invoice_lines (

        invoice_id,

        line_type,

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
      values (

        v_invoice.id,

        'CREDIT',

        'Security deposit applied at checkout',

        1,

        'deposit',

        -v_apply_to_invoice,

        -v_apply_to_invoice,

        v_currency,

        1,

        -v_apply_to_invoice,

        jsonb_build_object(

          'source',
          'CHECKOUT_DEPOSIT',

          'tenancyId',
          p_tenancy_id

        ),

        9990

      );


      -- ------------------------------------------------------
      -- DEPOSIT LEDGER
      -- ------------------------------------------------------

      insert into public.security_deposit_transactions (

        security_deposit_id,

        tx_type,

        amount,

        currency_code,

        invoice_id,

        tx_date,

        note,

        created_by

      )
      values (

        v_deposit_id,

        'APPLIED_TO_INVOICE',

        v_apply_to_invoice,

        v_currency,

        v_invoice.id,

        current_date,

        'Applied to outstanding invoice during checkout',

        auth.uid()

      );


      -- ------------------------------------------------------
      -- UPDATE INVOICE SNAPSHOT
      -- ------------------------------------------------------

      v_new_total :=
        greatest(
          v_invoice.base_total_amount
          -
          v_apply_to_invoice,
          0
        );


      v_new_balance :=
        greatest(
          v_invoice.base_balance_amount
          -
          v_apply_to_invoice,
          0
        );


      update public.invoices

      set
        base_total_amount =
          round(
            v_new_total,
            2
          ),

        base_balance_amount =
          round(
            v_new_balance,
            2
          ),

        status =
          case

            when v_new_balance <=
              0.005
            then
              'PAID'

            when base_paid_amount >
              0
            then
              'PARTIALLY_PAID'

            else
              status

          end,

        paid_at =
          case

            when v_new_balance <=
              0.005
            then
              coalesce(
                paid_at,
                now()
              )

            else
              paid_at

          end,

        updated_at =
          now()

      where
        id =
          v_invoice.id;


      v_remaining_apply :=
        round(
          v_remaining_apply
          -
          v_apply_to_invoice,
          2
        );

    end loop;


    if v_remaining_apply >
      0.01
    then
      raise exception
        'Unable to allocate the requested deposit amount to outstanding invoices.';
    end if;

  end if;


  -- ----------------------------------------------------------
  -- RETURN TO TENANT
  -- ----------------------------------------------------------

  if p_return_amount > 0 then

    insert into public.security_deposit_transactions (

      security_deposit_id,

      tx_type,

      amount,

      currency_code,

      tx_date,

      note,

      created_by

    )
    values (

      v_deposit_id,

      'RETURNED',

      p_return_amount,

      v_currency,

      current_date,

      coalesce(
        nullif(
          trim(
            p_note
          ),
          ''
        ),
        'Deposit returned at checkout'
      ),

      auth.uid()

    );

  end if;


  -- ----------------------------------------------------------
  -- RETAINED AMOUNT
  --
  -- Existing deposit_tx_type has ADJUSTMENT, so retained money
  -- is recorded there rather than inventing a second financial
  -- payment.
  -- ----------------------------------------------------------

  if p_retain_amount > 0 then

    insert into public.security_deposit_transactions (

      security_deposit_id,

      tx_type,

      amount,

      currency_code,

      tx_date,

      note,

      created_by

    )
    values (

      v_deposit_id,

      'ADJUSTMENT',

      p_retain_amount,

      v_currency,

      current_date,

      coalesce(
        nullif(
          trim(
            p_note
          ),
          ''
        ),
        'Deposit retained at checkout'
      ),

      auth.uid()

    );

  end if;


  -- ----------------------------------------------------------
  -- SECURITY DEPOSIT STATUS
  -- ----------------------------------------------------------

  if v_deposit_id is not null then

    if p_return_amount >=
      v_deposit_amount -
      0.01
    then

      v_security_status :=
        'RETURNED';


    elsif p_return_amount > 0 then

      v_security_status :=
        'PARTIALLY_RETURNED';


    elsif p_apply_amount > 0
      or p_retain_amount > 0
    then

      v_security_status :=
        'APPLIED';


    else

      v_security_status :=
        'WAIVED';

    end if;


    update public.security_deposits

    set
      status =
        v_security_status::deposit_status,

      updated_at =
        now()

    where
      id =
        v_deposit_id;

  end if;


  -- ----------------------------------------------------------
  -- SETTLEMENT MODE
  -- ----------------------------------------------------------

  v_mode :=
    case

      when v_deposit_amount <=
        0
      then
        'NO_DEPOSIT'

      when p_apply_amount > 0
        and p_return_amount > 0
      then
        'APPLY_AND_RETURN'

      when p_apply_amount > 0
        and p_retain_amount > 0
      then
        'APPLY_AND_RETAIN'

      when p_return_amount > 0
        and p_retain_amount > 0
      then
        'RETURN_AND_RETAIN'

      when p_apply_amount > 0
      then
        'APPLY_TO_BALANCE'

      when p_return_amount > 0
      then
        'RETURN'

      when p_retain_amount > 0
      then
        'RETAIN'

      else
        'NO_DEPOSIT'

    end;


  -- ----------------------------------------------------------
  -- SNAPSHOT ON CHECKOUT
  -- ----------------------------------------------------------

  update public.tenancy_checkouts

  set
    deposit_settlement_mode =
      v_mode,

    deposit_currency_code =
      v_currency,

    deposit_applied_amount =
      p_apply_amount,

    deposit_returned_amount =
      p_return_amount,

    deposit_retained_amount =
      p_retain_amount,

    deposit_settled_at =
      now(),

    deposit_settled_by =
      auth.uid(),

    deposit_settlement_note =
      nullif(
        trim(
          p_note
        ),
        ''
      ),

    status =
      'COMPLETED',

    completed_at =
      coalesce(
        completed_at,
        now()
      )

  where
    tenancy_id =
      p_tenancy_id;


  -- ----------------------------------------------------------
  -- END TENANCY
  -- ----------------------------------------------------------

  update public.tenancies

  set
    status =
      'ENDED',

    end_date =
      coalesce(
        v_checkout.checkout_date,
        current_date
      ),

    updated_at =
      now()

  where
    id =
      p_tenancy_id;


  -- CHECKOUT_COMPLETED notification is generated by the
  -- existing tenancy_checkouts status trigger.


  return query

  select
    'COMPLETED'::text,

    'ENDED'::text,

    p_apply_amount,

    p_return_amount,

    p_retain_amount;

end;
$$;


grant execute
on function public.complete_checkout_with_settlement(
  uuid,
  numeric,
  numeric,
  numeric,
  text
)
to authenticated;