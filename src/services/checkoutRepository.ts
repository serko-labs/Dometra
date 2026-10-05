import {
  supabase,
} from '../lib/supabase';

export type CheckoutStatus =
  | 'PENDING'
  | 'COMPLETED'
  | 'CANCELLED';

export type DepositSettlementAction =
  | 'RETURNED'
  | 'PARTIALLY_RETURNED'
  | 'APPLIED'
  | 'WAIVED';

export interface TenancyCheckout {
  tenancyId: string;

  status:
    CheckoutStatus;

  checkoutDate: string;

  notes?: string;

  requestedAt: string;

  completedAt?: string;

  depositAction?:
    DepositSettlementAction;

  depositReturnAmount?:
    number;

  settlementNotes?:
    string;
}

export interface CheckoutReading {
  tenancyId: string;

  meterRegisterId:
    string;

  readingDate:
    string;

  value:
    number;

  submittedAt:
    string;

  confirmedAt?:
    string;
}

export interface CheckoutRequiredRegister {
  id: string;

  meterId:
    string;

  meterName:
    string;

  code:
    string;

  name:
    string;

  unit:
    string;

  lastValue?:
    number;
}

export interface CheckoutReadingInput {
  registerId:
    string;

  value:
    number;
}

interface CheckoutRow {
  tenancy_id:
    string;

  status:
    CheckoutStatus;

  checkout_date:
    string;

  notes:
    string | null;

  requested_at:
    string;

  completed_at:
    string | null;

  deposit_action:
    DepositSettlementAction | null;

  deposit_return_amount:
    | number
    | string
    | null;

  settlement_notes:
    string | null;
}

interface CheckoutReadingRow {
  tenancy_id:
    string;

  meter_register_id:
    string;

  reading_date:
    string;

  value:
    number | string;

  submitted_at:
    string;

  confirmed_at:
    string | null;
}

interface MeterRow {
  id: string;

  property_service_id:
    string;

  name:
    string;
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

  sort_order:
    number;
}

interface LatestReadingRow {
  meter_register_id:
    string;

  current_value:
    | number
    | string
    | null;
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

function mapCheckout(
  row:
    CheckoutRow,
): TenancyCheckout {
  return {
    tenancyId:
      row.tenancy_id,

    status:
      row.status,

    checkoutDate:
      row.checkout_date,

    notes:
      row.notes ??
      undefined,

    requestedAt:
      row.requested_at,

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

export async function loadCheckoutSummaries(
  tenancyIds:
    string[],
): Promise<
  Record<
    string,
    TenancyCheckout
  >
> {
  if (
    tenancyIds.length ===
    0
  ) {
    return {};
  }

  const client =
    requireSupabase();

  const {
    data,
    error,
  } =
    await client
      .from(
        'tenancy_checkouts',
      )
      .select(
        [
          'tenancy_id',
          'status',
          'checkout_date',
          'notes',
          'requested_at',
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
      );

  if (
    error
  ) {
    throw error;
  }

  const result:
    Record<
      string,
      TenancyCheckout
    > = {};

  for (
    const row
    of (
      data ??
      []
    ) as unknown as
      CheckoutRow[]
  ) {
    result[
      row.tenancy_id
    ] =
      mapCheckout(
        row,
      );
  }

  return result;
}

export async function loadTenancyCheckout(
  tenancyId:
    string,
): Promise<
  TenancyCheckout | null
> {
  const result =
    await loadCheckoutSummaries(
      [
        tenancyId,
      ],
    );

  return (
    result[
      tenancyId
    ] ??
    null
  );
}

export async function startTenancyCheckout(
  params: {
    tenancyId:
      string;

    checkoutDate:
      string;

    notes?:
      string;
  },
) {
  const client =
    requireSupabase();

  const {
    error,
  } =
    await client.rpc(
      'start_tenancy_checkout',

      {
        p_tenancy_id:
          params.tenancyId,

        p_checkout_date:
          params.checkoutDate,

        p_notes:
          params.notes
            ?.trim() ||
          null,
      },
    );

  if (
    error
  ) {
    throw error;
  }
}

export async function cancelTenancyCheckout(
  tenancyId:
    string,
) {
  const client =
    requireSupabase();

  const {
    error,
  } =
    await client.rpc(
      'cancel_tenancy_checkout',

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
}

export async function loadCheckoutReadings(
  tenancyId:
    string,
): Promise<
  CheckoutReading[]
> {
  const client =
    requireSupabase();

  const {
    data,
    error,
  } =
    await client
      .from(
        'tenancy_checkout_readings',
      )
      .select(
        [
          'tenancy_id',
          'meter_register_id',
          'reading_date',
          'value',
          'submitted_at',
          'confirmed_at',
        ].join(
          ',',
        ),
      )
      .eq(
        'tenancy_id',
        tenancyId,
      )
      .order(
        'submitted_at',

        {
          ascending:
            true,
        },
      );

  if (
    error
  ) {
    throw error;
  }

  return (
    (
      data ??
      []
    ) as unknown as
      CheckoutReadingRow[]
  ).map(
    row => ({
      tenancyId:
        row.tenancy_id,

      meterRegisterId:
        row.meter_register_id,

      readingDate:
        row.reading_date,

      value:
        Number(
          row.value,
        ),

      submittedAt:
        row.submitted_at,

      confirmedAt:
        row.confirmed_at ??
        undefined,
    }),
  );
}

export async function saveTenantCheckoutReadings(
  params: {
    tenancyId:
      string;

    readingDate:
      string;

    readings:
      CheckoutReadingInput[];
  },
) {
  const client =
    requireSupabase();

  const {
    error,
  } =
    await client.rpc(
      'save_tenancy_checkout_readings',

      {
        p_tenancy_id:
          params.tenancyId,

        p_reading_date:
          params.readingDate,

        p_readings:
          params.readings.map(
            item => ({
              registerId:
                item.registerId,

              value:
                item.value,
            }),
          ),
      },
    );

  if (
    error
  ) {
    throw error;
  }
}

export async function completeTenancyCheckout(
  params: {
    tenancyId:
      string;

    depositAction?:
      DepositSettlementAction;

    depositReturnAmount?:
      number;

    settlementNotes?:
      string;
  },
) {
  const client =
    requireSupabase();

  const {
    error,
  } =
    await client.rpc(
      'complete_tenancy_checkout',

      {
        p_tenancy_id:
          params.tenancyId,

        p_deposit_action:
          params.depositAction ??
          null,

        p_deposit_return_amount:
          params.depositReturnAmount ??
          null,

        p_settlement_notes:
          params.settlementNotes
            ?.trim() ||
          null,
      },
    );

  if (
    error
  ) {
    throw error;
  }
}

export async function loadCheckoutRequiredRegisters(
  tenancyId:
    string,
): Promise<
  CheckoutRequiredRegister[]
> {
  const client =
    requireSupabase();

  const tenancyResult =
    await client
      .from(
        'tenancies',
      )
      .select(
        'property_id',
      )
      .eq(
        'id',
        tenancyId,
      )
      .single();

  if (
    tenancyResult.error
  ) {
    throw tenancyResult.error;
  }

  const propertyId =
    tenancyResult.data
      .property_id as string;

  const serviceResult =
    await client
      .from(
        'property_services',
      )
      .select(
        'id',
      )
      .eq(
        'property_id',
        propertyId,
      )
      .eq(
        'is_active',
        true,
      )
      .eq(
        'calculation_method',
        'METER',
      );

  if (
    serviceResult.error
  ) {
    throw serviceResult.error;
  }

  const serviceIds =
    (
      serviceResult.data ??
      []
    ).map(
      row =>
        row.id as string,
    );

  if (
    serviceIds.length ===
    0
  ) {
    return [];
  }

  const meterResult =
    await client
      .from(
        'meters',
      )
      .select(
        'id,property_service_id,name',
      )
      .in(
        'property_service_id',
        serviceIds,
      )
      .eq(
        'status',
        'ACTIVE',
      );

  if (
    meterResult.error
  ) {
    throw meterResult.error;
  }

  const meters =
    (
      meterResult.data ??
      []
    ) as unknown as
      MeterRow[];

  const meterIds =
    meters.map(
      item =>
        item.id,
    );

  if (
    meterIds.length ===
    0
  ) {
    return [];
  }

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
          'id,meter_id,code,name,unit,sort_order',
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
          'meter_register_id,current_value',
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

  const registers =
    (
      registerResult.data ??
      []
    ) as unknown as
      RegisterRow[];

  const latest =
    (
      latestResult.data ??
      []
    ) as unknown as
      LatestReadingRow[];

  return registers.map(
    register => {
      const meter =
        meters.find(
          item =>
            item.id ===
            register.meter_id,
        );

      const latestReading =
        latest.find(
          item =>
            item.meter_register_id ===
            register.id,
        );

      return {
        id:
          register.id,

        meterId:
          register.meter_id,

        meterName:
          meter?.name ??
          'Meter',

        code:
          register.code,

        name:
          register.name,

        unit:
          register.unit,

        lastValue:
          optionalNumber(
            latestReading
              ?.current_value,
          ),
      };
    },
  );
}