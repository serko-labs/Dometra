import {
  supabase,
} from '../lib/supabase';

export type PropertyHistoryCategory =
  | 'PROPERTY'
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

function stringValue(
  value:
    unknown,
) {
  if (
    typeof value ===
    'string'
  ) {
    return value;
  }

  return undefined;
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

    if (
      Number.isFinite(
        parsed,
      )
    ) {
      return parsed;
    }
  }

  return undefined;
}

function getData(
  row:
    AuditRow,
) {
  return (
    row.after_data ??
    row.before_data ??
    {}
  );
}

function describeProperty(
  row:
    AuditRow,
): PropertyHistoryItem {
  const data =
    getData(
      row,
    );

  const name =
    stringValue(
      data.title,
    ) ??
    'Apartment';

  const status =
    stringValue(
      data.status,
    );

  if (
    row.action ===
      'UPDATE' &&
    status ===
      'ARCHIVED'
  ) {
    return {
      id:
        String(
          row.id,
        ),

      title:
        'Apartment removed',

      details:
        name,

      timestamp:
        row.created_at,

      action:
        row.action,

      category:
        'PROPERTY',

      userId:
        row.user_id ??
        undefined,

      sessionId:
        row.session_id ??
        undefined,
    };
  }

  return {
    id:
      String(
        row.id,
      ),

    title:
      row.action ===
      'CREATE'
        ? 'Apartment added'
        : 'Apartment updated',

    details:
      name,

    timestamp:
      row.created_at,

    action:
      row.action,

    category:
      'PROPERTY',

    userId:
      row.user_id ??
      undefined,

    sessionId:
      row.session_id ??
      undefined,
  };
}

function describeService(
  row:
    AuditRow,
): PropertyHistoryItem {
  const data =
    getData(
      row,
    );

  const customName =
    stringValue(
      data.custom_name,
    );

  const serviceCode =
    stringValue(
      data.service_code,
    );

  const active =
    data.is_active;

  const name =
    customName ??
    serviceCode ??
    'Meter / service';

  let title =
    'Meter / service updated';

  if (
    row.action ===
    'CREATE'
  ) {
    title =
      'Meter / service added';
  }

  if (
    row.action ===
      'DELETE' ||
    active ===
      false
  ) {
    title =
      'Meter / service removed';
  }

  return {
    id:
      String(
        row.id,
      ),

    title,

    details:
      name,

    timestamp:
      row.created_at,

    action:
      row.action,

    category:
      'METER',

    userId:
      row.user_id ??
      undefined,

    sessionId:
      row.session_id ??
      undefined,
  };
}

function describeReading(
  row:
    AuditRow,
): PropertyHistoryItem {
  const data =
    getData(
      row,
    );

  const readingDate =
    stringValue(
      data.reading_date,
    );

  const period =
    stringValue(
      data.billing_period,
    );

  return {
    id:
      String(
        row.id,
      ),

    title:
      'Meter reading saved',

    details:
      readingDate ??
      period ??
      undefined,

    timestamp:
      row.created_at,

    action:
      row.action,

    category:
      'READING',

    userId:
      row.user_id ??
      undefined,

    sessionId:
      row.session_id ??
      undefined,
  };
}

function describeServiceValue(
  row:
    AuditRow,
): PropertyHistoryItem {
  const data =
    getData(
      row,
    );

  const amount =
    numberValue(
      data.amount,
    );

  const currency =
    stringValue(
      data.currency_code,
    );

  return {
    id:
      String(
        row.id,
      ),

    title:
      'Service value saved',

    details:
      amount !==
      undefined
        ? `${amount} ${currency ?? ''}`.trim()
        : undefined,

    timestamp:
      row.created_at,

    action:
      row.action,

    category:
      'SERVICE',

    userId:
      row.user_id ??
      undefined,

    sessionId:
      row.session_id ??
      undefined,
  };
}

function describeInvoice(
  row:
    AuditRow,
): PropertyHistoryItem {
  const data =
    getData(
      row,
    );

  const period =
    stringValue(
      data.period,
    );

  return {
    id:
      String(
        row.id,
      ),

    title:
      row.action ===
      'CREATE'
        ? 'Invoice created'
        : row.action ===
            'DELETE'
          ? 'Invoice removed'
          : 'Invoice updated',

    details:
      period,

    timestamp:
      row.created_at,

    action:
      row.action,

    category:
      'INVOICE',

    userId:
      row.user_id ??
      undefined,

    sessionId:
      row.session_id ??
      undefined,
  };
}

function describePayment(
  row:
    AuditRow,
): PropertyHistoryItem {
  const data =
    getData(
      row,
    );

  const amount =
    numberValue(
      data.amount,
    );

  const currency =
    stringValue(
      data.currency_code ??
      data.currency,
    );

  return {
    id:
      String(
        row.id,
      ),

    title:
      row.action ===
      'CREATE'
        ? 'Rental payment received'
        : row.action ===
            'DELETE'
          ? 'Rental payment removed'
          : 'Rental payment updated',

    details:
      amount !==
      undefined
        ? `${amount} ${currency ?? ''}`.trim()
        : undefined,

    timestamp:
      row.created_at,

    action:
      row.action,

    category:
      'PAYMENT',

    userId:
      row.user_id ??
      undefined,

    sessionId:
      row.session_id ??
      undefined,
  };
}

function mapAuditRow(
  row:
    AuditRow,
): PropertyHistoryItem {
  switch (
    row.table_name
  ) {
    case 'properties':
      return describeProperty(
        row,
      );

    case 'property_services':
      return describeService(
        row,
      );

    case 'meter_reading_sessions':
      return describeReading(
        row,
      );

    case 'service_period_values':
      return describeServiceValue(
        row,
      );

    case 'invoices':
      return describeInvoice(
        row,
      );

    case 'payments':
      return describePayment(
        row,
      );

    default:
      return {
        id:
          String(
            row.id,
          ),

        title:
          'Apartment activity',

        details:
          row.table_name,

        timestamp:
          row.created_at,

        action:
          row.action,

        category:
          'OTHER',

        userId:
          row.user_id ??
          undefined,

        sessionId:
          row.session_id ??
          undefined,
      };
  }
}

export async function loadPropertyHistory(
  propertyId:
    string,

  limit = 30,
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

  /*
   * Keep the timeline human-readable.
   *
   * Internal rows such as register tariff
   * updates and photo metadata are deliberately
   * hidden from the apartment timeline.
   */
  const tables = [
    'properties',
    'property_services',
    'meter_reading_sessions',
    'service_period_values',

    /*
     * These will automatically start appearing
     * when invoices/payments are moved to
     * Supabase and receive audit triggers.
     */
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
        ].join(
          ',',
        ),
      )
      .eq(
        'property_id',
        propertyId,
      )
      .in(
        'table_name',
        tables,
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
    mapAuditRow,
  );
}