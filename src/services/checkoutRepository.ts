import { requireSupabase } from '../lib/supabase';

export type CheckoutTenancyStatus =
  | 'ACTIVE'
  | 'CHECKOUT_PENDING';

export interface CheckoutRegister {
  id: string;
  meterId: string;
  meterName: string;
  registerCode: string;
  registerName: string;
  unit: string;
}

export interface CheckoutContext {
  tenancyId: string;
  propertyId: string;
  propertyTitle: string;

  startDate: string;
  endDate?: string;

  status: CheckoutTenancyStatus;

  registers: CheckoutRegister[];
}

export interface CheckoutReadingInput {
  meterRegisterId: string;
  value: number;
}

export interface CheckoutTenancyInput {
  tenancyId: string;
  checkoutDate: string;
  notes?: string;
  readings: CheckoutReadingInput[];
}

function errorMessage(
  fallback: string,
  error: unknown,
): string {
  if (
    error &&
    typeof error === 'object' &&
    'message' in error &&
    typeof error.message === 'string'
  ) {
    return error.message;
  }

  return fallback;
}

export async function getCheckoutContext(
  propertyId: string,
): Promise<CheckoutContext> {
  const [
    propertyResult,
    tenancyResult,
    metersResult,
  ] = await Promise.all([
    requireSupabase()
      .from('properties')
      .select(
        'id,title,city,street',
      )
      .eq(
        'id',
        propertyId,
      )
      .single(),

    requireSupabase()
      .from('tenancies')
      .select(
        `
          id,
          property_id,
          start_date,
          end_date,
          status,
          created_at
        `,
      )
      .eq(
        'property_id',
        propertyId,
      )
      .in(
        'status',
        [
          'ACTIVE',
          'CHECKOUT_PENDING',
        ],
      )
      .order(
        'created_at',
        {
          ascending: false,
        },
      )
      .limit(1)
      .maybeSingle(),

    requireSupabase()
      .from('meters')
      .select(
        `
          id,
          name,
          unit,
          status
        `,
      )
      .eq(
        'property_id',
        propertyId,
      )
      .eq(
        'status',
        'ACTIVE',
      )
      .order(
        'name',
        {
          ascending: true,
        },
      ),
  ]);

  if (propertyResult.error) {
    throw new Error(
      errorMessage(
        'Unable to load apartment.',
        propertyResult.error,
      ),
    );
  }

  if (tenancyResult.error) {
    throw new Error(
      errorMessage(
        'Unable to load active rental.',
        tenancyResult.error,
      ),
    );
  }

  if (metersResult.error) {
    throw new Error(
      errorMessage(
        'Unable to load meters.',
        metersResult.error,
      ),
    );
  }

  const property =
    propertyResult.data;

  const tenancy =
    tenancyResult.data;

  if (!tenancy) {
    throw new Error(
      'There is no active rental to end.',
    );
  }

  const meters =
    metersResult.data ?? [];

  const meterIds =
    meters.map(
      meter => meter.id,
    );

  let registers:
    CheckoutRegister[] = [];

  if (meterIds.length > 0) {
    const registerResult =
      await requireSupabase()
        .from(
          'meter_registers',
        )
        .select(
          `
            id,
            meter_id,
            code,
            name,
            unit,
            sort_order,
            active
          `,
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
            ascending: true,
          },
        );

    if (registerResult.error) {
      throw new Error(
        errorMessage(
          'Unable to load meter registers.',
          registerResult.error,
        ),
      );
    }

    const meterById =
      new Map(
        meters.map(
          meter => [
            meter.id,
            meter,
          ],
        ),
      );

    registers =
      (
        registerResult.data ??
        []
      ).map(
        register => {
          const meter =
            meterById.get(
              register.meter_id,
            );

          return {
            id:
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
              register.unit ||
              meter?.unit ||
              '',
          };
        },
      );
  }

  const address =
    [
      property.street,
      property.city,
    ]
      .filter(Boolean)
      .join(', ');

  return {
    tenancyId:
      tenancy.id,

    propertyId,

    propertyTitle:
      property.title ||
      address ||
      'Apartment',

    startDate:
      tenancy.start_date,

    endDate:
      tenancy.end_date ??
      undefined,

    status:
      String(
        tenancy.status,
      ) as CheckoutTenancyStatus,

    registers,
  };
}

export async function checkoutTenancy(
  input: CheckoutTenancyInput,
) {
  const readings =
    input.readings.map(
      reading => ({
        meter_register_id:
          reading.meterRegisterId,

        value:
          reading.value,
      }),
    );

  const {
    data,
    error,
  } =
    await requireSupabase().rpc(
      'checkout_tenancy',
      {
        p_tenancy_id:
          input.tenancyId,

        p_checkout_date:
          input.checkoutDate,

        p_notes:
          input.notes?.trim() ||
          null,

        p_readings:
          readings,
      },
    );

  if (error) {
    console.error(
      '[checkoutTenancy]',
      {
        code:
          error.code,

        message:
          error.message,

        details:
          error.details,

        hint:
          error.hint,
      },
    );

    throw new Error(
      error.message ||
      'Unable to end rental.',
    );
  }

  return data;
}