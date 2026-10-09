import {
  supabase,
} from '../lib/supabase';

import {
  CurrencyCode,
} from '../types';

const DOCUMENT_BUCKET =
  'tenant-documents';

export type RentalDepositAction =
  | 'RETURNED'
  | 'PARTIALLY_RETURNED'
  | 'APPLIED'
  | 'WAIVED';

export interface TenantRentalBalance {
  currency:
    string;

  invoiced:
    number;

  paid:
    number;

  outstanding:
    number;
}

export interface TenantRentalCheckoutSummary {
  checkoutDate:
    string;

  completedAt?:
    string;

  depositAction?:
    RentalDepositAction;

  depositReturnAmount?:
    number;

  settlementNotes?:
    string;
}

export interface TenantRentalHistoryItem {
  tenancyId:
    string;

  propertyId:
    string;

  propertyName:
    string;

  propertyAddress:
    string;

  propertyCity:
    string;

  areaM2:
    number;

  startDate:
    string;

  endDate?:
    string;

  rentAmount:
    number;

  currency:
    CurrencyCode;

  paymentDueDay:
    number;

  depositAmount?:
    number;

  depositCurrency?:
    CurrencyCode;

  agreementPath?:
    string;

  agreementUri?:
    string;

  checkout?:
    TenantRentalCheckoutSummary;

  balances:
    TenantRentalBalance[];
}

export interface TenantRentalFinalReading {
  id:
    string;

  meterRegisterId:
    string;

  meterId:
    string;

  meterName:
    string;

  registerCode:
    string;

  registerName:
    string;

  unit:
    string;

  value:
    number;

  readingDate:
    string;
}

export interface TenantRentalHistoryDetails
  extends TenantRentalHistoryItem {
  finalReadings:
    TenantRentalFinalReading[];
}

interface TenancyRow {
  id:
    string;

  property_id:
    string;

  start_date:
    string;

  end_date:
    string | null;

  agreement_path:
    string | null;

  status:
    string;
}

interface PropertyRow {
  id:
    string;

  title:
    string;

  street:
    string;

  city:
    string;

  area_m2:
    | number
    | string
    | null;
}

interface RentTermRow {
  tenancy_id:
    string;

  rent_amount:
    | number
    | string;

  currency_code:
    string;

  payment_due_day:
    number;

  deposit_amount:
    | number
    | string
    | null;

  deposit_currency:
    string | null;

  valid_from:
    string;

  valid_to:
    string | null;
}

interface CheckoutRow {
  tenancy_id:
    string;

  status:
    string;

  checkout_date:
    string;

  completed_at:
    string | null;

  deposit_action:
    RentalDepositAction | null;

  deposit_return_amount:
    | number
    | string
    | null;

  settlement_notes:
    string | null;
}

interface InvoiceRow {
  tenancy_id:
    string;

  status:
    string;

  base_currency:
    string;

  base_total_amount:
    | number
    | string;

  base_paid_amount:
    | number
    | string;

  base_balance_amount:
    | number
    | string;
}

interface CheckoutReadingRow {
  id:
    string;

  meter_register_id:
    string;

  reading_date:
    string;

  value:
    | number
    | string;
}

interface RegisterRow {
  id:
    string;

  meter_id:
    string;

  code:
    string;

  name:
    string;

  unit:
    string;
}

interface MeterRow {
  id:
    string;

  name:
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

function optionalNumber(
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

function currency(
  value:
    string | null | undefined,
): CurrencyCode {
  if (
    value ===
      'USD' ||
    value ===
      'EUR'
  ) {
    return value;
  }

  return 'UAH';
}

async function createAgreementUrl(
  path?:
    string,
) {
  if (
    !path
  ) {
    return undefined;
  }

  const client =
    requireSupabase();

  const {
    data,
    error,
  } =
    await client.storage
      .from(
        DOCUMENT_BUCKET,
      )
      .createSignedUrl(
        path,
        60 * 60,
      );

  if (
    error
  ) {
    console.warn(
      '[Dometra] Unable to create agreement URL:',
      error.message,
    );

    return undefined;
  }

  return data?.signedUrl ??
    undefined;
}

function latestRentTerm(
  rows:
    RentTermRow[],

  tenancyId:
    string,
) {
  return rows
    .filter(
      row =>
        row.tenancy_id ===
        tenancyId,
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

function checkoutForTenancy(
  rows:
    CheckoutRow[],

  tenancyId:
    string,
): TenantRentalCheckoutSummary | undefined {
  const row =
    rows.find(
      item =>
        item.tenancy_id ===
        tenancyId &&
        item.status ===
          'COMPLETED',
    );

  if (
    !row
  ) {
    return undefined;
  }

  return {
    checkoutDate:
      row.checkout_date,

    completedAt:
      row.completed_at ??
      undefined,

    depositAction:
      row.deposit_action ??
      undefined,

    depositReturnAmount:
      optionalNumber(
        row.deposit_return_amount,
      ),

    settlementNotes:
      row.settlement_notes ??
      undefined,
  };
}

function balancesForTenancy(
  rows:
    InvoiceRow[],

  tenancyId:
    string,
): TenantRentalBalance[] {
  const map =
    new Map<
      string,
      TenantRentalBalance
    >();

  rows
    .filter(
      row =>
        row.tenancy_id ===
          tenancyId &&
        row.status !==
          'VOID',
    )
    .forEach(
      row => {
        const existing =
          map.get(
            row.base_currency,
          ) ?? {
            currency:
              row.base_currency,

            invoiced:
              0,

            paid:
              0,

            outstanding:
              0,
          };

        existing.invoiced +=
          asNumber(
            row.base_total_amount,
          );

        existing.paid +=
          asNumber(
            row.base_paid_amount,
          );

        existing.outstanding +=
          asNumber(
            row.base_balance_amount,
          );

        map.set(
          row.base_currency,
          existing,
        );
      },
    );

  return Array.from(
    map.values(),
  )
    .map(
      item => ({
        ...item,

        invoiced:
          Math.round(
            item.invoiced *
              100,
          ) /
          100,

        paid:
          Math.round(
            item.paid *
              100,
          ) /
          100,

        outstanding:
          Math.round(
            item.outstanding *
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

async function loadTenantEndedTenancyIds() {
  const client =
    requireSupabase();

  const {
    data:
      userData,

    error:
      userError,
  } =
    await client.auth.getUser();

  if (
    userError
  ) {
    throw userError;
  }

  const userId =
    userData.user?.id;

  if (
    !userId
  ) {
    throw new Error(
      'Authentication is required.',
    );
  }

  /*
   * IMPORTANT:
   *
   * The live Dometra tenancy_member_role enum uses TENANT.
   *
   * Do NOT query PRIMARY_TENANT here.
   * PostgreSQL validates enum literals before filtering and
   * would throw:
   *
   * 22P02 invalid input value for enum tenancy_member_role
   */

  const {
    data:
      memberData,

    error:
      memberError,
  } =
    await client
      .from(
        'tenancy_members',
      )
      .select(
        'tenancy_id',
      )
      .eq(
        'user_id',
        userId,
      )
      .eq(
        'role',
        'TENANT',
      );

  if (
    memberError
  ) {
    throw memberError;
  }

  return [
    ...new Set(
      (
        memberData ??
        []
      ).map(
        (
          item:
            any,
        ) =>
          String(
            item.tenancy_id,
          ),
      ),
    ),
  ];
}

export async function loadTenantRentalHistory(): Promise<
  TenantRentalHistoryItem[]
> {
  const client =
    requireSupabase();

  const memberTenancyIds =
    await loadTenantEndedTenancyIds();

  if (
    memberTenancyIds.length ===
    0
  ) {
    return [];
  }

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
        [
          'id',
          'property_id',
          'start_date',
          'end_date',
          'agreement_path',
          'status',
        ].join(
          ',',
        ),
      )
      .in(
        'id',
        memberTenancyIds,
      )
      .eq(
        'status',
        'ENDED',
      )
      .order(
        'end_date',
        {
          ascending:
            false,
        },
      );

  if (
    tenancyError
  ) {
    throw tenancyError;
  }

  const tenancies =
    (
      tenancyData ??
      []
    ) as unknown as TenancyRow[];

  if (
    tenancies.length ===
    0
  ) {
    return [];
  }

  const tenancyIds =
    tenancies.map(
      tenancy =>
        tenancy.id,
    );

  const propertyIds =
    [
      ...new Set(
        tenancies.map(
          tenancy =>
            tenancy.property_id,
        ),
      ),
    ];

  const [
    propertyResult,
    rentResult,
    checkoutResult,
    invoiceResult,
  ] =
    await Promise.all([
      client
        .from(
          'properties',
        )
        .select(
          [
            'id',
            'title',
            'street',
            'city',
            'area_m2',
          ].join(
            ',',
          ),
        )
        .in(
          'id',
          propertyIds,
        ),

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
            'deposit_amount',
            'deposit_currency',
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
          'tenancy_checkouts',
        )
        .select(
          [
            'tenancy_id',
            'status',
            'checkout_date',
            'completed_at',
            'deposit_action',
            'deposit_return_amount',
            'settlement_notes',
          ].join(
            ',',
          ),
        )
        .in(
          'tenancy_id',
          tenancyIds,
        )
        .eq(
          'status',
          'COMPLETED',
        ),

      client
        .from(
          'invoices',
        )
        .select(
          [
            'tenancy_id',
            'status',
            'base_currency',
            'base_total_amount',
            'base_paid_amount',
            'base_balance_amount',
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
    propertyResult.error
  ) {
    throw propertyResult.error;
  }

  if (
    rentResult.error
  ) {
    throw rentResult.error;
  }

  if (
    checkoutResult.error
  ) {
    throw checkoutResult.error;
  }

  if (
    invoiceResult.error
  ) {
    throw invoiceResult.error;
  }

  const properties =
    (
      propertyResult.data ??
      []
    ) as unknown as PropertyRow[];

  const rentTerms =
    (
      rentResult.data ??
      []
    ) as unknown as RentTermRow[];

  const checkouts =
    (
      checkoutResult.data ??
      []
    ) as unknown as CheckoutRow[];

  const invoices =
    (
      invoiceResult.data ??
      []
    ) as unknown as InvoiceRow[];

  const result:
    TenantRentalHistoryItem[] =
    [];

  for (
    const tenancy
    of tenancies
  ) {
    const property =
      properties.find(
        item =>
          item.id ===
          tenancy.property_id,
      );

    if (
      !property
    ) {
      continue;
    }

    const rent =
      latestRentTerm(
        rentTerms,
        tenancy.id,
      );

    const agreementPath =
      tenancy.agreement_path ??
      undefined;

    result.push(
      {
        tenancyId:
          tenancy.id,

        propertyId:
          property.id,

        propertyName:
          property.title ||
          property.street ||
          'Apartment',

        propertyAddress:
          property.street,

        propertyCity:
          property.city,

        areaM2:
          asNumber(
            property.area_m2,
          ),

        startDate:
          tenancy.start_date,

        endDate:
          tenancy.end_date ??
          undefined,

        rentAmount:
          asNumber(
            rent?.rent_amount,
          ),

        currency:
          currency(
            rent?.currency_code,
          ),

        paymentDueDay:
          Number(
            rent?.payment_due_day ??
            5,
          ),

        depositAmount:
          optionalNumber(
            rent?.deposit_amount,
          ),

        depositCurrency:
          rent
            ?.deposit_currency
            ? currency(
                rent.deposit_currency,
              )
            : undefined,

        agreementPath,

        agreementUri:
          await createAgreementUrl(
            agreementPath,
          ),

        checkout:
          checkoutForTenancy(
            checkouts,
            tenancy.id,
          ),

        balances:
          balancesForTenancy(
            invoices,
            tenancy.id,
          ),
      },
    );
  }

  return result.sort(
    (
      a,
      b,
    ) =>
      (
        b.endDate ??
        b.startDate
      ).localeCompare(
        a.endDate ??
        a.startDate,
      ),
  );
}

export async function loadTenantRentalHistoryDetails(
  tenancyId:
    string,
): Promise<
  TenantRentalHistoryDetails | null
> {
  const client =
    requireSupabase();

  const history =
    await loadTenantRentalHistory();

  const rental =
    history.find(
      item =>
        item.tenancyId ===
        tenancyId,
    );

  if (
    !rental
  ) {
    return null;
  }

  const {
    data:
      readingData,

    error:
      readingError,
  } =
    await client
      .from(
        'tenancy_checkout_readings',
      )
      .select(
        [
          'id',
          'meter_register_id',
          'reading_date',
          'value',
        ].join(
          ',',
        ),
      )
      .eq(
        'tenancy_id',
        tenancyId,
      )
      .order(
        'reading_date',
        {
          ascending:
            true,
        },
      );

  if (
    readingError
  ) {
    throw readingError;
  }

  const checkoutReadings =
    (
      readingData ??
      []
    ) as unknown as CheckoutReadingRow[];

  if (
    checkoutReadings.length ===
    0
  ) {
    return {
      ...rental,

      finalReadings:
        [],
    };
  }

  const registerIds =
    [
      ...new Set(
        checkoutReadings.map(
          reading =>
            reading.meter_register_id,
        ),
      ),
    ];

  const {
    data:
      registerData,

    error:
      registerError,
  } =
    await client
      .from(
        'meter_registers',
      )
      .select(
        [
          'id',
          'meter_id',
          'code',
          'name',
          'unit',
        ].join(
          ',',
        ),
      )
      .in(
        'id',
        registerIds,
      );

  if (
    registerError
  ) {
    throw registerError;
  }

  const registers =
    (
      registerData ??
      []
    ) as unknown as RegisterRow[];

  const meterIds =
    [
      ...new Set(
        registers.map(
          register =>
            register.meter_id,
        ),
      ),
    ];

  let meters:
    MeterRow[] =
      [];

  if (
    meterIds.length >
    0
  ) {
    const {
      data:
        meterData,

      error:
        meterError,
    } =
      await client
        .from(
          'meters',
        )
        .select(
          'id,name',
        )
        .in(
          'id',
          meterIds,
        );

    if (
      meterError
    ) {
      throw meterError;
    }

    meters =
      (
        meterData ??
        []
      ) as unknown as MeterRow[];
  }

  const finalReadings =
    checkoutReadings
      .map(
        reading => {
          const register =
            registers.find(
              item =>
                item.id ===
                reading.meter_register_id,
            );

          if (
            !register
          ) {
            return null;
          }

          const meter =
            meters.find(
              item =>
                item.id ===
                register.meter_id,
            );

          return {
            id:
              reading.id,

            meterRegisterId:
              register.id,

            meterId:
              register.meter_id,

            meterName:
              meter?.name ??
              'Meter',

            registerCode:
              register.code,

            registerName:
              register.name,

            unit:
              register.unit,

            value:
              asNumber(
                reading.value,
              ),

            readingDate:
              reading.reading_date,
          } satisfies TenantRentalFinalReading;
        },
      )
      .filter(
        (
          item,
        ): item is TenantRentalFinalReading =>
          item !==
          null,
      )
      .sort(
        (
          a,
          b,
        ) => {
          const meterCompare =
            a.meterName.localeCompare(
              b.meterName,
            );

          if (
            meterCompare !==
            0
          ) {
            return meterCompare;
          }

          return a.registerCode.localeCompare(
            b.registerCode,
          );
        },
      );

  return {
    ...rental,

    finalReadings,
  };
}