import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  AppState,
  Platform,
} from 'react-native';

import {
  createClient,
  SupabaseClient,
} from '@supabase/supabase-js';


/*
 * ==========================================================
 * ENVIRONMENT
 * ==========================================================
 */

const supabaseUrl =
  process.env
    .EXPO_PUBLIC_SUPABASE_URL
    ?.trim() ??
  '';

const supabaseKey =
  process.env
    .EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    ?.trim() ??
  process.env
    .EXPO_PUBLIC_SUPABASE_ANON_KEY
    ?.trim() ??
  '';

export const isSupabaseConfigured =
  Boolean(
    supabaseUrl &&
    supabaseKey,
  );


/*
 * ==========================================================
 * LOOSE POSTGREST TYPES
 * ==========================================================
 *
 * Dometra currently uses repository-level interfaces such as:
 *
 * PropertyRow
 * MeterRow
 * InvoiceRow
 * PaymentRow
 * TenancyRow
 * etc.
 *
 * We also currently build a number of select clauses dynamically:
 *
 * .select(
 *   [
 *     'id',
 *     'name',
 *   ].join(','),
 * )
 *
 * Supabase's TypeScript select parser cannot infer those dynamic
 * strings and produces GenericStringError.
 *
 * We therefore keep Auth/Storage/etc. strongly typed but loosen
 * only the PostgREST query layer.
 *
 * Later, after generating Database types from Supabase, we can
 * replace this compatibility layer with SupabaseClient<Database>.
 */

export type LooseRow =
  Record<
    string,
    any
  >;

interface LooseQueryResult<
  T,
> {
  data:
    T;

  error:
    any;

  count?:
    number | null;

  status?:
    number;

  statusText?:
    string;
}

interface LooseQuery<
  T,
> {
  then:
    Promise<
      LooseQueryResult<T>
    >['then'];

  select: (
    columns?:
      string,

    options?:
      any,
  ) => LooseQuery<
    LooseRow[]
  >;

  insert: (
    values:
      any,

    options?:
      any,
  ) => LooseQuery<
    LooseRow[]
  >;

  upsert: (
    values:
      any,

    options?:
      any,
  ) => LooseQuery<
    LooseRow[]
  >;

  update: (
    values:
      any,

    options?:
      any,
  ) => LooseQuery<
    LooseRow[]
  >;

  delete: (
    options?:
      any,
  ) => LooseQuery<
    LooseRow[]
  >;

  eq: (
    column:
      string,

    value:
      any,
  ) => LooseQuery<T>;

  neq: (
    column:
      string,

    value:
      any,
  ) => LooseQuery<T>;

  gt: (
    column:
      string,

    value:
      any,
  ) => LooseQuery<T>;

  gte: (
    column:
      string,

    value:
      any,
  ) => LooseQuery<T>;

  lt: (
    column:
      string,

    value:
      any,
  ) => LooseQuery<T>;

  lte: (
    column:
      string,

    value:
      any,
  ) => LooseQuery<T>;

  like: (
    column:
      string,

    pattern:
      string,
  ) => LooseQuery<T>;

  ilike: (
    column:
      string,

    pattern:
      string,
  ) => LooseQuery<T>;

  is: (
    column:
      string,

    value:
      any,
  ) => LooseQuery<T>;

  in: (
    column:
      string,

    values:
      readonly any[],
  ) => LooseQuery<T>;

  contains: (
    column:
      string,

    value:
      any,
  ) => LooseQuery<T>;

  containedBy: (
    column:
      string,

    value:
      any,
  ) => LooseQuery<T>;

  overlaps: (
    column:
      string,

    value:
      any,
  ) => LooseQuery<T>;

  match: (
    query:
      Record<
        string,
        any
      >,
  ) => LooseQuery<T>;

  not: (
    column:
      string,

    operator:
      string,

    value:
      any,
  ) => LooseQuery<T>;

  or: (
    filters:
      string,

    options?:
      any,
  ) => LooseQuery<T>;

  filter: (
    column:
      string,

    operator:
      string,

    value:
      any,
  ) => LooseQuery<T>;

  order: (
    column:
      string,

    options?:
      {
        ascending?:
          boolean;

        nullsFirst?:
          boolean;

        referencedTable?:
          string;

        foreignTable?:
          string;
      },
  ) => LooseQuery<T>;

  limit: (
    count:
      number,

    options?:
      any,
  ) => LooseQuery<T>;

  range: (
    from:
      number,

    to:
      number,

    options?:
      any,
  ) => LooseQuery<T>;

  single:
    () => LooseQuery<
      LooseRow
    >;

  maybeSingle:
    () => LooseQuery<
      LooseRow | null
    >;

  throwOnError:
    () => LooseQuery<T>;

  abortSignal: (
    signal:
      AbortSignal,
  ) => LooseQuery<T>;

  returns: <
    TResult,
  >() => LooseQuery<
    TResult
  >;
}


/*
 * Keep all regular Supabase APIs typed:
 *
 * auth
 * storage
 * realtime
 * functions
 *
 * Only replace:
 *
 * from()
 * rpc()
 */

export type DometraSupabaseClient =
  Omit<
    SupabaseClient<any>,
    'from' | 'rpc'
  > & {
    from: (
      relation:
        string,
    ) => LooseQuery<
      LooseRow[]
    >;

    rpc: (
      fn:
        string,

      args?:
        Record<
          string,
          any
        >,

      options?:
        any,
    ) => LooseQuery<any>;
  };


/*
 * ==========================================================
 * CLIENT
 * ==========================================================
 */

const rawClient:
  SupabaseClient<any> | null =
  isSupabaseConfigured
    ? createClient(
        supabaseUrl,
        supabaseKey,
        {
          auth: {
            storage:
              AsyncStorage,

            persistSession:
              true,

            autoRefreshToken:
              true,

            detectSessionInUrl:
              false,
          },
        },
      )
    : null;


/*
 * Runtime object remains the normal Supabase client.
 *
 * This cast changes TypeScript's view of PostgREST only.
 */
export const supabase:
  DometraSupabaseClient | null =
  rawClient as
    | DometraSupabaseClient
    | null;


/*
 * ==========================================================
 * REQUIRED CLIENT
 * ==========================================================
 *
 * Repositories should use this helper when a non-null
 * Supabase client is required.
 */

export function requireSupabase():
  DometraSupabaseClient {
  if (
    !supabase
  ) {
    throw new Error(
      'Supabase is not configured.',
    );
  }

  return supabase;
}


/*
 * ==========================================================
 * AUTH TOKEN REFRESH
 * ==========================================================
 */

if (
  Platform.OS !==
    'web' &&
  rawClient
) {
  AppState.addEventListener(
    'change',

    state => {
      if (
        state ===
        'active'
      ) {
        rawClient.auth
          .startAutoRefresh();

        return;
      }

      rawClient.auth
        .stopAutoRefresh();
    },
  );
}