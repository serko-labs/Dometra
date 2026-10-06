// @ts-nocheck

import {
  createClient,
} from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL =
  Deno.env.get(
    'SUPABASE_URL',
  ) ?? '';

const SUPABASE_ANON_KEY =
  Deno.env.get(
    'SUPABASE_ANON_KEY',
  ) ?? '';

const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get(
    'SUPABASE_SERVICE_ROLE_KEY',
  ) ?? '';

const EXPO_PUSH_URL =
  'https://exp.host/--/api/v2/push/send';

function jsonResponse(
  body:
    unknown,

  status =
    200,
) {
  return new Response(
    JSON.stringify(
      body,
    ),
    {
      status,

      headers: {
        'Content-Type':
          'application/json',
      },
    },
  );
}

function monthLabel(
  billingPeriod:
    string,
) {
  const date =
    new Date(
      `${billingPeriod}T00:00:00Z`,
    );

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return billingPeriod;
  }

  return new Intl.DateTimeFormat(
    'en',
    {
      month:
        'long',

      year:
        'numeric',

      timeZone:
        'UTC',
    },
  ).format(
    date,
  );
}

Deno.serve(
  async request => {
    if (
      request.method !==
      'POST'
    ) {
      return jsonResponse(
        {
          error:
            'Method not allowed.',
        },
        405,
      );
    }

    if (
      !SUPABASE_URL ||
      !SUPABASE_ANON_KEY ||
      !SUPABASE_SERVICE_ROLE_KEY
    ) {
      return jsonResponse(
        {
          error:
            'Supabase environment is not configured.',
        },
        500,
      );
    }

    const authorization =
      request.headers.get(
        'Authorization',
      );

    if (
      !authorization
    ) {
      return jsonResponse(
        {
          error:
            'Authorization is required.',
        },
        401,
      );
    }

    let payload:
      {
        claimId?:
          string;
      };

    try {
      payload =
        await request.json();
    } catch {
      return jsonResponse(
        {
          error:
            'Invalid JSON body.',
        },
        400,
      );
    }

    const claimId =
      payload.claimId;

    if (
      !claimId
    ) {
      return jsonResponse(
        {
          error:
            'claimId is required.',
        },
        400,
      );
    }

    const userClient =
      createClient(
        SUPABASE_URL,
        SUPABASE_ANON_KEY,
        {
          global: {
            headers: {
              Authorization:
                authorization,
            },
          },
        },
      );

    const serviceClient =
      createClient(
        SUPABASE_URL,
        SUPABASE_SERVICE_ROLE_KEY,
        {
          auth: {
            persistSession:
              false,

            autoRefreshToken:
              false,
          },
        },
      );

    const {
      data:
        claim,

      error:
        claimError,
    } =
      await userClient
        .from(
          'tenant_payment_claims',
        )
        .select(
          'id,tenancy_id,billing_period,status,reported_by,reported_at',
        )
        .eq(
          'id',
          claimId,
        )
        .eq(
          'status',
          'REPORTED',
        )
        .single();

    if (
      claimError ||
      !claim
    ) {
      return jsonResponse(
        {
          error:
            'Payment report not found or not accessible.',
        },
        404,
      );
    }

    const {
      data:
        tenancy,

      error:
        tenancyError,
    } =
      await serviceClient
        .from(
          'tenancies',
        )
        .select(
          'id,property_id',
        )
        .eq(
          'id',
          claim.tenancy_id,
        )
        .single();

    if (
      tenancyError ||
      !tenancy
    ) {
      return jsonResponse(
        {
          error:
            'Tenancy not found.',
        },
        404,
      );
    }

    const {
      data:
        property,

      error:
        propertyError,
    } =
      await serviceClient
        .from(
          'properties',
        )
        .select(
          'id,workspace_id,title,street,city',
        )
        .eq(
          'id',
          tenancy.property_id,
        )
        .single();

    if (
      propertyError ||
      !property
    ) {
      return jsonResponse(
        {
          error:
            'Property not found.',
        },
        404,
      );
    }

    const {
      data:
        members,

      error:
        membersError,
    } =
      await serviceClient
        .from(
          'workspace_members',
        )
        .select(
          'user_id,role',
        )
        .eq(
          'workspace_id',
          property.workspace_id,
        )
        .in(
          'role',
          [
            'OWNER',
            'ADMIN',
            'MANAGER',
          ],
        );

    if (
      membersError
    ) {
      return jsonResponse(
        {
          error:
            membersError.message,
        },
        500,
      );
    }

    const managerIds =
      Array.from(
        new Set(
          (
            members ??
            []
          )
            .map(
              member =>
                member.user_id,
            )
            .filter(
              Boolean,
            ),
        ),
      );

    if (
      managerIds.length ===
      0
    ) {
      return jsonResponse(
        {
          sent:
            0,

          message:
            'No landlord managers found.',
        },
      );
    }

    const {
      data:
        settings,
    } =
      await serviceClient
        .from(
          'user_settings',
        )
        .select(
          'user_id,push_enabled',
        )
        .in(
          'user_id',
          managerIds,
        );

    const disabledUsers =
      new Set(
        (
          settings ??
          []
        )
          .filter(
            item =>
              item.push_enabled ===
              false,
          )
          .map(
            item =>
              item.user_id,
          ),
      );

    const pushUserIds =
      managerIds.filter(
        userId =>
          !disabledUsers.has(
            userId,
          ),
      );

    if (
      pushUserIds.length ===
      0
    ) {
      return jsonResponse(
        {
          sent:
            0,

          message:
            'Landlord push notifications are disabled.',
        },
      );
    }

    const {
      data:
        tokens,

      error:
        tokenError,
    } =
      await serviceClient
        .from(
          'device_push_tokens',
        )
        .select(
          'user_id,token',
        )
        .in(
          'user_id',
          pushUserIds,
        )
        .eq(
          'enabled',
          true,
        );

    if (
      tokenError
    ) {
      return jsonResponse(
        {
          error:
            tokenError.message,
        },
        500,
      );
    }

    const uniqueTokens =
      Array.from(
        new Set(
          (
            tokens ??
            []
          )
            .map(
              item =>
                item.token,
            )
            .filter(
              token =>
                typeof token ===
                  'string' &&
                token.length >
                  0,
            ),
        ),
      );

    if (
      uniqueTokens.length ===
      0
    ) {
      return jsonResponse(
        {
          sent:
            0,

          message:
            'No active landlord push tokens found.',
        },
      );
    }

    const title =
      'Payment reported';

    const apartmentName =
      property.title ||

      [
        property.street,
        property.city,
      ]
        .filter(
          Boolean,
        )
        .join(
          ', ',
        ) ||

      'Apartment';

    const body =
      `The tenant marked the ${monthLabel(
        claim.billing_period,
      )} bill as paid for ${apartmentName}.`;

    const messages =
      uniqueTokens.map(
        token => ({
          to:
            token,

          sound:
            'default',

          title,

          body,

          data: {
            type:
              'TENANT_PAYMENT_REPORTED',

            claimId:
              claim.id,

            tenancyId:
              claim.tenancy_id,

            propertyId:
              property.id,

            billingPeriod:
              claim.billing_period,
          },
        }),
      );

    const expoResponse =
      await fetch(
        EXPO_PUSH_URL,
        {
          method:
            'POST',

          headers: {
            Accept:
              'application/json',

            'Accept-Encoding':
              'gzip, deflate',

            'Content-Type':
              'application/json',
          },

          body:
            JSON.stringify(
              messages,
            ),
        },
      );

    const expoBody =
      await expoResponse
        .json()
        .catch(
          () =>
            null,
        );

    if (
      !expoResponse.ok
    ) {
      return jsonResponse(
        {
          error:
            'Expo push service rejected the notification request.',

          details:
            expoBody,
        },
        502,
      );
    }

    return jsonResponse(
      {
        sent:
          uniqueTokens.length,

        expo:
          expoBody,
      },
    );
  },
);