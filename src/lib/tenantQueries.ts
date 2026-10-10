import {
  queryClient,
} from '../lib/queryClient';

import {
  supabase,
} from '../lib/supabase';

import {
  currentBillingPeriod,
  loadPaymentClaims,
} from '../services/billingRepository';

import {
  loadCheckoutSummaries,
} from '../services/checkoutRepository';

import {
  loadTenantFinanceBalances,
  TenantFinanceBalance,
} from '../services/financeRepository';

import {
  getMeterSubmissionStatus,
  MeterSubmissionStatus,
} from '../services/meterSubmissionStatus';

import {
  loadTenantApartments,
  TenantApartmentPortal,
  TenantMeterContext,
} from '../services/tenantPortalRepository';

import {
  loadTenantRentalHistory,
} from '../services/tenantRentalHistoryRepository';

import {
  loadTenantExpenseStatistics,
  TenantExpenseStatistics,
} from '../services/tenantStatisticsRepository';

import {
  loadTenantMonthlyBills,
  TenantMonthlyBillSummary,
} from '../services/tenantBillingSummaryRepository';

export const tenantQueryKeys = {
  root:
    [
      'tenant',
    ] as const,

  apartments:
    [
      'tenant',
      'apartments',
    ] as const,

  home:
    [
      'tenant',
      'home',
    ] as const,

  previousRentals:
    [
      'tenant',
      'previous-rentals',
    ] as const,

  apartment:
    (
      tenancyId:
        string,
    ) =>
      [
        'tenant',
        'apartment',
        tenancyId,
      ] as const,

  apartmentRoot:
    [
      'tenant',
      'apartment',
    ] as const,

  financeBalances:
    (
      tenancyIds:
        string[],
    ) =>
      [
        'tenant',
        'finance-balances',
        normalizedIds(
          tenancyIds,
        ),
      ] as const,

  financeBalancesRoot:
    [
      'tenant',
      'finance-balances',
    ] as const,

  checkoutSummaries:
    (
      tenancyIds:
        string[],
    ) =>
      [
        'tenant',
        'checkout-summaries',
        normalizedIds(
          tenancyIds,
        ),
      ] as const,

  checkoutSummariesRoot:
    [
      'tenant',
      'checkout-summaries',
    ] as const,

  paymentClaims:
    (
      billingPeriod:
        string,

      tenancyIds:
        string[],
    ) =>
      [
        'tenant',
        'payment-claims',
        billingPeriod,
        normalizedIds(
          tenancyIds,
        ),
      ] as const,

  paymentClaimsRoot:
    [
      'tenant',
      'payment-claims',
    ] as const,

  monthlyBills:
    (
      tenancyId:
        string,
    ) =>
      [
        'tenant',
        'monthly-bills',
        tenancyId,
      ] as const,

  monthlyBillsRoot:
    [
      'tenant',
      'monthly-bills',
    ] as const,

  readings:
    [
      'tenant',
      'readings',
    ] as const,

  statisticsView:
    [
      'tenant',
      'statistics-view',
    ] as const,

  statistics:
    (
      tenancyIds:
        string[],
    ) =>
      [
        'tenant',
        'statistics',
        normalizedIds(
          tenancyIds,
        ),
      ] as const,

  statisticsRoot:
    [
      'tenant',
      'statistics',
    ] as const,
} as const;

export const tenantQueryOptions = {
  /*
   * Tenant server state is loaded once per authenticated app
   * session.
   *
   * We refresh it explicitly after actual mutations instead of
   * reloading every time navigation focuses a screen.
   */
  staleTime:
    Infinity,

  gcTime:
    Infinity,

  refetchOnMount:
    false,

  refetchOnWindowFocus:
    false,

  refetchOnReconnect:
    false,
} as const;

export type TenantApartments =
  Awaited<
    ReturnType<
      typeof loadTenantApartments
    >
  >;

export type PreviousRentals =
  Awaited<
    ReturnType<
      typeof loadTenantRentalHistory
    >
  >;

export type PaymentClaims =
  Awaited<
    ReturnType<
      typeof loadPaymentClaims
    >
  >;

export type CheckoutSummaries =
  Awaited<
    ReturnType<
      typeof loadCheckoutSummaries
    >
  >;

export type CheckoutSummary =
  CheckoutSummaries extends Record<
    string,
    infer TCheckout
  >
    ? TCheckout
    : never;

export type MeterSubmissionStatuses =
  MeterSubmissionStatus[];

export interface TenantHomeQueryData {
  apartments:
    TenantApartments;

  previousRentals:
    PreviousRentals;

  paymentClaims:
    PaymentClaims;

  checkouts:
    CheckoutSummaries;
}

export interface TenantHomeApartmentsQueryData {
  apartments:
    TenantApartments;

  checkouts:
    CheckoutSummaries;
}

export interface TenantReadingsQueryData {
  apartments:
    TenantApartments;

  meterStatuses:
    MeterSubmissionStatuses;

  checkouts:
    CheckoutSummaries;
}

export interface TenantApartmentQueryData {
  apartment:
    TenantApartmentPortal;

  balance:
    TenantFinanceBalance | null;

  checkout:
    | CheckoutSummary
    | undefined;

  monthlyBills:
    TenantMonthlyBillSummary[];
}

export interface TenantStatisticsQueryData {
  apartments:
    TenantApartments;

  statistics:
    TenantExpenseStatistics;
}

function normalizedIds(
  tenancyIds:
    string[],
) {
  return Array.from(
    new Set(
      tenancyIds,
    ),
  )
    .sort()
    .join(',');
}

/*
 * Cache must never leak between authenticated users.
 */
let authListenerStarted =
  false;

let cachedUserId:
  | string
  | null
  | undefined;

function ensureTenantCacheIsolation() {
  if (
    authListenerStarted ||
    !supabase
  ) {
    return;
  }

  authListenerStarted =
    true;

  const client =
    supabase;

  client.auth.onAuthStateChange(
    (
      _event,
      session,
    ) => {
      const nextUserId =
        session?.user?.id ??
        null;

      if (
        cachedUserId !==
          undefined &&
        cachedUserId !==
          nextUserId
      ) {
        queryClient.removeQueries({
          queryKey:
            tenantQueryKeys.root,
        });
      }

      cachedUserId =
        nextUserId;
    },
  );
}

ensureTenantCacheIsolation();

export async function loadCachedTenantApartments():
Promise<TenantApartments> {
  return queryClient.fetchQuery({
    queryKey:
      tenantQueryKeys.apartments,

    queryFn:
      () =>
        loadTenantApartments(),

    staleTime:
      Infinity,

    gcTime:
      Infinity,
  });
}

async function loadCachedPreviousRentals():
Promise<PreviousRentals> {
  return queryClient.fetchQuery({
    queryKey:
      tenantQueryKeys.previousRentals,

    queryFn:
      () =>
        loadTenantRentalHistory(),

    staleTime:
      Infinity,

    gcTime:
      Infinity,
  });
}

export async function loadCachedTenantFinanceBalances(
  tenancyIds:
    string[],
) {
  if (
    tenancyIds.length ===
    0
  ) {
    return [] as Awaited<
      ReturnType<
        typeof loadTenantFinanceBalances
      >
    >;
  }

  return queryClient.fetchQuery({
    queryKey:
      tenantQueryKeys.financeBalances(
        tenancyIds,
      ),

    queryFn:
      () =>
        loadTenantFinanceBalances(
          tenancyIds,
        ),

    staleTime:
      Infinity,

    gcTime:
      Infinity,
  });
}

async function loadCachedPaymentClaims(
  tenancyIds:
    string[],
): Promise<PaymentClaims> {
  const period =
    currentBillingPeriod();

  return queryClient.fetchQuery({
    queryKey:
      tenantQueryKeys.paymentClaims(
        period,
        tenancyIds,
      ),

    queryFn:
      () =>
        loadPaymentClaims(
          tenancyIds,
          period,
        ),

    staleTime:
      Infinity,

    gcTime:
      Infinity,
  });
}

export async function loadCachedCheckoutSummaries(
  tenancyIds:
    string[],
): Promise<CheckoutSummaries> {
  if (
    tenancyIds.length ===
    0
  ) {
    return {} as CheckoutSummaries;
  }

  return queryClient.fetchQuery({
    queryKey:
      tenantQueryKeys.checkoutSummaries(
        tenancyIds,
      ),

    queryFn:
      () =>
        loadCheckoutSummaries(
          tenancyIds,
        ),

    staleTime:
      Infinity,

    gcTime:
      Infinity,
  });
}

export async function loadCachedTenantMonthlyBills(
  tenancyId:
    string,
) {
  return queryClient.fetchQuery({
    queryKey:
      tenantQueryKeys.monthlyBills(
        tenancyId,
      ),

    queryFn:
      () =>
        loadTenantMonthlyBills(
          tenancyId,
        ),

    staleTime:
      Infinity,

    gcTime:
      Infinity,
  });
}

async function loadCachedTenantStatistics(
  apartments:
    TenantApartments,
) {
  const tenancyIds =
    apartments.map(
      apartment =>
        apartment.tenancyId,
    );

  return queryClient.fetchQuery({
    queryKey:
      tenantQueryKeys.statistics(
        tenancyIds,
      ),

    queryFn:
      () =>
        loadTenantExpenseStatistics(
          apartments,
        ),

    staleTime:
      Infinity,

    gcTime:
      Infinity,
  });
}

function createMeterSubmissionStatuses(
  apartments:
    TenantApartments,
): MeterSubmissionStatuses {
  return apartments.flatMap(
    apartment =>
      apartment.meters
        .filter(
          meter =>
            meter.billingMode ===
            'METERED',
        )
        .map(
          meter =>
            getMeterSubmissionStatus(
              meter,
            ),
        ),
  );
}

export async function loadTenantHomeApartmentsQuery():
Promise<TenantHomeApartmentsQueryData> {
  const apartments =
    await loadCachedTenantApartments();

  const tenancyIds =
    apartments.map(
      apartment =>
        apartment.tenancyId,
    );

  let checkouts =
    {} as CheckoutSummaries;

  if (
    tenancyIds.length >
    0
  ) {
    try {
      checkouts =
        await loadCachedCheckoutSummaries(
          tenancyIds,
        );
    } catch (
      error
    ) {
      console.warn(
        '[Dometra Tenant Home] Unable to load checkout status:',
        error,
      );
    }
  }

  return {
    apartments,
    checkouts,
  };
}

export async function loadTenantHomeQuery():
Promise<TenantHomeQueryData> {
  const apartments =
    await loadCachedTenantApartments();

  let previousRentals =
    [] as PreviousRentals;

  try {
    previousRentals =
      await loadCachedPreviousRentals();
  } catch (
    error
  ) {
    console.warn(
      '[Dometra Tenant Home] Unable to load previous rentals:',
      error,
    );
  }

  const tenancyIds =
    apartments.map(
      apartment =>
        apartment.tenancyId,
    );

  if (
    tenancyIds.length ===
    0
  ) {
    return {
      apartments,

      previousRentals,

      paymentClaims:
        {} as PaymentClaims,

      checkouts:
        {} as CheckoutSummaries,
    };
  }

  const [
    paymentClaims,
    checkouts,
  ] =
    await Promise.all([
      loadCachedPaymentClaims(
        tenancyIds,
      ).catch(
        error => {
          console.warn(
            '[Dometra Tenant Home] Unable to load payment claims:',
            error,
          );

          return {} as PaymentClaims;
        },
      ),

      loadCachedCheckoutSummaries(
        tenancyIds,
      ).catch(
        error => {
          console.warn(
            '[Dometra Tenant Home] Unable to load checkout status:',
            error,
          );

          return {} as CheckoutSummaries;
        },
      ),
    ]);

  return {
    apartments,
    previousRentals,
    paymentClaims,
    checkouts,
  };
}

export async function loadTenantApartmentQuery(
  tenancyId:
    string,
): Promise<TenantApartmentQueryData> {
  const apartments =
    await loadCachedTenantApartments();

  const apartment =
    apartments.find(
      item =>
        item.tenancyId ===
        tenancyId,
    );

  if (
    !apartment
  ) {
    throw new Error(
      'Apartment not found.',
    );
  }

  const [
    finance,
    checkouts,
    monthlyBills,
  ] =
    await Promise.all([
      loadCachedTenantFinanceBalances(
        [
          tenancyId,
        ],
      ).catch(
        error => {
          console.warn(
            '[Dometra Tenant Apartment] Unable to load finance balance:',
            error,
          );

          return [] as Awaited<
            ReturnType<
              typeof loadTenantFinanceBalances
            >
          >;
        },
      ),

      loadCachedCheckoutSummaries(
        [
          tenancyId,
        ],
      ).catch(
        error => {
          console.warn(
            '[Dometra Tenant Apartment] Unable to load checkout status:',
            error,
          );

          return {} as CheckoutSummaries;
        },
      ),

      loadCachedTenantMonthlyBills(
        tenancyId,
      ).catch(
        error => {
          console.warn(
            '[Dometra Tenant Apartment] Unable to load monthly bills:',
            error,
          );

          return [] as TenantMonthlyBillSummary[];
        },
      ),
    ]);

  return {
    apartment,

    balance:
      finance.find(
        item =>
          item.tenancyId ===
          tenancyId,
      ) ??
      finance[0] ??
      null,

    checkout:
      checkouts[
        tenancyId
      ],

    monthlyBills,
  };
}

export async function loadCachedTenantMeterContext(
  meterId:
    string,
): Promise<
  TenantMeterContext | null
> {
  const apartments =
    await loadCachedTenantApartments();

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

export async function loadTenantReadingsQuery():
Promise<TenantReadingsQueryData> {
  const apartments =
    await loadCachedTenantApartments();

  const meterStatuses =
    createMeterSubmissionStatuses(
      apartments,
    );

  const tenancyIds =
    apartments.map(
      apartment =>
        apartment.tenancyId,
    );

  let checkouts =
    {} as CheckoutSummaries;

  if (
    tenancyIds.length >
    0
  ) {
    try {
      checkouts =
        await loadCachedCheckoutSummaries(
          tenancyIds,
        );
    } catch (
      error
    ) {
      console.warn(
        '[Dometra Readings] Unable to load checkout status:',
        error,
      );
    }
  }

  return {
    apartments,
    meterStatuses,
    checkouts,
  };
}

export async function loadTenantStatisticsQuery():
Promise<TenantStatisticsQueryData> {
  const apartments =
    await loadCachedTenantApartments();

  const statistics =
    await loadCachedTenantStatistics(
      apartments,
    );

  return {
    apartments,
    statistics,
  };
}

export async function invalidateTenantApartmentData(
  tenancyId?:
    string,
) {
  const tasks:
    Promise<unknown>[] = [
      queryClient.invalidateQueries({
        queryKey:
          tenantQueryKeys.apartments,
      }),

      queryClient.invalidateQueries({
        queryKey:
          tenantQueryKeys.home,
      }),

      queryClient.invalidateQueries({
        queryKey:
          tenantQueryKeys.readings,
      }),

      queryClient.invalidateQueries({
        queryKey:
          tenantQueryKeys.statisticsRoot,
      }),

      queryClient.invalidateQueries({
        queryKey:
          tenantQueryKeys.statisticsView,
      }),
    ];

  if (
    tenancyId
  ) {
    tasks.push(
      queryClient.invalidateQueries({
        queryKey:
          tenantQueryKeys.apartment(
            tenancyId,
          ),
      }),
    );
  } else {
    tasks.push(
      queryClient.invalidateQueries({
        queryKey:
          tenantQueryKeys.apartmentRoot,
      }),
    );
  }

  await Promise.all(
    tasks,
  );
}

export async function invalidateTenantMeterData() {
  await Promise.all([
    queryClient.invalidateQueries({
      queryKey:
        tenantQueryKeys.apartments,
    }),

    queryClient.invalidateQueries({
      queryKey:
        tenantQueryKeys.home,
    }),

    queryClient.invalidateQueries({
      queryKey:
        tenantQueryKeys.apartmentRoot,
    }),

    queryClient.invalidateQueries({
      queryKey:
        tenantQueryKeys.readings,
    }),

    queryClient.invalidateQueries({
      queryKey:
        tenantQueryKeys.statisticsRoot,
    }),

    queryClient.invalidateQueries({
      queryKey:
        tenantQueryKeys.statisticsView,
    }),
  ]);
}

export async function invalidateTenantCheckoutData(
  tenancyId?:
    string,
) {
  await Promise.all([
    queryClient.invalidateQueries({
      queryKey:
        tenantQueryKeys.checkoutSummariesRoot,
    }),

    queryClient.invalidateQueries({
      queryKey:
        tenantQueryKeys.home,
    }),

    queryClient.invalidateQueries({
      queryKey:
        tenantQueryKeys.readings,
    }),

    queryClient.invalidateQueries({
      queryKey:
        tenancyId
          ? tenantQueryKeys.apartment(
              tenancyId,
            )
          : tenantQueryKeys.apartmentRoot,
    }),
  ]);
}

export async function invalidateTenantBillingData(
  tenancyId?:
    string,
) {
  await Promise.all([
    queryClient.invalidateQueries({
      queryKey:
        tenantQueryKeys.financeBalancesRoot,
    }),

    queryClient.invalidateQueries({
      queryKey:
        tenantQueryKeys.paymentClaimsRoot,
    }),

    queryClient.invalidateQueries({
      queryKey:
        tenancyId
          ? tenantQueryKeys.monthlyBills(
              tenancyId,
            )
          : tenantQueryKeys.monthlyBillsRoot,
    }),

    queryClient.invalidateQueries({
      queryKey:
        tenantQueryKeys.home,
    }),

    queryClient.invalidateQueries({
      queryKey:
        tenancyId
          ? tenantQueryKeys.apartment(
              tenancyId,
            )
          : tenantQueryKeys.apartmentRoot,
    }),

    queryClient.invalidateQueries({
      queryKey:
        tenantQueryKeys.statisticsRoot,
    }),

    queryClient.invalidateQueries({
      queryKey:
        tenantQueryKeys.statisticsView,
    }),
  ]);
}

export function clearTenantQueryCache() {
  queryClient.removeQueries({
    queryKey:
      tenantQueryKeys.root,
  });
}