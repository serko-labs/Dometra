import {
  QueryClient,
} from '@tanstack/react-query';

const ONE_HOUR =
  60 *
  60 *
  1000;

export const queryClient =
  new QueryClient({
    defaultOptions: {
      queries: {
        /*
         * Dometra uses explicit invalidation after mutations.
         *
         * Going:
         *
         * Screen A
         *   -> Screen B
         *   -> Back
         *
         * must not automatically hit Supabase again.
         */
        staleTime:
          Infinity,

        /*
         * Keep inactive screen data in memory.
         *
         * This cache is intentionally NOT persisted to disk.
         * Closing / killing the app gives us a clean load.
         */
        gcTime:
          ONE_HOUR,

        retry:
          1,

        refetchOnMount:
          false,

        refetchOnWindowFocus:
          false,

        refetchOnReconnect:
          false,
      },

      mutations: {
        retry:
          0,
      },
    },
  });


function sortedIds(
  ids:
    string[],
) {
  return [
    ...ids,
  ].sort();
}


export const queryKeys = {
  /*
   * ----------------------------------------------------------
   * TENANT
   * ----------------------------------------------------------
   */

  tenantRoot:
    [
      'tenant',
    ] as const,


  tenantHome:
    [
      'tenant',
      'home',
    ] as const,


  tenantApartments:
    [
      'tenant',
      'apartments',
    ] as const,


  tenantReadings:
    [
      'tenant',
      'readings',
    ] as const,


  tenantMeter:
    (
      meterId:
        string,
    ) =>
      [
        'tenant',
        'meter',
        meterId,
      ] as const,


  tenantApartment:
    (
      tenancyId:
        string,
    ) =>
      [
        'tenant',
        'apartment',
        tenancyId,
      ] as const,


  tenantStatistics:
    [
      'tenant',
      'statistics',
    ] as const,


  tenantBilling:
    (
      tenancyId:
        string,
    ) =>
      [
        'tenant',
        'billing',
        tenancyId,
      ] as const,


  billingHistory:
    (
      tenancyId:
        string,
    ) =>
      [
        'tenant',
        'billing-history',
        tenancyId,
      ] as const,


  previousRentals:
    [
      'tenant',
      'previous-rentals',
    ] as const,


  previousRental:
    (
      tenancyId:
        string,
    ) =>
      [
        'tenant',
        'previous-rental',
        tenancyId,
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
        sortedIds(
          tenancyIds,
        ),
      ] as const,


  checkoutSummaries:
    (
      tenancyIds:
        string[],
    ) =>
      [
        'checkout',
        'summaries',
        sortedIds(
          tenancyIds,
        ),
      ] as const,


  /*
   * ----------------------------------------------------------
   * READINGS
   * ----------------------------------------------------------
   */

  readingsRoot:
    [
      'readings',
    ] as const,


  meterSubmissionStatuses:
    [
      'readings',
      'submission-statuses',
    ] as const,


  /*
   * ----------------------------------------------------------
   * LANDLORD
   * ----------------------------------------------------------
   */

  landlordRoot:
    [
      'landlord',
    ] as const,


  landlordDashboard:
    [
      'landlord',
      'dashboard',
    ] as const,


  landlordStatistics:
    [
      'landlord',
      'statistics',
    ] as const,


  property:
    (
      propertyId:
        string,
    ) =>
      [
        'property',
        propertyId,
      ] as const,


  propertyHistory:
    (
      propertyId:
        string,
    ) =>
      [
        'property',
        propertyId,
        'history',
      ] as const,


  tenancy:
    (
      tenancyId:
        string,
    ) =>
      [
        'tenancy',
        tenancyId,
      ] as const,


  /*
   * ----------------------------------------------------------
   * CHECKOUT
   * ----------------------------------------------------------
   */

  checkoutRoot:
    [
      'checkout',
    ] as const,


  checkout:
    (
      tenancyId:
        string,
    ) =>
      [
        'checkout',
        tenancyId,
      ] as const,


  checkoutFinalBill:
    (
      tenancyId:
        string,
    ) =>
      [
        'checkout',
        tenancyId,
        'final-bill',
      ] as const,


  checkoutSettlement:
    (
      tenancyId:
        string,
    ) =>
      [
        'checkout',
        tenancyId,
        'settlement',
      ] as const,


  /*
   * ----------------------------------------------------------
   * NOTIFICATIONS
   * ----------------------------------------------------------
   */

  notifications:
    [
      'notifications',
    ] as const,
};


/*
 * ============================================================
 * INVALIDATION HELPERS
 * ============================================================
 *
 * The screen does NOT decide what else depends on its data.
 *
 * Mutations call one of these helpers instead.
 *
 * That keeps invalidation centralized.
 * ============================================================
 */


export async function invalidateTenantData(
  tenancyId?:
    string,
) {
  const tasks:
    Promise<unknown>[] =
    [
      queryClient.invalidateQueries({
        queryKey:
          queryKeys.tenantHome,
      }),

      queryClient.invalidateQueries({
        queryKey:
          queryKeys.tenantApartments,
      }),

      queryClient.invalidateQueries({
        queryKey:
          queryKeys.tenantReadings,
      }),

      queryClient.invalidateQueries({
        queryKey:
          queryKeys.tenantStatistics,
      }),

      queryClient.invalidateQueries({
        queryKey:
          queryKeys.previousRentals,
      }),
    ];


  if (
    tenancyId
  ) {
    tasks.push(
      queryClient.invalidateQueries({
        queryKey:
          queryKeys.tenantApartment(
            tenancyId,
          ),
      }),

      queryClient.invalidateQueries({
        queryKey:
          queryKeys.tenantBilling(
            tenancyId,
          ),
      }),

      queryClient.invalidateQueries({
        queryKey:
          queryKeys.billingHistory(
            tenancyId,
          ),
      }),

      queryClient.invalidateQueries({
        queryKey:
          queryKeys.previousRental(
            tenancyId,
          ),
      }),
    );
  }


  await Promise.all(
    tasks,
  );
}


export async function invalidateReadingsData(
  propertyId?:
    string,
) {
  const tasks:
    Promise<unknown>[] =
    [
      queryClient.invalidateQueries({
        queryKey:
          queryKeys.tenantHome,
      }),

      queryClient.invalidateQueries({
        queryKey:
          queryKeys.tenantApartments,
      }),

      queryClient.invalidateQueries({
        queryKey:
          queryKeys.tenantReadings,
      }),

      queryClient.invalidateQueries({
        queryKey:
          queryKeys.tenantStatistics,
      }),

      queryClient.invalidateQueries({
        queryKey:
          queryKeys.readingsRoot,
      }),

      queryClient.invalidateQueries({
        queryKey:
          queryKeys.landlordDashboard,
      }),

      queryClient.invalidateQueries({
        queryKey:
          queryKeys.landlordStatistics,
      }),
    ];


  if (
    propertyId
  ) {
    tasks.push(
      queryClient.invalidateQueries({
        queryKey:
          queryKeys.property(
            propertyId,
          ),
      }),

      queryClient.invalidateQueries({
        queryKey:
          queryKeys.propertyHistory(
            propertyId,
          ),
      }),
    );
  }


  await Promise.all(
    tasks,
  );
}


export async function invalidateLandlordData(
  propertyId?:
    string,
) {
  const tasks:
    Promise<unknown>[] =
    [
      queryClient.invalidateQueries({
        queryKey:
          queryKeys.landlordDashboard,
      }),

      queryClient.invalidateQueries({
        queryKey:
          queryKeys.landlordStatistics,
      }),
    ];


  if (
    propertyId
  ) {
    tasks.push(
      queryClient.invalidateQueries({
        queryKey:
          queryKeys.property(
            propertyId,
          ),
      }),

      queryClient.invalidateQueries({
        queryKey:
          queryKeys.propertyHistory(
            propertyId,
          ),
      }),
    );
  }


  await Promise.all(
    tasks,
  );
}


export async function invalidateCheckoutData(
  tenancyId:
    string,

  propertyId?:
    string,
) {
  const tasks:
    Promise<unknown>[] =
    [
      queryClient.invalidateQueries({
        queryKey:
          queryKeys.checkout(
            tenancyId,
          ),
      }),

      queryClient.invalidateQueries({
        queryKey:
          queryKeys.checkoutFinalBill(
            tenancyId,
          ),
      }),

      queryClient.invalidateQueries({
        queryKey:
          queryKeys.checkoutSettlement(
            tenancyId,
          ),
      }),

      queryClient.invalidateQueries({
        queryKey:
          queryKeys.checkoutRoot,
      }),

      queryClient.invalidateQueries({
        queryKey:
          queryKeys.tenantHome,
      }),

      queryClient.invalidateQueries({
        queryKey:
          queryKeys.tenantApartments,
      }),

      queryClient.invalidateQueries({
        queryKey:
          queryKeys.tenantReadings,
      }),

      queryClient.invalidateQueries({
        queryKey:
          queryKeys.tenantApartment(
            tenancyId,
          ),
      }),

      queryClient.invalidateQueries({
        queryKey:
          queryKeys.tenantBilling(
            tenancyId,
          ),
      }),

      queryClient.invalidateQueries({
        queryKey:
          queryKeys.billingHistory(
            tenancyId,
          ),
      }),

      queryClient.invalidateQueries({
        queryKey:
          queryKeys.previousRentals,
      }),

      queryClient.invalidateQueries({
        queryKey:
          queryKeys.landlordDashboard,
      }),

      queryClient.invalidateQueries({
        queryKey:
          queryKeys.landlordStatistics,
      }),

      queryClient.invalidateQueries({
        queryKey:
          queryKeys.notifications,
      }),
    ];


  if (
    propertyId
  ) {
    tasks.push(
      queryClient.invalidateQueries({
        queryKey:
          queryKeys.property(
            propertyId,
          ),
      }),

      queryClient.invalidateQueries({
        queryKey:
          queryKeys.propertyHistory(
            propertyId,
          ),
      }),
    );
  }


  await Promise.all(
    tasks,
  );
}


export async function invalidateNotifications() {
  await queryClient.invalidateQueries({
    queryKey:
      queryKeys.notifications,
  });
}


export async function refreshAllServerData() {
  await queryClient.invalidateQueries();
}


export function clearQueryCache() {
  queryClient.clear();
}