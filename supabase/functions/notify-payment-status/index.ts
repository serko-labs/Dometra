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

    const {
      claimId,
      status,
    } =
      await request.json();

    if (
      !claimId ||
      ![
        'CONFIRMED',
        'REJECTED',
      ].includes(
        status,
      )
    ) {
      return jsonResponse(
        {
          error:
            'Invalid request.',
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
      );

    const {
      data:
        userData,
    } =
      await userClient.auth
        .getUser();

    const user =
      userData?.user;

    if (
      !user
    ) {
      return jsonResponse(
        {
          error:
            'Invalid user.',
        },
        401,
      );
    }

    const {
      data:
        claim,
    } =
      await serviceClient
        .from(
          'tenant_payment_claims',
        )
        .select(
          'id,tenancy_id,billing_period,status,rejection_note',
        )
        .eq(
          'id',
          claimId,
        )
        .single();

    if (
      !claim ||
      claim.status !==
        status
    ) {
      return jsonResponse(
        {
          error:
            'Payment claim status does not match.',
        },
        409,
      );
    }

    const {
      data:
        tenancy,
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
        managerMembership,
    } =
      await serviceClient
        .from(
          'workspace_members',
        )
        .select(
          'role',
        )
        .eq(
          'workspace_id',
          property.workspace_id,
        )
        .eq(
          'user_id',
          user.id,
        )
        .maybeSingle();

    if (
      !managerMembership ||
      ![
        'OWNER',
        'ADMIN',
        'MANAGER',
      ].includes(
        managerMembership.role,
      )
    ) {
      return jsonResponse(
        {
          error:
            'Only a workspace manager can send this notification.',
        },
        403,
      );
    }

    const {
      data:
        tenantMembers,
    } =
      await serviceClient
        .from(
          'tenancy_members',
        )
        .select(
          'user_id',
        )
        .eq(
          'tenancy_id',
          claim.tenancy_id,
        );

    const tenantIds =
      Array.from(
        new Set(
          (
            tenantMembers ??
            []
          )
            .map(
              item =>
                item.user_id,
            )
            .filter(
              Boolean,
            ),
        ),
      );

    if (
      tenantIds.length ===
      0
    ) {
      return jsonResponse(
        {
          sent:
            0,
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
          tenantIds,
        );

    const disabled =
      new Set(
        (
          settings ??
          []
        )
          .filter(
            setting =>
              setting.push_enabled ===
              false,
          )
          .map(
            setting =>
              setting.user_id,
          ),
      );

    const enabledTenantIds =
      tenantIds.filter(
        id =>
          !disabled.has(
            id,
          ),
      );

    const {
      data:
        tokens,
    } =
      await serviceClient
        .from(
          'device_push_tokens',
        )
        .select(
          'token',
        )
        .in(
          'user_id',
          enabledTenantIds,
        )
        .eq(
          'enabled',
          true,
        );

    const pushTokens =
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
              Boolean,
            ),
        ),
      );

    if (
      pushTokens.length ===
      0
    ) {
      return jsonResponse(
        {
          sent:
            0,
        },
      );
    }

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
      'your apartment';

    const title =
      status ===
      'CONFIRMED'
        ? 'Payment confirmed'
        : 'Payment not confirmed';

    const body =
      status ===
      'CONFIRMED'
        ? `Your payment for ${apartmentName} has been confirmed.`

        : claim.rejection_note
          ? `Your payment for ${apartmentName} was not confirmed: ${claim.rejection_note}`

          : `Your payment for ${apartmentName} was not confirmed. Please check the payment and try again.`;

    const messages =
      pushTokens.map(
        token => ({
          to:
            token,

          sound:
            'default',

          title,

          body,

          data: {
            type:
              status ===
              'CONFIRMED'
                ? 'PAYMENT_CONFIRMED'
                : 'PAYMENT_REJECTED',

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
            'Expo rejected the notification.',

          details:
            expoBody,
        },
        502,
      );
    }

    return jsonResponse(
      {
        sent:
          pushTokens.length,

        expo:
          expoBody,
      },
    );
  },
);