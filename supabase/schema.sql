-- Dometra / Apartic-style rental & utilities SaaS
-- Supabase PostgreSQL schema
-- Generated 2026-09-10
-- Assumes Supabase Auth (auth.users) and Storage.

create extension if not exists pgcrypto;

-- ---------- ENUMS ----------
do $$ begin
  create type app_mode as enum ('LANDLORD','TENANT');
exception when duplicate_object then null; end $$;

do $$ begin
  create type workspace_role as enum ('OWNER','ADMIN','MANAGER','VIEWER');
exception when duplicate_object then null; end $$;

do $$ begin
  create type tenancy_member_role as enum ('PRIMARY_TENANT','TENANT','OCCUPANT');
exception when duplicate_object then null; end $$;

do $$ begin
  create type property_status as enum ('ACTIVE','INACTIVE','ARCHIVED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type tenancy_status as enum ('DRAFT','ACTIVE','ENDED','CANCELLED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type calculation_method as enum ('METER','FIXED','PER_AREA','FORMULA','MANUAL');
exception when duplicate_object then null; end $$;

do $$ begin
  create type meter_status as enum ('ACTIVE','REPLACED','INACTIVE');
exception when duplicate_object then null; end $$;

do $$ begin
  create type reading_status as enum ('DRAFT','SUBMITTED','CONFIRMED','REJECTED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type invoice_status as enum ('DRAFT','ISSUED','PARTIALLY_PAID','PAID','OVERDUE','VOID');
exception when duplicate_object then null; end $$;

do $$ begin
  create type invoice_line_type as enum ('RENT','UTILITY','FIXED_CHARGE','CUSTOM_CHARGE','DISCOUNT','CREDIT','DEPOSIT','OTHER');
exception when duplicate_object then null; end $$;

do $$ begin
  create type payment_method as enum ('BANK_TRANSFER','CASH','CARD','OTHER');
exception when duplicate_object then null; end $$;

do $$ begin
  create type payment_purpose as enum ('AUTO','INVOICE','ADVANCE','RENT','UTILITY','DEPOSIT','OTHER');
exception when duplicate_object then null; end $$;

do $$ begin
  create type fx_rule as enum ('NONE','MANUAL','NBU_INVOICE_DATE','NBU_PAYMENT_DATE','PROVIDER_INVOICE_DATE','PROVIDER_PAYMENT_DATE','FIXED_CONTRACT_RATE');
exception when duplicate_object then null; end $$;

do $$ begin
  create type deposit_status as enum ('REQUIRED','HELD','PARTIALLY_RETURNED','RETURNED','APPLIED','WAIVED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type deposit_tx_type as enum ('RECEIVED','RETURNED','APPLIED_TO_INVOICE','ADJUSTMENT');
exception when duplicate_object then null; end $$;

do $$ begin
  create type reminder_type as enum ('RENT_DUE','METER_READINGS','INVOICE_DUE','PAYMENT_OVERDUE','CUSTOM');
exception when duplicate_object then null; end $$;

do $$ begin
  create type reminder_recipient as enum ('LANDLORD','TENANT','BOTH');
exception when duplicate_object then null; end $$;

do $$ begin
  create type notification_channel as enum ('PUSH','EMAIL','IN_APP');
exception when duplicate_object then null; end $$;

do $$ begin
  create type notification_status as enum ('QUEUED','SENT','DELIVERED','FAILED','CANCELLED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type invitation_status as enum ('PENDING','ACCEPTED','EXPIRED','REVOKED');
exception when duplicate_object then null; end $$;

-- ---------- GENERIC UPDATED_AT ----------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------- USERS / LOCALIZATION ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  phone text,
  avatar_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.languages (
  code varchar(10) primary key,
  name text not null,
  native_name text not null,
  fallback_code varchar(10) references public.languages(code),
  enabled boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

insert into public.languages(code,name,native_name,sort_order)
values
  ('uk','Ukrainian','Українська',10),
  ('ru','Russian','Русский',20),
  ('en','English','English',30),
  ('de','German','Deutsch',40)
on conflict (code) do nothing;

create table if not exists public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  language_code varchar(10) not null default 'uk' references public.languages(code),
  region_code varchar(10) not null default 'UA',
  timezone text not null default 'Europe/Kyiv',
  display_currency char(3) not null default 'UAH',
  date_format text,
  number_format text,
  active_mode app_mode not null default 'LANDLORD',
  push_enabled boolean not null default true,
  email_enabled boolean not null default true,
  in_app_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.translation_keys (
  id uuid primary key default gen_random_uuid(),
  namespace text not null default 'app',
  key text not null,
  description text,
  created_at timestamptz not null default now(),
  unique(namespace,key)
);

create table if not exists public.translations (
  translation_key_id uuid not null references public.translation_keys(id) on delete cascade,
  language_code varchar(10) not null references public.languages(code) on delete cascade,
  value text not null,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  primary key(translation_key_id, language_code)
);

create table if not exists public.translation_releases (
  version bigint generated by default as identity primary key,
  storage_prefix text not null,
  checksum text,
  published_by uuid references auth.users(id),
  published_at timestamptz not null default now()
);

-- ---------- SAAS / WORKSPACES / SUBSCRIPTIONS ----------
create table if not exists public.subscription_plans (
  code text primary key,
  name text not null,
  max_active_properties integer, -- null = unlimited
  max_members integer,
  analytics_enabled boolean not null default false,
  exports_enabled boolean not null default false,
  tariff_templates_enabled boolean not null default false,
  priority_support boolean not null default false,
  monthly_price numeric(12,2) not null default 0,
  currency_code char(3) not null default 'EUR',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.subscription_plans
(code,name,max_active_properties,max_members,analytics_enabled,exports_enabled,tariff_templates_enabled,priority_support,monthly_price,currency_code)
values
('FREE','Free',4,1,false,false,false,false,0,'EUR'),
('PRO','Pro',null,10,true,true,true,true,0,'EUR')
on conflict (code) do nothing;

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_user_id uuid not null references auth.users(id),
  base_currency char(3) not null default 'UAH',
  default_timezone text not null default 'Europe/Kyiv',
  status text not null default 'ACTIVE' check(status in ('ACTIVE','SUSPENDED','ARCHIVED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role workspace_role not null default 'VIEWER',
  created_at timestamptz not null default now(),
  primary key(workspace_id,user_id)
);

create table if not exists public.workspace_subscriptions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  plan_code text not null references public.subscription_plans(code),
  provider text, -- APPLE / GOOGLE / STRIPE / MANUAL
  provider_customer_id text,
  provider_subscription_id text,
  status text not null default 'ACTIVE' check(status in ('TRIAL','ACTIVE','PAST_DUE','CANCELLED','EXPIRED')),
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(workspace_id)
);

-- ---------- PROPERTIES ----------
create table if not exists public.properties (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  title text not null,
  property_type text not null default 'APARTMENT',
  country_code varchar(2),
  region text,
  city text,
  street text,
  building text,
  apartment text,
  postal_code text,
  latitude numeric(9,6),
  longitude numeric(9,6),
  area_m2 numeric(10,2),
  rent_default_currency char(3),
  utilities_default_currency char(3) not null default 'UAH',
  timezone text,
  status property_status not null default 'ACTIVE',
  notes text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_properties_workspace on public.properties(workspace_id,status);

-- ---------- TENANCIES / TENANTS ----------
create table if not exists public.tenancies (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  start_date date not null,
  end_date date,
  status tenancy_status not null default 'DRAFT',
  payment_due_day smallint check(payment_due_day between 1 and 31),
  billing_anchor_day smallint check(billing_anchor_day between 1 and 31),
  notes text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check(end_date is null or end_date >= start_date)
);

create unique index if not exists uq_property_active_tenancy
on public.tenancies(property_id)
where status = 'ACTIVE';

create table if not exists public.tenancy_members (
  tenancy_id uuid not null references public.tenancies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role tenancy_member_role not null default 'TENANT',
  is_payer boolean not null default true,
  created_at timestamptz not null default now(),
  primary key(tenancy_id,user_id)
);

create table if not exists public.tenancy_invitations (
  id uuid primary key default gen_random_uuid(),
  tenancy_id uuid not null references public.tenancies(id) on delete cascade,
  email text,
  phone text,
  token_hash text not null unique,
  invited_role tenancy_member_role not null default 'TENANT',
  invited_by uuid not null references auth.users(id),
  status invitation_status not null default 'PENDING',
  expires_at timestamptz not null,
  accepted_by uuid references auth.users(id),
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  check(email is not null or phone is not null)
);

-- Rent can change over time and can be denominated in one currency but paid in another.
create table if not exists public.rent_terms (
  id uuid primary key default gen_random_uuid(),
  tenancy_id uuid not null references public.tenancies(id) on delete cascade,
  amount numeric(14,2) not null check(amount >= 0),
  rent_currency char(3) not null,
  payment_currency char(3) not null,
  exchange_rule fx_rule not null default 'NONE',
  fixed_exchange_rate numeric(18,8),
  valid_from date not null,
  valid_to date,
  due_day smallint check(due_day between 1 and 31),
  created_at timestamptz not null default now(),
  check(valid_to is null or valid_to >= valid_from),
  check(
    (exchange_rule = 'FIXED_CONTRACT_RATE' and fixed_exchange_rate is not null and fixed_exchange_rate > 0)
    or exchange_rule <> 'FIXED_CONTRACT_RATE'
  )
);

create index if not exists idx_rent_terms_tenancy_dates on public.rent_terms(tenancy_id,valid_from desc);

-- ---------- FX ----------
create table if not exists public.fx_rates (
  id uuid primary key default gen_random_uuid(),
  rate_date date not null,
  base_currency char(3) not null,
  quote_currency char(3) not null,
  rate numeric(18,8) not null check(rate > 0),
  source text not null, -- NBU, ECB, manual...
  created_at timestamptz not null default now(),
  unique(rate_date,base_currency,quote_currency,source)
);

-- ---------- SERVICES / TARIFFS ----------
create table if not exists public.property_services (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  service_code text not null, -- ELECTRICITY, WATER, GAS, INTERNET, MAINTENANCE, CUSTOM...
  custom_name text,
  calculation_method calculation_method not null,
  unit text, -- kWh, m3, m2, month...
  currency_code char(3) not null default 'UAH',
  formula jsonb, -- only for FORMULA calculations
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_property_services_property on public.property_services(property_id,is_active);

-- ---------- METERS / MULTI-TARIFF REGISTERS ----------
create table if not exists public.meters (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  property_service_id uuid references public.property_services(id) on delete set null,
  name text not null,
  category text not null, -- ELECTRICITY, WATER, GAS, HEAT, CUSTOM
  serial_number text,
  manufacturer text,
  model text,
  unit text not null,
  status meter_status not null default 'ACTIVE',
  installed_at date,
  removed_at date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.meter_registers (
  id uuid primary key default gen_random_uuid(),
  meter_id uuid not null references public.meters(id) on delete cascade,
  code text not null, -- TOTAL, T1, T2, T3...
  name text not null, -- Day, Night...
  unit text not null,
  sort_order integer not null default 0,
  photo_required boolean not null default true,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(meter_id,code)
);

-- Tariffs belong to a concrete property service and optionally one register (e.g. T1/T2).
create table if not exists public.service_tariffs (
  id uuid primary key default gen_random_uuid(),
  property_service_id uuid not null references public.property_services(id) on delete cascade,
  meter_register_id uuid references public.meter_registers(id) on delete cascade,
  price numeric(18,6) not null check(price >= 0),
  currency_code char(3) not null,
  unit text not null,
  valid_from date not null,
  valid_to date,
  source text,
  notes text,
  created_at timestamptz not null default now(),
  check(valid_to is null or valid_to >= valid_from)
);

create index if not exists idx_tariffs_service_dates
on public.service_tariffs(property_service_id,meter_register_id,valid_from desc);

-- Optional reusable templates. Applying one should COPY values into service_tariffs.
create table if not exists public.tariff_templates (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade,
  name text not null,
  country_code varchar(2),
  service_code text not null,
  definition jsonb not null,
  active boolean not null default true,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- MEDIA / METER READINGS ----------
create table if not exists public.media_files (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  property_id uuid references public.properties(id) on delete cascade,
  bucket text not null,
  storage_path text not null,
  mime_type text,
  size_bytes bigint check(size_bytes is null or size_bytes >= 0),
  width integer,
  height integer,
  checksum text,
  captured_at timestamptz,
  uploaded_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique(bucket,storage_path)
);

create table if not exists public.meter_reading_sessions (
  id uuid primary key default gen_random_uuid(),
  meter_id uuid not null references public.meters(id) on delete cascade,
  tenancy_id uuid references public.tenancies(id) on delete set null,
  billing_period date not null, -- first day of month, e.g. 2026-09-01
  reading_date date not null,
  status reading_status not null default 'DRAFT',
  submitted_by uuid references auth.users(id),
  submitted_at timestamptz,
  confirmed_by uuid references auth.users(id),
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(meter_id,billing_period)
);

create table if not exists public.meter_register_readings (
  id uuid primary key default gen_random_uuid(),
  reading_session_id uuid not null references public.meter_reading_sessions(id) on delete cascade,
  meter_register_id uuid not null references public.meter_registers(id) on delete cascade,
  previous_value numeric(18,6),
  current_value numeric(18,6),
  consumption numeric(18,6),
  ocr_value numeric(18,6),
  ocr_confidence numeric(5,4) check(ocr_confidence between 0 and 1),
  confirmed boolean not null default false,
  anomaly_code text,
  anomaly_details jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(reading_session_id,meter_register_id),
  check(current_value is null or previous_value is null or current_value >= previous_value)
);

create table if not exists public.meter_reading_photos (
  id uuid primary key default gen_random_uuid(),
  register_reading_id uuid not null references public.meter_register_readings(id) on delete cascade,
  media_file_id uuid not null references public.media_files(id) on delete cascade,
  photo_type text not null default 'READING',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique(register_reading_id,media_file_id)
);

-- ---------- INVOICES ----------
create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete restrict,
  tenancy_id uuid not null references public.tenancies(id) on delete restrict,
  invoice_number text not null,
  billing_period date not null,
  issue_date date not null,
  due_date date,
  status invoice_status not null default 'DRAFT',
  language_code varchar(10) not null default 'uk' references public.languages(code),
  base_currency char(3) not null,
  base_total_amount numeric(14,2) not null default 0,
  base_paid_amount numeric(14,2) not null default 0,
  base_balance_amount numeric(14,2) not null default 0,
  template_version integer not null default 1,
  notes text,
  issued_at timestamptz,
  paid_at timestamptz,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(workspace_id,invoice_number),
  unique(tenancy_id,billing_period)
);

create index if not exists idx_invoices_workspace_period on public.invoices(workspace_id,billing_period,status);
create index if not exists idx_invoices_tenancy_period on public.invoices(tenancy_id,billing_period);

create table if not exists public.invoice_lines (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  line_type invoice_line_type not null,
  property_service_id uuid references public.property_services(id) on delete set null,
  meter_register_reading_id uuid references public.meter_register_readings(id) on delete set null,
  description_key text,
  description_snapshot text not null,
  quantity numeric(18,6),
  unit text,
  unit_price numeric(18,6),
  amount numeric(14,2) not null,
  currency_code char(3) not null,
  fx_rate_to_base numeric(18,8) not null default 1 check(fx_rate_to_base > 0),
  fx_rate_date date,
  fx_source text,
  base_amount numeric(14,2) not null,
  metadata jsonb,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.invoice_documents (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  language_code varchar(10) not null references public.languages(code),
  template_version integer not null,
  media_file_id uuid not null references public.media_files(id) on delete cascade,
  generated_at timestamptz not null default now(),
  unique(invoice_id,language_code,template_version)
);

-- ---------- PAYMENTS / ADVANCE / ALLOCATIONS ----------
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  tenancy_id uuid not null references public.tenancies(id) on delete restrict,
  amount numeric(14,2) not null check(amount > 0),
  currency_code char(3) not null,
  base_currency char(3) not null,
  fx_rate_to_base numeric(18,8) not null default 1 check(fx_rate_to_base > 0),
  fx_rate_date date,
  fx_source text,
  base_amount numeric(14,2) not null,
  payment_date date not null,
  method payment_method not null default 'BANK_TRANSFER',
  purpose payment_purpose not null default 'AUTO',
  reference text,
  note text,
  received_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_payments_tenancy_date on public.payments(tenancy_id,payment_date desc);

-- A payment can be allocated to an existing invoice OR reserved for a future billing period.
create table if not exists public.payment_allocations (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments(id) on delete cascade,
  invoice_id uuid references public.invoices(id) on delete cascade,
  reserved_billing_period date,
  allocated_payment_amount numeric(14,2) not null check(allocated_payment_amount > 0),
  payment_currency char(3) not null,
  allocated_invoice_amount numeric(14,2),
  invoice_currency char(3),
  fx_rate numeric(18,8),
  base_amount numeric(14,2) not null check(base_amount > 0),
  allocation_type text not null default 'AUTO' check(allocation_type in ('AUTO','MANUAL','ADVANCE_RESERVATION')),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  check (
    (invoice_id is not null and reserved_billing_period is null)
    or (invoice_id is null and reserved_billing_period is not null)
  )
);

create index if not exists idx_allocations_payment on public.payment_allocations(payment_id);
create index if not exists idx_allocations_invoice on public.payment_allocations(invoice_id) where invoice_id is not null;

-- Unallocated payment amount = general advance/credit.
-- Reserved allocations = advance for a specific future billing period.

-- ---------- SECURITY DEPOSIT ----------
create table if not exists public.security_deposits (
  id uuid primary key default gen_random_uuid(),
  tenancy_id uuid not null references public.tenancies(id) on delete cascade,
  required_amount numeric(14,2) not null default 0,
  currency_code char(3) not null,
  status deposit_status not null default 'REQUIRED',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(tenancy_id)
);

create table if not exists public.security_deposit_transactions (
  id uuid primary key default gen_random_uuid(),
  security_deposit_id uuid not null references public.security_deposits(id) on delete cascade,
  tx_type deposit_tx_type not null,
  amount numeric(14,2) not null check(amount > 0),
  currency_code char(3) not null,
  invoice_id uuid references public.invoices(id) on delete set null,
  tx_date date not null,
  note text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

-- ---------- REMINDERS / NOTIFICATIONS ----------
create table if not exists public.reminder_rules (
  id uuid primary key default gen_random_uuid(),
  tenancy_id uuid references public.tenancies(id) on delete cascade,
  property_id uuid references public.properties(id) on delete cascade,
  type reminder_type not null,
  recipient reminder_recipient not null,
  rrule text not null, -- e.g. FREQ=MONTHLY;BYMONTHDAY=28;BYHOUR=18
  timezone text not null,
  channels notification_channel[] not null default array['PUSH'::notification_channel,'IN_APP'::notification_channel],
  repeat_until_condition_met boolean not null default false,
  repeat_every_days integer check(repeat_every_days is null or repeat_every_days > 0),
  max_repeats integer check(max_repeats is null or max_repeats >= 0),
  enabled boolean not null default true,
  config jsonb, -- due-day offsets, outstanding-only, required meter registers, etc.
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check(tenancy_id is not null or property_id is not null)
);

create table if not exists public.device_push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null check(platform in ('IOS','ANDROID','WEB')),
  token text not null,
  device_id text,
  enabled boolean not null default true,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  unique(token)
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  reminder_rule_id uuid references public.reminder_rules(id) on delete set null,
  channel notification_channel not null,
  status notification_status not null default 'QUEUED',
  language_code varchar(10) not null references public.languages(code),
  title_key text,
  body_key text,
  template_data jsonb,
  deep_link text,
  scheduled_at timestamptz not null,
  sent_at timestamptz,
  delivered_at timestamptz,
  failure_reason text,
  created_at timestamptz not null default now()
);

create index if not exists idx_notifications_queue on public.notifications(status,scheduled_at);
create index if not exists idx_notifications_user on public.notifications(user_id,created_at desc);

-- ---------- AUDIT ----------
create table if not exists public.audit_log (
  id bigint generated by default as identity primary key,
  workspace_id uuid references public.workspaces(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  entity_type text not null,
  entity_id uuid,
  action text not null,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);

-- ---------- UPDATED_AT TRIGGERS ----------
do $$ declare
  t text;
begin
  foreach t in array array[
    'profiles','user_settings','workspaces','workspace_subscriptions','properties',
    'tenancies','property_services','meters','tariff_templates',
    'meter_reading_sessions','meter_register_readings','invoices','payments',
    'security_deposits','reminder_rules'
  ]
  loop
    execute format('drop trigger if exists trg_%I_updated_at on public.%I', t, t);
    execute format(
      'create trigger trg_%I_updated_at before update on public.%I for each row execute function public.set_updated_at()',
      t,t
    );
  end loop;
end $$;

-- ---------- ACCESS HELPER FUNCTIONS ----------
create or replace function public.is_workspace_member(p_workspace_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = p_workspace_id
      and wm.user_id = auth.uid()
  );
$$;

create or replace function public.can_manage_workspace(p_workspace_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = p_workspace_id
      and wm.user_id = auth.uid()
      and wm.role in ('OWNER','ADMIN','MANAGER')
  );
$$;

create or replace function public.can_access_property(p_property_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.properties p
    join public.workspace_members wm on wm.workspace_id = p.workspace_id
    where p.id = p_property_id and wm.user_id = auth.uid()
  )
  or exists (
    select 1
    from public.tenancies t
    join public.tenancy_members tm on tm.tenancy_id = t.id
    where t.property_id = p_property_id
      and tm.user_id = auth.uid()
      and t.status in ('ACTIVE','ENDED')
  );
$$;

create or replace function public.current_plan_max_properties(p_workspace_id uuid)
returns integer
language sql stable security definer
set search_path = public
as $$
  select sp.max_active_properties
  from public.workspace_subscriptions ws
  join public.subscription_plans sp on sp.code = ws.plan_code
  where ws.workspace_id = p_workspace_id
    and ws.status in ('TRIAL','ACTIVE')
  limit 1;
$$;

create or replace function public.can_add_active_property(p_workspace_id uuid)
returns boolean
language plpgsql stable security definer
set search_path = public
as $$
declare
  v_limit integer;
  v_count integer;
begin
  select public.current_plan_max_properties(p_workspace_id) into v_limit;
  if v_limit is null then
    -- null means unlimited OR no subscription row; no row should fall back to FREE below
    if exists(select 1 from public.workspace_subscriptions where workspace_id=p_workspace_id and status in ('TRIAL','ACTIVE')) then
      return true;
    end if;
    select max_active_properties into v_limit from public.subscription_plans where code='FREE';
  end if;

  select count(*) into v_count
  from public.properties
  where workspace_id=p_workspace_id and status='ACTIVE';

  return v_count < v_limit;
end $$;

-- ---------- RLS ----------
-- Enable RLS on user-facing tables. Add/review grants as part of production hardening.
alter table public.profiles enable row level security;
alter table public.user_settings enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.workspace_subscriptions enable row level security;
alter table public.properties enable row level security;
alter table public.tenancies enable row level security;
alter table public.tenancy_members enable row level security;
alter table public.tenancy_invitations enable row level security;
alter table public.rent_terms enable row level security;
alter table public.property_services enable row level security;
alter table public.meters enable row level security;
alter table public.meter_registers enable row level security;
alter table public.service_tariffs enable row level security;
alter table public.tariff_templates enable row level security;
alter table public.media_files enable row level security;
alter table public.meter_reading_sessions enable row level security;
alter table public.meter_register_readings enable row level security;
alter table public.meter_reading_photos enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_lines enable row level security;
alter table public.invoice_documents enable row level security;
alter table public.payments enable row level security;
alter table public.payment_allocations enable row level security;
alter table public.security_deposits enable row level security;
alter table public.security_deposit_transactions enable row level security;
alter table public.reminder_rules enable row level security;
alter table public.device_push_tokens enable row level security;
alter table public.notifications enable row level security;

-- Profiles/settings: own rows.
drop policy if exists profiles_self_select on public.profiles;
create policy profiles_self_select on public.profiles for select
using (id = auth.uid());
drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update on public.profiles for update
using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists settings_self_all on public.user_settings;
create policy settings_self_all on public.user_settings for all
using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Properties: workspace members + linked tenants can read. Managers can write.
drop policy if exists property_read on public.properties;
create policy property_read on public.properties for select
using (public.can_access_property(id));

drop policy if exists property_insert on public.properties;
create policy property_insert on public.properties for insert
with check (
  public.can_manage_workspace(workspace_id)
  and (status <> 'ACTIVE' or public.can_add_active_property(workspace_id))
);

drop policy if exists property_update on public.properties;
create policy property_update on public.properties for update
using (public.can_manage_workspace(workspace_id))
with check (public.can_manage_workspace(workspace_id));

drop policy if exists property_delete on public.properties;
create policy property_delete on public.properties for delete
using (public.can_manage_workspace(workspace_id));

-- Push tokens/notifications: own rows.
drop policy if exists push_token_self on public.device_push_tokens;
create policy push_token_self on public.device_push_tokens for all
using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists notifications_self_read on public.notifications;
create policy notifications_self_read on public.notifications for select
using (user_id = auth.uid());

-- NOTE:
-- For all child tables (meters, readings, invoices, payments, tariffs, etc.),
-- add policies that resolve to can_access_property(...) for SELECT and
-- can_manage_workspace(...) for landlord-side INSERT/UPDATE/DELETE.
-- Tenant INSERT/UPDATE should be narrowly allowed for their own reading sessions/photos only.
-- Keep service-role operations in Edge Functions only; never ship service_role to the app.

-- ---------- STORAGE DESIGN ----------
-- Create PRIVATE buckets in Supabase Dashboard / migrations:
--   meter-photos
--   invoice-documents
--   avatars
--
-- Recommended object paths:
-- meter-photos/{workspace_id}/{property_id}/{meter_id}/{YYYY-MM}/{register_code}/{uuid}.jpg
-- invoice-documents/{workspace_id}/{property_id}/{invoice_id}/{language_code}/invoice.pdf
--
-- Access through authenticated download or short-lived signed URLs.


-- ============================================================
-- PRODUCTION ACCESS / BOOTSTRAP / KPI ADDITIONS
-- ============================================================

create or replace function public.can_manage_property(p_property_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.properties p
    where p.id = p_property_id
      and public.can_manage_workspace(p.workspace_id)
  );
$$;

create or replace function public.can_access_tenancy(p_tenancy_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.tenancies t
    where t.id = p_tenancy_id
      and public.can_access_property(t.property_id)
  );
$$;

create or replace function public.can_manage_tenancy(p_tenancy_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.tenancies t
    where t.id = p_tenancy_id
      and public.can_manage_property(t.property_id)
  );
$$;

create or replace function public.can_view_user_profile(p_user_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select
    p_user_id = auth.uid()
    or exists (
      select 1
      from public.workspace_members a
      join public.workspace_members b on b.workspace_id = a.workspace_id
      where a.user_id = auth.uid() and b.user_id = p_user_id
    )
    or exists (
      select 1
      from public.tenancy_members a
      join public.tenancy_members b on b.tenancy_id = a.tenancy_id
      where a.user_id = auth.uid() and b.user_id = p_user_id
    )
    or exists (
      select 1
      from public.tenancy_members tm
      join public.tenancies t on t.id = tm.tenancy_id
      join public.properties p on p.id = t.property_id
      join public.workspace_members wm on wm.workspace_id = p.workspace_id
      where wm.user_id = auth.uid() and tm.user_id = p_user_id
    )
    or exists (
      select 1
      from public.tenancy_members tm
      join public.tenancies t on t.id = tm.tenancy_id
      join public.properties p on p.id = t.property_id
      join public.workspace_members wm on wm.workspace_id = p.workspace_id
      where tm.user_id = auth.uid() and wm.user_id = p_user_id
    );
$$;

-- Bootstrap every landlord workspace with OWNER membership + FREE plan.
create or replace function public.bootstrap_workspace()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  insert into public.workspace_members(workspace_id,user_id,role)
  values(new.id,new.owner_user_id,'OWNER')
  on conflict do nothing;

  insert into public.workspace_subscriptions(workspace_id,plan_code,status)
  values(new.id,'FREE','ACTIVE')
  on conflict (workspace_id) do nothing;

  return new;
end $$;

drop trigger if exists trg_workspace_bootstrap on public.workspaces;
create trigger trg_workspace_bootstrap
after insert on public.workspaces
for each row execute function public.bootstrap_workspace();

-- Public-ish catalog tables: authenticated users can read; writes stay server/admin side.
alter table public.languages enable row level security;
alter table public.translation_keys enable row level security;
alter table public.translations enable row level security;
alter table public.translation_releases enable row level security;
alter table public.subscription_plans enable row level security;
alter table public.fx_rates enable row level security;
alter table public.audit_log enable row level security;

drop policy if exists catalog_languages_read on public.languages;
create policy catalog_languages_read on public.languages for select to authenticated using (enabled);

drop policy if exists translation_release_read on public.translation_releases;
create policy translation_release_read on public.translation_releases for select to authenticated using (true);

drop policy if exists plans_read on public.subscription_plans;
create policy plans_read on public.subscription_plans for select to authenticated using (active);

drop policy if exists fx_read on public.fx_rates;
create policy fx_read on public.fx_rates for select to authenticated using (true);

-- Profiles: user can see themselves plus landlords/tenants they actually share a relationship with.
drop policy if exists profiles_self_select on public.profiles;
create policy profiles_related_select on public.profiles for select to authenticated
using (public.can_view_user_profile(id));

drop policy if exists profiles_self_insert on public.profiles;
create policy profiles_self_insert on public.profiles for insert to authenticated
with check (id = auth.uid());

-- Workspaces.
drop policy if exists workspaces_read on public.workspaces;
create policy workspaces_read on public.workspaces for select to authenticated
using (public.is_workspace_member(id) or owner_user_id = auth.uid());

drop policy if exists workspaces_insert on public.workspaces;
create policy workspaces_insert on public.workspaces for insert to authenticated
with check (owner_user_id = auth.uid());

drop policy if exists workspaces_update on public.workspaces;
create policy workspaces_update on public.workspaces for update to authenticated
using (public.can_manage_workspace(id))
with check (public.can_manage_workspace(id));

drop policy if exists workspaces_delete on public.workspaces;
create policy workspaces_delete on public.workspaces for delete to authenticated
using (
  exists(select 1 from public.workspace_members wm
         where wm.workspace_id=id and wm.user_id=auth.uid() and wm.role='OWNER')
);

-- Workspace members.
drop policy if exists workspace_members_read on public.workspace_members;
create policy workspace_members_read on public.workspace_members for select to authenticated
using (public.is_workspace_member(workspace_id));

drop policy if exists workspace_members_insert on public.workspace_members;
create policy workspace_members_insert on public.workspace_members for insert to authenticated
with check (
  public.can_manage_workspace(workspace_id)
  or exists(select 1 from public.workspaces w where w.id=workspace_id and w.owner_user_id=auth.uid())
);

drop policy if exists workspace_members_update on public.workspace_members;
create policy workspace_members_update on public.workspace_members for update to authenticated
using (public.can_manage_workspace(workspace_id))
with check (public.can_manage_workspace(workspace_id));

drop policy if exists workspace_members_delete on public.workspace_members;
create policy workspace_members_delete on public.workspace_members for delete to authenticated
using (public.can_manage_workspace(workspace_id));

-- Subscription is readable to workspace members; mutations should come from billing webhooks / server.
drop policy if exists workspace_subscriptions_read on public.workspace_subscriptions;
create policy workspace_subscriptions_read on public.workspace_subscriptions for select to authenticated
using (public.is_workspace_member(workspace_id));

-- Tenancies.
drop policy if exists tenancies_read on public.tenancies;
create policy tenancies_read on public.tenancies for select to authenticated
using (public.can_access_property(property_id));

drop policy if exists tenancies_insert on public.tenancies;
create policy tenancies_insert on public.tenancies for insert to authenticated
with check (public.can_manage_property(property_id));

drop policy if exists tenancies_update on public.tenancies;
create policy tenancies_update on public.tenancies for update to authenticated
using (public.can_manage_property(property_id))
with check (public.can_manage_property(property_id));

drop policy if exists tenancies_delete on public.tenancies;
create policy tenancies_delete on public.tenancies for delete to authenticated
using (public.can_manage_property(property_id));

-- Tenancy members and invitations.
drop policy if exists tenancy_members_read on public.tenancy_members;
create policy tenancy_members_read on public.tenancy_members for select to authenticated
using (public.can_access_tenancy(tenancy_id));

drop policy if exists tenancy_members_manage on public.tenancy_members;
create policy tenancy_members_manage on public.tenancy_members for all to authenticated
using (public.can_manage_tenancy(tenancy_id))
with check (public.can_manage_tenancy(tenancy_id));

drop policy if exists tenancy_invitations_read on public.tenancy_invitations;
create policy tenancy_invitations_read on public.tenancy_invitations for select to authenticated
using (public.can_manage_tenancy(tenancy_id) or accepted_by=auth.uid());

drop policy if exists tenancy_invitations_manage on public.tenancy_invitations;
create policy tenancy_invitations_manage on public.tenancy_invitations for all to authenticated
using (public.can_manage_tenancy(tenancy_id))
with check (public.can_manage_tenancy(tenancy_id));

-- Rent terms.
drop policy if exists rent_terms_read on public.rent_terms;
create policy rent_terms_read on public.rent_terms for select to authenticated
using (public.can_access_tenancy(tenancy_id));

drop policy if exists rent_terms_manage on public.rent_terms;
create policy rent_terms_manage on public.rent_terms for all to authenticated
using (public.can_manage_tenancy(tenancy_id))
with check (public.can_manage_tenancy(tenancy_id));

-- Property services.
drop policy if exists property_services_read on public.property_services;
create policy property_services_read on public.property_services for select to authenticated
using (public.can_access_property(property_id));

drop policy if exists property_services_manage on public.property_services;
create policy property_services_manage on public.property_services for all to authenticated
using (public.can_manage_property(property_id))
with check (public.can_manage_property(property_id));

-- Meters.
drop policy if exists meters_read on public.meters;
create policy meters_read on public.meters for select to authenticated
using (public.can_access_property(property_id));

drop policy if exists meters_manage on public.meters;
create policy meters_manage on public.meters for all to authenticated
using (public.can_manage_property(property_id))
with check (public.can_manage_property(property_id));

-- Meter registers.
drop policy if exists meter_registers_read on public.meter_registers;
create policy meter_registers_read on public.meter_registers for select to authenticated
using (
  exists(select 1 from public.meters m
         where m.id=meter_id and public.can_access_property(m.property_id))
);

drop policy if exists meter_registers_manage on public.meter_registers;
create policy meter_registers_manage on public.meter_registers for all to authenticated
using (
  exists(select 1 from public.meters m
         where m.id=meter_id and public.can_manage_property(m.property_id))
)
with check (
  exists(select 1 from public.meters m
         where m.id=meter_id and public.can_manage_property(m.property_id))
);

-- Service tariffs.
drop policy if exists service_tariffs_read on public.service_tariffs;
create policy service_tariffs_read on public.service_tariffs for select to authenticated
using (
  exists(select 1 from public.property_services ps
         where ps.id=property_service_id and public.can_access_property(ps.property_id))
);

drop policy if exists service_tariffs_manage on public.service_tariffs;
create policy service_tariffs_manage on public.service_tariffs for all to authenticated
using (
  exists(select 1 from public.property_services ps
         where ps.id=property_service_id and public.can_manage_property(ps.property_id))
)
with check (
  exists(select 1 from public.property_services ps
         where ps.id=property_service_id and public.can_manage_property(ps.property_id))
);

-- Tariff templates.
drop policy if exists tariff_templates_read on public.tariff_templates;
create policy tariff_templates_read on public.tariff_templates for select to authenticated
using (workspace_id is null or public.is_workspace_member(workspace_id));

drop policy if exists tariff_templates_manage on public.tariff_templates;
create policy tariff_templates_manage on public.tariff_templates for all to authenticated
using (workspace_id is not null and public.can_manage_workspace(workspace_id))
with check (workspace_id is not null and public.can_manage_workspace(workspace_id));

-- Media metadata.
drop policy if exists media_files_read on public.media_files;
create policy media_files_read on public.media_files for select to authenticated
using (property_id is not null and public.can_access_property(property_id));

drop policy if exists media_files_insert on public.media_files;
create policy media_files_insert on public.media_files for insert to authenticated
with check (
  uploaded_by=auth.uid()
  and property_id is not null
  and public.can_access_property(property_id)
);

drop policy if exists media_files_delete on public.media_files;
create policy media_files_delete on public.media_files for delete to authenticated
using (
  uploaded_by=auth.uid()
  or (property_id is not null and public.can_manage_property(property_id))
);

-- Reading sessions: both landlord and linked tenants may submit.
drop policy if exists reading_sessions_read on public.meter_reading_sessions;
create policy reading_sessions_read on public.meter_reading_sessions for select to authenticated
using (
  exists(select 1 from public.meters m
         where m.id=meter_id and public.can_access_property(m.property_id))
);

drop policy if exists reading_sessions_insert on public.meter_reading_sessions;
create policy reading_sessions_insert on public.meter_reading_sessions for insert to authenticated
with check (
  submitted_by=auth.uid()
  and exists(select 1 from public.meters m
             where m.id=meter_id and public.can_access_property(m.property_id))
);

drop policy if exists reading_sessions_update on public.meter_reading_sessions;
create policy reading_sessions_update on public.meter_reading_sessions for update to authenticated
using (
  submitted_by=auth.uid()
  or exists(select 1 from public.meters m
            where m.id=meter_id and public.can_manage_property(m.property_id))
)
with check (
  submitted_by=auth.uid()
  or exists(select 1 from public.meters m
            where m.id=meter_id and public.can_manage_property(m.property_id))
);

-- Register readings inherit session->meter->property access.
drop policy if exists register_readings_read on public.meter_register_readings;
create policy register_readings_read on public.meter_register_readings for select to authenticated
using (
  exists(
    select 1 from public.meter_reading_sessions s
    join public.meters m on m.id=s.meter_id
    where s.id=reading_session_id and public.can_access_property(m.property_id)
  )
);

drop policy if exists register_readings_write on public.meter_register_readings;
create policy register_readings_write on public.meter_register_readings for all to authenticated
using (
  exists(
    select 1 from public.meter_reading_sessions s
    join public.meters m on m.id=s.meter_id
    where s.id=reading_session_id and public.can_access_property(m.property_id)
  )
)
with check (
  exists(
    select 1 from public.meter_reading_sessions s
    join public.meters m on m.id=s.meter_id
    where s.id=reading_session_id and public.can_access_property(m.property_id)
  )
);

drop policy if exists reading_photos_read on public.meter_reading_photos;
create policy reading_photos_read on public.meter_reading_photos for select to authenticated
using (
  exists(
    select 1
    from public.meter_register_readings r
    join public.meter_reading_sessions s on s.id=r.reading_session_id
    join public.meters m on m.id=s.meter_id
    where r.id=register_reading_id and public.can_access_property(m.property_id)
  )
);

drop policy if exists reading_photos_write on public.meter_reading_photos;
create policy reading_photos_write on public.meter_reading_photos for all to authenticated
using (
  exists(
    select 1
    from public.meter_register_readings r
    join public.meter_reading_sessions s on s.id=r.reading_session_id
    join public.meters m on m.id=s.meter_id
    where r.id=register_reading_id and public.can_access_property(m.property_id)
  )
)
with check (
  exists(
    select 1
    from public.meter_register_readings r
    join public.meter_reading_sessions s on s.id=r.reading_session_id
    join public.meters m on m.id=s.meter_id
    where r.id=register_reading_id and public.can_access_property(m.property_id)
  )
);

-- Invoices.
drop policy if exists invoices_read on public.invoices;
create policy invoices_read on public.invoices for select to authenticated
using (public.can_access_property(property_id));

drop policy if exists invoices_manage on public.invoices;
create policy invoices_manage on public.invoices for all to authenticated
using (public.can_manage_property(property_id))
with check (public.can_manage_property(property_id));

drop policy if exists invoice_lines_read on public.invoice_lines;
create policy invoice_lines_read on public.invoice_lines for select to authenticated
using (
  exists(select 1 from public.invoices i
         where i.id=invoice_id and public.can_access_property(i.property_id))
);

drop policy if exists invoice_lines_manage on public.invoice_lines;
create policy invoice_lines_manage on public.invoice_lines for all to authenticated
using (
  exists(select 1 from public.invoices i
         where i.id=invoice_id and public.can_manage_property(i.property_id))
)
with check (
  exists(select 1 from public.invoices i
         where i.id=invoice_id and public.can_manage_property(i.property_id))
);

drop policy if exists invoice_documents_read on public.invoice_documents;
create policy invoice_documents_read on public.invoice_documents for select to authenticated
using (
  exists(select 1 from public.invoices i
         where i.id=invoice_id and public.can_access_property(i.property_id))
);

drop policy if exists invoice_documents_manage on public.invoice_documents;
create policy invoice_documents_manage on public.invoice_documents for all to authenticated
using (
  exists(select 1 from public.invoices i
         where i.id=invoice_id and public.can_manage_property(i.property_id))
)
with check (
  exists(select 1 from public.invoices i
         where i.id=invoice_id and public.can_manage_property(i.property_id))
);

-- Payments and allocations: tenants can read their financial history; landlord managers record/allocate.
drop policy if exists payments_read on public.payments;
create policy payments_read on public.payments for select to authenticated
using (public.can_access_tenancy(tenancy_id));

drop policy if exists payments_manage on public.payments;
create policy payments_manage on public.payments for all to authenticated
using (public.can_manage_tenancy(tenancy_id))
with check (public.can_manage_tenancy(tenancy_id));

drop policy if exists allocations_read on public.payment_allocations;
create policy allocations_read on public.payment_allocations for select to authenticated
using (
  exists(select 1 from public.payments p
         where p.id=payment_id and public.can_access_tenancy(p.tenancy_id))
);

drop policy if exists allocations_manage on public.payment_allocations;
create policy allocations_manage on public.payment_allocations for all to authenticated
using (
  exists(select 1 from public.payments p
         where p.id=payment_id and public.can_manage_tenancy(p.tenancy_id))
)
with check (
  exists(select 1 from public.payments p
         where p.id=payment_id and public.can_manage_tenancy(p.tenancy_id))
);

-- Deposits.
drop policy if exists deposits_read on public.security_deposits;
create policy deposits_read on public.security_deposits for select to authenticated
using (public.can_access_tenancy(tenancy_id));

drop policy if exists deposits_manage on public.security_deposits;
create policy deposits_manage on public.security_deposits for all to authenticated
using (public.can_manage_tenancy(tenancy_id))
with check (public.can_manage_tenancy(tenancy_id));

drop policy if exists deposit_tx_read on public.security_deposit_transactions;
create policy deposit_tx_read on public.security_deposit_transactions for select to authenticated
using (
  exists(select 1 from public.security_deposits d
         where d.id=security_deposit_id and public.can_access_tenancy(d.tenancy_id))
);

drop policy if exists deposit_tx_manage on public.security_deposit_transactions;
create policy deposit_tx_manage on public.security_deposit_transactions for all to authenticated
using (
  exists(select 1 from public.security_deposits d
         where d.id=security_deposit_id and public.can_manage_tenancy(d.tenancy_id))
)
with check (
  exists(select 1 from public.security_deposits d
         where d.id=security_deposit_id and public.can_manage_tenancy(d.tenancy_id))
);

-- Reminders.
drop policy if exists reminders_read on public.reminder_rules;
create policy reminders_read on public.reminder_rules for select to authenticated
using (
  (tenancy_id is not null and public.can_access_tenancy(tenancy_id))
  or (property_id is not null and public.can_access_property(property_id))
);

drop policy if exists reminders_manage on public.reminder_rules;
create policy reminders_manage on public.reminder_rules for all to authenticated
using (
  (tenancy_id is not null and public.can_manage_tenancy(tenancy_id))
  or (property_id is not null and public.can_manage_property(property_id))
)
with check (
  (tenancy_id is not null and public.can_manage_tenancy(tenancy_id))
  or (property_id is not null and public.can_manage_property(property_id))
);

-- Audit: landlord managers can read audit trail. Writes should be server-side.
drop policy if exists audit_read on public.audit_log;
create policy audit_read on public.audit_log for select to authenticated
using (workspace_id is not null and public.can_manage_workspace(workspace_id));

-- ---------- KPI / BALANCE VIEWS ----------
create or replace view public.v_payment_credit
with (security_invoker = true)
as
select
  p.id as payment_id,
  p.workspace_id,
  p.tenancy_id,
  p.payment_date,
  p.currency_code,
  p.amount,
  p.base_currency,
  p.base_amount,
  coalesce(sum(pa.base_amount),0)::numeric(14,2) as allocated_base_amount,
  (p.base_amount - coalesce(sum(pa.base_amount),0))::numeric(14,2) as unallocated_advance_base_amount
from public.payments p
left join public.payment_allocations pa on pa.payment_id=p.id
group by p.id;

create or replace view public.v_workspace_monthly_kpis
with (security_invoker = true)
as
with invoice_month as (
  select
    workspace_id,
    billing_period,
    sum(base_total_amount)::numeric(14,2) expected_base,
    sum(base_paid_amount)::numeric(14,2) allocated_received_base,
    sum(greatest(base_balance_amount,0))::numeric(14,2) outstanding_base
  from public.invoices
  where status <> 'VOID'
  group by workspace_id,billing_period
),
payments_month as (
  select
    workspace_id,
    date_trunc('month',payment_date)::date billing_period,
    sum(base_amount)::numeric(14,2) cash_received_base
  from public.payments
  group by workspace_id,date_trunc('month',payment_date)::date
),
advance as (
  select
    workspace_id,
    sum(greatest(unallocated_advance_base_amount,0))::numeric(14,2) advance_base
  from public.v_payment_credit
  group by workspace_id
)
select
  i.workspace_id,
  i.billing_period,
  i.expected_base,
  coalesce(p.cash_received_base,0)::numeric(14,2) received_base,
  i.outstanding_base,
  coalesce(a.advance_base,0)::numeric(14,2) advance_base,
  case when i.expected_base > 0
    then round((coalesce(p.cash_received_base,0) / i.expected_base) * 100,2)
    else 0
  end as collection_rate_percent
from invoice_month i
left join payments_month p using(workspace_id,billing_period)
left join advance a using(workspace_id);

-- ---------- PRIVATE STORAGE BUCKETS ----------
insert into storage.buckets(id,name,public)
values
  ('meter-photos','meter-photos',false),
  ('invoice-documents','invoice-documents',false)
on conflict (id) do update set public=false;

-- Paths:
-- meter-photos/{workspace_id}/{property_id}/{meter_id}/{YYYY-MM}/{register_code}/{uuid}.jpg
-- invoice-documents/{workspace_id}/{property_id}/{invoice_id}/{language_code}/{uuid}.pdf

drop policy if exists meter_photos_select on storage.objects;
create policy meter_photos_select on storage.objects for select to authenticated
using (
  bucket_id='meter-photos'
  and public.can_access_property(((storage.foldername(name))[2])::uuid)
);

drop policy if exists meter_photos_insert on storage.objects;
create policy meter_photos_insert on storage.objects for insert to authenticated
with check (
  bucket_id='meter-photos'
  and public.can_access_property(((storage.foldername(name))[2])::uuid)
);

drop policy if exists meter_photos_delete on storage.objects;
create policy meter_photos_delete on storage.objects for delete to authenticated
using (
  bucket_id='meter-photos'
  and public.can_manage_property(((storage.foldername(name))[2])::uuid)
);

drop policy if exists invoice_docs_select on storage.objects;
create policy invoice_docs_select on storage.objects for select to authenticated
using (
  bucket_id='invoice-documents'
  and public.can_access_property(((storage.foldername(name))[2])::uuid)
);

drop policy if exists invoice_docs_insert on storage.objects;
create policy invoice_docs_insert on storage.objects for insert to authenticated
with check (
  bucket_id='invoice-documents'
  and public.can_manage_property(((storage.foldername(name))[2])::uuid)
);

drop policy if exists invoice_docs_delete on storage.objects;
create policy invoice_docs_delete on storage.objects for delete to authenticated
using (
  bucket_id='invoice-documents'
  and public.can_manage_property(((storage.foldername(name))[2])::uuid)
);

-- ---------- IMPORTANT SERVER-SIDE RESPONSIBILITIES ----------
-- Implement with Supabase Edge Functions / RPCs, transactionally:
-- 1) create_invoice(tenancy_id, billing_period)
-- 2) confirm_meter_reading(session_id)
-- 3) record_payment(...) + allocate_payment(...)
-- 4) reconcile_future_allocations(invoice_id)
-- 5) recalculate_invoice_balance(invoice_id)
-- 6) publish_translations()
-- 7) generate_invoice_pdf(invoice_id, language_code)
-- 8) notification_scheduler()
-- 9) billing webhook handler (Apple/Google/Stripe)
--
-- Keep service_role key ONLY in server-side functions.
