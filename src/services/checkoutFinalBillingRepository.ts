import {
  supabase,
} from '../lib/supabase';

export interface CheckoutFinalBillLine {
  meterRegisterId:
    string;

  meterId:
    string;

  propertyServiceId?:
    string;

  serviceName:
    string;

  registerCode:
    string;

  registerName:
    string;

  unit:
    string;

  previousValue?:
    number;

  finalValue?:
    number;

  consumption?:
    number;

  unitPrice?:
    number;

  currencyCode?:
    string;

  amount?:
    number;

  ready:
    boolean;

  issue?:
    string;
}

export interface CheckoutBalance {
  currency:
    string;

  outstanding:
    number;
}

export interface CheckoutGeneratedInvoice {
  id:
    string;

  currency:
    string;

  total:
    number;
}

export interface CheckoutFinalBillingSummary {
  checkoutDate?:
    string;

  checkoutStatus?:
    string;

  generatedAt?:
    string;

  lines:
    CheckoutFinalBillLine[];

  totals:
    CheckoutBalance[];

  existingOutstanding:
    CheckoutBalance[];

  invoices:
    CheckoutGeneratedInvoice[];

  ready:
    boolean;
}

interface PreviewRow {
  meter_register_id:
    string;

  meter_id:
    string;

  property_service_id:
    string | null;

  service_name:
    string;

  register_code:
    string;

  register_name:
    string;

  unit:
    string;

  previous_value:
    number | string | null;

  final_value:
    number | string | null;

  consumption:
    number | string | null;

  unit_price:
    number | string | null;

  currency_code:
    string | null;

  amount:
    number | string | null;

  is_ready:
    boolean;

  issue:
    string | null;
}

interface CheckoutRow {
  checkout_date:
    string | null;

  status:
    string;

  final_invoice_ids:
    string[] | null;

  final_billing_generated_at:
    string | null;
}

interface InvoiceBalanceRow {
  base_currency:
    string;

  base_balance_amount:
    number | string;

  status:
    string;
}

interface GeneratedInvoiceRow {
  id:
    string;

  base_currency:
    string;

  base_total_amount:
    number | string;
}

interface GeneratedRpcRow {
  invoice_id:
    string;

  currency_code:
    string;

  total_amount:
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

function numberValue(
  value:
    | number
    | string
    | null
    | undefined,
): number | undefined {
  if (
    value === null ||
    value === undefined
  ) {
    return undefined;
  }

  const parsed =
    Number(
      value,
    );

  return Number.isFinite(
    parsed,
  )
    ? parsed
    : undefined;
}

function aggregate(
  items:
    Array<{
      currency?:
        string;

      amount?:
        number;
    }>,
): CheckoutBalance[] {
  const map =
    new Map<
      string,
      number
    >();

  for (
    const item
    of items
  ) {
    if (
      !item.currency ||
      item.amount ===
        undefined
    ) {
      continue;
    }

    map.set(
      item.currency,
      (
        map.get(
          item.currency,
        ) ??
        0
      ) +
        item.amount,
    );
  }

  return Array.from(
    map.entries(),
  )
    .map(
      ([
        currency,
        outstanding,
      ]) => ({
        currency,

        outstanding:
          Math.round(
            outstanding *
              100,
          ) /
          100,
      }),
    )
    .sort(
      (
        a,
        b,
      ) =>
        a.currency.localeCompare(
          b.currency,
        ),
    );
}

export async function loadCheckoutFinalBilling(
  tenancyId:
    string,
): Promise<
  CheckoutFinalBillingSummary
> {
  const client =
    requireSupabase();

  const [
    previewResult,
    checkoutResult,
    balanceResult,
  ] =
    await Promise.all([
      client.rpc(
        'get_checkout_final_bill_preview',
        {
          p_tenancy_id:
            tenancyId,
        },
      ),

      client
        .from(
          'tenancy_checkouts',
        )
        .select(
          [
            'checkout_date',
            'status',
            'final_invoice_ids',
            'final_billing_generated_at',
          ].join(
            ',',
          ),
        )
        .eq(
          'tenancy_id',
          tenancyId,
        )
        .maybeSingle(),

      client
        .from(
          'invoices',
        )
        .select(
          [
            'base_currency',
            'base_balance_amount',
            'status',
          ].join(
            ',',
          ),
        )
        .eq(
          'tenancy_id',
          tenancyId,
        )
        .neq(
          'status',
          'VOID',
        ),
    ]);

  if (
    previewResult.error
  ) {
    throw previewResult.error;
  }

  if (
    checkoutResult.error
  ) {
    throw checkoutResult.error;
  }

  if (
    balanceResult.error
  ) {
    throw balanceResult.error;
  }

  const previewRows =
    (
      previewResult.data ??
      []
    ) as unknown as
      PreviewRow[];

  const checkout =
    (
      checkoutResult.data ??
      null
    ) as unknown as
      CheckoutRow | null;

  const balanceRows =
    (
      balanceResult.data ??
      []
    ) as unknown as
      InvoiceBalanceRow[];

  const lines:
    CheckoutFinalBillLine[] =
    previewRows.map(
      row => ({
        meterRegisterId:
          String(
            row.meter_register_id,
          ),

        meterId:
          String(
            row.meter_id,
          ),

        propertyServiceId:
          row.property_service_id ??
          undefined,

        serviceName:
          row.service_name,

        registerCode:
          row.register_code,

        registerName:
          row.register_name,

        unit:
          row.unit,

        previousValue:
          numberValue(
            row.previous_value,
          ),

        finalValue:
          numberValue(
            row.final_value,
          ),

        consumption:
          numberValue(
            row.consumption,
          ),

        unitPrice:
          numberValue(
            row.unit_price,
          ),

        currencyCode:
          row.currency_code ??
          undefined,

        amount:
          numberValue(
            row.amount,
          ),

        ready:
          Boolean(
            row.is_ready,
          ),

        issue:
          row.issue ??
          undefined,
      }),
    );

  const totals =
    aggregate(
      lines.map(
        line => ({
          currency:
            line.currencyCode,

          amount:
            line.amount,
        }),
      ),
    );

  const existingOutstanding =
    aggregate(
      balanceRows.map(
        row => ({
          currency:
            row.base_currency,

          amount:
            numberValue(
              row.base_balance_amount,
            ) ??
            0,
        }),
      ),
    );

  const finalInvoiceIds =
    checkout
      ?.final_invoice_ids ??
    [];

  let invoices:
    CheckoutGeneratedInvoice[] =
    [];

  if (
    finalInvoiceIds.length >
    0
  ) {
    const {
      data:
        invoiceData,

      error:
        invoiceError,
    } =
      await client
        .from(
          'invoices',
        )
        .select(
          [
            'id',
            'base_currency',
            'base_total_amount',
          ].join(
            ',',
          ),
        )
        .in(
          'id',
          finalInvoiceIds,
        );

    if (
      invoiceError
    ) {
      throw invoiceError;
    }

    const invoiceRows =
      (
        invoiceData ??
        []
      ) as unknown as
        GeneratedInvoiceRow[];

    invoices =
      invoiceRows.map(
        row => ({
          id:
            row.id,

          currency:
            row.base_currency,

          total:
            numberValue(
              row.base_total_amount,
            ) ??
            0,
        }),
      );
  }

  return {
    checkoutDate:
      checkout
        ?.checkout_date ??
      undefined,

    checkoutStatus:
      checkout
        ?.status,

    generatedAt:
      checkout
        ?.final_billing_generated_at ??
      undefined,

    lines,

    totals,

    existingOutstanding,

    invoices,

    ready:
      lines.every(
        line =>
          line.ready,
      ),
  };
}

export async function generateCheckoutFinalInvoice(
  tenancyId:
    string,
): Promise<
  CheckoutGeneratedInvoice[]
> {
  const client =
    requireSupabase();

  const {
    data,
    error,
  } =
    await client.rpc(
      'generate_checkout_final_invoice',
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
      GeneratedRpcRow[];

  return rows.map(
    row => ({
      id:
        String(
          row.invoice_id,
        ),

      currency:
        String(
          row.currency_code,
        ),

      total:
        numberValue(
          row.total_amount,
        ) ??
        0,
    }),
  );
}