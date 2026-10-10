import {
  supabase,
} from '../lib/supabase';

export type LandlordCacheKey =
  readonly (
    | string
    | number
    | boolean
    | null
    | undefined
  )[];

interface CacheEntry<T> {
  hasValue: boolean;
  value?: T;
  updatedAt: number;
  invalidated: boolean;
  inFlight?: Promise<T>;
}

export interface LandlordCacheSnapshot<T> {
  hasValue: boolean;
  value?: T;
  updatedAt?: number;
  stale: boolean;
}

export interface LoadLandlordCacheOptions {
  ttlMs?: number;
  force?: boolean;
}

export const landlordCacheTtl = {
  portfolio: 60_000,
  propertyTenancy: 30_000,
  propertyHistory: 30_000,
  propertyInvoices: 30_000,
  propertyIcons: 5 * 60_000,
} as const;

export const landlordCacheKeys = {
  portfolio: (
    billingPeriod: string,
  ): LandlordCacheKey => [
    'landlord',
    'portfolio',
    billingPeriod,
  ],

  property: (
    propertyId: string,
  ): LandlordCacheKey => [
    'landlord',
    'property',
    propertyId,
  ],

  propertyTenancy: (
    propertyId: string,
  ): LandlordCacheKey => [
    'landlord',
    'property',
    propertyId,
    'tenancy',
  ],

  propertyHistory: (
    propertyId: string,
    limit = 30,
  ): LandlordCacheKey => [
    'landlord',
    'property',
    propertyId,
    'history',
    limit,
  ],

  propertyHistoryPrefix: (
    propertyId: string,
  ): LandlordCacheKey => [
    'landlord',
    'property',
    propertyId,
    'history',
  ],

  propertyInvoices: (
    propertyId: string,
  ): LandlordCacheKey => [
    'landlord',
    'property',
    propertyId,
    'invoices',
  ],

  propertyIcons: (
    propertyIds: string[],
  ): LandlordCacheKey => [
    'landlord',
    'property-icons',
    [...propertyIds]
      .sort()
      .join(','),
  ],

  propertyIconsPrefix: (): LandlordCacheKey => [
    'landlord',
    'property-icons',
  ],
} as const;

const cache =
  new Map<
    string,
    CacheEntry<unknown>
  >();

let authListenerStarted =
  false;

let currentUserId:
  | string
  | null
  | undefined;

function serializeKey(
  key: LandlordCacheKey,
) {
  return key
    .map(part =>
      JSON.stringify(
        part ?? null,
      ),
    )
    .join('|');
}

function isPrefixMatch(
  candidate: string,
  prefix: string,
) {
  return (
    candidate === prefix ||
    candidate.startsWith(
      `${prefix}|`,
    )
  );
}

function ensureAuthListener() {
  if (
    authListenerStarted ||
    !supabase
  ) {
    return;
  }

  authListenerStarted =
    true;

  const client =
    supabase as any;

  client.auth.onAuthStateChange(
    (
      _event: string,
      session: any,
    ) => {
      const nextUserId =
        session?.user?.id ??
        null;

      if (
        currentUserId !==
          undefined &&
        currentUserId !==
          nextUserId
      ) {
        clearLandlordCache();
      }

      currentUserId =
        nextUserId;
    },
  );
}

export function readLandlordCache<T>(
  key: LandlordCacheKey,
): LandlordCacheSnapshot<T> {
  ensureAuthListener();

  const entry =
    cache.get(
      serializeKey(key),
    ) as
      | CacheEntry<T>
      | undefined;

  if (
    !entry ||
    !entry.hasValue
  ) {
    return {
      hasValue: false,
      stale: true,
    };
  }

  return {
    hasValue: true,
    value: entry.value,
    updatedAt:
      entry.updatedAt,
    stale:
      entry.invalidated,
  };
}

export function hasLandlordCache(
  key: LandlordCacheKey,
) {
  return readLandlordCache(
    key,
  ).hasValue;
}

export async function loadLandlordCachedQuery<T>(
  key: LandlordCacheKey,
  loader: () => Promise<T>,
  options: LoadLandlordCacheOptions = {},
): Promise<T> {
  ensureAuthListener();

  const cacheKey =
    serializeKey(key);

  const ttlMs =
    options.ttlMs ??
    60_000;

  let entry =
    cache.get(
      cacheKey,
    ) as
      | CacheEntry<T>
      | undefined;

  const now =
    Date.now();

  if (
    !options.force &&
    entry?.hasValue &&
    !entry.invalidated &&
    now -
      entry.updatedAt <
      ttlMs
  ) {
    return entry.value as T;
  }

  if (
    entry?.inFlight
  ) {
    return entry.inFlight;
  }

  if (!entry) {
    entry = {
      hasValue: false,
      updatedAt: 0,
      invalidated: true,
    };

    cache.set(
      cacheKey,
      entry as CacheEntry<unknown>,
    );
  }

  const target =
    entry;

  const request =
    loader()
      .then(value => {
        target.hasValue =
          true;

        target.value =
          value;

        target.updatedAt =
          Date.now();

        target.invalidated =
          false;

        target.inFlight =
          undefined;

        cache.set(
          cacheKey,
          target as CacheEntry<unknown>,
        );

        return value;
      })
      .catch(error => {
        target.inFlight =
          undefined;

        cache.set(
          cacheKey,
          target as CacheEntry<unknown>,
        );

        throw error;
      });

  target.inFlight =
    request;

  cache.set(
    cacheKey,
    target as CacheEntry<unknown>,
  );

  return request;
}

export function invalidateLandlordCache(
  keyPrefix: LandlordCacheKey,
) {
  const prefix =
    serializeKey(
      keyPrefix,
    );

  for (
    const [
      key,
      entry,
    ] of cache.entries()
  ) {
    if (
      isPrefixMatch(
        key,
        prefix,
      )
    ) {
      entry.invalidated =
        true;
    }
  }
}

export function invalidateLandlordPortfolioCache(
  billingPeriod?: string,
) {
  invalidateLandlordCache(
    billingPeriod
      ? landlordCacheKeys.portfolio(
          billingPeriod,
        )
      : [
          'landlord',
          'portfolio',
        ],
  );
}

export function clearLandlordCache() {
  cache.clear();
}

ensureAuthListener();