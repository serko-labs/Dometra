import {
  queryClient,
  queryKeys,
} from '../lib/queryClient';

import {
  currentBillingPeriod,
  loadPaymentClaims,
} from '../services/billingRepository';

import {
  loadCheckoutSummaries,
} from '../services/checkoutRepository';

import {
  loadMeterSubmissionStatuses,
} from '../services/meterSubmissionStatus';

import {
  loadTenantApartments,
} from '../services/tenantPortalRepository';

import {
  loadTenantRentalHistory,
} from '../services/tenantRentalHistoryRepository';


/*
 * Do not depend on repository-internal types being exported.
 *
 * The repository functions are already strongly typed, so we
 * derive all cache types directly from their return values.
 */

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


export type MeterSubmissionStatuses =
  Awaited<
    ReturnType<
      typeof loadMeterSubmissionStatuses
    >
  >;


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


export interface TenantReadingsQueryData {
  apartments:
    TenantApartments;

  meterStatuses:
    MeterSubmissionStatuses;

  checkouts:
    CheckoutSummaries;
}


/*
 * ============================================================
 * SHARED TENANT APARTMENTS
 * ============================================================
 *
 * Tenant Home and Readings both need this same relatively
 * expensive portal payload.
 *
 * fetchQuery() means:
 *
 * first consumer
 *   -> Supabase
 *
 * second consumer
 *   -> existing QueryClient cache
 *
 * until explicit invalidation occurs.
 * ============================================================
 */

export async function loadCachedTenantApartments():
Promise<TenantApartments> {
  return queryClient.fetchQuery({
    queryKey:
      queryKeys.tenantApartments,

    queryFn:
      () =>
        loadTenantApartments(),
  });
}


async function loadCachedPreviousRentals():
Promise<PreviousRentals> {
  return queryClient.fetchQuery({
    queryKey:
      queryKeys.previousRentals,

    queryFn:
      () =>
        loadTenantRentalHistory(),
  });
}


async function loadCachedMeterSubmissionStatuses():
Promise<MeterSubmissionStatuses> {
  return queryClient.fetchQuery({
    queryKey:
      queryKeys.meterSubmissionStatuses,

    queryFn:
      () =>
        loadMeterSubmissionStatuses(),
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
      queryKeys.paymentClaims(
        period,
        tenancyIds,
      ),

    queryFn:
      () =>
        loadPaymentClaims(
          tenancyIds,
          period,
        ),
  });
}


async function loadCachedCheckoutSummaries(
  tenancyIds:
    string[],
): Promise<CheckoutSummaries> {
  return queryClient.fetchQuery({
    queryKey:
      queryKeys.checkoutSummaries(
        tenancyIds,
      ),

    queryFn:
      () =>
        loadCheckoutSummaries(
          tenancyIds,
        ),
  });
}


export async function loadTenantHomeQuery():
Promise<TenantHomeQueryData> {
  /*
   * Apartments are critical.
   *
   * If this fails, Tenant Home itself cannot be rendered.
   */
  const apartments =
    await loadCachedTenantApartments();


  /*
   * Previous rentals are supplementary.
   *
   * A historical-data issue should not break active tenancy
   * access.
   */
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


  let paymentClaims =
    {} as PaymentClaims;

  let checkouts =
    {} as CheckoutSummaries;


  try {
    paymentClaims =
      await loadCachedPaymentClaims(
        tenancyIds,
      );
  } catch (
    error
  ) {
    console.warn(
      '[Dometra Tenant Home] Unable to load payment claims:',
      error,
    );
  }


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


  return {
    apartments,

    previousRentals,

    paymentClaims,

    checkouts,
  };
}


export async function loadTenantReadingsQuery():
Promise<TenantReadingsQueryData> {
  const apartments =
    await loadCachedTenantApartments();


  const tenancyIds =
    apartments.map(
      apartment =>
        apartment.tenancyId,
    );


  const meterStatusesPromise =
    loadCachedMeterSubmissionStatuses();


  const checkoutsPromise:
    Promise<CheckoutSummaries> =
    tenancyIds.length >
    0
      ? loadCachedCheckoutSummaries(
          tenancyIds,
        ).catch(
          error => {
            console.warn(
              '[Dometra Readings] Unable to load checkout status:',
              error,
            );

            return {} as CheckoutSummaries;
          },
        )

      : Promise.resolve(
          {} as CheckoutSummaries,
        );


  const [
    meterStatuses,
    checkouts,
  ] =
    await Promise.all([
      meterStatusesPromise,
      checkoutsPromise,
    ]);


  return {
    apartments,

    meterStatuses,

    checkouts,
  };
}