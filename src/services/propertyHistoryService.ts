import {
  supabase,
} from '../lib/supabase';


export type PropertyHistoryCategory =
  | 'PROPERTY'
  | 'TENANT'
  | 'METER'
  | 'READING'
  | 'SERVICE'
  | 'INVOICE'
  | 'PAYMENT'
  | 'OTHER';


export interface PropertyHistoryItem {
  id: string;

  title: string;

  details?: string;

  timestamp: string;

  action: string;

  category:
    PropertyHistoryCategory;

  userId?: string;

  sessionId?: string;
}


interface AuditRow {
  id:
    number | string;

  user_id:
    string | null;

  session_id:
    string | null;

  table_name:
    string;

  entity_id:
    string | null;

  action:
    string;

  before_data:
    Record<
      string,
      unknown
    > | null;

  after_data:
    Record<
      string,
      unknown
    > | null;

  created_at:
    string;
}


function dataFor(
  row:
    AuditRow,
) {
  return (
    row.after_data ??
    row.before_data ??
    {}
  );
}


function stringValue(
  value:
    unknown,
) {
  return typeof value ===
    'string'
    ? value
    : undefined;
}


function numberValue(
  value:
    unknown,
) {
  if (
    typeof value ===
    'number'
  ) {
    return value;
  }

  if (
    typeof value ===
    'string'
  ) {
    const parsed =
      Number(value);

    return Number.isFinite(
      parsed,
    )
      ? parsed
      : undefined;
  }

  return undefined;
}


function base(
  row:
    AuditRow,
  title:
    string,
  category:
    PropertyHistoryCategory,
  details?:
    string,
): PropertyHistoryItem {
  return {
    id:
      String(
        row.id,
      ),

    title,

    details,

    timestamp:
      row.created_at,

    action:
      row.action,

    category,

    userId:
      row.user_id ??
      undefined,

    sessionId:
      row.session_id ??
      undefined,
  };
}


function describe(
  row:
    AuditRow,
): PropertyHistoryItem {
  const data =
    dataFor(
      row,
    );

  switch (
    row.table_name
  ) {
    case 'properties':
      return base(
        row,
        row.action ===
          'CREATE'
          ? 'Apartment added'
          : 'Apartment updated',
        'PROPERTY',
        stringValue(
          data.title,
        ),
      );


    case 'manual_tenant_contacts': {
      const name =
        [
          stringValue(
            data.first_name,
          ),
          stringValue(
            data.last_name,
          ),
        ]
          .filter(
            Boolean,
          )
          .join(' ');

      return base(
        row,
        row.action ===
          'CREATE'
          ? 'Manual tenant added'
          : row.action ===
              'DELETE'
            ? 'Manual tenant removed'
            : 'Tenant information updated',
        'TENANT',
        name ||
        undefined,
      );
    }


    case 'tenancies': {
      const status =
        stringValue(
          data.status,
        );

      if (
        row.action ===
          'CREATE'
      ) {
        return base(
          row,
          status ===
            'ACTIVE'
            ? 'Tenancy started'
            : 'Tenancy created',
          'TENANT',
          stringValue(
            data.start_date,
          ),
        );
      }

      return base(
        row,
        status ===
          'ENDED'
          ? 'Tenancy ended'
          : status ===
              'CANCELLED'
            ? 'Tenancy cancelled'
            : 'Tenancy updated',
        'TENANT',
      );
    }


    case 'tenancy_members':
      return base(
        row,
        'Tenant joined Dometra',
        'TENANT',
      );


    case 'tenancy_invitations': {
      const status =
        stringValue(
          data.status,
        );

      let title =
        'Tenant invitation updated';

      if (
        row.action ===
          'CREATE'
      ) {
        title =
          'Tenant invitation created';
      } else if (
        status ===
          'ACCEPTED'
      ) {
        title =
          'Tenant invitation accepted';
      } else if (
        status ===
          'REVOKED'
      ) {
        title =
          'Tenant invitation revoked';
      }

      return base(
        row,
        title,
        'TENANT',
      );
    }


    case 'rent_terms': {
      const amount =
        numberValue(
          data.rent_amount,
        );

      const currency =
        stringValue(
          data.currency_code,
        );

      return base(
        row,
        row.action ===
          'CREATE'
          ? 'Rental terms added'
          : 'Rental terms updated',
        'TENANT',
        amount !==
        undefined
          ? `${amount} ${currency ?? ''} / month`.trim()
          : undefined,
      );
    }


    case 'tenancy_meter_readings': {
      const type =
        stringValue(
          data.reading_type,
        );

      const value =
        numberValue(
          data.value,
        );

      return base(
        row,
        type ===
          'MOVE_OUT'
          ? 'Checkout meter reading saved'
          : 'Opening meter reading saved',
        'READING',
        value !==
        undefined
          ? String(value)
          : undefined,
      );
    }


    case 'property_services': {
      const name =
        stringValue(
          data.custom_name,
        ) ??
        stringValue(
          data.service_code,
        ) ??
        'Meter / service';

      return base(
        row,
        data.is_active ===
          false
          ? 'Meter / service removed'
          : row.action ===
              'CREATE'
            ? 'Meter / service added'
            : 'Meter / service updated',
        'METER',
        name,
      );
    }


    case 'meter_reading_sessions':
      return base(
        row,
        'Meter reading saved',
        'READING',
        stringValue(
          data.reading_date,
        ),
      );


    case 'service_period_values':
      return base(
        row,
        'Service value saved',
        'SERVICE',
      );


    case 'invoices':
      return base(
        row,
        row.action ===
          'CREATE'
          ? 'Invoice created'
          : 'Invoice updated',
        'INVOICE',
        stringValue(
          data.period,
        ),
      );


    case 'payments': {
      const amount =
        numberValue(
          data.amount,
        );

      const currency =
        stringValue(
          data.currency_code,
        ) ??
        stringValue(
          data.currency,
        );

      return base(
        row,
        row.action ===
          'CREATE'
          ? 'Rental payment received'
          : 'Rental payment updated',
        'PAYMENT',
        amount !==
        undefined
          ? `${amount} ${currency ?? ''}`.trim()
          : undefined,
      );
    }


    default:
      return base(
        row,
        'Apartment activity',
        'OTHER',
        row.table_name,
      );
  }
}


export async function loadPropertyHistory(
  propertyId: string,
  limit = 40,
): Promise<
  PropertyHistoryItem[]
> {
  if (
    !supabase
  ) {
    throw new Error(
      'Supabase is not configured.',
    );
  }

  const visibleTables = [
    'properties',
    'manual_tenant_contacts',
    'tenancies',
    'tenancy_members',
    'tenancy_invitations',
    'rent_terms',
    'tenancy_meter_readings',
    'property_services',
    'meter_reading_sessions',
    'service_period_values',
    'invoices',
    'payments',
  ];

  const {
    data,
    error,
  } =
    await supabase
      .from(
        'audit_log',
      )
      .select(
        [
          'id',
          'user_id',
          'session_id',
          'table_name',
          'entity_id',
          'action',
          'before_data',
          'after_data',
          'created_at',
        ].join(','),
      )
      .eq(
        'property_id',
        propertyId,
      )
      .in(
        'table_name',
        visibleTables,
      )
      .order(
        'created_at',
        {
          ascending:
            false,
        },
      )
      .limit(
        limit,
      );

  if (
    error
  ) {
    throw error;
  }

  return (
    (
      data ??
      []
    ) as AuditRow[]
  ).map(
    describe,
  );
}