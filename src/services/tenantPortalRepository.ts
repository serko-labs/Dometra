import {
  supabase,
} from '../lib/supabase';

import {
  saveMeterReadings as saveCoreMeterReadings,
} from './supabaseRepository';

import {
  CurrencyCode,
  Meter,
  MeterReadingInput,
} from '../types';

export interface TenantApartmentPortal {
  tenancyId: string;

  status:
    | 'ACTIVE'
    | 'CHECKOUT_PENDING';

  propertyId: string;

  workspaceId: string;

  propertyName: string;

  propertyAddress: string;

  propertyCity: string;

  areaM2: number;

  startDate: string;

  endDate?: string;

  rentAmount: number;

  currency:
    CurrencyCode;

  paymentDueDay: number;

  depositAmount?: number;

  depositCurrency?:
    CurrencyCode;

  agreementPath?: string;

  meters:
    Meter[];
}

export interface TenantMeterContext {
  workspaceId: string;

  propertyId: string;

  propertyName: string;

  meter:
    Meter;
}

interface TenancyRow {
  id: string;

  status:
    | 'ACTIVE'
    | 'CHECKOUT_PENDING';

  property_id: string;

  start_date: string;

  end_date:
    string | null;

  agreement_path:
    string | null;
}

interface PropertyRow {
  id: string;

  workspace_id: string;

  title: string;

  street: string;

  city: string;

  area_m2:
    number |
    string |
    null;
}

interface RentRow {
  tenancy_id: string;

  rent_amount:
    number |
    string;

  currency_code:
    string;

  payment_due_day:
    number;

  deposit_amount:
    number |
    string |
    null;

  deposit_currency:
    string |
    null;
}

interface ServiceRow {
  id: string;

  property_id: string;

  service_code: string;

  custom_name:
    string | null;

  calculation_method:
    | 'METER'
    | 'FIXED'
    | 'MANUAL';

  unit:
    string | null;

  currency_code:
    string;
}

interface MeterRow {
  id: string;

  property_id: string;

  property_service_id:
    string;

  name: string;

  category: string;

  serial_number:
    string | null;

  unit: string;
}

interface RegisterRow {
  id: string;

  meter_id: string;

  code: string;

  name: string;

  unit: string;

  sort_order: number;
}

interface TariffRow {
  property_service_id:
    string;

  meter_register_id:
    string | null;

  price:
    number |
    string;

  currency_code:
    string;
}

interface LatestReadingRow {
  meter_register_id:
    string;

  meter_id: string;

  billing_period: string;

  reading_date: string;

  previous_value:
    number |
    string |
    null;

  current_value:
    number |
    string;
}

interface ManualValueRow {
  property_service_id:
    string;

  billing_period: string;

  amount:
    number |
    string;

  currency_code:
    string;

  submitted_at: string;
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

  fallback = 0,
) {
  if (
    value === null ||
    value === undefined
  ) {
    return fallback;
  }

  const parsed =
    Number(value);

  return Number.isFinite(
    parsed,
  )
    ? parsed
    : fallback;
}

function optionalNumber(
  value:
    number |
    string |
    null |
    undefined,
) {
  if (
    value === null ||
    value === undefined
  ) {
    return undefined;
  }

  const parsed =
    Number(value);

  return Number.isFinite(
    parsed,
  )
    ? parsed
    : undefined;
}

function currency(
  value:
    string |
    null |
    undefined,
): CurrencyCode {
  if (
    value === 'USD' ||
    value === 'EUR'
  ) {
    return value;
  }

  return 'UAH';
}

function currentMonth() {
  const now =
    new Date();

  return `${now.getFullYear()}-${String(
    now.getMonth() + 1,
  ).padStart(
    2,
    '0',
  )}-01`;
}

export async function loadTenantApartments(): Promise<
  TenantApartmentPortal[]
> {
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
   * One user can belong to many tenancies.
   *
   * We intentionally do NOT use:
   *
   *   .single()
   *   .maybeSingle()
   *   .limit(1)
   *
   * here.
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

  const tenancyIds =
    [
      ...new Set(
        (
          memberData ??
          []
        ).map(
          item =>
            item.tenancy_id as string,
        ),
      ),
    ];

  if (
    tenancyIds.length ===
    0
  ) {
    return [];
  }

  /*
   * A tenant can rent several apartments at once.
   *
   * CHECKOUT_PENDING remains visible because the tenancy
   * has not actually ended yet.
   */
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
          'status',
          'property_id',
          'start_date',
          'end_date',
          'agreement_path',
        ].join(
          ',',
        ),
      )
      .in(
        'id',
        tenancyIds,
      )
      .in(
        'status',
        [
          'ACTIVE',
          'CHECKOUT_PENDING',
        ],
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
    throw tenancyError;
  }

  const tenancies =
    (
      tenancyData ??
      []
    ) as TenancyRow[];

  if (
    tenancies.length ===
    0
  ) {
    return [];
  }

  const activeTenancyIds =
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
  ] =
    await Promise.all([
      client
        .from(
          'properties',
        )
        .select(
          [
            'id',
            'workspace_id',
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
          ].join(
            ',',
          ),
        )
        .in(
          'tenancy_id',
          activeTenancyIds,
        )
        .is(
          'valid_to',
          null,
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

  const properties =
    (
      propertyResult.data ??
      []
    ) as PropertyRow[];

  const rentTerms =
    (
      rentResult.data ??
      []
    ) as RentRow[];

  const {
    data:
      serviceData,

    error:
      serviceError,
  } =
    await client
      .from(
        'property_services',
      )
      .select(
        [
          'id',
          'property_id',
          'service_code',
          'custom_name',
          'calculation_method',
          'unit',
          'currency_code',
        ].join(
          ',',
        ),
      )
      .in(
        'property_id',
        propertyIds,
      )
      .eq(
        'is_active',
        true,
      )
      .order(
        'sort_order',
        {
          ascending:
            true,
        },
      );

  if (
    serviceError
  ) {
    throw serviceError;
  }

  const services =
    (
      serviceData ??
      []
    ) as ServiceRow[];

  const serviceIds =
    services.map(
      service =>
        service.id,
    );

  let meterRows:
    MeterRow[] = [];

  let tariffRows:
    TariffRow[] = [];

  let manualRows:
    ManualValueRow[] = [];

  if (
    serviceIds.length >
    0
  ) {
    const [
      metersResult,
      tariffsResult,
      manualResult,
    ] =
      await Promise.all([
        client
          .from(
            'meters',
          )
          .select(
            [
              'id',
              'property_id',
              'property_service_id',
              'name',
              'category',
              'serial_number',
              'unit',
            ].join(
              ',',
            ),
          )
          .in(
            'property_service_id',
            serviceIds,
          )
          .eq(
            'status',
            'ACTIVE',
          ),

        client
          .from(
            'v_current_service_tariffs',
          )
          .select(
            [
              'property_service_id',
              'meter_register_id',
              'price',
              'currency_code',
            ].join(
              ',',
            ),
          )
          .in(
            'property_service_id',
            serviceIds,
          ),

        client
          .from(
            'v_latest_service_period_values',
          )
          .select(
            [
              'property_service_id',
              'billing_period',
              'amount',
              'currency_code',
              'submitted_at',
            ].join(
              ',',
            ),
          )
          .in(
            'property_service_id',
            serviceIds,
          ),
      ]);

    if (
      metersResult.error
    ) {
      throw metersResult.error;
    }

    if (
      tariffsResult.error
    ) {
      throw tariffsResult.error;
    }

    if (
      manualResult.error
    ) {
      throw manualResult.error;
    }

    meterRows =
      (
        metersResult.data ??
        []
      ) as MeterRow[];

    tariffRows =
      (
        tariffsResult.data ??
        []
      ) as TariffRow[];

    manualRows =
      (
        manualResult.data ??
        []
      ) as ManualValueRow[];
  }

  const meterIds =
    meterRows.map(
      meter =>
        meter.id,
    );

  let registerRows:
    RegisterRow[] = [];

  let latestRows:
    LatestReadingRow[] = [];

  if (
    meterIds.length >
    0
  ) {
    const [
      registerResult,
      latestResult,
    ] =
      await Promise.all([
        client
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
              'sort_order',
            ].join(
              ',',
            ),
          )
          .in(
            'meter_id',
            meterIds,
          )
          .eq(
            'active',
            true,
          )
          .order(
            'sort_order',
            {
              ascending:
                true,
            },
          ),

        client
          .from(
            'v_latest_meter_register_readings',
          )
          .select(
            [
              'meter_register_id',
              'meter_id',
              'billing_period',
              'reading_date',
              'previous_value',
              'current_value',
            ].join(
              ',',
            ),
          )
          .in(
            'meter_id',
            meterIds,
          ),
      ]);

    if (
      registerResult.error
    ) {
      throw registerResult.error;
    }

    if (
      latestResult.error
    ) {
      throw latestResult.error;
    }

    registerRows =
      (
        registerResult.data ??
        []
      ) as RegisterRow[];

    latestRows =
      (
        latestResult.data ??
        []
      ) as LatestReadingRow[];
  }

  const month =
    currentMonth();

  const meters:
    Meter[] = [];

  for (
    const service
    of services
  ) {
    if (
      service.calculation_method ===
      'METER'
    ) {
      const meter =
        meterRows.find(
          row =>
            row.property_service_id ===
            service.id,
        );

      if (
        !meter
      ) {
        continue;
      }

      const registers =
        registerRows
          .filter(
            register =>
              register.meter_id ===
              meter.id,
          )
          .map(
            register => {
              const tariff =
                tariffRows.find(
                  row =>
                    row.meter_register_id ===
                    register.id,
                );

              const latest =
                latestRows.find(
                  row =>
                    row.meter_register_id ===
                    register.id,
                );

              const latestValue =
                latest
                  ? asNumber(
                      latest.current_value,
                    )
                  : undefined;

              /*
               * Current input stays blank.
               *
               * previousValue is only used internally
               * for validation / consumption calculation.
               */
              const previousValue =
                latest
                  ? latest.billing_period ===
                    month
                    ? asNumber(
                        latest.previous_value,
                      )
                    : asNumber(
                        latest.current_value,
                      )
                  : 0;

              return {
                id:
                  register.id,

                code:
                  register.code,

                name:
                  register.name,

                unit:
                  register.unit,

                tariff:
                  asNumber(
                    tariff?.price,
                  ),

                tariffCurrency:
                  currency(
                    tariff
                      ?.currency_code ??
                    service.currency_code,
                  ),

                previousValue,

                currentValue:
                  undefined,

                lastValue:
                  latestValue,

                lastReadingAt:
                  latest
                    ?.reading_date,

                lastBillingPeriod:
                  latest
                    ?.billing_period,
              };
            },
          );

      meters.push({
        id:
          meter.id,

        serviceId:
          service.id,

        propertyId:
          meter.property_id,

        name:
          meter.name,

        category:
          meter.category as
            Meter['category'],

        billingMode:
          'METERED',

        serialNumber:
          meter.serial_number ??
          undefined,

        unit:
          meter.unit,

        registers,

        billingCurrency:
          currency(
            service.currency_code,
          ),
      });

      continue;
    }

    if (
      service.calculation_method ===
      'FIXED'
    ) {
      const tariff =
        tariffRows.find(
          row =>
            row.property_service_id ===
              service.id &&
            row.meter_register_id ===
              null,
        );

      meters.push({
        id:
          service.id,

        serviceId:
          service.id,

        propertyId:
          service.property_id,

        name:
          service.custom_name ??
          service.service_code,

        category:
          'CUSTOM',

        billingMode:
          'FIXED',

        unit:
          '',

        registers:
          [],

        fixedAmount:
          asNumber(
            tariff?.price,
          ),

        billingCurrency:
          currency(
            tariff
              ?.currency_code ??
            service.currency_code,
          ),
      });

      continue;
    }

    const latestManual =
      manualRows.find(
        row =>
          row.property_service_id ===
          service.id,
      );

    meters.push({
      id:
        service.id,

      serviceId:
        service.id,

      propertyId:
        service.property_id,

      name:
        service.custom_name ??
        service.service_code,

      category:
        'CUSTOM',

      billingMode:
        'VARIABLE',

      unit:
        '',

      registers:
        [],

      lastAmount:
        optionalNumber(
          latestManual?.amount,
        ),

      lastAmountAt:
        latestManual
          ?.submitted_at,

      lastBillingPeriod:
        latestManual
          ?.billing_period,

      billingCurrency:
        currency(
          latestManual
            ?.currency_code ??
          service.currency_code,
        ),
    });
  }

  return tenancies
    .map(
      tenancy => {
        const property =
          properties.find(
            item =>
              item.id ===
              tenancy.property_id,
          );

        if (
          !property
        ) {
          return null;
        }

        const rent =
          rentTerms.find(
            item =>
              item.tenancy_id ===
              tenancy.id,
          );

        return {
          tenancyId:
            tenancy.id,

          status:
            tenancy.status,

          propertyId:
            property.id,

          workspaceId:
            property.workspace_id,

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

          agreementPath:
            tenancy.agreement_path ??
            undefined,

          meters:
            meters.filter(
              meter =>
                meter.propertyId ===
                property.id,
            ),
        } satisfies TenantApartmentPortal;
      },
    )
    .filter(
      (
        item,
      ): item is TenantApartmentPortal =>
        item !== null,
    );
}

export async function loadTenantMeterContext(
  meterId: string,
): Promise<
  TenantMeterContext | null
> {
  const apartments =
    await loadTenantApartments();

  for (
    const apartment
    of apartments
  ) {
    const meter =
      apartment.meters.find(
        item =>
          item.id ===
          meterId,
      );

    if (
      meter
    ) {
      return {
        workspaceId:
          apartment.workspaceId,

        propertyId:
          apartment.propertyId,

        propertyName:
          apartment.propertyName,

        meter,
      };
    }
  }

  return null;
}

export async function saveTenantMeterReadings(
  context:
    TenantMeterContext,

  readings:
    MeterReadingInput[],
) {
  await saveCoreMeterReadings(
    context.workspaceId,
    context.meter,
    readings,
  );
}