import {
  File,
} from 'expo-file-system';

import {
  supabase,
} from '../lib/supabase';

const PROPERTY_ICON_BUCKET =
  'property-icons';

export interface PropertyIcon {
  propertyId:
    string;

  path?:
    string;

  uri?:
    string;
}

interface PropertyIconRow {
  id:
    string;

  icon_path:
    string | null;
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

function normalizeExtension(
  extension:
    string,
) {
  const cleaned =
    extension
      .replace(
        /^\./,
        '',
      )
      .toLowerCase();

  if (
    cleaned ===
    'jpeg'
  ) {
    return 'jpg';
  }

  return cleaned ||
    'jpg';
}

function randomFileName() {
  return `${Date.now()}-${Math.random()
    .toString(
      36,
    )
    .slice(
      2,
      10,
    )}`;
}

async function signedIconUri(
  path?:
    string | null,
) {
  if (
    !path
  ) {
    return undefined;
  }

  const client =
    requireSupabase();

  const {
    data,
    error,
  } =
    await client.storage
      .from(
        PROPERTY_ICON_BUCKET,
      )
      .createSignedUrl(
        path,
        60 * 60,
      );

  if (
    error
  ) {
    console.warn(
      '[Dometra] Unable to create property icon URL:',
      error.message,
    );

    return undefined;
  }

  return data?.signedUrl ??
    undefined;
}

async function removeStoredIcon(
  path?:
    string,
) {
  if (
    !path
  ) {
    return;
  }

  const client =
    requireSupabase();

  const {
    error,
  } =
    await client.storage
      .from(
        PROPERTY_ICON_BUCKET,
      )
      .remove(
        [
          path,
        ],
      );

  if (
    error
  ) {
    console.warn(
      '[Dometra] Unable to remove previous property icon:',
      error.message,
    );
  }
}

async function loadPropertyIconPath(
  propertyId:
    string,
) {
  const client =
    requireSupabase();

  const {
    data,
    error,
  } =
    await client
      .from(
        'properties',
      )
      .select(
        'id,icon_path',
      )
      .eq(
        'id',
        propertyId,
      )
      .single();

  if (
    error
  ) {
    throw error;
  }

  const row =
    data as PropertyIconRow;

  return row.icon_path ??
    undefined;
}

export async function loadPropertyIcons(
  propertyIds:
    string[],
): Promise<
  Record<
    string,
    PropertyIcon
  >
> {
  if (
    propertyIds.length ===
    0
  ) {
    return {};
  }

  const client =
    requireSupabase();

  const {
    data,
    error,
  } =
    await client
      .from(
        'properties',
      )
      .select(
        'id,icon_path',
      )
      .in(
        'id',
        propertyIds,
      );

  if (
    error
  ) {
    throw error;
  }

  const rows =
    (
      data ??
      []
    ) as PropertyIconRow[];

  const entries =
    await Promise.all(
      rows.map(
        async row => {
          const path =
            row.icon_path ??
            undefined;

          return [
            row.id,

            {
              propertyId:
                row.id,

              path,

              uri:
                await signedIconUri(
                  path,
                ),
            } satisfies PropertyIcon,
          ] as const;
        },
      ),
    );

  return Object.fromEntries(
    entries,
  );
}

export async function loadPropertyIcon(
  propertyId:
    string,
): Promise<
  PropertyIcon
> {
  const icons =
    await loadPropertyIcons(
      [
        propertyId,
      ],
    );

  return icons[
    propertyId
  ] ?? {
    propertyId,
  };
}

export async function setPropertyIcon(
  propertyId:
    string,

  localUri:
    string,
): Promise<
  PropertyIcon
> {
  const client =
    requireSupabase();

  const oldPath =
    await loadPropertyIconPath(
      propertyId,
    );

  const file =
    new File(
      localUri,
    );

  const bytes =
    await file.arrayBuffer();

  const extension =
    normalizeExtension(
      file.extension,
    );

  const contentType =
    file.type ||
    (
      extension ===
      'png'
        ? 'image/png'

        : extension ===
            'heic'
          ? 'image/heic'

          : 'image/jpeg'
    );

  const newPath =
    `${propertyId}/${randomFileName()}.${extension}`;

  const {
    error:
      uploadError,
  } =
    await client.storage
      .from(
        PROPERTY_ICON_BUCKET,
      )
      .upload(
        newPath,
        bytes,
        {
          contentType,

          cacheControl:
            '3600',

          upsert:
            false,
        },
      );

  if (
    uploadError
  ) {
    throw uploadError;
  }

  const {
    error:
      updateError,
  } =
    await client
      .from(
        'properties',
      )
      .update(
        {
          icon_path:
            newPath,
        },
      )
      .eq(
        'id',
        propertyId,
      );

  if (
    updateError
  ) {
    await removeStoredIcon(
      newPath,
    );

    throw updateError;
  }

  if (
    oldPath &&
    oldPath !==
      newPath
  ) {
    await removeStoredIcon(
      oldPath,
    );
  }

  return {
    propertyId,

    path:
      newPath,

    uri:
      await signedIconUri(
        newPath,
      ),
  };
}

export async function removePropertyIcon(
  propertyId:
    string,
) {
  const client =
    requireSupabase();

  const oldPath =
    await loadPropertyIconPath(
      propertyId,
    );

  const {
    error,
  } =
    await client
      .from(
        'properties',
      )
      .update(
        {
          icon_path:
            null,
        },
      )
      .eq(
        'id',
        propertyId,
      );

  if (
    error
  ) {
    throw error;
  }

  await removeStoredIcon(
    oldPath,
  );
}