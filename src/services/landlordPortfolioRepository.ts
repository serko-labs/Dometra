import {
  supabase,
} from '../lib/supabase';

import {
  currentBillingPeriod,
} from './billingRepository';

export type LandlordPaymentState =
  | 'PAID'
  | 'AWAITING'
  | 'PENDING'
  | 'DELAYED'
  | 'VACANT';

export interface LandlordCurrencyTotal {
  currency: string;
  total: number;
}

export interface LandlordPropertyPaymentSummary {
  propertyId: string;
  propertyName: string;
  propertyAddress: string;
  propertyCity: string;
  areaM2: number;
  tenancyId?: string;
  rentAmount?: number;
  rentCurrency?: string;
  paymentDueDay?: number;
  paymentState: LandlordPaymentState;
  billingReady: boolean;
  billingMissingCount: number;
  expectedTotals: LandlordCurrencyTotal[];
}

export interface LandlordCurrencyStatistics {
  currency: string;
  expected: number;
  received: number;
  awaiting: number;
  pending: number;
  debt: number;
  rentForecast: number;
}

export interface LandlordPortfolioStatistics {
  billingPeriod: string;

  properties:
    LandlordPropertyPaymentSummary[];

  currencies:
    LandlordCurrencyStatistics[];

  totalProperties: number;
  occupiedProperties: number;
  vacantProperties: number;

  paidProperties: number;
  awaitingProperties: number;
  pendingProperties: number;
  delayedProperties: number;

  incompleteBills: number;
}

interface PropertyRow {
  id: string;
  title: string;
  street: string;
  city: string;

  area_m2:
    | number
    | string
    | null;
}

interface TenancyRow {
  id: string;
  property_id: string;
  start_date: string;
  end_date: string | null;
}

interface RentTermRow {
  tenancy_id: string;

  rent_amount:
    | number
    | string;

  currency_code: string;

  payment_due_day: number;

  valid_from: string;

  valid_to: string | null;
}

interface PaymentClaimRow {
  tenancy_id: string;

  status:
    | 'REPORTED'
    | 'CONFIRMED';
}

interface InvoiceRow {
  tenancy_id: string;

  base_currency: string;

  base_total_amount:
    | number
    | string;
}

interface BillingPreviewRow {
  amount:
    | number
    | string
    | null;

  currency_code:
    string | null;

  is_ready: boolean;
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
    | number
    | string
    | null
    | undefined,
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

function monthEnd(
  billingPeriod:
    string,
) {
  const date =
    new Date(
      `${billingPeriod}T00:00:00`,
    );

  return new Date(
    date.getFullYear(),
    date.getMonth() + 1,
    0,
  );
}

function isRentTermForPeriod(
  term:
    RentTermRow,

  billingPeriod:
    string,
) {
  const periodStart =
    new Date(
      `${billingPeriod}T00:00:00`,
    );

  const periodEnd =
    monthEnd(
      billingPeriod,
    );

  const validFrom =
    new Date(
      `${term.valid_from}T00:00:00`,
    );

  const validTo =
    term.valid_to
      ? new Date(
          `${term.valid_to}T00:00:00`,
        )
      : null;

  return (
    validFrom.getTime() <=
      periodEnd.getTime() &&
    (
      !validTo ||
      validTo.getTime() >=
        periodStart.getTime()
    )
  );
}

function chooseRentTerm(
  terms:
    RentTermRow[],

  tenancyId:
    string,

  billingPeriod:
    string,
) {
  return terms
    .filter(
      term =>
        term.tenancy_id ===
          tenancyId &&
        isRentTermForPeriod(
          term,
          billingPeriod,
        ),
    )
    .sort(
      (
        a,
        b,
      ) =>
        b.valid_from.localeCompare(
          a.valid_from,
        ),
    )[0];
}

function paymentDueDate(
  billingPeriod:
    string,

  dueDay:
    number,
) {
  const base =
    new Date(
      `${billingPeriod}T00:00:00`,
    );

  const year =
    base.getFullYear();

  const month =
    base.getMonth();

  const lastDay =
    new Date(
      year,
      month + 1,
      0,
    ).getDate();

  return new Date(
    year,
    month,

    Math.min(
      Math.max(
        dueDay,
        1,
      ),
      lastDay,
    ),

    23,
    59,
    59,
    999,
  );
}

function resolvePaymentState(
  claimStatus:
    PaymentClaimRow['status']
    | undefined,

  billingPeriod:
    string,

  dueDay:
    number,

  now =
    new Date(),
): LandlordPaymentState {
  if (
    claimStatus ===
    'CONFIRMED'
  ) {
    return 'PAID';
  }

  if (
    claimStatus ===
    'REPORTED'
  ) {
    return 'AWAITING';
  }

  return now.getTime() >
    paymentDueDate(
      billingPeriod,
      dueDay,
    ).getTime()
    ? 'DELAYED'
    : 'PENDING';
}

function addToCurrencyMap(
  target:
    Map<
      string,
      number
    >,

  currency:
    string,

  value:
    number,
) {
  if (
    !currency ||
    !Number.isFinite(
      value,
    )
  ) {
    return;
  }

  target.set(
    currency,

    (
      target.get(
        currency,
      ) ??
      0
    ) +
      value,
  );
}

function mapToTotals(
  map:
    Map<
      string,
      number
    >,
): LandlordCurrencyTotal[] {
  return Array.from(
    map.entries(),
  )
    .map(
      ([
        currency,
        total,
      ]) => ({
        currency,

        total:
          Math.round(
            total *
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

export async function loadLandlordPortfolioStatistics(
  billingPeriod =
    currentBillingPeriod(),
): Promise<
  LandlordPortfolioStatistics
> {
  const client =
    requireSupabase();

  const {
    data:
      propertyData,

    error:
      propertyError,
  } =
    await client
      .from(
        'properties',
      )
      .select(
        'id,title,street,city,area_m2',
      )
      .eq(
        'status',
        'ACTIVE',
      )
      .order(
        'created_at',
        {
          ascending:
            true,
        },
      );

  if (
    propertyError
  ) {
    throw new Error(
      propertyError.message ??
      'Unable to load properties.',
    );
  }

  const properties =
    (
      propertyData ??
      []
    ) as unknown as PropertyRow[];

  if (
    properties.length ===
    0
  ) {
    return {
      billingPeriod,

      properties:
        [],

      currencies:
        [],

      totalProperties:
        0,

      occupiedProperties:
        0,

      vacantProperties:
        0,

      paidProperties:
        0,

      awaitingProperties:
        0,

      pendingProperties:
        0,

      delayedProperties:
        0,

      incompleteBills:
        0,
    };
  }

  const propertyIds =
    properties.map(
      property =>
        property.id,
    );

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
        'id,property_id,start_date,end_date',
      )
      .in(
        'property_id',
        propertyIds,
      )
      .eq(
        'status',
        'ACTIVE',
      )
      .order(
        'start_date',
        {
          ascending:
            false,
        },
      );

  if (
    tenancyError
  ) {
    throw new Error(
      tenancyError.message ??
      'Unable to load active tenancies.',
    );
  }

  const tenancies =
    (
      tenancyData ??
      []
    ) as unknown as TenancyRow[];

  const activeTenancyByProperty =
    new Map<
      string,
      TenancyRow
    >();

  for (
    const tenancy
    of tenancies
  ) {
    if (
      !activeTenancyByProperty.has(
        tenancy.property_id,
      )
    ) {
      activeTenancyByProperty.set(
        tenancy.property_id,
        tenancy,
      );
    }
  }

  const tenancyIds =
    Array.from(
      activeTenancyByProperty.values(),
    ).map(
      tenancy =>
        tenancy.id,
    );

  let rentTerms:
    RentTermRow[] =
      [];

  let claims:
    PaymentClaimRow[] =
      [];

  let invoices:
    InvoiceRow[] =
      [];

  if (
    tenancyIds.length >
    0
  ) {
    const [
      rentResult,
      claimResult,
      invoiceResult,
    ] =
      await Promise.all([
        client
          .from(
            'rent_terms',
          )
          .select(
            [
              'tenancy_id',
              'rent_amount',
              'currency_code',
              'payment_due_day',
              'valid_from',
              'valid_to',
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
            'tenant_payment_claims',
          )
          .select(
            'tenancy_id,status',
          )
          .in(
            'tenancy_id',
            tenancyIds,
          )
          .eq(
            'billing_period',
            billingPeriod,
          )
          .in(
            'status',
            [
              'REPORTED',
              'CONFIRMED',
            ],
          ),

        client
          .from(
            'invoices',
          )
          .select(
            'tenancy_id,base_currency,base_total_amount',
          )
          .in(
            'tenancy_id',
            tenancyIds,
          )
          .eq(
            'billing_period',
            billingPeriod,
          )
          .eq(
            'status',
            'PAID',
          ),
      ]);

    if (
      rentResult.error
    ) {
      throw new Error(
        rentResult.error.message,
      );
    }

    if (
      claimResult.error
    ) {
      throw new Error(
        claimResult.error.message,
      );
    }

    if (
      invoiceResult.error
    ) {
      throw new Error(
        invoiceResult.error.message,
      );
    }

    rentTerms =
      (
        rentResult.data ??
        []
      ) as unknown as RentTermRow[];

    claims =
      (
        claimResult.data ??
        []
      ) as unknown as PaymentClaimRow[];

    invoices =
      (
        invoiceResult.data ??
        []
      ) as unknown as InvoiceRow[];
  }

  const claimByTenancy =
    new Map<
      string,
      PaymentClaimRow['status']
    >();

  for (
    const claim
    of claims
  ) {
    claimByTenancy.set(
      claim.tenancy_id,
      claim.status,
    );
  }

  const paidInvoiceTotalsByTenancy =
    new Map<
      string,
      Map<
        string,
        number
      >
    >();

  for (
    const invoice
    of invoices
  ) {
    const tenancyMap =
      paidInvoiceTotalsByTenancy.get(
        invoice.tenancy_id,
      ) ??
      new Map<
        string,
        number
      >();

    addToCurrencyMap(
      tenancyMap,

      invoice.base_currency,

      asNumber(
        invoice.base_total_amount,
      ),
    );

    paidInvoiceTotalsByTenancy.set(
      invoice.tenancy_id,
      tenancyMap,
    );
  }

  const billingPreviewByTenancy =
    new Map<
      string,
      BillingPreviewRow[]
    >();

  await Promise.all(
    tenancyIds.map(
      async tenancyId => {
        const {
          data,
          error,
        } =
          await client.rpc(
            'get_tenancy_billing_preview',
            {
              p_tenancy_id:
                tenancyId,

              p_billing_period:
                billingPeriod,
            },
          );

        if (
          error
        ) {
          throw new Error(
            error.message,
          );
        }

        billingPreviewByTenancy.set(
          tenancyId,

          (
            data ??
            []
          ) as unknown as BillingPreviewRow[],
        );
      },
    ),
  );

  const expectedByCurrency =
    new Map<
      string,
      number
    >();

  const receivedByCurrency =
    new Map<
      string,
      number
    >();

  const awaitingByCurrency =
    new Map<
      string,
      number
    >();

  const pendingByCurrency =
    new Map<
      string,
      number
    >();

  const debtByCurrency =
    new Map<
      string,
      number
    >();

  const rentForecastByCurrency =
    new Map<
      string,
      number
    >();

  const propertySummaries:
    LandlordPropertyPaymentSummary[] =
    [];

  let paidProperties =
    0;

  let awaitingProperties =
    0;

  let pendingProperties =
    0;

  let delayedProperties =
    0;

  let incompleteBills =
    0;

  for (
    const property
    of properties
  ) {
    const tenancy =
      activeTenancyByProperty.get(
        property.id,
      );

    if (
      !tenancy
    ) {
      propertySummaries.push(
        {
          propertyId:
            property.id,

          propertyName:
            property.title,

          propertyAddress:
            property.street,

          propertyCity:
            property.city,

          areaM2:
            asNumber(
              property.area_m2,
            ),

          paymentState:
            'VACANT',

          billingReady:
            true,

          billingMissingCount:
            0,

          expectedTotals:
            [],
        },
      );

      continue;
    }

    const rentTerm =
      chooseRentTerm(
        rentTerms,

        tenancy.id,

        billingPeriod,
      );

    const dueDay =
      Number(
        rentTerm
          ?.payment_due_day ??
        5,
      );

    const paymentState =
      resolvePaymentState(
        claimByTenancy.get(
          tenancy.id,
        ),

        billingPeriod,

        dueDay,
      );

    if (
      paymentState ===
      'PAID'
    ) {
      paidProperties +=
        1;
    } else if (
      paymentState ===
      'AWAITING'
    ) {
      awaitingProperties +=
        1;
    } else if (
      paymentState ===
      'DELAYED'
    ) {
      delayedProperties +=
        1;
    } else {
      pendingProperties +=
        1;
    }

    if (
      rentTerm
    ) {
      addToCurrencyMap(
        rentForecastByCurrency,

        rentTerm.currency_code,

        asNumber(
          rentTerm.rent_amount,
        ),
      );
    }

    const previewRows =
      billingPreviewByTenancy.get(
        tenancy.id,
      ) ??
      [];

    const missingCount =
      previewRows.filter(
        row =>
          !row.is_ready,
      ).length;

    const billingReady =
      missingCount ===
      0;

    if (
      !billingReady
    ) {
      incompleteBills +=
        1;
    }

    const expectedForProperty =
      new Map<
        string,
        number
      >();

    for (
      const row
      of previewRows
    ) {
      if (
        !row.is_ready ||
        row.amount ===
          null ||
        !row.currency_code
      ) {
        continue;
      }

      const amount =
        asNumber(
          row.amount,
        );

      addToCurrencyMap(
        expectedForProperty,

        row.currency_code,

        amount,
      );

      addToCurrencyMap(
        expectedByCurrency,

        row.currency_code,

        amount,
      );

      if (
        paymentState ===
        'AWAITING'
      ) {
        addToCurrencyMap(
          awaitingByCurrency,

          row.currency_code,

          amount,
        );
      }

      if (
        paymentState ===
        'PENDING'
      ) {
        addToCurrencyMap(
          pendingByCurrency,

          row.currency_code,

          amount,
        );
      }

      if (
        paymentState ===
        'DELAYED'
      ) {
        addToCurrencyMap(
          debtByCurrency,

          row.currency_code,

          amount,
        );
      }
    }

    if (
      paymentState ===
      'PAID'
    ) {
      const invoiceTotals =
        paidInvoiceTotalsByTenancy.get(
          tenancy.id,
        );

      if (
        invoiceTotals
      ) {
        for (
          const [
            currency,
            total,
          ]
          of invoiceTotals.entries()
        ) {
          addToCurrencyMap(
            receivedByCurrency,

            currency,

            total,
          );
        }
      }
    }

    propertySummaries.push(
      {
        propertyId:
          property.id,

        propertyName:
          property.title,

        propertyAddress:
          property.street,

        propertyCity:
          property.city,

        areaM2:
          asNumber(
            property.area_m2,
          ),

        tenancyId:
          tenancy.id,

        rentAmount:
          rentTerm
            ? asNumber(
                rentTerm.rent_amount,
              )
            : undefined,

        rentCurrency:
          rentTerm
            ?.currency_code,

        paymentDueDay:
          dueDay,

        paymentState,

        billingReady,

        billingMissingCount:
          missingCount,

        expectedTotals:
          mapToTotals(
            expectedForProperty,
          ),
      },
    );
  }

  const currencies =
    new Set<string>();

  for (
    const source
    of [
      expectedByCurrency,
      receivedByCurrency,
      awaitingByCurrency,
      pendingByCurrency,
      debtByCurrency,
      rentForecastByCurrency,
    ]
  ) {
    for (
      const currency
      of source.keys()
    ) {
      currencies.add(
        currency,
      );
    }
  }

  const currencyStatistics =
    Array.from(
      currencies,
    )
      .sort()
      .map(
        currency => ({
          currency,

          expected:
            expectedByCurrency.get(
              currency,
            ) ??
            0,

          received:
            receivedByCurrency.get(
              currency,
            ) ??
            0,

          awaiting:
            awaitingByCurrency.get(
              currency,
            ) ??
            0,

          pending:
            pendingByCurrency.get(
              currency,
            ) ??
            0,

          debt:
            debtByCurrency.get(
              currency,
            ) ??
            0,

          rentForecast:
            rentForecastByCurrency.get(
              currency,
            ) ??
            0,
        }),
      );

  const occupiedProperties =
    tenancyIds.length;

  return {
    billingPeriod,

    properties:
      propertySummaries,

    currencies:
      currencyStatistics,

    totalProperties:
      properties.length,

    occupiedProperties,

    vacantProperties:
      Math.max(
        properties.length -
          occupiedProperties,
        0,
      ),

    paidProperties,

    awaitingProperties,

    pendingProperties,

    delayedProperties,

    incompleteBills,
  };
}