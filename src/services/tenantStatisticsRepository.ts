import {
  supabase,
} from '../lib/supabase';

import {
  TenantApartmentPortal,
} from './tenantPortalRepository';

export interface TenantExpenseBucket {
  currency: string;
  total: number;
  rent: number;
  utilities: number;
  other: number;
}

export interface TenantApartmentExpense {
  tenancyId: string;
  propertyId: string;
  propertyName: string;
  currency: string;
  total: number;
  rent: number;
  utilities: number;
  other: number;
}

export interface TenantExpenseHistoryItem {
  period: string;
  currency: string;
  total: number;
  rent: number;
  utilities: number;
  other: number;
}

export interface TenantExpenseStatistics {
  currentPeriod: string;
  current: TenantExpenseBucket[];
  apartments: TenantApartmentExpense[];
  history: TenantExpenseHistoryItem[];
}

interface InvoiceRow {
  id: string;
  property_id: string;
  tenancy_id: string;
  billing_period: string;
  status: string;
  base_currency: string;
  base_total_amount:
    number |
    string;
}

interface InvoiceLineRow {
  invoice_id: string;
  line_type: string;
  base_amount:
    number |
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
    number |
    string |
    null |
    undefined,
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

function periodKey(
  value:
    string,
) {
  const match =
    value.match(
      /^(\d{4})-(\d{2})/,
    );

  return match
    ? `${match[1]}-${match[2]}`
    : value;
}

function datePeriod(
  date:
    Date,
) {
  return `${date.getFullYear()}-${String(
    date.getMonth() + 1,
  ).padStart(
    2,
    '0',
  )}`;
}

function firstDay(
  date:
    Date,
) {
  return `${date.getFullYear()}-${String(
    date.getMonth() + 1,
  ).padStart(
    2,
    '0',
  )}-01`;
}

function addMonths(
  date:
    Date,

  delta:
    number,
) {
  return new Date(
    date.getFullYear(),
    date.getMonth() +
      delta,
    1,
  );
}

function emptyBucket(
  currency:
    string,
): TenantExpenseBucket {
  return {
    currency,
    total:
      0,
    rent:
      0,
    utilities:
      0,
    other:
      0,
  };
}

function addLineAmount(
  bucket:
    TenantExpenseBucket,

  lineType:
    string,

  amount:
    number,
) {
  if (
    lineType ===
    'RENT'
  ) {
    bucket.rent +=
      amount;

    return;
  }

  if (
    lineType ===
      'UTILITY' ||
    lineType ===
      'FIXED_CHARGE'
  ) {
    bucket.utilities +=
      amount;

    return;
  }

  bucket.other +=
    amount;
}

export async function loadTenantExpenseStatistics(
  apartments:
    TenantApartmentPortal[],

  now =
    new Date(),
): Promise<
  TenantExpenseStatistics
> {
  if (
    apartments.length ===
    0
  ) {
    return {
      currentPeriod:
        datePeriod(
          now,
        ),

      current:
        [],

      apartments:
        [],

      history:
        [],
    };
  }

  const client =
    requireSupabase();

  const tenancyIds =
    apartments.map(
      apartment =>
        apartment.tenancyId,
    );

  const start =
    addMonths(
      new Date(
        now.getFullYear(),
        now.getMonth(),
        1,
      ),

      -5,
    );

  const end =
    addMonths(
      new Date(
        now.getFullYear(),
        now.getMonth(),
        1,
      ),

      1,
    );

  const invoiceResult =
    await client
      .from(
        'invoices',
      )
      .select(
        [
          'id',
          'property_id',
          'tenancy_id',
          'billing_period',
          'status',
          'base_currency',
          'base_total_amount',
        ].join(
          ',',
        ),
      )
      .in(
        'tenancy_id',
        tenancyIds,
      )
      .neq(
        'status',
        'DRAFT',
      )
      .gte(
        'billing_period',
        firstDay(
          start,
        ),
      )
      .lt(
        'billing_period',
        firstDay(
          end,
        ),
      )
      .order(
        'billing_period',
        {
          ascending:
            true,
        },
      );

  if (
    invoiceResult.error
  ) {
    throw invoiceResult.error;
  }

  const invoices =
    (
      invoiceResult.data ??
      []
    ) as unknown as
      InvoiceRow[];

  if (
    invoices.length ===
    0
  ) {
    return {
      currentPeriod:
        datePeriod(
          now,
        ),

      current:
        [],

      apartments:
        [],

      history:
        [],
    };
  }

  const invoiceIds =
    invoices.map(
      invoice =>
        invoice.id,
    );

  const lineResult =
    await client
      .from(
        'invoice_lines',
      )
      .select(
        [
          'invoice_id',
          'line_type',
          'base_amount',
        ].join(
          ',',
        ),
      )
      .in(
        'invoice_id',
        invoiceIds,
      );

  if (
    lineResult.error
  ) {
    throw lineResult.error;
  }

  const lines =
    (
      lineResult.data ??
      []
    ) as unknown as
      InvoiceLineRow[];

  const linesByInvoice =
    new Map<
      string,
      InvoiceLineRow[]
    >();

  for (
    const line
    of lines
  ) {
    const existing =
      linesByInvoice.get(
        line.invoice_id,
      ) ??
      [];

    existing.push(
      line,
    );

    linesByInvoice.set(
      line.invoice_id,
      existing,
    );
  }

  const currentPeriod =
    datePeriod(
      now,
    );

  const currentMap =
    new Map<
      string,
      TenantExpenseBucket
    >();

  const apartmentMap =
    new Map<
      string,
      TenantApartmentExpense
    >();

  const historyMap =
    new Map<
      string,
      TenantExpenseHistoryItem
    >();

  const apartmentByTenancy =
    new Map(
      apartments.map(
        apartment => [
          apartment.tenancyId,
          apartment,
        ],
      ),
    );

  for (
    const invoice
    of invoices
  ) {
    const currency =
      invoice.base_currency;

    const period =
      periodKey(
        invoice.billing_period,
      );

    const total =
      asNumber(
        invoice.base_total_amount,
      );

    const invoiceLines =
      linesByInvoice.get(
        invoice.id,
      ) ??
      [];

    const lineBucket =
      emptyBucket(
        currency,
      );

    for (
      const line
      of invoiceLines
    ) {
      addLineAmount(
        lineBucket,
        line.line_type,
        asNumber(
          line.base_amount,
        ),
      );
    }

    /*
     * Use invoice.base_total_amount as the total source of truth.
     * The category breakdown is built from invoice lines.
     */
    lineBucket.total =
      total;

    if (
      period ===
      currentPeriod
    ) {
      const current =
        currentMap.get(
          currency,
        ) ??
        emptyBucket(
          currency,
        );

      current.total +=
        lineBucket.total;

      current.rent +=
        lineBucket.rent;

      current.utilities +=
        lineBucket.utilities;

      current.other +=
        lineBucket.other;

      currentMap.set(
        currency,
        current,
      );

      const apartment =
        apartmentByTenancy.get(
          invoice.tenancy_id,
        );

      if (
        apartment
      ) {
        const key =
          `${invoice.tenancy_id}:${currency}`;

        const apartmentExpense =
          apartmentMap.get(
            key,
          ) ??
          {
            tenancyId:
              apartment.tenancyId,

            propertyId:
              apartment.propertyId,

            propertyName:
              apartment.propertyName,

            currency,

            total:
              0,

            rent:
              0,

            utilities:
              0,

            other:
              0,
          };

        apartmentExpense.total +=
          lineBucket.total;

        apartmentExpense.rent +=
          lineBucket.rent;

        apartmentExpense.utilities +=
          lineBucket.utilities;

        apartmentExpense.other +=
          lineBucket.other;

        apartmentMap.set(
          key,
          apartmentExpense,
        );
      }
    }

    const historyKey =
      `${period}:${currency}`;

    const history =
      historyMap.get(
        historyKey,
      ) ??
      {
        period,

        currency,

        total:
          0,

        rent:
          0,

        utilities:
          0,

        other:
          0,
      };

    history.total +=
      lineBucket.total;

    history.rent +=
      lineBucket.rent;

    history.utilities +=
      lineBucket.utilities;

    history.other +=
      lineBucket.other;

    historyMap.set(
      historyKey,
      history,
    );
  }

  return {
    currentPeriod,

    current:
      Array.from(
        currentMap.values(),
      ).sort(
        (
          a,
          b,
        ) =>
          a.currency.localeCompare(
            b.currency,
          ),
      ),

    apartments:
      Array.from(
        apartmentMap.values(),
      ).sort(
        (
          a,
          b,
        ) =>
          b.total -
          a.total,
      ),

    history:
      Array.from(
        historyMap.values(),
      ).sort(
        (
          a,
          b,
        ) =>
          a.period.localeCompare(
            b.period,
          ) ||
          a.currency.localeCompare(
            b.currency,
          ),
      ),
  };
}