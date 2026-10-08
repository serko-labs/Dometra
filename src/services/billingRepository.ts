import {
  File,
} from 'expo-file-system';

import {
  supabase,
} from '../lib/supabase';

const BILLING_PROOF_BUCKET =
  'billing-proofs';

export type BillingLineKind =
  | 'RENT'
  | 'METERED'
  | 'FIXED'
  | 'VARIABLE';

export type TenantPaymentState =
  | 'DUE'
  | 'OVERDUE'
  | 'AWAITING'
  | 'PAID';

export type TenantPaymentClaimStatus =
  | 'REPORTED'
  | 'CONFIRMED'
  | 'REJECTED'
  | 'CANCELLED';

export interface BillingPreviewLine {
  key: string;
  kind: BillingLineKind;
  propertyServiceId?: string;
  meterId?: string;
  meterRegisterReadingId?: string;
  description: string;
  quantity?: number;
  unit?: string;
  unitPrice?: number;
  amount?: number;
  currency: string;
  ready: boolean;
}

export interface BillingTotal {
  currency: string;
  total: number;
}

export interface GeneratedInvoiceSummary {
  id: string;
  number: string;
  currency: string;
  total: number;
}

export interface TenantPaymentClaim {
  id: string;

  tenancyId: string;

  billingPeriod: string;

  status:
    TenantPaymentClaimStatus;

  invoiceIds:
    string[];

  paymentIds:
    string[];

  proofPath?: string;

  proofUri?: string;

  note?: string;

  reportedBy: string;

  reportedAt: string;

  confirmedBy?: string;

  confirmedAt?: string;

  rejectedBy?: string;

  rejectedAt?: string;

  rejectionNote?: string;

  invoices:
    GeneratedInvoiceSummary[];
}

export interface VariableExpense {
  id: string;

  tenancyId: string;

  propertyServiceId:
    string;

  billingPeriod:
    string;

  amount:
    number;

  currency:
    string;

  photoPath?:
    string;

  photoUri?:
    string;

  note?:
    string;

  submittedAt:
    string;
}

export interface TenantBillingSummary {
  tenancyId:
    string;

  billingPeriod:
    string;

  lines:
    BillingPreviewLine[];

  totals:
    BillingTotal[];

  ready:
    boolean;

  missingCount:
    number;

  claim:
    TenantPaymentClaim | null;
}

interface PreviewRow {
  line_key:
    string;

  line_kind:
    BillingLineKind;

  property_service_id:
    string | null;

  meter_id:
    string | null;

  meter_register_reading_id:
    string | null;

  description:
    string;

  quantity:
    | number
    | string
    | null;

  unit:
    string | null;

  unit_price:
    | number
    | string
    | null;

  amount:
    | number
    | string
    | null;

  currency_code:
    string | null;

  is_ready:
    boolean;
}

interface ClaimRow {
  id:
    string;

  tenancy_id:
    string;

  billing_period:
    string;

  status:
    TenantPaymentClaimStatus;

  invoice_ids:
    string[] | null;

  payment_ids:
    string[] | null;

  proof_path:
    string | null;

  note:
    string | null;

  reported_by:
    string;

  reported_at:
    string;

  confirmed_by:
    string | null;

  confirmed_at:
    string | null;

  rejected_by:
    string | null;

  rejected_at:
    string | null;

  rejection_note:
    string | null;
}

interface InvoiceRow {
  id:
    string;

  invoice_number:
    string;

  base_currency:
    string;

  base_total_amount:
    number | string;
}

interface VariableExpenseRow {
  id:
    string;

  tenancy_id:
    string;

  property_service_id:
    string;

  billing_period:
    string;

  amount:
    number | string;

  currency_code:
    string;

  photo_path:
    string | null;

  note:
    string | null;

  submitted_at:
    string;
}

interface ReportPaymentRpcResult {
  claimId:
    string;

  claimStatus?:
    TenantPaymentClaimStatus;

  alreadyReported:
    boolean;

  invoices:
    Array<{
      id: string;
      number: string;
      currency: string;
      total:
        | number
        | string;
    }>;
}

interface ConfirmPaymentRpcResult {
  claimId:
    string;

  alreadyConfirmed:
    boolean;

  paymentIds:
    string[];
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

export function billingErrorMessage(
  error:
    unknown,

  fallback =
    'Unknown billing error.',
) {
  if (
    error instanceof
    Error
  ) {
    return error.message;
  }

  if (
    typeof error ===
    'string'
  ) {
    return error;
  }

  if (
    error &&
    typeof error ===
      'object'
  ) {
    const value =
      error as Record<
        string,
        unknown
      >;

    const parts = [
      value.message,
      value.details,
      value.hint,

      value.code
        ? `Code: ${String(
            value.code,
          )}`
        : undefined,
    ]
      .filter(
        item =>
          typeof item ===
            'string' &&
          item.trim().length >
            0,
      )
      .map(
        item =>
          String(
            item,
          ).trim(),
      );

    if (
      parts.length >
      0
    ) {
      return parts.join(
        '\n',
      );
    }
  }

  return fallback;
}

function throwBillingError(
  error:
    unknown,

  fallback:
    string,
): never {
  throw new Error(
    billingErrorMessage(
      error,
      fallback,
    ),
  );
}

function numberOrUndefined(
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

function normalizeExtension(
  extension:
    string,
) {
  const cleaned =
    extension
      .replace(
        /^\./,
        '',
      )
      .toLowerCase();

  if (
    cleaned ===
    'jpeg'
  ) {
    return 'jpg';
  }

  return cleaned ||
    'jpg';
}

function randomFileName() {
  return `${Date.now()}-${Math.random()
    .toString(
      36,
    )
    .slice(
      2,
      10,
    )}`;
}

export function currentBillingPeriod(
  now =
    new Date(),
) {
  return `${now.getFullYear()}-${String(
    now.getMonth() + 1,
  ).padStart(
    2,
    '0',
  )}-01`;
}

export function billingMonthLabel(
  billingPeriod:
    string,
) {
  const date =
    new Date(
      `${billingPeriod}T00:00:00`,
    );

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return billingPeriod;
  }

  return date.toLocaleDateString(
    undefined,
    {
      month:
        'long',

      year:
        'numeric',
    },
  );
}

export function paymentDueDate(
  billingPeriod:
    string,

  dueDay:
    number,
) {
  const base =
    new Date(
      `${billingPeriod}T00:00:00`,
    );

  if (
    Number.isNaN(
      base.getTime(),
    )
  ) {
    return null;
  }

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
  );
}

export function getTenantPaymentState(
  claim:
    TenantPaymentClaim | null,

  billingPeriod:
    string,

  paymentDueDay:
    number,

  now =
    new Date(),
): TenantPaymentState {
  if (
    claim?.status ===
    'CONFIRMED'
  ) {
    return 'PAID';
  }

  if (
    claim?.status ===
    'REPORTED'
  ) {
    return 'AWAITING';
  }

  const due =
    paymentDueDate(
      billingPeriod,
      paymentDueDay,
    );

  if (
    due &&
    now.getTime() >
      new Date(
        due.getFullYear(),
        due.getMonth(),
        due.getDate(),
        23,
        59,
        59,
        999,
      ).getTime()
  ) {
    return 'OVERDUE';
  }

  return 'DUE';
}

async function uploadProofImage(
  tenancyId:
    string,

  folder:
    | 'variable'
    | 'payment',

  uri:
    string,
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

  const contentType =
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

  const path =
    `${tenancyId}/${folder}/${randomFileName()}.${extension}`;

  const {
    error,
  } =
    await client.storage
      .from(
        BILLING_PROOF_BUCKET,
      )
      .upload(
        path,
        data,
        {
          contentType,

          cacheControl:
            '3600',

          upsert:
            false,
        },
      );

  if (
    error
  ) {
    throwBillingError(
      error,
      'Unable to upload billing proof.',
    );
  }

  return path;
}

async function removeProofImage(
  path?:
    string,
) {
  if (
    !path
  ) {
    return;
  }

  const client =
    requireSupabase();

  const {
    error,
  } =
    await client.storage
      .from(
        BILLING_PROOF_BUCKET,
      )
      .remove(
        [
          path,
        ],
      );

  if (
    error
  ) {
    console.warn(
      '[Dometra] Unable to remove old billing proof:',
      billingErrorMessage(
        error,
      ),
    );
  }
}

async function signedProofUrl(
  path?:
    string | null,
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
        BILLING_PROOF_BUCKET,
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

  return data?.signedUrl ??
    undefined;
}

async function loadInvoicesForIds(
  invoiceIds:
    string[],
): Promise<
  GeneratedInvoiceSummary[]
> {
  if (
    invoiceIds.length ===
    0
  ) {
    return [];
  }

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
        'id,invoice_number,base_currency,base_total_amount',
      )
      .in(
        'id',
        invoiceIds,
      );

  if (
    error
  ) {
    throwBillingError(
      error,
      'Unable to load generated invoices.',
    );
  }

  return (
    (
      data ??
      []
    ) as unknown as InvoiceRow[]
  ).map(
    row => ({
      id:
        row.id,

      number:
        row.invoice_number,

      currency:
        row.base_currency,

      total:
        Number(
          row.base_total_amount,
        ),
    }),
  );
}

async function mapClaim(
  row:
    ClaimRow,
): Promise<
  TenantPaymentClaim
> {
  const invoiceIds =
    row.invoice_ids ??
    [];

  const [
    proofUri,
    invoices,
  ] =
    await Promise.all([
      signedProofUrl(
        row.proof_path,
      ),

      loadInvoicesForIds(
        invoiceIds,
      ),
    ]);

  return {
    id:
      row.id,

    tenancyId:
      row.tenancy_id,

    billingPeriod:
      row.billing_period,

    status:
      row.status,

    invoiceIds,

    paymentIds:
      row.payment_ids ??
      [],

    proofPath:
      row.proof_path ??
      undefined,

    proofUri,

    note:
      row.note ??
      undefined,

    reportedBy:
      row.reported_by,

    reportedAt:
      row.reported_at,

    confirmedBy:
      row.confirmed_by ??
      undefined,

    confirmedAt:
      row.confirmed_at ??
      undefined,

    rejectedBy:
      row.rejected_by ??
      undefined,

    rejectedAt:
      row.rejected_at ??
      undefined,

    rejectionNote:
      row.rejection_note ??
      undefined,

    invoices,
  };
}

export async function loadPaymentClaims(
  tenancyIds:
    string[],

  billingPeriod =
    currentBillingPeriod(),
): Promise<
  Record<
    string,
    TenantPaymentClaim
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
        'tenant_payment_claims',
      )
      .select(
        [
          'id',
          'tenancy_id',
          'billing_period',
          'status',
          'invoice_ids',
          'payment_ids',
          'proof_path',
          'note',
          'reported_by',
          'reported_at',
          'confirmed_by',
          'confirmed_at',
          'rejected_by',
          'rejected_at',
          'rejection_note',
        ].join(
          ',',
        ),
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
      );

  if (
    error
  ) {
    throwBillingError(
      error,
      'Unable to load payment statuses.',
    );
  }

  const result:
    Record<
      string,
      TenantPaymentClaim
    > = {};

  for (
    const row
    of (
      data ??
      []
    ) as unknown as ClaimRow[]
  ) {
    result[
      row.tenancy_id
    ] =
      await mapClaim(
        row,
      );
  }

  return result;
}

export async function loadPaymentClaim(
  tenancyId:
    string,

  billingPeriod =
    currentBillingPeriod(),
): Promise<
  TenantPaymentClaim | null
> {
  const claims =
    await loadPaymentClaims(
      [
        tenancyId,
      ],
      billingPeriod,
    );

  return claims[
    tenancyId
  ] ??
    null;
}

export async function loadTenantBillingSummary(
  tenancyId:
    string,

  billingPeriod =
    currentBillingPeriod(),
): Promise<
  TenantBillingSummary
> {
  const client =
    requireSupabase();

  const [
    previewResult,
    claim,
  ] =
    await Promise.all([
      client.rpc(
        'get_tenancy_billing_preview',
        {
          p_tenancy_id:
            tenancyId,

          p_billing_period:
            billingPeriod,
        },
      ),

      loadPaymentClaim(
        tenancyId,
        billingPeriod,
      ),
    ]);

  if (
    previewResult.error
  ) {
    throwBillingError(
      previewResult.error,
      'Unable to load monthly billing preview.',
    );
  }

  const lines =
    (
      previewResult.data ??
      []
    ) as unknown as PreviewRow[];

  const mappedLines:
    BillingPreviewLine[] =
    lines.map(
      row => ({
        key:
          row.line_key,

        kind:
          row.line_kind,

        propertyServiceId:
          row.property_service_id ??
          undefined,

        meterId:
          row.meter_id ??
          undefined,

        meterRegisterReadingId:
          row.meter_register_reading_id ??
          undefined,

        description:
          row.description,

        quantity:
          numberOrUndefined(
            row.quantity,
          ),

        unit:
          row.unit ??
          undefined,

        unitPrice:
          numberOrUndefined(
            row.unit_price,
          ),

        amount:
          numberOrUndefined(
            row.amount,
          ),

        currency:
          row.currency_code ??
          '',

        ready:
          Boolean(
            row.is_ready,
          ),
      }),
    );

  const totalsMap =
    new Map<
      string,
      number
    >();

  for (
    const line
    of mappedLines
  ) {
    if (
      !line.ready ||
      line.amount ===
        undefined ||
      !line.currency
    ) {
      continue;
    }

    totalsMap.set(
      line.currency,

      (
        totalsMap.get(
          line.currency,
        ) ??
        0
      ) +
        line.amount,
    );
  }

  const totals =
    Array.from(
      totalsMap.entries(),
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

  const missingCount =
    mappedLines.filter(
      line =>
        !line.ready,
    ).length;

  return {
    tenancyId,

    billingPeriod,

    lines:
      mappedLines,

    totals,

    ready:
      missingCount ===
      0,

    missingCount,

    claim,
  };
}

export async function loadVariableExpense(
  tenancyId:
    string,

  propertyServiceId:
    string,

  billingPeriod =
    currentBillingPeriod(),
): Promise<
  VariableExpense | null
> {
  const client =
    requireSupabase();

  const {
    data,
    error,
  } =
    await client
      .from(
        'monthly_variable_expenses',
      )
      .select(
        [
          'id',
          'tenancy_id',
          'property_service_id',
          'billing_period',
          'amount',
          'currency_code',
          'photo_path',
          'note',
          'submitted_at',
        ].join(
          ',',
        ),
      )
      .eq(
        'tenancy_id',
        tenancyId,
      )
      .eq(
        'property_service_id',
        propertyServiceId,
      )
      .eq(
        'billing_period',
        billingPeriod,
      )
      .maybeSingle();

  if (
    error
  ) {
    throwBillingError(
      error,
      'Unable to load variable expense.',
    );
  }

  if (
    !data
  ) {
    return null;
  }

  const row =
    data as unknown as VariableExpenseRow;

  return {
    id:
      row.id,

    tenancyId:
      row.tenancy_id,

    propertyServiceId:
      row.property_service_id,

    billingPeriod:
      row.billing_period,

    amount:
      Number(
        row.amount,
      ),

    currency:
      row.currency_code,

    photoPath:
      row.photo_path ??
      undefined,

    photoUri:
      await signedProofUrl(
        row.photo_path,
      ),

    note:
      row.note ??
      undefined,

    submittedAt:
      row.submitted_at,
  };
}

export async function saveVariableExpense(
  params: {
    tenancyId: string;
    propertyServiceId: string;
    billingPeriod?: string;
    amount: number;
    note?: string;
    photoUri?: string;
    existingPhotoPath?: string;
    removeExistingPhoto?: boolean;
  },
) {
  const client =
    requireSupabase();

  const billingPeriod =
    params.billingPeriod ??
    currentBillingPeriod();

  let photoPath =
    params.removeExistingPhoto
      ? undefined
      : params.existingPhotoPath;

  if (
    params.photoUri
  ) {
    photoPath =
      await uploadProofImage(
        params.tenancyId,
        'variable',
        params.photoUri,
      );
  }

  const {
    data,
    error,
  } =
    await client.rpc(
      'save_monthly_variable_expense',
      {
        p_tenancy_id:
          params.tenancyId,

        p_property_service_id:
          params.propertyServiceId,

        p_billing_period:
          billingPeriod,

        p_amount:
          params.amount,

        p_photo_path:
          photoPath ??
          null,

        p_note:
          params.note
            ?.trim() ||
          null,
      },
    );

  if (
    error
  ) {
    if (
      params.photoUri &&
      photoPath
    ) {
      await removeProofImage(
        photoPath,
      );
    }

    throwBillingError(
      error,
      'Unable to save variable expense.',
    );
  }

  if (
    params.photoUri &&
    params.existingPhotoPath &&
    params.existingPhotoPath !==
      photoPath
  ) {
    await removeProofImage(
      params.existingPhotoPath,
    );
  }

  if (
    params.removeExistingPhoto &&
    params.existingPhotoPath
  ) {
    await removeProofImage(
      params.existingPhotoPath,
    );
  }

  return data as string;
}

export async function reportTenantPayment(
  params: {
    tenancyId: string;
    billingPeriod?: string;
    note?: string;
  },
): Promise<{
  claimId: string;
  alreadyReported: boolean;
  invoices:
    GeneratedInvoiceSummary[];
}> {
  const client =
    requireSupabase();

  const {
    data,
    error,
  } =
    await client.rpc(
      'report_tenant_payment',
      {
        p_tenancy_id:
          params.tenancyId,

        p_billing_period:
          params.billingPeriod ??
          currentBillingPeriod(),

        p_note:
          params.note
            ?.trim() ||
          null,
      },
    );

  if (
    error
  ) {
    throwBillingError(
      error,
      'Unable to mark this bill as paid.',
    );
  }

  if (
    !data ||
    typeof data !==
      'object'
  ) {
    throw new Error(
      'The server returned an invalid payment response.',
    );
  }

  const result =
    data as ReportPaymentRpcResult;

  if (
    !result.claimId
  ) {
    throw new Error(
      'The server did not return a payment claim ID.',
    );
  }

  try {
    const notificationResult =
      await client.functions.invoke(
        'notify-payment-reported',
        {
          body: {
            claimId:
              result.claimId,
          },
        },
      );

    if (
      notificationResult.error
    ) {
      console.warn(
        '[Dometra] Payment was saved but landlord notification failed:',
        billingErrorMessage(
          notificationResult.error,
        ),
      );
    }
  } catch (
    notificationError
  ) {
    console.warn(
      '[Dometra] Payment was saved but landlord notification failed:',
      billingErrorMessage(
        notificationError,
      ),
    );
  }

  return {
    claimId:
      result.claimId,

    alreadyReported:
      Boolean(
        result.alreadyReported,
      ),

    invoices:
      (
        result.invoices ??
        []
      ).map(
        invoice => ({
          id:
            invoice.id,

          number:
            invoice.number,

          currency:
            invoice.currency,

          total:
            Number(
              invoice.total,
            ),
        }),
      ),
  };
}

export async function confirmTenantPayment(
  params: {
    claimId: string;
    note?: string;
  },
) {
  const client =
    requireSupabase();

  const {
    data,
    error,
  } =
    await client.rpc(
      'confirm_tenant_payment',
      {
        p_claim_id:
          params.claimId,

        p_note:
          params.note
            ?.trim() ||
          null,
      },
    );

  if (
    error
  ) {
    throwBillingError(
      error,
      'Unable to confirm payment.',
    );
  }

  const result =
    data as ConfirmPaymentRpcResult;

  try {
    const notificationResult =
      await client.functions.invoke(
        'notify-payment-status',
        {
          body: {
            claimId:
              params.claimId,

            status:
              'CONFIRMED',
          },
        },
      );

    if (
      notificationResult.error
    ) {
      console.warn(
        '[Dometra] Payment confirmed but tenant notification failed:',
        billingErrorMessage(
          notificationResult.error,
        ),
      );
    }
  } catch (
    notificationError
  ) {
    console.warn(
      '[Dometra] Payment confirmed but tenant notification failed:',
      billingErrorMessage(
        notificationError,
      ),
    );
  }

  return result;
}

export async function rejectTenantPayment(
  params: {
    claimId: string;
    note?: string;
  },
) {
  const client =
    requireSupabase();

  const {
    error,
  } =
    await client.rpc(
      'reject_tenant_payment',
      {
        p_claim_id:
          params.claimId,

        p_note:
          params.note
            ?.trim() ||
          null,
      },
    );

  if (
    error
  ) {
    throwBillingError(
      error,
      'Unable to reject payment.',
    );
  }

  try {
    const notificationResult =
      await client.functions.invoke(
        'notify-payment-status',
        {
          body: {
            claimId:
              params.claimId,

            status:
              'REJECTED',
          },
        },
      );

    if (
      notificationResult.error
    ) {
      console.warn(
        '[Dometra] Payment rejected but tenant notification failed:',
        billingErrorMessage(
          notificationResult.error,
        ),
      );
    }
  } catch (
    notificationError
  ) {
    console.warn(
      '[Dometra] Payment rejected but tenant notification failed:',
      billingErrorMessage(
        notificationError,
      ),
    );
  }
}

export async function attachTenantPaymentProof(
  params: {
    claimId: string;
    tenancyId: string;
    photoUri: string;
    existingProofPath?: string;
  },
) {
  const client =
    requireSupabase();

  const newPath =
    await uploadProofImage(
      params.tenancyId,
      'payment',
      params.photoUri,
    );

  const {
    error,
  } =
    await client.rpc(
      'set_tenant_payment_proof',
      {
        p_claim_id:
          params.claimId,

        p_proof_path:
          newPath,
      },
    );

  if (
    error
  ) {
    await removeProofImage(
      newPath,
    );

    throwBillingError(
      error,
      'Unable to attach payment proof.',
    );
  }

  if (
    params.existingProofPath &&
    params.existingProofPath !==
      newPath
  ) {
    await removeProofImage(
      params.existingProofPath,
    );
  }

  return newPath;
}

export async function removeTenantPaymentProof(
  params: {
    claimId: string;
    proofPath?: string;
  },
) {
  const client =
    requireSupabase();

  const {
    error,
  } =
    await client.rpc(
      'set_tenant_payment_proof',
      {
        p_claim_id:
          params.claimId,

        p_proof_path:
          null,
      },
    );

  if (
    error
  ) {
    throwBillingError(
      error,
      'Unable to remove payment proof.',
    );
  }

  await removeProofImage(
    params.proofPath,
  );
}