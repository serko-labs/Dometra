============================================================
-- DOMETRA
-- 013
-- PHONE-LANGUAGE INITIALIZATION
--
-- Existing users:
--   preserve their current language choice.
--
-- New users:
--   language_initialized = false
--   and the mobile app will initialize language from the phone.
--
-- Supported phone languages:
--   uk -> uk
--   ru -> ru
--   en -> en
--   de -> de
--
-- Unsupported phone languages:
--   -> en
-- ============================================================

begin;

alter table public.user_settings
add column if not exists language_initialized boolean;

-- Existing settings rows are treated as an existing user choice.
-- This prevents an upgrade from unexpectedly changing language
-- for users who already use Dometra.
update public.user_settings
set language_initialized = true
where language_initialized is null;

alter table public.user_settings
alter column language_initialized
set default false;

alter table public.user_settings
alter column language_initialized
set not null;

commit;

-- ============================================================
-- VERIFICATION
-- ============================================================

select
  column_name,
  data_type,
  is_nullable,
  column_default
from information_schema.columns
where
  table_schema = 'public'
  and table_name = 'user_settings'
  and column_name in (
    'language_code',
    'language_initialized'
  )
order by ordinal_position;
