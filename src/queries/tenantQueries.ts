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
  getMeterSubmissionStatus,
  MeterSubmissionStatus,
} from '../services/meterSubmissionStatus';

import {
  loadTenantApartments,
} from '../services/tenantPortalRepository';

import {
  loadTenantRentalHistory,
} from '../services/tenantRentalHistoryRepository';


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
 * SHARED TENANT APARTMENTS CACHE
 * ============================================================
 *
 * Tenant Home and Readings use the same apartment payload.
 *
 * With staleTime = Infinity this query is reused until a
 * mutation explicitly invalidates it.
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


/*
 * ============================================================
 * METER SUBMISSION STATUS
 * ============================================================
 *
 * This is NOT server state.
 *
 * meterSubmissionStatus.ts derives the current state from
 * Meter.registers[].lastBillingPeriod.
 *
 * Therefore we should NOT make another Supabase request and
 * should NOT maintain a separate server query for this data.
 *
 * Whenever cached apartment meter readings are invalidated,
 * these values are recalculated from the fresh apartment data.
 * ============================================================
 */

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


export async function loadTenantHomeQuery():
Promise<TenantHomeQueryData> {
  /*
   * Active apartments are critical.
   */
  const apartments =
    await loadCachedTenantApartments();


  /*
   * Previous rentals are supplementary.
   *
   * Historical-data failure must not break active tenancy UI.
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
  /*
   * This is the only server request required for the meter
   * submission states themselves.
   *
   * Statuses are calculated from the returned meter data.
   */
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