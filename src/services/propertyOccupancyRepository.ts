import {
  supabase,
} from '../lib/supabase';

import {
  CurrencyCode,
} from '../types';

export type PropertyOccupancyState =
  | 'AVAILABLE'
  | 'PENDING'
  | 'OCCUPIED';

export interface PropertyOccupancySummary {
  propertyId: string;

  tenancyId?: string;

  state:
    PropertyOccupancyState;

  tenantName?: string;

  rentAmount?: number;

  rentCurrency?:
    CurrencyCode;

  startDate?: string;
}

interface TenancyRow {
  id: string;

  property_id: string;

  manual_tenant_contact_id:
    string | null;

  status:
    'PENDING' | 'ACTIVE';

  start_date: string;
}

interface RentRow {
  tenancy_id: string;

  rent_amount:
    number | string;

  currency_code:
    string;
}

interface ManualTenantRow {
  id: string;

  first_name: string;

  last_name: string;
}

interface TenancyMemberRow {
  tenancy_id: string;

  user_id: string;

  role:
    'TENANT' | 'CO_TENANT';
}

interface TenantProfileRow {
  user_id: string;

  first_name: string;

  last_name: string;
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

function currency(
  value:
    string |
    null |
    undefined,
): CurrencyCode {
  if (
    value === 'USD' ||
    value === 'EUR'
  ) {
    return value;
  }

  return 'UAH';
}

function fullName(
  firstName:
    string | null | undefined,

  lastName:
    string | null | undefined,
) {
  const value =
    [
      firstName,
      lastName,
    ]
      .filter(
        Boolean,
      )
      .join(' ')
      .trim();

  return value ||
    undefined;
}

export async function loadPropertyOccupancy(
  propertyIds:
    string[],
): Promise<
  Record<
    string,
    PropertyOccupancySummary
  >
> {
  const result:
    Record<
      string,
      PropertyOccupancySummary
    > = {};

  /*
   * Always return a result for every apartment.
   */
  propertyIds.forEach(
    (
      propertyId,
    ) => {
      result[
        propertyId
      ] = {
        propertyId,

        state:
          'AVAILABLE',
      };
    },
  );

  if (
    propertyIds.length ===
    0
  ) {
    return result;
  }

  const client =
    requireSupabase();

  /*
   * Only current tenancies matter for the
   * main apartment cards.
   *
   * Historical ENDED/CANCELLED tenancies remain
   * in Supabase but do not make an apartment occupied.
   */
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
        [
          'id',
          'property_id',
          'manual_tenant_contact_id',
          'status',
          'start_date',
        ].join(','),
      )
      .in(
        'property_id',
        propertyIds,
      )
      .in(
        'status',
        [
          'PENDING',
          'ACTIVE',
        ],
      );

  if (
    tenancyError
  ) {
    throw tenancyError;
  }

  const tenancies =
    (
      tenancyData ??
      []
    ) as TenancyRow[];

  if (
    tenancies.length ===
    0
  ) {
    return result;
  }

  const tenancyIds =
    tenancies.map(
      (
        tenancy,
      ) =>
        tenancy.id,
    );

  const manualTenantIds =
    tenancies
      .map(
        (
          tenancy,
        ) =>
          tenancy
            .manual_tenant_contact_id,
      )
      .filter(
        (
          id,
        ): id is string =>
          Boolean(id),
      );

  /*
   * Rent terms and Dometra tenancy members can
   * be loaded in parallel.
   */
  const [
    rentResult,
    memberResult,
  ] =
    await Promise.all([
      client
        .from(
          'rent_terms',
        )
        .select(
          [
            'tenancy_id',
            'rent_amount',
            'currency_code',
          ].join(','),
        )
        .in(
          'tenancy_id',
          tenancyIds,
        )
        .is(
          'valid_to',
          null,
        ),

      client
        .from(
          'tenancy_members',
        )
        .select(
          [
            'tenancy_id',
            'user_id',
            'role',
          ].join(','),
        )
        .in(
          'tenancy_id',
          tenancyIds,
        )
        .eq(
          'role',
          'TENANT',
        ),
    ]);

  if (
    rentResult.error
  ) {
    throw rentResult.error;
  }

  if (
    memberResult.error
  ) {
    throw memberResult.error;
  }

  const rentRows =
    (
      rentResult.data ??
      []
    ) as RentRow[];

  const memberRows =
    (
      memberResult.data ??
      []
    ) as TenancyMemberRow[];

  /*
   * Manual tenant names.
   */
  let manualRows:
    ManualTenantRow[] = [];

  if (
    manualTenantIds.length >
    0
  ) {
    const {
      data,
      error,
    } =
      await client
        .from(
          'manual_tenant_contacts',
        )
        .select(
          [
            'id',
            'first_name',
            'last_name',
          ].join(','),
        )
        .in(
          'id',
          manualTenantIds,
        );

    if (
      error
    ) {
      throw error;
    }

    manualRows =
      (
        data ??
        []
      ) as ManualTenantRow[];
  }

  /*
   * Dometra tenant profile names.
   */
  const tenantUserIds =
    [
      ...new Set(
        memberRows.map(
          (
            member,
          ) =>
            member.user_id,
        ),
      ),
    ];

  let profileRows:
    TenantProfileRow[] = [];

  if (
    tenantUserIds.length >
    0
  ) {
    const {
      data,
      error,
    } =
      await client
        .from(
          'tenant_profiles',
        )
        .select(
          [
            'user_id',
            'first_name',
            'last_name',
          ].join(','),
        )
        .in(
          'user_id',
          tenantUserIds,
        );

    if (
      error
    ) {
      throw error;
    }

    profileRows =
      (
        data ??
        []
      ) as TenantProfileRow[];
  }

  for (
    const tenancy
    of tenancies
  ) {
    const rent =
      rentRows.find(
        (
          row,
        ) =>
          row.tenancy_id ===
          tenancy.id,
      );

    let tenantName:
      string | undefined;

    /*
     * Manual tenant.
     */
    if (
      tenancy
        .manual_tenant_contact_id
    ) {
      const manual =
        manualRows.find(
          (
            row,
          ) =>
            row.id ===
            tenancy
              .manual_tenant_contact_id,
        );

      tenantName =
        fullName(
          manual?.first_name,
          manual?.last_name,
        );
    }

    /*
     * Registered Dometra tenant.
     */
    if (
      !tenantName
    ) {
      const member =
        memberRows.find(
          (
            row,
          ) =>
            row.tenancy_id ===
            tenancy.id,
        );

      if (
        member
      ) {
        const profile =
          profileRows.find(
            (
              row,
            ) =>
              row.user_id ===
              member.user_id,
          );

        tenantName =
          fullName(
            profile?.first_name,
            profile?.last_name,
          );
      }
    }

    result[
      tenancy.property_id
    ] = {
      propertyId:
        tenancy.property_id,

      tenancyId:
        tenancy.id,

      state:
        tenancy.status ===
          'ACTIVE'
          ? 'OCCUPIED'
          : 'PENDING',

      tenantName,

      rentAmount:
        rent
          ? Number(
              rent.rent_amount,
            )
          : undefined,

      rentCurrency:
        rent
          ? currency(
              rent.currency_code,
            )
          : undefined,

      startDate:
        tenancy.start_date,
    };
  }

  return result;
}