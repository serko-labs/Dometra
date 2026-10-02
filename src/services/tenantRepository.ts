import { File } from 'expo-file-system';

import { supabase } from '../lib/supabase';

import {
  CreatedTenantInvitation,
  CurrencyCode,
  TenantInvitation,
  TenantMeterReading,
  TenantProfile,
  TenantProfileInput,
  TenancyOpeningReadingInput,
  TenancyTermsInput,
} from '../types';

const DOCUMENT_BUCKET =
  'tenant-documents';

export interface PropertyTenantDetails {
  id?: string;

  userId?: string;

  firstName: string;

  lastName: string;

  phone: string;

  email: string;

  passportIdNumber?: string;

  passportPhotoPath?: string;

  passportPhotoUri?: string;

  emergencyContact?: string;

  notes?: string;
}

export interface PropertyTenancySummary {
  id: string;

  propertyId: string;

  status:
    | 'PENDING'
    | 'ACTIVE'
    | 'CHECKOUT_PENDING'
    | 'ENDED'
    | 'CANCELLED';

  startDate: string;

  endDate?: string;

  autoProlongation: boolean;

  rentAmount: number;

  currency: CurrencyCode;

  paymentDueDay: number;

  depositAmount?: number;

  depositCurrency?: CurrencyCode;

  agreementPath?: string;

  agreementUri?: string;

  tenantType:
    | 'MANUAL'
    | 'DOMETRA'
    | 'INVITED';

  tenant?: PropertyTenantDetails;

  invitation?: {
    id: string;

    status: string;

    expiresAt: string;
  };

  openingReadings:
    TenantMeterReading[];
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

function supabaseErrorMessage(
  fallback: string,
  error: unknown,
): string {
  if (
    error &&
    typeof error === 'object'
  ) {
    const source =
      error as {
        code?: unknown;
        message?: unknown;
        details?: unknown;
        hint?: unknown;
      };

    const parts:
      string[] = [];

    if (
      typeof source.message ===
        'string' &&
      source.message.trim()
    ) {
      parts.push(
        source.message.trim(),
      );
    }

    if (
      typeof source.details ===
        'string' &&
      source.details.trim()
    ) {
      parts.push(
        `Details: ${source.details.trim()}`,
      );
    }

    if (
      typeof source.hint ===
        'string' &&
      source.hint.trim()
    ) {
      parts.push(
        `Hint: ${source.hint.trim()}`,
      );
    }

    if (
      typeof source.code ===
        'string' &&
      source.code.trim()
    ) {
      parts.push(
        `Code: ${source.code.trim()}`,
      );
    }

    if (
      parts.length >
      0
    ) {
      return parts.join(
        '\n',
      );
    }
  }

  if (
    error instanceof Error &&
    error.message
  ) {
    return error.message;
  }

  return fallback;
}

function currency(
  value:
    | string
    | null
    | undefined,
): CurrencyCode {
  if (
    value === 'USD' ||
    value === 'EUR'
  ) {
    return value;
  }

  return 'UAH';
}

function asNumber(
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

  const result =
    Number(value);

  return Number.isFinite(
    result,
  )
    ? result
    : undefined;
}

function normalizeExtension(
  extension: string,
) {
  const clean =
    extension
      .replace(
        /^\./,
        '',
      )
      .toLowerCase();

  if (
    clean === 'jpeg'
  ) {
    return 'jpg';
  }

  return clean || 'jpg';
}

function makeStorageId() {
  return `${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

async function uploadImageDocument(
  uri: string,
  folder: string,
) {
  const client =
    requireSupabase();

  const file =
    new File(uri);

  const data =
    await file.arrayBuffer();

  const extension =
    normalizeExtension(
      file.extension,
    );

  const mimeType =
    file.type ||
    (
      extension === 'png'
        ? 'image/png'
        : extension === 'heic'
          ? 'image/heic'
          : 'image/jpeg'
    );

  const path =
    `${folder}/${makeStorageId()}.${extension}`;

  const {
    error,
  } =
    await client.storage
      .from(
        DOCUMENT_BUCKET,
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

  return path;
}

async function removeDocuments(
  paths: string[],
) {
  if (
    paths.length === 0
  ) {
    return;
  }

  const client =
    requireSupabase();

  await client.storage
    .from(
      DOCUMENT_BUCKET,
    )
    .remove(
      paths,
    );
}

async function createSignedUrl(
  path?: string,
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
    return undefined;
  }

  return data?.signedUrl;
}

export async function getMyTenantProfile():
Promise<TenantProfile | null> {
  const client =
    requireSupabase();

  const {
    data:
      userData,

    error:
      userError,
  } =
    await client.auth
      .getUser();

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

  const {
    data,
    error,
  } =
    await client
      .from(
        'tenant_profiles',
      )
      .select(
        [
          'user_id',
          'first_name',
          'last_name',
          'phone',
          'email',
          'passport_id_number',
          'passport_photo_path',
          'emergency_contact',
          'notes',
        ].join(','),
      )
      .eq(
        'user_id',
        userId,
      )
      .maybeSingle();

  if (
    error
  ) {
    throw error;
  }

  if (
    !data
  ) {
    return null;
  }

  const passportPhotoPath =
    data.passport_photo_path ??
    undefined;

  return {
    userId:
      data.user_id,

    firstName:
      data.first_name,

    lastName:
      data.last_name,

    phone:
      data.phone,

    email:
      data.email,

    passportIdNumber:
      data.passport_id_number ??
      undefined,

    passportPhotoPath,

    passportPhotoUri:
      await createSignedUrl(
        passportPhotoPath,
      ),

    emergencyContact:
      data.emergency_contact ??
      undefined,

    notes:
      data.notes ??
      undefined,
  };
}

export async function saveMyTenantProfile(
  input:
    TenantProfileInput,
): Promise<TenantProfile> {
  const client =
    requireSupabase();

  const {
    data:
      userData,

    error:
      userError,
  } =
    await client.auth
      .getUser();

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

  const existing =
    await getMyTenantProfile();

  let passportPhotoPath =
    existing?.passportPhotoPath;

  let uploadedPath:
    string | undefined;

  try {
    if (
      input.passportPhotoUri &&
      input.passportPhotoUri !==
        existing?.passportPhotoUri
    ) {
      uploadedPath =
        await uploadImageDocument(
          input.passportPhotoUri,
          `profile/${userId}`,
        );

      passportPhotoPath =
        uploadedPath;
    }

    const {
      error,
    } =
      await client.rpc(
        'save_my_tenant_profile',
        {
          p_first_name:
            input.firstName.trim(),

          p_last_name:
            input.lastName.trim(),

          p_phone:
            input.phone.trim(),

          p_email:
            input.email
              .trim()
              .toLowerCase(),

          p_passport_id_number:
            input.passportIdNumber
              ?.trim() ||
            null,

          p_passport_photo_path:
            passportPhotoPath ??
            null,

          p_emergency_contact:
            input.emergencyContact
              ?.trim() ||
            null,

          p_notes:
            input.notes
              ?.trim() ||
            null,
        },
      );

    if (
      error
    ) {
      throw error;
    }

    if (
      uploadedPath &&
      existing?.passportPhotoPath &&
      existing.passportPhotoPath !==
        uploadedPath
    ) {
      await removeDocuments([
        existing.passportPhotoPath,
      ]);
    }

    const saved =
      await getMyTenantProfile();

    if (
      !saved
    ) {
      throw new Error(
        'Tenant profile could not be loaded after saving.',
      );
    }

    return saved;
  } catch (
    error
  ) {
    if (
      uploadedPath
    ) {
      await removeDocuments([
        uploadedPath,
      ]);
    }

    throw error;
  }
}

export async function updateManualTenantProfile(
  params: {
    workspaceId: string;

    propertyId: string;

    tenantId: string;

    input:
      TenantProfileInput;

    existingPhotoPath?:
      string;

    existingPhotoUri?:
      string;
  },
) {
  const client =
    requireSupabase();

  let passportPhotoPath =
    params.existingPhotoPath;

  let uploadedPath:
    string | undefined;

  try {
    if (
      params.input.passportPhotoUri &&
      params.input.passportPhotoUri !==
        params.existingPhotoUri
    ) {
      uploadedPath =
        await uploadImageDocument(
          params.input.passportPhotoUri,
          `manual/${params.workspaceId}/${params.propertyId}`,
        );

      passportPhotoPath =
        uploadedPath;
    }

    const {
      error,
    } =
      await client
        .from(
          'manual_tenant_contacts',
        )
        .update({
          first_name:
            params.input.firstName.trim(),

          last_name:
            params.input.lastName.trim(),

          phone:
            params.input.phone.trim(),

          email:
            params.input.email
              .trim()
              .toLowerCase(),

          passport_id_number:
            params.input.passportIdNumber
              ?.trim() ||
            null,

          passport_photo_path:
            passportPhotoPath ??
            null,

          emergency_contact:
            params.input.emergencyContact
              ?.trim() ||
            null,

          notes:
            params.input.notes
              ?.trim() ||
            null,
        })
        .eq(
          'id',
          params.tenantId,
        );

    if (
      error
    ) {
      throw error;
    }

    if (
      uploadedPath &&
      params.existingPhotoPath &&
      params.existingPhotoPath !==
        uploadedPath
    ) {
      await removeDocuments([
        params.existingPhotoPath,
      ]);
    }
  } catch (
    error
  ) {
    if (
      uploadedPath
    ) {
      await removeDocuments([
        uploadedPath,
      ]);
    }

    throw error;
  }
}

function rpcOpeningReadings(
  readings?:
    TenancyOpeningReadingInput[],
) {
  return (
    readings ??
    []
  ).map(
    reading => ({
      meter_register_id:
        reading.meterRegisterId,

      value:
        reading.value,
    }),
  );
}

export async function createManualTenancy(
  workspaceId: string,
  propertyId: string,
  tenant:
    TenantProfileInput,
  terms:
    TenancyTermsInput,
) {
  const client =
    requireSupabase();

  const uploadedPaths:
    string[] = [];

  try {
    let passportPhotoPath:
      string | undefined;

    let agreementPath:
      string | undefined;

    if (
      tenant.passportPhotoUri
    ) {
      passportPhotoPath =
        await uploadImageDocument(
          tenant.passportPhotoUri,
          `manual/${workspaceId}/${propertyId}`,
        );

      uploadedPaths.push(
        passportPhotoPath,
      );
    }

    if (
      terms.agreementUri
    ) {
      agreementPath =
        await uploadImageDocument(
          terms.agreementUri,
          `agreement/${workspaceId}/${propertyId}`,
        );

      uploadedPaths.push(
        agreementPath,
      );
    }

    const {
      data,
      error,
    } =
      await client.rpc(
        'create_manual_tenancy_v2',
        {
          p_property_id:
            propertyId,

          p_first_name:
            tenant.firstName.trim(),

          p_last_name:
            tenant.lastName.trim(),

          p_phone:
            tenant.phone.trim(),

          p_email:
            tenant.email
              .trim()
              .toLowerCase(),

          p_passport_id_number:
            tenant.passportIdNumber
              ?.trim() ||
            null,

          p_passport_photo_path:
            passportPhotoPath ??
            null,

          p_emergency_contact:
            tenant.emergencyContact
              ?.trim() ||
            null,

          p_notes:
            tenant.notes
              ?.trim() ||
            null,

          p_rent_amount:
            terms.rentAmount,

          p_currency:
            terms.currency,

          p_start_date:
            terms.startDate,

          p_payment_due_day:
            terms.paymentDueDay,

          p_end_date:
            terms.endDate ||
            null,

          p_deposit_amount:
            terms.depositAmount ??
            null,

          p_deposit_currency:
            terms.depositAmount !==
            undefined
              ? terms.depositCurrency ??
                terms.currency
              : null,

          p_agreement_path:
            agreementPath ??
            null,

          p_auto_prolongation:
            terms.autoProlongation,

          p_opening_readings:
            rpcOpeningReadings(
              terms.openingReadings,
            ),
        },
      );

    if (
      error
    ) {
      throw error;
    }

    return data as string;
  } catch (
    error
  ) {
    await removeDocuments(
      uploadedPaths,
    );

    throw error;
  }
}

export async function createTenantInvitation(
  workspaceId: string,
  propertyId: string,
  terms:
    TenancyTermsInput,
): Promise<CreatedTenantInvitation> {
  const client =
    requireSupabase();

  let agreementPath:
    string | undefined;

  try {
    if (
      terms.agreementUri
    ) {
      agreementPath =
        await uploadImageDocument(
          terms.agreementUri,
          `agreement/${workspaceId}/${propertyId}`,
        );
    }

    const {
      data,
      error,
    } =
      await client.rpc(
        'create_tenant_invitation_v2',
        {
          p_property_id:
            propertyId,

          p_rent_amount:
            terms.rentAmount,

          p_currency:
            terms.currency,

          p_start_date:
            terms.startDate,

          p_payment_due_day:
            terms.paymentDueDay,

          p_end_date:
            terms.endDate ||
            null,

          p_deposit_amount:
            terms.depositAmount ??
            null,

          p_deposit_currency:
            terms.depositAmount !==
            undefined
              ? terms.depositCurrency ??
                terms.currency
              : null,

          p_agreement_path:
            agreementPath ??
            null,

          p_auto_prolongation:
            terms.autoProlongation,

          p_opening_readings:
            rpcOpeningReadings(
              terms.openingReadings,
            ),
        },
      );

    if (
      error
    ) {
      console.error(
        '[Dometra] createTenantInvitation RPC failed:',
        {
          code:
            error.code,

          message:
            error.message,

          details:
            error.details,

          hint:
            error.hint,

          propertyId,

          workspaceId,

          terms: {
            rentAmount:
              terms.rentAmount,

            currency:
              terms.currency,

            startDate:
              terms.startDate,

            paymentDueDay:
              terms.paymentDueDay,

            endDate:
              terms.endDate,

            depositAmount:
              terms.depositAmount,

            depositCurrency:
              terms.depositCurrency,

            autoProlongation:
              terms.autoProlongation,

            openingReadingsCount:
              terms.openingReadings
                ?.length ??
              0,

            hasAgreement:
              Boolean(
                terms.agreementUri,
              ),
          },
        },
      );

      throw new Error(
        supabaseErrorMessage(
          'Unable to create tenant invitation.',
          error,
        ),
      );
    }

    const row =
      Array.isArray(
        data,
      )
        ? data[0]
        : data;

    if (
      !row
    ) {
      throw new Error(
        'Supabase created no invitation result.',
      );
    }

    if (
      !row.token
    ) {
      console.error(
        '[Dometra] Invitation result has no token:',
        row,
      );

      throw new Error(
        'Invitation token was not returned by Supabase.',
      );
    }

    if (
      !row.tenancy_id
    ) {
      throw new Error(
        'Tenancy ID was not returned by Supabase.',
      );
    }

    if (
      !row.invitation_id
    ) {
      throw new Error(
        'Invitation ID was not returned by Supabase.',
      );
    }

    if (
      !row.expires_at
    ) {
      throw new Error(
        'Invitation expiration date was not returned by Supabase.',
      );
    }

    const token =
      String(
        row.token,
      );

    return {
      tenancyId:
        String(
          row.tenancy_id,
        ),

      invitationId:
        String(
          row.invitation_id,
        ),

      token,

      expiresAt:
        String(
          row.expires_at,
        ),

      link:
        `dometra://invite/${token}`,
    };
  } catch (
    error
  ) {
    if (
      agreementPath
    ) {
      try {
        await removeDocuments([
          agreementPath,
        ]);
      } catch (
        cleanupError
      ) {
        console.warn(
          '[Dometra] Unable to clean invitation agreement after failure:',
          cleanupError,
        );
      }
    }

    if (
      error instanceof Error
    ) {
      throw error;
    }

    throw new Error(
      supabaseErrorMessage(
        'Unable to create tenant invitation.',
        error,
      ),
    );
  }
}

export async function getTenantInvitation(
  token: string,
): Promise<TenantInvitation | null> {
  const client =
    requireSupabase();

  const {
    data,
    error,
  } =
    await client.rpc(
      'get_tenant_invitation',
      {
        p_token:
          token,
      },
    );

  if (
    error
  ) {
    throw error;
  }

  const row =
    Array.isArray(
      data,
    )
      ? data[0]
      : data;

  if (
    !row
  ) {
    return null;
  }

  return {
    id:
      token,

    tenancyId:
      String(
        row.tenancy_id,
      ),

    propertyId:
      String(
        row.property_id,
      ),

    propertyName:
      String(
        row.property_name,
      ),

    propertyAddress:
      String(
        row.property_address,
      ),

    propertyCity:
      String(
        row.property_city,
      ),

    rentAmount:
      Number(
        row.rent_amount,
      ),

    currency:
      currency(
        row.currency_code,
      ),

    paymentDueDay:
      Number(
        row.payment_due_day,
      ),

    startDate:
      String(
        row.start_date,
      ),

    endDate:
      row.end_date
        ? String(
            row.end_date,
          )
        : undefined,

    depositAmount:
      asNumber(
        row.deposit_amount,
      ),

    depositCurrency:
      row.deposit_currency
        ? currency(
            row.deposit_currency,
          )
        : undefined,

    status:
      'PENDING',

    expiresAt:
      String(
        row.expires_at,
      ),
  };
}

export async function acceptTenantInvitation(
  token: string,
) {
  const client =
    requireSupabase();

  const {
    data,
    error,
  } =
    await client.rpc(
      'accept_tenant_invitation',
      {
        p_token:
          token,
      },
    );

  if (
    error
  ) {
    throw error;
  }

  return data as string;
}

export async function revokeTenantInvitation(
  invitationId: string,
) {
  const client =
    requireSupabase();

  const {
    error,
  } =
    await client.rpc(
      'revoke_tenant_invitation',
      {
        p_invitation_id:
          invitationId,
      },
    );

  if (
    error
  ) {
    throw error;
  }
}

export async function getPropertyTenancy(
  propertyId: string,
): Promise<PropertyTenancySummary | null> {
  const client =
    requireSupabase();

  const {
    data:
      tenancy,

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
          'manual_tenant_contact_id',
          'status',
          'start_date',
          'end_date',
          'agreement_path',
          'auto_prolongation',
        ].join(','),
      )
      .eq(
        'property_id',
        propertyId,
      )
      .in(
        'status',
        [
          'PENDING',
          'ACTIVE',
          'CHECKOUT_PENDING',
        ],
      )
      .order(
        'created_at',
        {
          ascending:
            false,
        },
      )
      .limit(1)
      .maybeSingle();

  if (
    tenancyError
  ) {
    throw tenancyError;
  }

  if (
    !tenancy
  ) {
    return null;
  }

  const {
    data:
      rentTerms,

    error:
      rentError,
  } =
    await client
      .from(
        'rent_terms',
      )
      .select(
        [
          'rent_amount',
          'currency_code',
          'payment_due_day',
          'deposit_amount',
          'deposit_currency',
        ].join(','),
      )
      .eq(
        'tenancy_id',
        tenancy.id,
      )
      .is(
        'valid_to',
        null,
      )
      .maybeSingle();

  if (
    rentError
  ) {
    throw rentError;
  }

  let tenantType:
    PropertyTenancySummary['tenantType'] =
      'INVITED';

  let tenant:
    PropertyTenantDetails | undefined;

  if (
    tenancy.manual_tenant_contact_id
  ) {
    const {
      data:
        manual,

      error:
        manualError,
    } =
      await client
        .from(
          'manual_tenant_contacts',
        )
        .select(
          [
            'id',
            'first_name',
            'last_name',
            'phone',
            'email',
            'passport_id_number',
            'passport_photo_path',
            'emergency_contact',
            'notes',
          ].join(','),
        )
        .eq(
          'id',
          tenancy.manual_tenant_contact_id,
        )
        .single();

    if (
      manualError
    ) {
      throw manualError;
    }

    tenantType =
      'MANUAL';

    const photoPath =
      manual.passport_photo_path ??
      undefined;

    tenant = {
      id:
        manual.id,

      firstName:
        manual.first_name,

      lastName:
        manual.last_name,

      phone:
        manual.phone,

      email:
        manual.email,

      passportIdNumber:
        manual.passport_id_number ??
        undefined,

      passportPhotoPath:
        photoPath,

      passportPhotoUri:
        await createSignedUrl(
          photoPath,
        ),

      emergencyContact:
        manual.emergency_contact ??
        undefined,

      notes:
        manual.notes ??
        undefined,
    };
  } else {
    const {
      data:
        member,

      error:
        memberError,
    } =
      await client
        .from(
          'tenancy_members',
        )
        .select(
          'user_id',
        )
        .eq(
          'tenancy_id',
          tenancy.id,
        )
        .eq(
          'role',
          'TENANT',
        )
        .limit(1)
        .maybeSingle();

    if (
      memberError
    ) {
      throw memberError;
    }

    if (
      member?.user_id
    ) {
      const {
        data:
          profile,

        error:
          profileError,
      } =
        await client
          .from(
            'tenant_profiles',
          )
          .select(
            [
              'user_id',
              'first_name',
              'last_name',
              'phone',
              'email',
              'passport_id_number',
              'passport_photo_path',
              'emergency_contact',
              'notes',
            ].join(','),
          )
          .eq(
            'user_id',
            member.user_id,
          )
          .single();

      if (
        profileError
      ) {
        throw profileError;
      }

      tenantType =
        'DOMETRA';

      const photoPath =
        profile.passport_photo_path ??
        undefined;

      tenant = {
        userId:
          profile.user_id,

        firstName:
          profile.first_name,

        lastName:
          profile.last_name,

        phone:
          profile.phone,

        email:
          profile.email,

        passportIdNumber:
          profile.passport_id_number ??
          undefined,

        passportPhotoPath:
          photoPath,

        passportPhotoUri:
          await createSignedUrl(
            photoPath,
          ),

        emergencyContact:
          profile.emergency_contact ??
          undefined,

        notes:
          profile.notes ??
          undefined,
      };
    }
  }

  const {
    data:
      invitation,

    error:
      invitationError,
  } =
    await client
      .from(
        'tenancy_invitations',
      )
      .select(
        [
          'id',
          'status',
          'expires_at',
        ].join(','),
      )
      .eq(
        'tenancy_id',
        tenancy.id,
      )
      .order(
        'created_at',
        {
          ascending:
            false,
        },
      )
      .limit(1)
      .maybeSingle();

  if (
    invitationError
  ) {
    throw invitationError;
  }

  const {
    data:
      readingData,

    error:
      readingError,
  } =
    await client
      .from(
        'tenancy_meter_readings',
      )
      .select(
        [
          'id',
          'tenancy_id',
          'meter_register_id',
          'reading_type',
          'reading_date',
          'value',
        ].join(','),
      )
      .eq(
        'tenancy_id',
        tenancy.id,
      )
      .eq(
        'reading_type',
        'MOVE_IN',
      );

  if (
    readingError
  ) {
    throw readingError;
  }

  const readings =
    readingData ??
    [];

  const registerIds =
    readings.map(
      reading =>
        reading.meter_register_id,
    );

  let openingReadings:
    TenantMeterReading[] =
    [];

  if (
    registerIds.length >
    0
  ) {
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
          ].join(','),
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

    const meterIds = [
      ...new Set(
        (
          registerData ??
          []
        ).map(
          register =>
            register.meter_id,
        ),
      ),
    ];

    let meterData:
      Array<{
        id: string;
        name: string;
      }> =
      [];

    if (
      meterIds.length >
      0
    ) {
      const {
        data,
        error,
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
        error
      ) {
        throw error;
      }

      meterData =
  (
    data ??
    []
  ).map(
    row => ({
      id:
        String(
          row.id,
        ),

      name:
        String(
          row.name ??
          '',
        ),
    }),
  );
    }

    openingReadings =
      readings.map(
        reading => {
          const register =
            (
              registerData ??
              []
            ).find(
              item =>
                item.id ===
                reading.meter_register_id,
            );

          const meter =
            meterData.find(
              item =>
                item.id ===
                register?.meter_id,
            );

          return {
            id:
              reading.id,

            tenancyId:
              reading.tenancy_id,

            meterRegisterId:
              reading.meter_register_id,

            meterId:
              register?.meter_id ??
              '',

            meterName:
              meter?.name ??
              'Meter',

            registerCode:
              register?.code ??
              '',

            registerName:
              register?.name ??
              '',

            unit:
              register?.unit ??
              '',

            type:
              'MOVE_IN',

            date:
              reading.reading_date,

            value:
              Number(
                reading.value,
              ),
          };
        },
      );
  }

  const agreementPath =
    tenancy.agreement_path ??
    undefined;

  return {
    id:
      tenancy.id,

    propertyId:
      tenancy.property_id,

    status:
      tenancy.status,

    startDate:
      tenancy.start_date,

    endDate:
      tenancy.end_date ??
      undefined,

    autoProlongation:
      Boolean(
        tenancy.auto_prolongation,
      ),

    rentAmount:
      Number(
        rentTerms?.rent_amount ??
        0,
      ),

    currency:
      currency(
        rentTerms?.currency_code,
      ),

    paymentDueDay:
      Number(
        rentTerms?.payment_due_day ??
        5,
      ),

    depositAmount:
      asNumber(
        rentTerms?.deposit_amount,
      ),

    depositCurrency:
      rentTerms
        ?.deposit_currency
        ? currency(
            rentTerms.deposit_currency,
          )
        : undefined,

    agreementPath,

    agreementUri:
      await createSignedUrl(
        agreementPath,
      ),

    tenantType,

    tenant,

    invitation:
      invitation
        ? {
            id:
              invitation.id,

            status:
              invitation.status,

            expiresAt:
              invitation.expires_at,
          }
        : undefined,

    openingReadings,
  };
}