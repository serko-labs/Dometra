-- ============================================================
-- DOMETRA
-- PROPERTY ICON / THUMBNAIL
-- ============================================================
--
-- Landlords can set one image for every property.
--
-- If icon_path is null the mobile app uses its built-in
-- default apartment icon.
--
-- Storage path:
--
--   property-icons/<property-id>/<uuid>.<ext>
--
-- The bucket is private.
-- Linked tenants may read the image because they can access
-- the property, but only workspace managers can upload,
-- replace or remove it.
-- ============================================================


-- ============================================================
-- PROPERTY COLUMN
-- ============================================================

alter table public.properties
add column if not exists icon_path text;


-- ============================================================
-- PRIVATE STORAGE BUCKET
-- ============================================================

insert into storage.buckets (
  id,
  name,
  public
)
values (
  'property-icons',
  'property-icons',
  false
)
on conflict (id)
do update
set public = false;


-- ============================================================
-- STORAGE RLS
-- ============================================================

drop policy if exists property_icons_read
on storage.objects;

create policy property_icons_read
on storage.objects
for select
to authenticated
using (
  bucket_id = 'property-icons'
  and public.can_access_property(
    case
      when name ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/'
      then split_part(name, '/', 1)::uuid
      else null
    end
  )
);


drop policy if exists property_icons_insert
on storage.objects;

create policy property_icons_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'property-icons'
  and public.can_manage_property(
    case
      when name ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/'
      then split_part(name, '/', 1)::uuid
      else null
    end
  )
);


drop policy if exists property_icons_update
on storage.objects;

create policy property_icons_update
on storage.objects
for update
to authenticated
using (
  bucket_id = 'property-icons'
  and public.can_manage_property(
    case
      when name ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/'
      then split_part(name, '/', 1)::uuid
      else null
    end
  )
)
with check (
  bucket_id = 'property-icons'
  and public.can_manage_property(
    case
      when name ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/'
      then split_part(name, '/', 1)::uuid
      else null
    end
  )
);


drop policy if exists property_icons_delete
on storage.objects;

create policy property_icons_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'property-icons'
  and public.can_manage_property(
    case
      when name ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/'
      then split_part(name, '/', 1)::uuid
      else null
    end
  )
);