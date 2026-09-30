import {
  File,
} from 'expo-file-system';

import {
  supabase,
} from '../lib/supabase';

import {
  AppMode,
  CurrencyCode,
  LanguageCode,
  Meter,
  MeterInput,
  MeterReadingInput,
  Property,
  PropertyInput,
  UserSettings,
  Workspace,
} from '../types';

const PHOTO_BUCKET =
  'meter-photos';

interface CoreData {
  workspace:
    Workspace;

  settings:
    UserSettings;

  properties:
    Property[];

  meters:
    Meter[];
}

interface PropertyRow {
  id: string;

  workspace_id: string;

  title: string;

  city: string;

  street: string;

  area_m2:
    number | string | null;

  status:
    'ACTIVE' |
    'INACTIVE' |
    'ARCHIVED';
}

interface ServiceRow {
  id: string;

  property_id: string;

  service_code: string;

  custom_name:
    string | null;

  calculation_method:
    'METER' |
    'FIXED' |
    'MANUAL';

  unit:
    string | null;

  currency_code:
    string;

  sort_order:
    number;

  is_active:
    boolean;
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

  status: string;
}

interface RegisterRow {
  id: string;

  meter_id: string;

  code: string;

  name: string;

  unit: string;

  sort_order:
    number;

  active:
    boolean;
}

interface TariffRow {
  property_service_id:
    string;

  meter_register_id:
    string | null;

  price:
    number | string;

  currency_code:
    string;

  unit: string;
}

interface LatestReadingRow {
  meter_register_id:
    string;

  meter_id: string;

  billing_period:
    string;

  reading_date:
    string;

  previous_value:
    number | string | null;

  current_value:
    number | string;

  consumption:
    number | string | null;

  photo_path:
    string | null;

  photo_mime_type:
    string | null;
}

interface LatestManualValueRow {
  property_service_id:
    string;

  billing_period:
    string;

  amount:
    number | string;

  currency_code:
    string;

  submitted_at:
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

  fallback = 0,
) {
  if (
    value === null ||
    value === undefined
  ) {
    return fallback;
  }

  const result =
    Number(value);

  return Number.isFinite(
    result,
  )
    ? result
    : fallback;
}

function currency(
  value:
    string |
    null |
    undefined,
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

function currentMonth() {
  const now =
    new Date();

  const month =
    String(
      now.getMonth() +
        1,
    ).padStart(
      2,
      '0',
    );

  return `${now.getFullYear()}-${month}-01`;
}

function currentDate() {
  const now =
    new Date();

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

  return `${now.getFullYear()}-${month}-${day}`;
}

function monthFolder() {
  return currentMonth()
    .slice(
      0,
      7,
    );
}

function makeStorageId() {
  return `${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

function normalizeExtension(
  extension:
    string,
) {
  const clean =
    extension
      .replace(
        /^\./,
        '',
      )
      .toLowerCase();

  if (
    clean ===
      'jpeg'
  ) {
    return 'jpg';
  }

  return (
    clean ||
    'jpg'
  );
}

function mapProperty(
  row:
    PropertyRow,
): Property {
  return {
    id:
      row.id,

    workspaceId:
      row.workspace_id,

    name:
      row.title,

    address:
      row.street,

    city:
      row.city,

    areaM2:
      asNumber(
        row.area_m2,
      ),

    status:
      row.status,

    /*
     * Tenancy comes next.
     */
    rentAmount:
      0,

    rentCurrency:
      'UAH',

    utilitiesCurrency:
      'UAH',

    paymentDueDay:
      5,
  };
}

async function createSignedPhotoUrls(
  paths:
    string[],
) {
  const client =
    requireSupabase();

  const uniquePaths =
    [
      ...new Set(
        paths.filter(
          Boolean,
        ),
      ),
    ];

  const result:
    Record<
      string,
      string
    > = {};

  await Promise.all(
    uniquePaths.map(
      async (
        path,
      ) => {
        const {
          data,
          error,
        } =
          await client.storage
            .from(
              PHOTO_BUCKET,
            )
            .createSignedUrl(
              path,
              60 * 60,
            );

        if (
          !error &&
          data?.signedUrl
        ) {
          result[path] =
            data.signedUrl;
        }
      },
    ),
  );

  return result;
}

async function loadPersonalWorkspace(
  userId: string,
): Promise<Workspace> {
  const client =
    requireSupabase();

  /*
   * Prefer the user's own landlord
   * workspace.
   */
  const {
    data:
      ownedWorkspace,
    error:
      ownedError,
  } =
    await client
      .from(
        'workspaces',
      )
      .select(
        [
          'id',
          'name',
          'base_currency',
          'default_timezone',
        ].join(
          ',',
        ),
      )
      .eq(
        'owner_user_id',
        userId,
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
      )
      .limit(1)
      .maybeSingle();

  if (
    ownedError
  ) {
    throw ownedError;
  }

  let row =
    ownedWorkspace;

  /*
   * Later a user may be invited to a
   * workspace which they do not own.
   */
  if (
    !row
  ) {
    const {
      data,
      error,
    } =
      await client
        .from(
          'workspaces',
        )
        .select(
          [
            'id',
            'name',
            'base_currency',
            'default_timezone',
          ].join(
            ',',
          ),
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
        )
        .limit(1)
        .maybeSingle();

    if (
      error
    ) {
      throw error;
    }

    row =
      data;
  }

  if (
    !row
  ) {
    throw new Error(
      'No Dometra workspace was found for this account.',
    );
  }

  return {
    id:
      row.id,

    name:
      row.name,

    baseCurrency:
      currency(
        row.base_currency,
      ),

    timezone:
      row.default_timezone ??
      'Europe/Kyiv',
  };
}

async function loadSettings(
  userId: string,
): Promise<UserSettings> {
  const client =
    requireSupabase();

  const {
    data,
    error,
  } =
    await client
      .from(
        'user_settings',
      )
      .select(
        [
          'language_code',
          'region_code',
          'timezone',
          'display_currency',
          'active_mode',
          'push_enabled',
        ].join(
          ',',
        ),
      )
      .eq(
        'user_id',
        userId,
      )
      .single();

  if (
    error
  ) {
    throw error;
  }

  return {
    language:
      (
        data.language_code ??
        'uk'
      ) as LanguageCode,

    region:
      data.region_code ??
      'UA',

    timezone:
      data.timezone ??
      'Europe/Kyiv',

    displayCurrency:
      currency(
        data.display_currency,
      ),

    activeMode:
      (
        data.active_mode ??
        'LANDLORD'
      ) as AppMode,

    pushEnabled:
      Boolean(
        data.push_enabled,
      ),
  };
}

export async function loadCoreData(
  userId: string,
): Promise<CoreData> {
  const client =
    requireSupabase();

  const [
    workspace,
    settings,
  ] =
    await Promise.all([
      loadPersonalWorkspace(
        userId,
      ),

      loadSettings(
        userId,
      ),
    ]);

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
        [
          'id',
          'workspace_id',
          'title',
          'city',
          'street',
          'area_m2',
          'status',
        ].join(
          ',',
        ),
      )
      .eq(
        'workspace_id',
        workspace.id,
      )
      .eq(
        'status',
        'ACTIVE',
      )
      .order(
        'created_at',
        {
          ascending:
            false,
        },
      );

  if (
    propertyError
  ) {
    throw propertyError;
  }

  const propertyRows =
    (
      propertyData ??
      []
    ) as PropertyRow[];

  const properties =
    propertyRows.map(
      mapProperty,
    );

  const propertyIds =
    properties.map(
      (
        property,
      ) =>
        property.id,
    );

  if (
    propertyIds.length ===
    0
  ) {
    return {
      workspace,
      settings,
      properties:
        [],

      meters:
        [],
    };
  }

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
          'sort_order',
          'is_active',
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

  if (
    services.length ===
    0
  ) {
    return {
      workspace,
      settings,
      properties,
      meters:
        [],
    };
  }

  const serviceIds =
    services.map(
      (
        service,
      ) =>
        service.id,
    );

  const [
    meterResult,
    tariffResult,
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
            'status',
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
            'unit',
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
    meterResult.error
  ) {
    throw meterResult.error;
  }

  if (
    tariffResult.error
  ) {
    throw tariffResult.error;
  }

  if (
    manualResult.error
  ) {
    throw manualResult.error;
  }

  const meterRows =
    (
      meterResult.data ??
      []
    ) as MeterRow[];

  const tariffRows =
    (
      tariffResult.data ??
      []
    ) as TariffRow[];

  const manualRows =
    (
      manualResult.data ??
      []
    ) as LatestManualValueRow[];

  const meterIds =
    meterRows.map(
      (
        meter,
      ) =>
        meter.id,
    );

  let registerRows:
    RegisterRow[] =
    [];

  let latestRows:
    LatestReadingRow[] =
    [];

  if (
    meterIds.length >
    0
  ) {
    const [
      registersResult,
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
              'active',
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
              'consumption',
              'photo_path',
              'photo_mime_type',
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
      registersResult.error
    ) {
      throw registersResult.error;
    }

    if (
      latestResult.error
    ) {
      throw latestResult.error;
    }

    registerRows =
      (
        registersResult.data ??
        []
      ) as RegisterRow[];

    latestRows =
      (
        latestResult.data ??
        []
      ) as LatestReadingRow[];
  }

  const photoUrls =
    await createSignedPhotoUrls(
      latestRows
        .map(
          (
            row,
          ) =>
            row.photo_path,
        )
        .filter(
          (
            path,
          ): path is string =>
            Boolean(path),
        ),
    );

  const billingPeriod =
    currentMonth();

  const meters:
    Meter[] =
    [];

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
          (
            row,
          ) =>
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
            (
              row,
            ) =>
              row.meter_id ===
              meter.id,
          )
          .map(
            (
              register,
            ) => {
              const tariff =
                tariffRows.find(
                  (
                    row,
                  ) =>
                    row.meter_register_id ===
                    register.id,
                );

              const latest =
                latestRows.find(
                  (
                    row,
                  ) =>
                    row.meter_register_id ===
                    register.id,
                );

              const isCurrentPeriod =
                latest
                  ?.billing_period ===
                billingPeriod;

              const latestValue =
                latest
                  ? asNumber(
                      latest.current_value,
                    )
                  : undefined;

              const previousValue =
                latest
                  ? isCurrentPeriod
                    ? asNumber(
                        latest.previous_value,
                      )
                    : asNumber(
                        latest.current_value,
                      )
                  : 0;

              const lastPhotoPath =
                latest
                  ?.photo_path ??
                undefined;

              const lastPhotoUri =
                lastPhotoPath
                  ? photoUrls[
                      lastPhotoPath
                    ]
                  : undefined;

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
                  isCurrentPeriod
                    ? latestValue
                    : undefined,

                lastValue:
                  latestValue,

                lastReadingAt:
                  latest
                    ?.reading_date,

                lastBillingPeriod:
                  latest
                    ?.billing_period,

                photoPath:
                  isCurrentPeriod
                    ? lastPhotoPath
                    : undefined,

                photoUri:
                  isCurrentPeriod
                    ? lastPhotoUri
                    : undefined,

                lastPhotoPath,

                lastPhotoUri,
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
          (
            row,
          ) =>
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
        (
          row,
        ) =>
          row.property_service_id ===
          service.id,
      );

    const isCurrentPeriod =
      latestManual
        ?.billing_period ===
      billingPeriod;

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

      currentAmount:
        isCurrentPeriod
          ? asNumber(
              latestManual?.amount,
            )
          : undefined,

      lastAmount:
        latestManual
          ? asNumber(
              latestManual.amount,
            )
          : undefined,

      lastAmountAt:
        latestManual
          ?.submitted_at,

      lastBillingPeriod:
        latestManual
          ?.billing_period,

      billingCurrency:
        currency(
          service.currency_code,
        ),
    });
  }

  return {
    workspace,
    settings,
    properties,
    meters,
  };
}

export async function createProperty(
  workspaceId: string,
  userId: string,
  input:
    PropertyInput,
): Promise<Property> {
  const client =
    requireSupabase();

  const address =
    input.address.trim();

  const {
    data,
    error,
  } =
    await client
      .from(
        'properties',
      )
      .insert({
        workspace_id:
          workspaceId,

        title:
          input.name?.trim() ||
          address,

        property_type:
          'APARTMENT',

        city:
          input.city.trim(),

        street:
          address,

        area_m2:
          input.areaM2 ??
          null,

        status:
          'ACTIVE',

        created_by:
          userId,
      })
      .select(
        [
          'id',
          'workspace_id',
          'title',
          'city',
          'street',
          'area_m2',
          'status',
        ].join(
          ',',
        ),
      )
      .single();

  if (
    error
  ) {
    throw error;
  }

  return mapProperty(
    data as PropertyRow,
  );
}

export async function updateProperty(
  propertyId: string,
  input:
    PropertyInput,
): Promise<Property> {
  const client =
    requireSupabase();

  const address =
    input.address.trim();

  const {
    data,
    error,
  } =
    await client
      .from(
        'properties',
      )
      .update({
        title:
          input.name?.trim() ||
          address,

        city:
          input.city.trim(),

        street:
          address,

        area_m2:
          input.areaM2 ??
          null,
      })
      .eq(
        'id',
        propertyId,
      )
      .select(
        [
          'id',
          'workspace_id',
          'title',
          'city',
          'street',
          'area_m2',
          'status',
        ].join(
          ',',
        ),
      )
      .single();

  if (
    error
  ) {
    throw error;
  }

  return mapProperty(
    data as PropertyRow,
  );
}

export async function archiveProperty(
  propertyId: string,
) {
  const client =
    requireSupabase();

  const {
    error,
  } =
    await client
      .from(
        'properties',
      )
      .update({
        status:
          'ARCHIVED',
      })
      .eq(
        'id',
        propertyId,
      );

  if (
    error
  ) {
    throw error;
  }
}

export async function savePropertyService(
  input:
    MeterInput,

  serviceId?:
    string,
) {
  const client =
    requireSupabase();

  const tariffCurrency =
    input.tariffCurrency ??
    input.billingCurrency ??
    'UAH';

  const tariff =
    input.category ===
      'CUSTOM' &&
    input.billingMode ===
      'FIXED'
      ? input.fixedAmount ??
        null
      : input.tariff ??
        null;

  const {
    data,
    error,
  } =
    await client.rpc(
      'save_property_service',
      {
        p_service_id:
          serviceId ??
          null,

        p_property_id:
          input.propertyId,

        p_category:
          input.category,

        p_custom_name:
          input.name ??
          null,

        p_billing_mode:
          input.billingMode,

        p_currency:
          tariffCurrency,

        p_tariff:
          tariff,

        p_tariff_t1:
          input.tariffT1 ??
          null,

        p_tariff_t2:
          input.tariffT2 ??
          null,
      },
    );

  if (
    error
  ) {
    throw error;
  }

  return data as string;
}

export async function archivePropertyService(
  serviceId: string,
) {
  const client =
    requireSupabase();

  const {
    error,
  } =
    await client.rpc(
      'archive_property_service',
      {
        p_service_id:
          serviceId,
      },
    );

  if (
    error
  ) {
    throw error;
  }
}

export async function saveVariableServiceValue(
  serviceId: string,
  amount: number,
) {
  const client =
    requireSupabase();

  const {
    error,
  } =
    await client.rpc(
      'save_service_period_value',
      {
        p_service_id:
          serviceId,

        p_billing_period:
          currentMonth(),

        p_amount:
          amount,
      },
    );

  if (
    error
  ) {
    throw error;
  }
}

async function uploadMeterPhoto(
  workspaceId: string,
  propertyId: string,
  meterId: string,
  registerCode: string,
  uri: string,
) {
  const client =
    requireSupabase();

  const file =
    new File(
      uri,
    );

  const data =
    await file.arrayBuffer();

  const extension =
    normalizeExtension(
      file.extension,
    );

  const mimeType =
    file.type ||
    (
      extension ===
      'png'
        ? 'image/png'
        : extension ===
            'heic'
          ? 'image/heic'
          : 'image/jpeg'
    );

  const safeRegister =
    registerCode.replace(
      /[^a-zA-Z0-9_-]/g,
      '_',
    );

  const path =
    [
      workspaceId,

      propertyId,

      meterId,

      monthFolder(),

      safeRegister,

      `${makeStorageId()}.${extension}`,
    ].join(
      '/',
    );

  const {
    error,
  } =
    await client.storage
      .from(
        PHOTO_BUCKET,
      )
      .upload(
        path,
        data,
        {
          contentType:
            mimeType,

          cacheControl:
            '3600',

          upsert:
            false,
        },
      );

  if (
    error
  ) {
    throw error;
  }

  return {
    path,
    mimeType,
  };
}

export async function saveMeterReadings(
  workspaceId: string,
  meter: Meter,
  readings:
    MeterReadingInput[],
) {
  const client =
    requireSupabase();

  const uploadedPaths:
    string[] =
    [];

  try {
    const payload =
      [];

    for (
      const reading
      of readings
    ) {
      const register =
        meter.registers.find(
          (
            item,
          ) =>
            item.id ===
            reading.registerId,
        );

      if (
        !register
      ) {
        throw new Error(
          'Meter register was not found.',
        );
      }

      let photoPath =
        register.photoPath ??
        null;

      let mimeType:
        string | null =
        null;

      const hasNewPhoto =
        Boolean(
          reading.photoUri,
        ) &&
        reading.photoUri !==
          register.photoUri;

      if (
        hasNewPhoto &&
        reading.photoUri
      ) {
        const uploaded =
          await uploadMeterPhoto(
            workspaceId,

            meter.propertyId,

            meter.id,

            register.code,

            reading.photoUri,
          );

        photoPath =
          uploaded.path;

        mimeType =
          uploaded.mimeType;

        uploadedPaths.push(
          uploaded.path,
        );
      }

      if (
        !photoPath
      ) {
        throw new Error(
          `A photo is required for ${register.code}.`,
        );
      }

      payload.push({
        register_id:
          register.id,

        current_value:
          reading.currentValue,

        photo_path:
          photoPath,

        mime_type:
          mimeType ??
          'image/jpeg',
      });
    }

    const {
      error,
    } =
      await client.rpc(
        'save_meter_readings',
        {
          p_meter_id:
            meter.id,

          p_billing_period:
            currentMonth(),

          p_reading_date:
            currentDate(),

          p_readings:
            payload,
        },
      );

    if (
      error
    ) {
      throw error;
    }
  } catch (
    error
  ) {
    /*
     * If DB save fails after new files were
     * uploaded, clean those new orphan files.
     */
    if (
      uploadedPaths.length >
      0
    ) {
      await client.storage
        .from(
          PHOTO_BUCKET,
        )
        .remove(
          uploadedPaths,
        );
    }

    throw error;
  }
}

export async function updateUserSettings(
  userId: string,
  patch: {
    activeMode?:
      AppMode;

    language?:
      LanguageCode;

    pushEnabled?:
      boolean;
  },
) {
  const client =
    requireSupabase();

  const payload:
    Record<
      string,
      unknown
    > = {};

  if (
    patch.activeMode !==
    undefined
  ) {
    payload.active_mode =
      patch.activeMode;
  }

  if (
    patch.language !==
    undefined
  ) {
    payload.language_code =
      patch.language;
  }

  if (
    patch.pushEnabled !==
    undefined
  ) {
    payload.push_enabled =
      patch.pushEnabled;
  }

  if (
    Object.keys(
      payload,
    ).length ===
    0
  ) {
    return;
  }

  const {
    error,
  } =
    await client
      .from(
        'user_settings',
      )
      .update(
        payload,
      )
      .eq(
        'user_id',
        userId,
      );

  if (
    error
  ) {
    throw error;
  }
}