import {
  supabase,
} from '../lib/supabase';

export interface MeterSubmissionStatus {
  meterId: string;

  propertyId: string;

  tenancyId: string;

  billingPeriod: string;

  requiredRegisterCount: number;

  submittedRegisterCount: number;

  requiredPhotoCount: number;

  submittedPhotoCount: number;

  submitted: boolean;

  submittedAt?: string;

  submittedByTenant: boolean;
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
  value: unknown,
): number {
  const parsed =
    Number(
      value,
    );

  return Number.isFinite(
    parsed,
  )
    ? parsed
    : 0;
}

export async function loadMeterSubmissionStatuses(
  propertyId?: string,
): Promise<
  MeterSubmissionStatus[]
> {
  const client =
    requireSupabase();

  const {
    data,
    error,
  } =
    await client.rpc(
      'get_meter_submission_statuses',
      {
        p_property_id:
          propertyId ??
          null,
      },
    );

  if (
    error
  ) {
    throw error;
  }

  return (
    data ??
    []
  ).map(
    (
      row:
        any,
    ) => ({
      meterId:
        String(
          row.meter_id,
        ),

      propertyId:
        String(
          row.property_id,
        ),

      tenancyId:
        String(
          row.tenancy_id,
        ),

      billingPeriod:
        String(
          row.billing_period,
        ),

      requiredRegisterCount:
        asNumber(
          row.required_register_count,
        ),

      submittedRegisterCount:
        asNumber(
          row.submitted_register_count,
        ),

      requiredPhotoCount:
        asNumber(
          row.required_photo_count,
        ),

      submittedPhotoCount:
        asNumber(
          row.submitted_photo_count,
        ),

      submitted:
        Boolean(
          row.submitted,
        ),

      submittedAt:
        row.submitted_at
          ? String(
              row.submitted_at,
            )
          : undefined,

      submittedByTenant:
        Boolean(
          row.submitted_by_tenant,
        ),
    }),
  );
}

export function findMeterSubmissionStatus(
  statuses:
    MeterSubmissionStatus[],

  meterId:
    string,
):
  | MeterSubmissionStatus
  | undefined {
  return statuses.find(
    status =>
      status.meterId ===
      meterId,
  );
}

export function getCurrentMeterDueText():
string {
  const now =
    new Date();

  const month =
    now.toLocaleDateString(
      undefined,
      {
        month:
          'short',
      },
    );

  return `Send before 5 ${month}`;
}