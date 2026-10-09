import {
  supabase,
} from '../lib/supabase';

export interface CheckoutSettlementPreview {
  checkoutDate?:
    string;

  checkoutStatus:
    string;

  readingsReady:
    boolean;

  finalBillingReady:
    boolean;

  depositId?:
    string;

  depositAmount:
    number;

  depositCurrency?:
    string;

  outstandingAmount:
    number;
}

export interface CompleteCheckoutSettlementInput {
  tenancyId:
    string;

  applyAmount:
    number;

  returnAmount:
    number;

  retainAmount:
    number;

  note?:
    string;
}

export interface CompleteCheckoutSettlementResult {
  checkoutStatus:
    string;

  tenancyStatus:
    string;

  appliedAmount:
    number;

  returnedAmount:
    number;

  retainedAmount:
    number;
}

interface PreviewRow {
  checkout_date:
    string | null;

  checkout_status:
    string;

  readings_ready:
    boolean;

  final_billing_ready:
    boolean;

  deposit_id:
    string | null;

  deposit_amount:
    number | string;

  deposit_currency:
    string | null;

  outstanding_amount:
    number | string;
}

interface CompleteRow {
  checkout_status:
    string;

  tenancy_status:
    string;

  applied_amount:
    number | string;

  returned_amount:
    number | string;

  retained_amount:
    number | string;
}

function requireSupabase() {
  if (
    !supabase
  ) {
    throw new Error(
      'Supabase is not configured.',
    );
  }

  return supabase as any;
}

function asNumber(
  value:
    number | string | null | undefined,
) {
  const result =
    Number(
      value ??
      0,
    );

  return Number.isFinite(
    result,
  )
    ? result
    : 0;
}

export async function loadCheckoutSettlementPreview(
  tenancyId:
    string,
): Promise<
  CheckoutSettlementPreview
> {
  const client =
    requireSupabase();

  const {
    data,
    error,
  } =
    await client.rpc(
      'get_checkout_deposit_settlement_preview',
      {
        p_tenancy_id:
          tenancyId,
      },
    );

  if (
    error
  ) {
    throw error;
  }

  const rows =
    (
      data ??
      []
    ) as unknown as
      PreviewRow[];

  const row =
    rows[0];

  if (
    !row
  ) {
    throw new Error(
      'Checkout settlement preview was not returned.',
    );
  }

  return {
    checkoutDate:
      row.checkout_date ??
      undefined,

    checkoutStatus:
      row.checkout_status,

    readingsReady:
      Boolean(
        row.readings_ready,
      ),

    finalBillingReady:
      Boolean(
        row.final_billing_ready,
      ),

    depositId:
      row.deposit_id ??
      undefined,

    depositAmount:
      asNumber(
        row.deposit_amount,
      ),

    depositCurrency:
      row.deposit_currency ??
      undefined,

    outstandingAmount:
      asNumber(
        row.outstanding_amount,
      ),
  };
}

export async function completeCheckoutWithSettlement(
  input:
    CompleteCheckoutSettlementInput,
): Promise<
  CompleteCheckoutSettlementResult
> {
  const client =
    requireSupabase();

  const {
    data,
    error,
  } =
    await client.rpc(
      'complete_checkout_with_settlement',
      {
        p_tenancy_id:
          input.tenancyId,

        p_apply_amount:
          input.applyAmount,

        p_return_amount:
          input.returnAmount,

        p_retain_amount:
          input.retainAmount,

        p_note:
          input.note?.trim() ||
          null,
      },
    );

  if (
    error
  ) {
    throw error;
  }

  const rows =
    (
      data ??
      []
    ) as unknown as
      CompleteRow[];

  const row =
    rows[0];

  if (
    !row
  ) {
    throw new Error(
      'Checkout completion result was not returned.',
    );
  }

  return {
    checkoutStatus:
      row.checkout_status,

    tenancyStatus:
      row.tenancy_status,

    appliedAmount:
      asNumber(
        row.applied_amount,
      ),

    returnedAmount:
      asNumber(
        row.returned_amount,
      ),

    retainedAmount:
      asNumber(
        row.retained_amount,
      ),
  };
}