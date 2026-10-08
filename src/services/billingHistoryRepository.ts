import {
  supabase,
} from '../lib/supabase';

import {
  BillingTotal,
  currentBillingPeriod,
  getTenantPaymentState,
  loadTenantBillingSummary,
  TenantPaymentClaimStatus,
  TenantPaymentState,
} from './billingRepository';

export interface BillingHistoryItem {
  billingPeriod: string;

  paymentDueDay: number;

  state:
    TenantPaymentState;

  totals:
    BillingTotal[];

  ready:
    boolean;

  missingCount:
    number;

  claimStatus?:
    TenantPaymentClaimStatus;
}

interface TenancyRow {
  id: string;

  start_date: string;

  end_date:
    string | null;
}

interface RentTermRow {
  payment_due_day:
    number;

  valid_from:
    string;

  valid_to:
    string | null;
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

function monthStart(
  value:
    string,
) {
  const date =
    new Date(
      `${value.slice(
        0,
        10,
      )}T00:00:00`,
    );

  return new Date(
    date.getFullYear(),
    date.getMonth(),
    1,
  );
}

function periodFromDate(
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

function endOfPeriod(
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

function rentTermForPeriod(
  terms:
    RentTermRow[],

  billingPeriod:
    string,
) {
  const periodStart =
    new Date(
      `${billingPeriod}T00:00:00`,
    );

  const periodEnd =
    endOfPeriod(
      billingPeriod,
    );

  return terms
    .filter(
      term => {
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
      },
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

function buildPeriods(
  startDate:
    string,

  endDate:
    string | undefined,

  limit:
    number,
) {
  const start =
    monthStart(
      startDate,
    );

  const current =
    monthStart(
      currentBillingPeriod(),
    );

  const tenancyEnd =
    endDate
      ? monthStart(
          endDate,
        )
      : current;

  const latest =
    tenancyEnd.getTime() <
    current.getTime()
      ? tenancyEnd
      : current;

  const result:
    string[] = [];

  let cursor =
    new Date(
      latest.getFullYear(),
      latest.getMonth(),
      1,
    );

  while (
    cursor.getTime() >=
      start.getTime() &&
    result.length <
      limit
  ) {
    result.push(
      periodFromDate(
        cursor,
      ),
    );

    cursor =
      new Date(
        cursor.getFullYear(),
        cursor.getMonth() - 1,
        1,
      );
  }

  return result;
}

export async function loadTenancyBillingHistory(
  tenancyId:
    string,

  limit =
    12,
): Promise<
  BillingHistoryItem[]
> {
  const client =
    requireSupabase();

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
        'id,start_date,end_date',
      )
      .eq(
        'id',
        tenancyId,
      )
      .single();

  if (
    tenancyError
  ) {
    throw new Error(
      tenancyError.message ??
      'Unable to load tenancy.',
    );
  }

  const tenancy =
    tenancyData as unknown as TenancyRow;

  const {
    data:
      rentData,

    error:
      rentError,
  } =
    await client
      .from(
        'rent_terms',
      )
      .select(
        [
          'payment_due_day',
          'valid_from',
          'valid_to',
        ].join(
          ',',
        ),
      )
      .eq(
        'tenancy_id',
        tenancyId,
      )
      .order(
        'valid_from',
        {
          ascending:
            false,
        },
      );

  if (
    rentError
  ) {
    throw new Error(
      rentError.message ??
      'Unable to load rent terms.',
    );
  }

  const rentTerms =
    (
      rentData ??
      []
    ) as unknown as RentTermRow[];

  const periods =
    buildPeriods(
      tenancy.start_date,

      tenancy.end_date ??
        undefined,

      Math.max(
        1,
        Math.min(
          limit,
          36,
        ),
      ),
    );

  const rows =
    await Promise.all(
      periods.map(
        async billingPeriod => {
          const summary =
            await loadTenantBillingSummary(
              tenancyId,
              billingPeriod,
            );

          const rentTerm =
            rentTermForPeriod(
              rentTerms,
              billingPeriod,
            );

          const paymentDueDay =
            Number(
              rentTerm
                ?.payment_due_day ??
              5,
            );

          return {
            billingPeriod,

            paymentDueDay,

            state:
              getTenantPaymentState(
                summary.claim,
                billingPeriod,
                paymentDueDay,
              ),

            totals:
              summary.totals,

            ready:
              summary.ready,

            missingCount:
              summary.missingCount,

            claimStatus:
              summary.claim
                ?.status,
          } satisfies BillingHistoryItem;
        },
      ),
    );

  return rows;
}