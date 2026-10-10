import {
  supabase,
} from '../lib/supabase';

export type TenantMonthlyBillState =
  | 'PAID'
  | 'PARTIALLY_PAID'
  | 'OVERDUE'
  | 'PENDING';

export interface TenantMonthlyBillTotal {
  currency: string;
  amount: number;
}

export interface TenantMonthlyBillSummary {
  billingPeriod: string;
  invoiceIds: string[];
  dueDate?: string;
  paymentState: TenantMonthlyBillState;
  totals: TenantMonthlyBillTotal[];
}

interface InvoiceRow {
  id: string;
  tenancy_id: string;
  billing_period: string;
  due_date: string | null;
  status: string;
  base_currency: string;
  base_total_amount: number | string;
  base_balance_amount: number | string;
}

interface InvoiceLineRow {
  invoice_id: string;
  amount: number | string;
  currency_code: string;
}

interface MonthAccumulator {
  billingPeriod: string;
  invoiceIds: string[];
  dueDates: string[];
  states: TenantMonthlyBillState[];
  totals: Map<string, number>;
}

function requireSupabase() {
  if (!supabase) {
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
) {
  if (
    value === null ||
    value === undefined
  ) {
    return 0;
  }

  const parsed =
    Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : 0;
}

function dateKey(
  value: string,
) {
  const match =
    value.match(
      /^(\d{4})-(\d{2})/,
    );

  return match
    ? `${match[1]}-${match[2]}`
    : value;
}

function todayKey() {
  const now =
    new Date();

  return `${now.getFullYear()}-${String(
    now.getMonth() + 1,
  ).padStart(
    2,
    '0',
  )}-${String(
    now.getDate(),
  ).padStart(
    2,
    '0',
  )}`;
}

function invoicePaymentState(
  invoice:
    InvoiceRow,
): TenantMonthlyBillState {
  const balance =
    numberValue(
      invoice.base_balance_amount,
    );

  if (
    invoice.status ===
      'PAID' ||
    balance <=
      0.009
  ) {
    return 'PAID';
  }

  if (
    invoice.status ===
    'PARTIALLY_PAID'
  ) {
    return 'PARTIALLY_PAID';
  }

  if (
    invoice.status ===
    'OVERDUE'
  ) {
    return 'OVERDUE';
  }

  if (
    invoice.due_date &&
    invoice.due_date <
      todayKey()
  ) {
    return 'OVERDUE';
  }

  return 'PENDING';
}

function monthPaymentState(
  states:
    TenantMonthlyBillState[],
): TenantMonthlyBillState {
  if (
    states.length ===
    0
  ) {
    return 'PENDING';
  }

  if (
    states.every(
      state =>
        state ===
        'PAID',
    )
  ) {
    return 'PAID';
  }

  if (
    states.some(
      state =>
        state ===
        'OVERDUE',
    )
  ) {
    return 'OVERDUE';
  }

  if (
    states.some(
      state =>
        state ===
          'PARTIALLY_PAID' ||
        state ===
          'PAID',
    )
  ) {
    return 'PARTIALLY_PAID';
  }

  return 'PENDING';
}

function currencyOrder(
  value: string,
) {
  switch (
    value.toUpperCase()
  ) {
    case 'UAH':
      return 0;

    case 'USD':
      return 1;

    case 'EUR':
      return 2;

    default:
      return 10;
  }
}

function sortTotals(
  totals:
    TenantMonthlyBillTotal[],
) {
  return [...totals].sort(
    (
      a,
      b,
    ) => {
      const rank =
        currencyOrder(
          a.currency,
        ) -
        currencyOrder(
          b.currency,
        );

      if (
        rank !==
        0
      ) {
        return rank;
      }

      return a.currency.localeCompare(
        b.currency,
      );
    },
  );
}

function addAmount(
  totals:
    Map<
      string,
      number
    >,
  currency:
    string,
  amount:
    number,
) {
  const normalizedCurrency =
    currency.toUpperCase();

  totals.set(
    normalizedCurrency,
    (
      totals.get(
        normalizedCurrency,
      ) ??
      0
    ) +
      amount,
  );
}

export async function loadTenantMonthlyBills(
  tenancyId:
    string,
  limit = 12,
): Promise<
  TenantMonthlyBillSummary[]
> {
  if (
    !tenancyId
  ) {
    return [];
  }

  const client =
    requireSupabase();

  /*
   * More than `limit` invoices are loaded because checkout /
   * adjustment flows may create several invoices belonging to
   * the same calendar month.
   *
   * They are merged into one monthly card below.
   */
  const invoiceLimit =
    Math.max(
      limit * 3,
      limit,
    );

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
          'tenancy_id',
          'billing_period',
          'due_date',
          'status',
          'base_currency',
          'base_total_amount',
          'base_balance_amount',
        ].join(','),
      )
      .eq(
        'tenancy_id',
        tenancyId,
      )
      .neq(
        'status',
        'VOID',
      )
      .order(
        'billing_period',
        {
          ascending:
            false,
        },
      )
      .limit(
        invoiceLimit,
      );

  if (
    invoiceError
  ) {
    throw invoiceError;
  }

  const invoices =
    (
      invoiceData ??
      []
    ) as unknown as InvoiceRow[];

  if (
    invoices.length ===
    0
  ) {
    return [];
  }

  const invoiceIds =
    invoices.map(
      invoice =>
        invoice.id,
    );

  const {
    data:
      lineData,
    error:
      lineError,
  } =
    await client
      .from(
        'invoice_lines',
      )
      .select(
        [
          'invoice_id',
          'amount',
          'currency_code',
        ].join(','),
      )
      .in(
        'invoice_id',
        invoiceIds,
      );

  if (
    lineError
  ) {
    throw lineError;
  }

  const lines =
    (
      lineData ??
      []
    ) as unknown as InvoiceLineRow[];

  const lineTotalsByInvoice =
    new Map<
      string,
      Map<
        string,
        number
      >
    >();

  for (
    const line
    of lines
  ) {
    let totals =
      lineTotalsByInvoice.get(
        line.invoice_id,
      );

    if (
      !totals
    ) {
      totals =
        new Map<
          string,
          number
        >();

      lineTotalsByInvoice.set(
        line.invoice_id,
        totals,
      );
    }

    addAmount(
      totals,
      String(
        line.currency_code,
      ),
      numberValue(
        line.amount,
      ),
    );
  }

  const months =
    new Map<
      string,
      MonthAccumulator
    >();

  for (
    const invoice
    of invoices
  ) {
    const month =
      dateKey(
        invoice.billing_period,
      );

    let accumulator =
      months.get(
        month,
      );

    if (
      !accumulator
    ) {
      accumulator = {
        billingPeriod:
          invoice.billing_period,

        invoiceIds:
          [],

        dueDates:
          [],

        states:
          [],

        totals:
          new Map<
            string,
            number
          >(),
      };

      months.set(
        month,
        accumulator,
      );
    }

    accumulator.invoiceIds.push(
      invoice.id,
    );

    accumulator.states.push(
      invoicePaymentState(
        invoice,
      ),
    );

    if (
      invoice.due_date
    ) {
      accumulator.dueDates.push(
        invoice.due_date,
      );
    }

    const invoiceLineTotals =
      lineTotalsByInvoice.get(
        invoice.id,
      );

    if (
      invoiceLineTotals &&
      invoiceLineTotals.size >
        0
    ) {
      for (
        const [
          currency,
          amount,
        ]
        of invoiceLineTotals.entries()
      ) {
        addAmount(
          accumulator.totals,
          currency,
          amount,
        );
      }
    } else {
      addAmount(
        accumulator.totals,
        invoice.base_currency,
        numberValue(
          invoice.base_total_amount,
        ),
      );
    }
  }

  return Array.from(
    months.values(),
  )
    .sort(
      (
        a,
        b,
      ) =>
        b.billingPeriod.localeCompare(
          a.billingPeriod,
        ),
    )
    .slice(
      0,
      limit,
    )
    .map(
      month => ({
        billingPeriod:
          month.billingPeriod,

        invoiceIds:
          month.invoiceIds,

        dueDate:
          month.dueDates.length >
          0
            ? [...month.dueDates].sort()[0]
            : undefined,

        paymentState:
          monthPaymentState(
            month.states,
          ),

        totals:
          sortTotals(
            Array.from(
              month.totals.entries(),
            ).map(
              (
                [
                  currency,
                  amount,
                ],
              ) => ({
                currency,

                amount:
                  Math.round(
                    amount *
                      100,
                  ) /
                  100,
              }),
            ),
          ),
      }),
    );
}