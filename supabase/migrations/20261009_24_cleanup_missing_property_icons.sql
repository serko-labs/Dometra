-- ============================================================
-- DOMETRA
-- CLEAN STALE PROPERTY ICON REFERENCES
-- ============================================================
--
-- properties.icon_path may still point to an object that was
-- removed from Supabase Storage.
--
-- In that case Dometra falls back to the default icon, so the
-- stale DB reference should simply be cleared.
--
-- ============================================================

update public.properties p

set
  icon_path = null

where
  p.icon_path is not null

  and not exists (

    select
      1

    from storage.objects o

    where
      o.bucket_id =
        'property-icons'

      and o.name =
        p.icon_path
  );