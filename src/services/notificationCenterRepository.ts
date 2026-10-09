import {
  supabase,
} from '../lib/supabase';

export type DometraNotificationEventType =
  | 'PAYMENT_REPORTED'
  | 'PAYMENT_CONFIRMED'
  | 'PAYMENT_REJECTED'
  | 'CHECKOUT_STARTED'
  | 'CHECKOUT_COMPLETED'
  | string;

export interface DometraNotification {
  id:
    string;

  eventType:
    DometraNotificationEventType;

  propertyId?:
    string;

  tenancyId?:
    string;

  titleKey?:
    string;

  bodyKey?:
    string;

  templateData:
    Record<
      string,
      unknown
    >;

  deepLink?:
    string;

  readAt?:
    string;

  createdAt:
    string;
}

interface NotificationRow {
  id:
    string;

  event_type:
    string | null;

  property_id:
    string | null;

  tenancy_id:
    string | null;

  title_key:
    string | null;

  body_key:
    string | null;

  template_data:
    Record<
      string,
      unknown
    > | null;

  deep_link:
    string | null;

  read_at:
    string | null;

  created_at:
    string;
}

function requireSupabase() {
  if (
    !supabase
  ) {
    throw new Error(
      'Supabase is not configured.',
    );
  }

  return supabase as any;
}

function mapNotification(
  row:
    NotificationRow,
): DometraNotification {
  return {
    id:
      row.id,

    eventType:
      row.event_type ??
      'UNKNOWN',

    propertyId:
      row.property_id ??
      undefined,

    tenancyId:
      row.tenancy_id ??
      undefined,

    titleKey:
      row.title_key ??
      undefined,

    bodyKey:
      row.body_key ??
      undefined,

    templateData:
      row.template_data ??
      {},

    deepLink:
      row.deep_link ??
      undefined,

    readAt:
      row.read_at ??
      undefined,

    createdAt:
      row.created_at,
  };
}

export async function loadNotifications(
  limit =
    50,
): Promise<
  DometraNotification[]
> {
  const client =
    requireSupabase();

  const {
    data,
    error,
  } =
    await client
      .from(
        'notifications',
      )
      .select(
        [
          'id',
          'event_type',
          'property_id',
          'tenancy_id',
          'title_key',
          'body_key',
          'template_data',
          'deep_link',
          'read_at',
          'created_at',
        ].join(
          ',',
        ),
      )
      .eq(
        'channel',
        'IN_APP',
      )
      .order(
        'created_at',
        {
          ascending:
            false,
        },
      )
      .limit(
        Math.max(
          1,
          Math.min(
            limit,
            100,
          ),
        ),
      );

  if (
    error
  ) {
    throw error;
  }

  return (
    data ??
    []
  ).map(
    (
      row:
        NotificationRow,
    ) =>
      mapNotification(
        row,
      ),
  );
}

export async function loadUnreadNotificationCount() {
  const client =
    requireSupabase();

  const {
    count,
    error,
  } =
    await client
      .from(
        'notifications',
      )
      .select(
        'id',
        {
          count:
            'exact',

          head:
            true,
        },
      )
      .eq(
        'channel',
        'IN_APP',
      )
      .is(
        'read_at',
        null,
      );

  if (
    error
  ) {
    throw error;
  }

  return count ??
    0;
}

export async function markNotificationRead(
  notificationId:
    string,
) {
  const client =
    requireSupabase();

  const {
    error,
  } =
    await client.rpc(
      'mark_notification_read',
      {
        p_notification_id:
          notificationId,
      },
    );

  if (
    error
  ) {
    throw error;
  }
}

export async function markAllNotificationsRead() {
  const client =
    requireSupabase();

  const {
    error,
  } =
    await client.rpc(
      'mark_all_notifications_read',
    );

  if (
    error
  ) {
    throw error;
  }
}