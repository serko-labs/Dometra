import {
  createClient,
} from 'npm:@supabase/supabase-js@2';

type NotificationRow = {
  id: string;

  user_id: string;

  language_code: string;

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
};

type PushTokenRow = {
  user_id: string;

  token: string;
};

type UserSettingRow = {
  user_id: string;

  push_enabled: boolean;
};

type ExpoTicket = {
  status:
    | 'ok'
    | 'error';

  id?: string;

  message?: string;

  details?: {
    error?: string;
  };
};

const SUPABASE_URL =
  Deno.env.get(
    'SUPABASE_URL',
  );

const SERVICE_ROLE_KEY =
  Deno.env.get(
    'SUPABASE_SERVICE_ROLE_KEY',
  );

if (
  !SUPABASE_URL ||
  !SERVICE_ROLE_KEY
) {
  throw new Error(
    'Supabase Edge Function environment is not configured.',
  );
}

const supabase =
  createClient(
    SUPABASE_URL,
    SERVICE_ROLE_KEY,
    {
      auth: {
        persistSession:
          false,

        autoRefreshToken:
          false,
      },
    },
  );

function asString(
  value: unknown,
  fallback = '',
) {
  return typeof value ===
    'string'
    ? value
    : fallback;
}

function asNumber(
  value: unknown,
  fallback = 0,
) {
  const parsed =
    Number(
      value,
    );

  return Number.isFinite(
    parsed,
  )
    ? parsed
    : fallback;
}

function renderMeterReminder(
  languageCode:
    string,

  data:
    Record<
      string,
      unknown
    >,
) {
  const propertyName =
    asString(
      data.property_name,
      'Apartment',
    );

  const missingCount =
    asNumber(
      data.missing_meter_count,
      1,
    );

  switch (
    languageCode
  ) {
    case 'uk':
      return {
        title:
          'Потрібно передати показники',

        body:
          `${propertyName}: ще не передано показники для ${missingCount} ${
            missingCount ===
            1
              ? 'лічильника'
              : 'лічильників'
          }. Передайте значення та фото до 5-го числа.`,
      };

    case 'ru':
      return {
        title:
          'Нужно передать показания',

        body:
          `${propertyName}: не переданы показания для ${missingCount} ${
            missingCount ===
            1
              ? 'счётчика'
              : 'счётчиков'
          }. Передайте значения и фото до 5-го числа.`,
      };

    case 'de':
      return {
        title:
          'Zählerstände erforderlich',

        body:
          `${propertyName}: Für ${missingCount} Zähler fehlen noch Werte. Bitte Werte und Fotos bis zum 5. einreichen.`,
      };

    default:
      return {
        title:
          'Meter readings are due',

        body:
          `${propertyName}: ${missingCount} ${
            missingCount ===
            1
              ? 'meter still needs'
              : 'meters still need'
          } readings. Submit values and photos before the 5th.`,
      };
  }
}

async function meterReminderIsStillNeeded(
  notification:
    NotificationRow,
) {
  if (
    notification.title_key !==
    'meter_readings_due'
  ) {
    return true;
  }

  const propertyId =
    asString(
      notification
        .template_data
        ?.property_id,
    );

  const billingPeriod =
    asString(
      notification
        .template_data
        ?.billing_period,
    );

  if (
    !propertyId ||
    !billingPeriod
  ) {
    return true;
  }

  const {
    data,
    error,
  } =
    await supabase
      .from(
        'v_meter_monthly_submission_status_internal',
      )
      .select(
        'meter_id',
      )
      .eq(
        'property_id',
        propertyId,
      )
      .eq(
        'billing_period',
        billingPeriod,
      )
      .eq(
        'submitted',
        false,
      )
      .limit(
        1,
      );

  if (
    error
  ) {
    console.error(
      '[Dometra] Unable to re-check meter reminder:',
      error,
    );

    return true;
  }

  return (
    data?.length ??
    0
  ) > 0;
}

async function updateNotificationStatus(
  id:
    string,

  status:
    | 'SENT'
    | 'FAILED'
    | 'CANCELLED',

  failureReason?:
    string,
) {
  const patch:
    Record<
      string,
      unknown
    > = {
    status,
  };

  if (
    status ===
    'SENT'
  ) {
    patch.sent_at =
      new Date()
        .toISOString();

    patch.failure_reason =
      null;
  } else if (
    failureReason
  ) {
    patch.failure_reason =
      failureReason;
  }

  const {
    error,
  } =
    await supabase
      .from(
        'notifications',
      )
      .update(
        patch,
      )
      .eq(
        'id',
        id,
      );

  if (
    error
  ) {
    console.error(
      '[Dometra] Unable to update notification status:',
      {
        id,
        status,
        error,
      },
    );
  }
}

Deno.serve(
  async request => {
    if (
      request.method !==
      'POST'
    ) {
      return new Response(
        'Method not allowed',
        {
          status:
            405,
        },
      );
    }

    const now =
      new Date()
        .toISOString();

    const {
      data:
        notificationData,

      error:
        notificationError,
    } =
      await supabase
        .from(
          'notifications',
        )
        .select(
          [
            'id',
            'user_id',
            'language_code',
            'title_key',
            'body_key',
            'template_data',
            'deep_link',
          ].join(
            ',',
          ),
        )
        .eq(
          'channel',
          'PUSH',
        )
        .eq(
          'status',
          'QUEUED',
        )
        .lte(
          'scheduled_at',
          now,
        )
        .order(
          'scheduled_at',
          {
            ascending:
              true,
          },
        )
        .limit(
          50,
        );

    if (
      notificationError
    ) {
      console.error(
        '[Dometra] Unable to load queued notifications:',
        notificationError,
      );

      return Response.json(
        {
          ok:
            false,

          error:
            notificationError.message,
        },
        {
          status:
            500,
        },
      );
    }

    const notifications =
      (
        notificationData ??
        []
      ) as NotificationRow[];

    if (
      notifications.length ===
      0
    ) {
      return Response.json({
        ok:
          true,

        processed:
          0,

        sent:
          0,
      });
    }

    const userIds = [
      ...new Set(
        notifications.map(
          notification =>
            notification.user_id,
        ),
      ),
    ];

    const [
      tokenResult,
      settingsResult,
    ] =
      await Promise.all([
        supabase
          .from(
            'device_push_tokens',
          )
          .select(
            'user_id,token',
          )
          .in(
            'user_id',
            userIds,
          )
          .eq(
            'enabled',
            true,
          ),

        supabase
          .from(
            'user_settings',
          )
          .select(
            'user_id,push_enabled',
          )
          .in(
            'user_id',
            userIds,
          ),
      ]);

    if (
      tokenResult.error
    ) {
      return Response.json(
        {
          ok:
            false,

          error:
            tokenResult.error.message,
        },
        {
          status:
            500,
        },
      );
    }

    const tokens =
      (
        tokenResult.data ??
        []
      ) as PushTokenRow[];

    const settings =
      (
        settingsResult.data ??
        []
      ) as UserSettingRow[];

    let sentCount =
      0;

    let cancelledCount =
      0;

    let failedCount =
      0;

    for (
      const notification
      of notifications
    ) {
      const pushSetting =
        settings.find(
          item =>
            item.user_id ===
            notification.user_id,
        );

      if (
        pushSetting &&
        pushSetting.push_enabled ===
        false
      ) {
        await updateNotificationStatus(
          notification.id,
          'CANCELLED',
          'Push notifications are disabled by the user.',
        );

        cancelledCount +=
          1;

        continue;
      }

      const stillNeeded =
        await meterReminderIsStillNeeded(
          notification,
        );

      if (
        !stillNeeded
      ) {
        await updateNotificationStatus(
          notification.id,
          'CANCELLED',
          'Meter readings were submitted before dispatch.',
        );

        cancelledCount +=
          1;

        continue;
      }

      const userTokens =
        tokens.filter(
          token =>
            token.user_id ===
            notification.user_id,
        );

      if (
        userTokens.length ===
        0
      ) {
        continue;
      }

      const rendered =
        notification.title_key ===
        'meter_readings_due'
          ? renderMeterReminder(
              notification.language_code,
              notification.template_data ??
                {},
            )
          : {
              title:
                'Dometra',

              body:
                'You have a new notification.',
            };

      const messages =
        userTokens.map(
          token => ({
            to:
              token.token,

            title:
              rendered.title,

            body:
              rendered.body,

            sound:
              'default',

            data: {
              notificationId:
                notification.id,

              ...(
                notification.template_data ??
                {}
              ),
            },
          }),
        );

      try {
        const response =
          await fetch(
            'https://exp.host/--/api/v2/push/send',
            {
              method:
                'POST',

              headers: {
                Accept:
                  'application/json',

                'Content-Type':
                  'application/json',
              },

              body:
                JSON.stringify(
                  messages,
                ),
            },
          );

        if (
          !response.ok
        ) {
          const errorText =
            await response.text();

          await updateNotificationStatus(
            notification.id,
            'FAILED',
            `Expo Push Service returned ${response.status}: ${errorText}`,
          );

          failedCount +=
            1;

          continue;
        }

        const payload =
          await response.json();

        const tickets =
          Array.isArray(
            payload?.data,
          )
            ? payload.data as ExpoTicket[]
            : [
                payload?.data as ExpoTicket,
              ].filter(
                Boolean,
              );

        const hasSuccess =
          tickets.some(
            ticket =>
              ticket.status ===
              'ok',
          );

        for (
          let index = 0;
          index <
          tickets.length;
          index += 1
        ) {
          const ticket =
            tickets[
              index
            ];

          const token =
            userTokens[
              index
            ];

          if (
            ticket?.status ===
              'error' &&
            ticket.details
              ?.error ===
              'DeviceNotRegistered' &&
            token
          ) {
            await supabase
              .from(
                'device_push_tokens',
              )
              .update({
                enabled:
                  false,

                last_seen_at:
                  new Date()
                    .toISOString(),
              })
              .eq(
                'token',
                token.token,
              );
          }
        }

        if (
          hasSuccess
        ) {
          await updateNotificationStatus(
            notification.id,
            'SENT',
          );

          sentCount +=
            1;
        } else {
          const reason =
            tickets
              .map(
                ticket =>
                  ticket?.message,
              )
              .filter(
                Boolean,
              )
              .join(
                '; ',
              ) ||
            'Expo Push Service rejected the notification.';

          await updateNotificationStatus(
            notification.id,
            'FAILED',
            reason,
          );

          failedCount +=
            1;
        }
      } catch (
        error
      ) {
        console.error(
          '[Dometra] Push dispatch failed:',
          error,
        );

        // Keep QUEUED.
        // A later cron run will retry transient network failures.
      }
    }

    return Response.json({
      ok:
        true,

      processed:
        notifications.length,

      sent:
        sentCount,

      cancelled:
        cancelledCount,

      failed:
        failedCount,
    });
  },
);