import {
  supabase,
} from '../lib/supabase';

import {
  CurrencyCode,
  PaymentMethod,
} from '../types';

export interface FinanceMoneyBucket {
  currency:
    CurrencyCode;

  amount:
    number;
}

export interface LandlordFinanceOverview {
  currency:
    CurrencyCode;

  expectedThisMonth:
    number;

  receivedThisMonth:
    number;

  outstanding:
    number;

  advance:
    number;

  collectionRate:
    number;

  debtTenancies:
    number;

  forecastByCurrency:
    FinanceMoneyBucket[];

  financeAvailable:
    boolean;
}

export interface TenantFinanceBalance {
  tenancyId:
    string;

  currency?:
    CurrencyCode;

  outstanding:
    number;

  advance:
    number;

  openInvoices:
    number;
}

export interface FinanceInvoiceSummary {
  id:
    string;

  workspaceId:
    string;

  propertyId:
    string;

  tenancyId:
    string;

  invoiceNumber:
    string;

  billingPeriod:
    string;

  issueDate:
    string;

  dueDate?:
    string;

  status:
    string;

  baseCurrency:
    CurrencyCode;

  total:
    number;

  paid:
    number;

  balance:
    number;

  createdAt:
    string;
}

export interface FinanceInvoiceLine {
  id:
    string;

  type:
    string;

  description:
    string;

  quantity?:
    number;

  unit?:
    string;

  unitPrice?:
    number;

  amount:
    number;

  currency:
    CurrencyCode;

  fxRateToBase:
    number;

  baseAmount:
    number;
}

export interface FinanceInvoiceDetails
  extends FinanceInvoiceSummary {
  lines:
    FinanceInvoiceLine[];
}

export interface FinancePayment {
  id:
    string;

  workspaceId:
    string;

  tenancyId:
    string;

  amount:
    number;

  currency:
    CurrencyCode;

  baseCurrency:
    CurrencyCode;

  fxRateToBase:
    number;

  baseAmount:
    number;

  paymentDate:
    string;

  method:
    PaymentMethod;

  reference?:
    string;

  note?:
    string;

  allocatedBaseAmount:
    number;

  advanceBaseAmount:
    number;

  createdAt:
    string;
}

export interface RecordPaymentInput {
  propertyId:
    string;

  amount:
    number;

  currency:
    CurrencyCode;

  method:
    PaymentMethod;

  paymentDate?:
    string;

  note?:
    string;

  reference?:
    string;

  fxRateToBase?:
    number;
}

interface InvoiceRow {
  id:
    string;

  workspace_id:
    string;

  property_id:
    string;

  tenancy_id:
    string;

  invoice_number:
    string;

  billing_period:
    string;

  issue_date:
    string;

  due_date:
    string | null;

  status:
    string;

  base_currency:
    string;

  base_total_amount:
    number |
    string |
    null;

  base_paid_amount:
    number |
    string |
    null;

  base_balance_amount:
    number |
    string |
    null;

  created_at:
    string;
}

interface InvoiceLineRow {
  id:
    string;

  line_type:
    string;

  description_snapshot:
    string;

  quantity:
    number |
    string |
    null;

  unit:
    string |
    null;

  unit_price:
    number |
    string |
    null;

  amount:
    number |
    string |
    null;

  currency_code:
    string;

  fx_rate_to_base:
    number |
    string |
    null;

  base_amount:
    number |
    string |
    null;
}

interface PaymentRow {
  id:
    string;

  workspace_id:
    string;

  tenancy_id:
    string;

  amount:
    number |
    string |
    null;

  currency_code:
    string;

  base_currency:
    string;

  fx_rate_to_base:
    number |
    string |
    null;

  base_amount:
    number |
    string |
    null;

  payment_date:
    string;

  method:
    PaymentMethod;

  reference:
    string |
    null;

  note:
    string |
    null;

  created_at:
    string;
}

interface AllocationRow {
  payment_id:
    string;

  base_amount:
    number |
    string |
    null;
}

interface RentRow {
  tenancy_id:
    string;

  rent_amount:
    number |
    string |
    null;

  currency_code:
    string;
}

function requireSupabase() {
  if (
    !supabase
  ) {
    throw new Error(
      'Supabase is not configured.',
    );
  }

  return supabase;
}

function asNumber(
  value:
    unknown,
) {
  const parsed =
    Number(
      value ??
      0,
    );

  return Number.isFinite(
    parsed,
  )
    ? parsed
    : 0;
}

function optionalNumber(
  value:
    unknown,
) {
  if (
    value === null ||
    value === undefined ||
    value === ''
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

function asCurrency(
  value:
    unknown,

  fallback:
    CurrencyCode =
      'UAH',
): CurrencyCode {
  const normalized =
    String(
      value ??
      '',
    ).toUpperCase();

  if (
    normalized ===
      'UAH' ||
    normalized ===
      'USD' ||
    normalized ===
      'EUR'
  ) {
    return normalized;
  }

  return fallback;
}

function currentMonthRange(
  timezone:
    string,
) {
  const parts =
    new Intl.DateTimeFormat(
      'en-US',

      {
        timeZone:
          timezone,

        year:
          'numeric',

        month:
          '2-digit',
      },
    )
      .formatToParts(
        new Date(),
      );

  const year =
    Number(
      parts.find(
        part =>
          part.type ===
          'year',
      )?.value,
    );

  const month =
    Number(
      parts.find(
        part =>
          part.type ===
          'month',
      )?.value,
    );

  const start =
    `${year}-${String(
      month,
    ).padStart(
      2,
      '0',
    )}-01`;

  let nextYear =
    year;

  let nextMonth =
    month +
    1;

  if (
    nextMonth >
    12
  ) {
    nextMonth =
      1;

    nextYear +=
      1;
  }

  const end =
    `${nextYear}-${String(
      nextMonth,
    ).padStart(
      2,
      '0',
    )}-01`;

  return {
    start,
    end,
  };
}

function todayDate() {
  const now =
    new Date();

  const year =
    now.getFullYear();

  const month =
    String(
      now.getMonth() +
        1,
    ).padStart(
      2,
      '0',
    );

  const day =
    String(
      now.getDate(),
    ).padStart(
      2,
      '0',
    );

  return `${year}-${month}-${day}`;
}

function isOpenDebtInvoice(
  status:
    string,
) {
  return (
    status ===
      'ISSUED' ||
    status ===
      'PARTIALLY_PAID' ||
    status ===
      'OVERDUE'
  );
}

function isMissingTableError(
  error:
    any,
) {
  return (
    error?.code ===
      '42P01' ||
    error?.code ===
      'PGRST205'
  );
}

function mapInvoice(
  row:
    InvoiceRow,
): FinanceInvoiceSummary {
  return {
    id:
      row.id,

    workspaceId:
      row.workspace_id,

    propertyId:
      row.property_id,

    tenancyId:
      row.tenancy_id,

    invoiceNumber:
      row.invoice_number,

    billingPeriod:
      row.billing_period,

    issueDate:
      row.issue_date,

    dueDate:
      row.due_date ??
      undefined,

    status:
      row.status,

    baseCurrency:
      asCurrency(
        row.base_currency,
      ),

    total:
      asNumber(
        row.base_total_amount,
      ),

    paid:
      asNumber(
        row.base_paid_amount,
      ),

    balance:
      asNumber(
        row.base_balance_amount,
      ),

    createdAt:
      row.created_at,
  };
}

async function loadAllocations(
  paymentIds:
    string[],
) {
  if (
    paymentIds.length ===
    0
  ) {
    return [] as AllocationRow[];
  }

  const client =
    requireSupabase();

  const result:
    AllocationRow[] =
    [];

  for (
    let offset = 0;
    offset <
    paymentIds.length;
    offset += 100
  ) {
    const chunk =
      paymentIds.slice(
        offset,
        offset +
          100,
      );

    const {
      data,
      error,
    } =
      await client
        .from(
          'payment_allocations',
        )
        .select(
          [
            'payment_id',
            'base_amount',
          ].join(
            ',',
          ),
        )
        .in(
          'payment_id',
          chunk,
        );

    if (
      error
    ) {
      if (
        isMissingTableError(
          error,
        )
      ) {
        return [];
      }

      throw error;
    }

    result.push(
      ...(
        (
          data ??
          []
        ) as AllocationRow[]
      ),
    );
  }

  return result;
}

async function loadRentForecast(
  propertyIds:
    string[],
) {
  if (
    propertyIds.length ===
    0
  ) {
    return [] as FinanceMoneyBucket[];
  }

  const client =
    requireSupabase();

  const {
    data:
      tenancyData,
    error:
      tenancyError,
  } =
    await client
      .from(
        'tenancies',
      )
      .select(
        'id',
      )
      .in(
        'property_id',
        propertyIds,
      )
      .in(
        'status',
        [
          'ACTIVE',
          'CHECKOUT_PENDING',
        ],
      );

  if (
    tenancyError
  ) {
    throw tenancyError;
  }

  const tenancyIds =
    (
      tenancyData ??
      []
    )
      .map(
        row =>
          String(
            row.id,
          ),
      );

  if (
    tenancyIds.length ===
    0
  ) {
    return [];
  }

  const {
    data:
      rentData,
    error:
      rentError,
  } =
    await client
      .from(
        'rent_terms',
      )
      .select(
        [
          'tenancy_id',
          'rent_amount',
          'currency_code',
        ].join(
          ',',
        ),
      )
      .in(
        'tenancy_id',
        tenancyIds,
      )
      .is(
        'valid_to',
        null,
      );

  if (
    rentError
  ) {
    throw rentError;
  }

  const totals =
    new Map<
      CurrencyCode,
      number
    >();

  for (
    const row
    of (
      (
        rentData ??
        []
      ) as RentRow[]
    )
  ) {
    const currency =
      asCurrency(
        row.currency_code,
      );

    totals.set(
      currency,

      (
        totals.get(
          currency,
        ) ??
        0
      ) +
        asNumber(
          row.rent_amount,
        ),
    );
  }

  return Array.from(
    totals.entries(),
  )
    .map(
      ([
        currency,
        amount,
      ]) => ({
        currency,
        amount,
      }),
    )
    .sort(
      (
        first,
        second,
      ) =>
        second.amount -
        first.amount,
    );
}

export async function generateMonthlyInvoice(
  propertyId:
    string,

  billingPeriod?:
    string,
): Promise<FinanceInvoiceSummary> {
  const client =
    requireSupabase();

  const {
    data,
    error,
  } =
    await client.rpc(
      'generate_monthly_invoice_v1',

      {
        p_property_id:
          propertyId,

        p_billing_period:
          billingPeriod ??
          null,
      },
    );

  if (
    error
  ) {
    throw error;
  }

  const invoiceId =
    String(
      data,
    );

  return loadInvoiceSummary(
    invoiceId,
  );
}

export async function loadInvoiceSummary(
  invoiceId:
    string,
): Promise<FinanceInvoiceSummary> {
  const client =
    requireSupabase();

  const {
    data,
    error,
  } =
    await client
      .from(
        'invoices',
      )
      .select(
        [
          'id',
          'workspace_id',
          'property_id',
          'tenancy_id',
          'invoice_number',
          'billing_period',
          'issue_date',
          'due_date',
          'status',
          'base_currency',
          'base_total_amount',
          'base_paid_amount',
          'base_balance_amount',
          'created_at',
        ].join(
          ',',
        ),
      )
      .eq(
        'id',
        invoiceId,
      )
      .single();

  if (
    error
  ) {
    throw error;
  }

  return mapInvoice(
    data as InvoiceRow,
  );
}

export async function loadInvoiceDetails(
  invoiceId:
    string,
): Promise<FinanceInvoiceDetails> {
  const client =
    requireSupabase();

  const [
    invoice,
    lineResult,
  ] =
    await Promise.all([
      loadInvoiceSummary(
        invoiceId,
      ),

      client
        .from(
          'invoice_lines',
        )
        .select(
          [
            'id',
            'line_type',
            'description_snapshot',
            'quantity',
            'unit',
            'unit_price',
            'amount',
            'currency_code',
            'fx_rate_to_base',
            'base_amount',
          ].join(
            ',',
          ),
        )
        .eq(
          'invoice_id',
          invoiceId,
        )
        .order(
          'sort_order',
          {
            ascending:
              true,
          },
        ),
    ]);

  if (
    lineResult.error
  ) {
    throw lineResult.error;
  }

  const lines =
    (
      lineResult.data ??
      []
    )
      .map(
        row => {
          const line =
            row as InvoiceLineRow;

          return {
            id:
              line.id,

            type:
              line.line_type,

            description:
              line.description_snapshot,

            quantity:
              optionalNumber(
                line.quantity,
              ),

            unit:
              line.unit ??
              undefined,

            unitPrice:
              optionalNumber(
                line.unit_price,
              ),

            amount:
              asNumber(
                line.amount,
              ),

            currency:
              asCurrency(
                line.currency_code,
              ),

            fxRateToBase:
              asNumber(
                line.fx_rate_to_base,
              ),

            baseAmount:
              asNumber(
                line.base_amount,
              ),
          };
        },
      );

  return {
    ...invoice,
    lines,
  };
}

export async function loadPropertyInvoices(
  propertyId:
    string,
): Promise<FinanceInvoiceSummary[]> {
  const client =
    requireSupabase();

  const {
    data,
    error,
  } =
    await client
      .from(
        'invoices',
      )
      .select(
        [
          'id',
          'workspace_id',
          'property_id',
          'tenancy_id',
          'invoice_number',
          'billing_period',
          'issue_date',
          'due_date',
          'status',
          'base_currency',
          'base_total_amount',
          'base_paid_amount',
          'base_balance_amount',
          'created_at',
        ].join(
          ',',
        ),
      )
      .eq(
        'property_id',
        propertyId,
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
      );

  if (
    error
  ) {
    if (
      isMissingTableError(
        error,
      )
    ) {
      return [];
    }

    throw error;
  }

  return (
    (
      data ??
      []
    ) as InvoiceRow[]
  )
    .map(
      mapInvoice,
    );
}

export async function recordPayment(
  input:
    RecordPaymentInput,
): Promise<FinancePayment> {
  const client =
    requireSupabase();

  if (
    !Number.isFinite(
      input.amount,
    ) ||
    input.amount <=
      0
  ) {
    throw new Error(
      'Payment amount must be greater than zero.',
    );
  }

  const {
    data,
    error,
  } =
    await client.rpc(
      'record_property_payment_v1',

      {
        p_property_id:
          input.propertyId,

        p_amount:
          input.amount,

        p_currency_code:
          input.currency,

        p_method:
          input.method,

        p_payment_date:
          input.paymentDate ??
          todayDate(),

        p_note:
          input.note?.trim() ||
          null,

        p_reference:
          input.reference?.trim() ||
          null,

        p_fx_rate_to_base:
          input.fxRateToBase ??
          null,
      },
    );

  if (
    error
  ) {
    throw error;
  }

  return loadPayment(
    String(
      data,
    ),
  );
}

export async function loadPayment(
  paymentId:
    string,
): Promise<FinancePayment> {
  const client =
    requireSupabase();

  const {
    data,
    error,
  } =
    await client
      .from(
        'payments',
      )
      .select(
        [
          'id',
          'workspace_id',
          'tenancy_id',
          'amount',
          'currency_code',
          'base_currency',
          'fx_rate_to_base',
          'base_amount',
          'payment_date',
          'method',
          'reference',
          'note',
          'created_at',
        ].join(
          ',',
        ),
      )
      .eq(
        'id',
        paymentId,
      )
      .single();

  if (
    error
  ) {
    throw error;
  }

  const row =
    data as PaymentRow;

  const allocations =
    await loadAllocations([
      row.id,
    ]);

  const allocated =
    allocations.reduce(
      (
        total,
        allocation,
      ) =>
        total +
        asNumber(
          allocation.base_amount,
        ),

      0,
    );

  const baseAmount =
    asNumber(
      row.base_amount,
    );

  return {
    id:
      row.id,

    workspaceId:
      row.workspace_id,

    tenancyId:
      row.tenancy_id,

    amount:
      asNumber(
        row.amount,
      ),

    currency:
      asCurrency(
        row.currency_code,
      ),

    baseCurrency:
      asCurrency(
        row.base_currency,
      ),

    fxRateToBase:
      asNumber(
        row.fx_rate_to_base,
      ),

    baseAmount,

    paymentDate:
      row.payment_date,

    method:
      row.method,

    reference:
      row.reference ??
      undefined,

    note:
      row.note ??
      undefined,

    allocatedBaseAmount:
      allocated,

    advanceBaseAmount:
      Math.max(
        0,
        baseAmount -
          allocated,
      ),

    createdAt:
      row.created_at,
  };
}

export async function loadWorkspacePayments(
  workspaceId:
    string,
): Promise<FinancePayment[]> {
  const client =
    requireSupabase();

  const {
    data,
    error,
  } =
    await client
      .from(
        'payments',
      )
      .select(
        [
          'id',
          'workspace_id',
          'tenancy_id',
          'amount',
          'currency_code',
          'base_currency',
          'fx_rate_to_base',
          'base_amount',
          'payment_date',
          'method',
          'reference',
          'note',
          'created_at',
        ].join(
          ',',
        ),
      )
      .eq(
        'workspace_id',
        workspaceId,
      )
      .order(
        'payment_date',
        {
          ascending:
            false,
        },
      )
      .order(
        'created_at',
        {
          ascending:
            false,
        },
      );

  if (
    error
  ) {
    if (
      isMissingTableError(
        error,
      )
    ) {
      return [];
    }

    throw error;
  }

  const rows =
    (
      data ??
      []
    ) as PaymentRow[];

  const allocations =
    await loadAllocations(
      rows.map(
        row =>
          row.id,
      ),
    );

  const allocationMap =
    new Map<
      string,
      number
    >();

  for (
    const allocation
    of allocations
  ) {
    allocationMap.set(
      allocation.payment_id,

      (
        allocationMap.get(
          allocation.payment_id,
        ) ??
        0
      ) +
        asNumber(
          allocation.base_amount,
        ),
    );
  }

  return rows.map(
    row => {
      const baseAmount =
        asNumber(
          row.base_amount,
        );

      const allocated =
        allocationMap.get(
          row.id,
        ) ??
        0;

      return {
        id:
          row.id,

        workspaceId:
          row.workspace_id,

        tenancyId:
          row.tenancy_id,

        amount:
          asNumber(
            row.amount,
          ),

        currency:
          asCurrency(
            row.currency_code,
          ),

        baseCurrency:
          asCurrency(
            row.base_currency,
          ),

        fxRateToBase:
          asNumber(
            row.fx_rate_to_base,
          ),

        baseAmount,

        paymentDate:
          row.payment_date,

        method:
          row.method,

        reference:
          row.reference ??
          undefined,

        note:
          row.note ??
          undefined,

        allocatedBaseAmount:
          allocated,

        advanceBaseAmount:
          Math.max(
            0,
            baseAmount -
              allocated,
          ),

        createdAt:
          row.created_at,
      };
    },
  );
}

export async function loadLandlordFinanceOverview(
  workspaceId:
    string,

  propertyIds:
    string[],

  baseCurrency:
    CurrencyCode,

  timezone:
    string,
): Promise<LandlordFinanceOverview> {
  const client =
    requireSupabase();

  const {
    start,
    end,
  } =
    currentMonthRange(
      timezone,
    );

  let invoices:
    InvoiceRow[] =
    [];

  let payments:
    PaymentRow[] =
    [];

  let financeAvailable =
    true;

  const [
    invoiceResult,
    paymentResult,
    forecastByCurrency,
  ] =
    await Promise.all([
      client
        .from(
          'invoices',
        )
        .select(
          [
            'id',
            'workspace_id',
            'property_id',
            'tenancy_id',
            'invoice_number',
            'billing_period',
            'issue_date',
            'due_date',
            'status',
            'base_currency',
            'base_total_amount',
            'base_paid_amount',
            'base_balance_amount',
            'created_at',
          ].join(
            ',',
          ),
        )
        .eq(
          'workspace_id',
          workspaceId,
        ),

      client
        .from(
          'payments',
        )
        .select(
          [
            'id',
            'workspace_id',
            'tenancy_id',
            'amount',
            'currency_code',
            'base_currency',
            'fx_rate_to_base',
            'base_amount',
            'payment_date',
            'method',
            'reference',
            'note',
            'created_at',
          ].join(
            ',',
          ),
        )
        .eq(
          'workspace_id',
          workspaceId,
        ),

      loadRentForecast(
        propertyIds,
      ),
    ]);

  if (
    invoiceResult.error
  ) {
    if (
      isMissingTableError(
        invoiceResult.error,
      )
    ) {
      financeAvailable =
        false;
    } else {
      throw invoiceResult.error;
    }
  } else {
    invoices =
      (
        invoiceResult.data ??
        []
      ) as InvoiceRow[];
  }

  if (
    paymentResult.error
  ) {
    if (
      isMissingTableError(
        paymentResult.error,
      )
    ) {
      financeAvailable =
        false;
    } else {
      throw paymentResult.error;
    }
  } else {
    payments =
      (
        paymentResult.data ??
        []
      ) as PaymentRow[];
  }

  const allocations =
    await loadAllocations(
      payments.map(
        payment =>
          payment.id,
      ),
    );

  const allocatedByPayment =
    new Map<
      string,
      number
    >();

  for (
    const allocation
    of allocations
  ) {
    allocatedByPayment.set(
      allocation.payment_id,

      (
        allocatedByPayment.get(
          allocation.payment_id,
        ) ??
        0
      ) +
        asNumber(
          allocation.base_amount,
        ),
    );
  }

  const currentInvoices =
    invoices.filter(
      invoice =>
        invoice.status !==
          'VOID' &&
        invoice.billing_period >=
          start &&
        invoice.billing_period <
          end,
    );

  const expectedThisMonth =
    currentInvoices.reduce(
      (
        total,
        invoice,
      ) =>
        total +
        asNumber(
          invoice.base_total_amount,
        ),

      0,
    );

  const receivedThisMonth =
    payments
      .filter(
        payment =>
          payment.payment_date >=
            start &&
          payment.payment_date <
            end,
      )
      .reduce(
        (
          total,
          payment,
        ) =>
          total +
          asNumber(
            payment.base_amount,
          ),

        0,
      );

  let outstanding =
    0;

  const debtTenancies =
    new Set<
      string
    >();

  for (
    const invoice
    of invoices
  ) {
    if (
      !isOpenDebtInvoice(
        invoice.status,
      )
    ) {
      continue;
    }

    const balance =
      Math.max(
        0,
        asNumber(
          invoice.base_balance_amount,
        ),
      );

    if (
      balance >
      0
    ) {
      outstanding +=
        balance;

      debtTenancies.add(
        invoice.tenancy_id,
      );
    }
  }

  const advance =
    payments.reduce(
      (
        total,
        payment,
      ) => {
        const paymentAmount =
          asNumber(
            payment.base_amount,
          );

        const allocated =
          allocatedByPayment.get(
            payment.id,
          ) ??
          0;

        return (
          total +
          Math.max(
            0,
            paymentAmount -
              allocated,
          )
        );
      },

      0,
    );

  const collectionRate =
    expectedThisMonth >
    0
      ? (
          receivedThisMonth /
          expectedThisMonth
        ) *
        100
      : 0;

  return {
    currency:
      baseCurrency,

    expectedThisMonth,

    receivedThisMonth,

    outstanding,

    advance,

    collectionRate,

    debtTenancies:
      debtTenancies.size,

    forecastByCurrency,

    financeAvailable,
  };
}

export async function loadTenantFinanceBalances(
  tenancyIds:
    string[],
): Promise<TenantFinanceBalance[]> {
  if (
    tenancyIds.length ===
    0
  ) {
    return [];
  }

  const client =
    requireSupabase();

  const [
    invoiceResult,
    paymentResult,
  ] =
    await Promise.all([
      client
        .from(
          'invoices',
        )
        .select(
          [
            'id',
            'workspace_id',
            'property_id',
            'tenancy_id',
            'invoice_number',
            'billing_period',
            'issue_date',
            'due_date',
            'status',
            'base_currency',
            'base_total_amount',
            'base_paid_amount',
            'base_balance_amount',
            'created_at',
          ].join(
            ',',
          ),
        )
        .in(
          'tenancy_id',
          tenancyIds,
        ),

      client
        .from(
          'payments',
        )
        .select(
          [
            'id',
            'workspace_id',
            'tenancy_id',
            'amount',
            'currency_code',
            'base_currency',
            'fx_rate_to_base',
            'base_amount',
            'payment_date',
            'method',
            'reference',
            'note',
            'created_at',
          ].join(
            ',',
          ),
        )
        .in(
          'tenancy_id',
          tenancyIds,
        ),
    ]);

  if (
    invoiceResult.error &&
    !isMissingTableError(
      invoiceResult.error,
    )
  ) {
    throw invoiceResult.error;
  }

  if (
    paymentResult.error &&
    !isMissingTableError(
      paymentResult.error,
    )
  ) {
    throw paymentResult.error;
  }

  const invoices =
    (
      invoiceResult.data ??
      []
    ) as InvoiceRow[];

  const payments =
    (
      paymentResult.data ??
      []
    ) as PaymentRow[];

  const allocations =
    await loadAllocations(
      payments.map(
        payment =>
          payment.id,
      ),
    );

  const allocatedByPayment =
    new Map<
      string,
      number
    >();

  for (
    const allocation
    of allocations
  ) {
    allocatedByPayment.set(
      allocation.payment_id,

      (
        allocatedByPayment.get(
          allocation.payment_id,
        ) ??
        0
      ) +
        asNumber(
          allocation.base_amount,
        ),
    );
  }

  const balances =
    new Map<
      string,
      TenantFinanceBalance
    >();

  for (
    const tenancyId
    of tenancyIds
  ) {
    balances.set(
      tenancyId,

      {
        tenancyId,

        outstanding:
          0,

        advance:
          0,

        openInvoices:
          0,
      },
    );
  }

  for (
    const invoice
    of invoices
  ) {
    const balance =
      balances.get(
        invoice.tenancy_id,
      );

    if (
      !balance
    ) {
      continue;
    }

    balance.currency =
      asCurrency(
        invoice.base_currency,

        balance.currency ??
          'UAH',
      );

    if (
      !isOpenDebtInvoice(
        invoice.status,
      )
    ) {
      continue;
    }

    const amount =
      Math.max(
        0,
        asNumber(
          invoice.base_balance_amount,
        ),
      );

    if (
      amount >
      0
    ) {
      balance.outstanding +=
        amount;

      balance.openInvoices +=
        1;
    }
  }

  for (
    const payment
    of payments
  ) {
    const balance =
      balances.get(
        payment.tenancy_id,
      );

    if (
      !balance
    ) {
      continue;
    }

    balance.currency =
      asCurrency(
        payment.base_currency,

        balance.currency ??
          'UAH',
      );

    const paymentAmount =
      asNumber(
        payment.base_amount,
      );

    const allocated =
      allocatedByPayment.get(
        payment.id,
      ) ??
        0;

    balance.advance +=
      Math.max(
        0,
        paymentAmount -
          allocated,
      );
  }

  return Array.from(
    balances.values(),
  );
}