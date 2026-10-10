import {
  QueryClient,
} from '@tanstack/react-query';

export const queryClient =
  new QueryClient({
    defaultOptions: {
      queries: {
        /*
         * Server data stays fresh until Dometra explicitly
         * invalidates it after a mutation.
         *
         * This is intentional:
         *
         * Screen A
         *   -> Screen B
         *   -> Back
         *
         * must NOT perform another Supabase request.
         */
        staleTime:
          Infinity,

        /*
         * Keep unused screen data in memory for one hour.
         *
         * If the app process is killed, this cache disappears.
         * We intentionally do not persist it to disk yet.
         */
        gcTime:
          60 *
          60 *
          1000,

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


export const queryKeys = {
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


  readings:
    [
      'readings',
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


  notifications:
    [
      'notifications',
    ] as const,


  notificationCount:
    [
      'notifications',
      'unread-count',
    ] as const,
};


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


export async function invalidateNotifications() {
  await Promise.all([
    queryClient.invalidateQueries({
      queryKey:
        queryKeys.notifications,
    }),

    queryClient.invalidateQueries({
      queryKey:
        queryKeys.notificationCount,
    }),
  ]);
}


export function clearQueryCache() {
  queryClient.clear();
}