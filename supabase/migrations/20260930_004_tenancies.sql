-- ============================================================
-- DOMETRA
-- Tenancies, tenants and invitations
-- 2026-09-30
-- ============================================================

create extension if not exists pgcrypto;


-- ============================================================
-- ENUMS
-- ============================================================

do $$
begin
  create type public.tenancy_status
    as enum (
      'PENDING',
      'ACTIVE',
      'ENDED',
      'CANCELLED'
    );
exception
  when duplicate_object then null;
end $$;


do $$
begin
  create type public.tenancy_member_role
    as enum (
      'TENANT',
      'CO_TENANT'
    );
exception
  when duplicate_object then null;
end $$;


do $$
begin
  create type public.tenancy_invitation_status
    as enum (
      'PENDING',
      'ACCEPTED',
      'DECLINED',
      'EXPIRED',
      'REVOKED'
    );
exception
  when duplicate_object then null;
end $$;


-- ============================================================
-- DOMETRA TENANT PROFILE
--
-- Reusable user identity information.
--
-- Required:
-- first_name
-- last_name
-- phone
-- email
--
-- Optional:
-- passport_id_number
-- passport_photo_path
-- emergency_contact
-- notes
-- ============================================================

create table if not exists public.tenant_profiles (
  user_id uuid
    primary key
    references auth.users(id)
    on delete cascade,

  first_name text
    not null,

  last_name text
    not null,

  phone text
    not null,

  email text
    not null,

  passport_id_number text,

  passport_photo_path text,

  emergency_contact text,

  notes text,

  created_at timestamptz
    not null
    default now(),

  updated_at timestamptz
    not null
    default now(),

  check (
    length(trim(first_name)) > 0
  ),

  check (
    length(trim(last_name)) > 0
  ),

  check (
    length(trim(phone)) > 0
  ),

  check (
    length(trim(email)) > 0
  )
);


-- ============================================================
-- MANUAL TENANT
--
-- Tenant does not have a Dometra account.
--
-- Never create fake auth.users records.
-- ============================================================

create table if not exists public.manual_tenant_contacts (
  id uuid
    primary key
    default gen_random_uuid(),

  workspace_id uuid
    not null
    references public.workspaces(id)
    on delete cascade,

  first_name text
    not null,

  last_name text
    not null,

  phone text
    not null,

  email text
    not null,

  passport_id_number text,

  passport_photo_path text,

  emergency_contact text,

  notes text,

  created_by uuid
    not null
    references auth.users(id),

  created_at timestamptz
    not null
    default now(),

  updated_at timestamptz
    not null
    default now(),

  check (
    length(trim(first_name)) > 0
  ),

  check (
    length(trim(last_name)) > 0
  ),

  check (
    length(trim(phone)) > 0
  ),

  check (
    length(trim(email)) > 0
  )
);


create index if not exists
  idx_manual_tenants_workspace
on public.manual_tenant_contacts (
  workspace_id
);


-- ============================================================
-- TENANCY
--
-- One tenancy represents one rental relationship.
--
-- Manual tenancy:
--   manual_tenant_contact_id != null
--
-- Dometra tenant:
--   user is linked through tenancy_members
-- ============================================================

create table if not exists public.tenancies (
  id uuid
    primary key
    default gen_random_uuid(),

  property_id uuid
    not null
    references public.properties(id)
    on delete restrict,

  manual_tenant_contact_id uuid
    references public.manual_tenant_contacts(id)
    on delete set null,

  status public.tenancy_status
    not null
    default 'PENDING',

  start_date date
    not null,

  end_date date,

  agreement_path text,

  created_by uuid
    not null
    references auth.users(id),

  created_at timestamptz
    not null
    default now(),

  updated_at timestamptz
    not null
    default now(),

  check (
    end_date is null
    or
    end_date >= start_date
  )
);


create index if not exists
  idx_tenancies_property
on public.tenancies (
  property_id,
  status
);


-- Only one current/pending tenancy per apartment.

create unique index if not exists
  uq_property_current_tenancy
on public.tenancies (
  property_id
)
where
  status in (
    'PENDING',
    'ACTIVE'
  );


-- ============================================================
-- TENANCY MEMBERS
--
-- Real Dometra users linked to tenancy.
-- ============================================================

create table if not exists public.tenancy_members (
  tenancy_id uuid
    not null
    references public.tenancies(id)
    on delete cascade,

  user_id uuid
    not null
    references auth.users(id)
    on delete cascade,

  role public.tenancy_member_role
    not null
    default 'TENANT',

  joined_at timestamptz
    not null
    default now(),

  primary key (
    tenancy_id,
    user_id
  )
);


create index if not exists
  idx_tenancy_members_user
on public.tenancy_members (
  user_id,
  tenancy_id
);


-- ============================================================
-- RENT TERMS
--
-- Kept separately from tenant profile.
-- Allows historical rent terms later.
-- ============================================================

create table if not exists public.rent_terms (
  id uuid
    primary key
    default gen_random_uuid(),

  tenancy_id uuid
    not null
    references public.tenancies(id)
    on delete cascade,

  rent_amount numeric(14, 2)
    not null
    check (
      rent_amount >= 0
    ),

  currency_code char(3)
    not null,

  payment_due_day integer
    not null
    check (
      payment_due_day between 1 and 31
    ),

  deposit_amount numeric(14, 2),

  deposit_currency char(3),

  valid_from date
    not null,

  valid_to date,

  created_at timestamptz
    not null
    default now(),

  check (
    deposit_amount is null
    or
    deposit_amount >= 0
  ),

  check (
    valid_to is null
    or
    valid_to >= valid_from
  )
);


create index if not exists
  idx_rent_terms_tenancy
on public.rent_terms (
  tenancy_id,
  valid_from desc
);


-- Only one active rent term at a time.

create unique index if not exists
  uq_active_rent_term
on public.rent_terms (
  tenancy_id
)
where
  valid_to is null;


-- ============================================================
-- INVITATIONS
--
-- Plain invitation token is NEVER stored.
-- Only SHA-256 hash is stored.
-- ============================================================

create table if not exists public.tenancy_invitations (
  id uuid
    primary key
    default gen_random_uuid(),

  tenancy_id uuid
    not null
    references public.tenancies(id)
    on delete cascade,

  token_hash text
    not null
    unique,

  status public.tenancy_invitation_status
    not null
    default 'PENDING',

  invited_by uuid
    not null
    references auth.users(id),

  accepted_by uuid
    references auth.users(id),

  expires_at timestamptz
    not null,

  accepted_at timestamptz,

  created_at timestamptz
    not null
    default now()
);


create index if not exists
  idx_tenancy_invitations_tenancy
on public.tenancy_invitations (
  tenancy_id,
  status
);


create index if not exists
  idx_tenancy_invitations_expiry
on public.tenancy_invitations (
  expires_at
)
where
  status = 'PENDING';


-- ============================================================
-- UPDATED_AT
-- ============================================================

drop trigger if exists
  trg_tenant_profiles_updated_at
on public.tenant_profiles;


create trigger
  trg_tenant_profiles_updated_at
before update
on public.tenant_profiles
for each row
execute function
  public.set_updated_at();


drop trigger if exists
  trg_manual_tenant_contacts_updated_at
on public.manual_tenant_contacts;


create trigger
  trg_manual_tenant_contacts_updated_at
before update
on public.manual_tenant_contacts
for each row
execute function
  public.set_updated_at();


drop trigger if exists
  trg_tenancies_updated_at
on public.tenancies;


create trigger
  trg_tenancies_updated_at
before update
on public.tenancies
for each row
execute function
  public.set_updated_at();


-- ============================================================
-- HELPERS
-- ============================================================

create or replace function public.can_manage_tenancy(
  p_tenancy_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1

    from public.tenancies t

    where
      t.id =
        p_tenancy_id

      and

      public.can_manage_property(
        t.property_id
      )
  );
$$;


create or replace function public.can_access_tenancy(
  p_tenancy_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    exists (
      select 1

      from public.tenancies t

      where
        t.id =
          p_tenancy_id

        and

        public.can_access_property(
          t.property_id
        )
    )

    or

    exists (
      select 1

      from public.tenancy_members tm

      where
        tm.tenancy_id =
          p_tenancy_id

        and

        tm.user_id =
          (select auth.uid())
    );
$$;


create or replace function public.has_tenant_access_to_property(
  p_property_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1

    from public.tenancies t

    join public.tenancy_members tm
      on
        tm.tenancy_id =
        t.id

    where
      t.property_id =
        p_property_id

      and

      t.status =
        'ACTIVE'

      and

      tm.user_id =
        (select auth.uid())
  );
$$;


-- ============================================================
-- SAVE CURRENT USER TENANT PROFILE
-- ============================================================

create or replace function public.save_my_tenant_profile(
  p_first_name text,

  p_last_name text,

  p_phone text,

  p_email text,

  p_passport_id_number text,

  p_passport_photo_path text,

  p_emergency_contact text,

  p_notes text
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid;
begin

  v_user_id :=
    (select auth.uid());


  if
    v_user_id is null
  then
    raise exception
      'Authentication required';
  end if;


  if
    nullif(
      trim(
        p_first_name
      ),
      ''
    )
    is null
  then
    raise exception
      'First name is required';
  end if;


  if
    nullif(
      trim(
        p_last_name
      ),
      ''
    )
    is null
  then
    raise exception
      'Last name is required';
  end if;


  if
    nullif(
      trim(
        p_phone
      ),
      ''
    )
    is null
  then
    raise exception
      'Phone is required';
  end if;


  if
    nullif(
      trim(
        p_email
      ),
      ''
    )
    is null
  then
    raise exception
      'Email is required';
  end if;


  insert into public.tenant_profiles (
    user_id,
    first_name,
    last_name,
    phone,
    email,
    passport_id_number,
    passport_photo_path,
    emergency_contact,
    notes
  )
  values (
    v_user_id,

    trim(
      p_first_name
    ),

    trim(
      p_last_name
    ),

    trim(
      p_phone
    ),

    lower(
      trim(
        p_email
      )
    ),

    nullif(
      trim(
        p_passport_id_number
      ),
      ''
    ),

    nullif(
      trim(
        p_passport_photo_path
      ),
      ''
    ),

    nullif(
      trim(
        p_emergency_contact
      ),
      ''
    ),

    nullif(
      trim(
        p_notes
      ),
      ''
    )
  )

  on conflict (
    user_id
  )

  do update set
    first_name =
      excluded.first_name,

    last_name =
      excluded.last_name,

    phone =
      excluded.phone,

    email =
      excluded.email,

    passport_id_number =
      excluded.passport_id_number,

    passport_photo_path =
      excluded.passport_photo_path,

    emergency_contact =
      excluded.emergency_contact,

    notes =
      excluded.notes;

end;
$$;


-- ============================================================
-- CREATE MANUAL TENANCY
-- ============================================================

create or replace function public.create_manual_tenancy(
  p_property_id uuid,

  p_first_name text,

  p_last_name text,

  p_phone text,

  p_email text,

  p_passport_id_number text,

  p_passport_photo_path text,

  p_emergency_contact text,

  p_notes text,

  p_rent_amount numeric,

  p_currency char(3),

  p_start_date date,

  p_payment_due_day integer,

  p_end_date date,

  p_deposit_amount numeric,

  p_deposit_currency char(3),

  p_agreement_path text
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_workspace_id uuid;

  v_contact_id uuid;

  v_tenancy_id uuid;
begin

  if
    not public.can_manage_property(
      p_property_id
    )
  then
    raise exception
      'Not allowed to manage this property';
  end if;


  if exists (
    select 1

    from public.tenancies

    where
      property_id =
        p_property_id

      and

      status in (
        'PENDING',
        'ACTIVE'
      )
  )
  then
    raise exception
      'This apartment already has an active or pending tenancy';
  end if;


  if
    nullif(
      trim(
        p_first_name
      ),
      ''
    )
    is null
  then
    raise exception
      'First name is required';
  end if;


  if
    nullif(
      trim(
        p_last_name
      ),
      ''
    )
    is null
  then
    raise exception
      'Last name is required';
  end if;


  if
    nullif(
      trim(
        p_phone
      ),
      ''
    )
    is null
  then
    raise exception
      'Phone is required';
  end if;


  if
    nullif(
      trim(
        p_email
      ),
      ''
    )
    is null
  then
    raise exception
      'Email is required';
  end if;


  if
    p_rent_amount < 0
  then
    raise exception
      'Rent amount is invalid';
  end if;


  if
    p_payment_due_day < 1
    or
    p_payment_due_day > 31
  then
    raise exception
      'Payment due day must be between 1 and 31';
  end if;


  select
    workspace_id
  into
    v_workspace_id
  from public.properties
  where
    id =
      p_property_id;


  insert into public.manual_tenant_contacts (
    workspace_id,
    first_name,
    last_name,
    phone,
    email,
    passport_id_number,
    passport_photo_path,
    emergency_contact,
    notes,
    created_by
  )
  values (
    v_workspace_id,

    trim(
      p_first_name
    ),

    trim(
      p_last_name
    ),

    trim(
      p_phone
    ),

    lower(
      trim(
        p_email
      )
    ),

    nullif(
      trim(
        p_passport_id_number
      ),
      ''
    ),

    nullif(
      trim(
        p_passport_photo_path
      ),
      ''
    ),

    nullif(
      trim(
        p_emergency_contact
      ),
      ''
    ),

    nullif(
      trim(
        p_notes
      ),
      ''
    ),

    (select auth.uid())
  )

  returning
    id
  into
    v_contact_id;


  insert into public.tenancies (
    property_id,
    manual_tenant_contact_id,
    status,
    start_date,
    end_date,
    agreement_path,
    created_by
  )
  values (
    p_property_id,

    v_contact_id,

    'ACTIVE',

    p_start_date,

    p_end_date,

    nullif(
      trim(
        p_agreement_path
      ),
      ''
    ),

    (select auth.uid())
  )

  returning
    id
  into
    v_tenancy_id;


  insert into public.rent_terms (
    tenancy_id,
    rent_amount,
    currency_code,
    payment_due_day,
    deposit_amount,
    deposit_currency,
    valid_from
  )
  values (
    v_tenancy_id,

    p_rent_amount,

    p_currency,

    p_payment_due_day,

    p_deposit_amount,

    case
      when
        p_deposit_amount is null
      then
        null

      else
        coalesce(
          p_deposit_currency,
          p_currency
        )
    end,

    p_start_date
  );


  return
    v_tenancy_id;
end;
$$;


-- ============================================================
-- CREATE DOMETRA TENANT INVITATION
--
-- Landlord creates rental terms first.
-- Tenant identity is filled by tenant after opening invitation.
-- ============================================================

create or replace function public.create_tenant_invitation(
  p_property_id uuid,

  p_rent_amount numeric,

  p_currency char(3),

  p_start_date date,

  p_payment_due_day integer,

  p_end_date date,

  p_deposit_amount numeric,

  p_deposit_currency char(3),

  p_agreement_path text
)
returns table (
  tenancy_id uuid,

  invitation_id uuid,

  token text,

  expires_at timestamptz
)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_tenancy_id uuid;

  v_invitation_id uuid;

  v_token text;

  v_token_hash text;

  v_expires_at timestamptz;
begin

  if
    not public.can_manage_property(
      p_property_id
    )
  then
    raise exception
      'Not allowed to manage this property';
  end if;


  if exists (
    select 1

    from public.tenancies

    where
      property_id =
        p_property_id

      and

      status in (
        'PENDING',
        'ACTIVE'
      )
  )
  then
    raise exception
      'This apartment already has an active or pending tenancy';
  end if;


  if
    p_rent_amount < 0
  then
    raise exception
      'Rent amount is invalid';
  end if;


  if
    p_payment_due_day < 1
    or
    p_payment_due_day > 31
  then
    raise exception
      'Payment due day must be between 1 and 31';
  end if;


  insert into public.tenancies (
    property_id,
    status,
    start_date,
    end_date,
    agreement_path,
    created_by
  )
  values (
    p_property_id,

    'PENDING',

    p_start_date,

    p_end_date,

    nullif(
      trim(
        p_agreement_path
      ),
      ''
    ),

    (select auth.uid())
  )

  returning
    id
  into
    v_tenancy_id;


  insert into public.rent_terms (
    tenancy_id,
    rent_amount,
    currency_code,
    payment_due_day,
    deposit_amount,
    deposit_currency,
    valid_from
  )
  values (
    v_tenancy_id,

    p_rent_amount,

    p_currency,

    p_payment_due_day,

    p_deposit_amount,

    case
      when
        p_deposit_amount is null
      then
        null

      else
        coalesce(
          p_deposit_currency,
          p_currency
        )
    end,

    p_start_date
  );


  v_token :=
    encode(
      gen_random_bytes(
        32
      ),
      'hex'
    );


  v_token_hash :=
    encode(
      digest(
        v_token,
        'sha256'
      ),
      'hex'
    );


  v_expires_at :=
    now() +
    interval '7 days';


  insert into public.tenancy_invitations (
    tenancy_id,
    token_hash,
    status,
    invited_by,
    expires_at
  )
  values (
    v_tenancy_id,

    v_token_hash,

    'PENDING',

    (select auth.uid()),

    v_expires_at
  )

  returning
    id
  into
    v_invitation_id;


  return query
  select
    v_tenancy_id,
    v_invitation_id,
    v_token,
    v_expires_at;

end;
$$;


-- ============================================================
-- INVITATION PREVIEW
--
-- Authentication is required.
--
-- We deliberately expose only information needed to decide
-- whether to accept the invitation.
-- ============================================================

create or replace function public.get_tenant_invitation(
  p_token text
)
returns table (
  tenancy_id uuid,

  property_id uuid,

  property_name text,

  property_address text,

  property_city text,

  rent_amount numeric,

  currency_code char(3),

  payment_due_day integer,

  start_date date,

  end_date date,

  deposit_amount numeric,

  deposit_currency char(3),

  expires_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hash text;
begin

  if
    (select auth.uid())
    is null
  then
    raise exception
      'Authentication required';
  end if;


  v_hash :=
    encode(
      digest(
        p_token,
        'sha256'
      ),
      'hex'
    );


  return query
  select
    t.id,

    p.id,

    p.title,

    p.street,

    p.city,

    rt.rent_amount,

    rt.currency_code,

    rt.payment_due_day,

    t.start_date,

    t.end_date,

    rt.deposit_amount,

    rt.deposit_currency,

    ti.expires_at

  from public.tenancy_invitations ti

  join public.tenancies t
    on
      t.id =
      ti.tenancy_id

  join public.properties p
    on
      p.id =
      t.property_id

  join public.rent_terms rt
    on
      rt.tenancy_id =
      t.id

    and

      rt.valid_to is null

  where
    ti.token_hash =
      v_hash

    and

    ti.status =
      'PENDING'

    and

    ti.expires_at >
      now()

  limit 1;

end;
$$;


-- ============================================================
-- ACCEPT INVITATION
--
-- Tenant MUST have completed required profile fields first.
-- ============================================================

create or replace function public.accept_tenant_invitation(
  p_token text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;

  v_hash text;

  v_invitation_id uuid;

  v_tenancy_id uuid;

  v_expires_at timestamptz;

  v_status public.tenancy_invitation_status;
begin

  v_user_id :=
    (select auth.uid());


  if
    v_user_id is null
  then
    raise exception
      'Authentication required';
  end if;


  if not exists (
    select 1

    from public.tenant_profiles tp

    where
      tp.user_id =
        v_user_id

      and

      length(
        trim(
          tp.first_name
        )
      ) > 0

      and

      length(
        trim(
          tp.last_name
        )
      ) > 0

      and

      length(
        trim(
          tp.phone
        )
      ) > 0

      and

      length(
        trim(
          tp.email
        )
      ) > 0
  )
  then
    raise exception
      'Complete your tenant profile before accepting the invitation';
  end if;


  v_hash :=
    encode(
      digest(
        p_token,
        'sha256'
      ),
      'hex'
    );


  select
    ti.id,
    ti.tenancy_id,
    ti.expires_at,
    ti.status

  into
    v_invitation_id,
    v_tenancy_id,
    v_expires_at,
    v_status

  from public.tenancy_invitations ti

  where
    ti.token_hash =
      v_hash

  for update;


  if
    v_invitation_id is null
  then
    raise exception
      'Invitation not found';
  end if;


  if
    v_status <>
    'PENDING'
  then
    raise exception
      'Invitation is no longer active';
  end if;


  if
    v_expires_at <=
    now()
  then

    update public.tenancy_invitations
    set
      status =
        'EXPIRED'
    where
      id =
        v_invitation_id;


    raise exception
      'Invitation has expired';

  end if;


  insert into public.tenancy_members (
    tenancy_id,
    user_id,
    role
  )
  values (
    v_tenancy_id,

    v_user_id,

    'TENANT'
  )
  on conflict
  do nothing;


  update public.tenancy_invitations
  set
    status =
      'ACCEPTED',

    accepted_by =
      v_user_id,

    accepted_at =
      now()

  where
    id =
      v_invitation_id;


  update public.tenancies
  set
    status =
      'ACTIVE'

  where
    id =
      v_tenancy_id;


  return
    v_tenancy_id;

end;
$$;


-- ============================================================
-- REVOKE INVITATION
-- ============================================================

create or replace function public.revoke_tenant_invitation(
  p_invitation_id uuid
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_tenancy_id uuid;
begin

  select
    tenancy_id
  into
    v_tenancy_id
  from public.tenancy_invitations
  where
    id =
      p_invitation_id;


  if
    v_tenancy_id is null
  then
    raise exception
      'Invitation not found';
  end if;


  if
    not public.can_manage_tenancy(
      v_tenancy_id
    )
  then
    raise exception
      'Not allowed';
  end if;


  update public.tenancy_invitations
  set
    status =
      'REVOKED'

  where
    id =
      p_invitation_id

    and

    status =
      'PENDING';


  update public.tenancies
  set
    status =
      'CANCELLED'

  where
    id =
      v_tenancy_id

    and

    status =
      'PENDING';

end;
$$;


-- ============================================================
-- RLS
-- ============================================================

alter table public.tenant_profiles
  enable row level security;

alter table public.manual_tenant_contacts
  enable row level security;

alter table public.tenancies
  enable row level security;

alter table public.tenancy_members
  enable row level security;

alter table public.rent_terms
  enable row level security;

alter table public.tenancy_invitations
  enable row level security;


-- ============================================================
-- TENANT PROFILE
-- ============================================================

drop policy if exists
  tenant_profiles_read
on public.tenant_profiles;


create policy
  tenant_profiles_read
on public.tenant_profiles
for select
to authenticated
using (
  user_id =
    (select auth.uid())

  or

  exists (
    select 1

    from public.tenancy_members tm

    where
      tm.user_id =
        tenant_profiles.user_id

      and

      public.can_manage_tenancy(
        tm.tenancy_id
      )
  )
);


drop policy if exists
  tenant_profiles_insert_self
on public.tenant_profiles;


create policy
  tenant_profiles_insert_self
on public.tenant_profiles
for insert
to authenticated
with check (
  user_id =
    (select auth.uid())
);


drop policy if exists
  tenant_profiles_update_self
on public.tenant_profiles;


create policy
  tenant_profiles_update_self
on public.tenant_profiles
for update
to authenticated
using (
  user_id =
    (select auth.uid())
)
with check (
  user_id =
    (select auth.uid())
);


-- ============================================================
-- MANUAL CONTACTS
-- ============================================================

drop policy if exists
  manual_tenants_read
on public.manual_tenant_contacts;


create policy
  manual_tenants_read
on public.manual_tenant_contacts
for select
to authenticated
using (
  public.is_workspace_member(
    workspace_id
  )
);


drop policy if exists
  manual_tenants_manage
on public.manual_tenant_contacts;


create policy
  manual_tenants_manage
on public.manual_tenant_contacts
for all
to authenticated
using (
  public.can_manage_workspace(
    workspace_id
  )
)
with check (
  public.can_manage_workspace(
    workspace_id
  )
);


-- ============================================================
-- TENANCIES
-- ============================================================

drop policy if exists
  tenancies_read
on public.tenancies;


create policy
  tenancies_read
on public.tenancies
for select
to authenticated
using (
  public.can_access_property(
    property_id
  )

  or

  public.has_tenant_access_to_property(
    property_id
  )
);


drop policy if exists
  tenancies_manage
on public.tenancies;


create policy
  tenancies_manage
on public.tenancies
for all
to authenticated
using (
  public.can_manage_property(
    property_id
  )
)
with check (
  public.can_manage_property(
    property_id
  )
);


-- ============================================================
-- TENANCY MEMBERS
-- ============================================================

drop policy if exists
  tenancy_members_read
on public.tenancy_members;


create policy
  tenancy_members_read
on public.tenancy_members
for select
to authenticated
using (
  user_id =
    (select auth.uid())

  or

  public.can_manage_tenancy(
    tenancy_id
  )
);


-- ============================================================
-- RENT TERMS
-- ============================================================

drop policy if exists
  rent_terms_read
on public.rent_terms;


create policy
  rent_terms_read
on public.rent_terms
for select
to authenticated
using (
  public.can_access_tenancy(
    tenancy_id
  )
);


drop policy if exists
  rent_terms_manage
on public.rent_terms;


create policy
  rent_terms_manage
on public.rent_terms
for all
to authenticated
using (
  public.can_manage_tenancy(
    tenancy_id
  )
)
with check (
  public.can_manage_tenancy(
    tenancy_id
  )
);


-- ============================================================
-- INVITATIONS
-- ============================================================

drop policy if exists
  tenancy_invitations_landlord_read
on public.tenancy_invitations;


create policy
  tenancy_invitations_landlord_read
on public.tenancy_invitations
for select
to authenticated
using (
  public.can_manage_tenancy(
    tenancy_id
  )
);


drop policy if exists
  tenancy_invitations_landlord_manage
on public.tenancy_invitations;


create policy
  tenancy_invitations_landlord_manage
on public.tenancy_invitations
for all
to authenticated
using (
  public.can_manage_tenancy(
    tenancy_id
  )
)
with check (
  public.can_manage_tenancy(
    tenancy_id
  )
);


-- ============================================================
-- PRIVATE DOCUMENT STORAGE
-- ============================================================

insert into storage.buckets (
  id,
  name,
  public
)
values (
  'tenant-documents',
  'tenant-documents',
  false
)
on conflict (
  id
)
do update set
  public =
    false;


-- ------------------------------------------------------------
-- PATHS
--
-- Dometra user's passport:
--
-- profile/{userId}/{filename}
--
-- Manual tenant passport:
--
-- manual/{workspaceId}/{propertyId}/{filename}
--
-- Rental agreement:
--
-- agreement/{workspaceId}/{propertyId}/{filename}
-- ------------------------------------------------------------


drop policy if exists
  dometra_tenant_documents_select
on storage.objects;


create policy
  dometra_tenant_documents_select
on storage.objects
for select
to authenticated
using (
  bucket_id =
    'tenant-documents'

  and

  (
    (
      (
        storage.foldername(
          name
        )
      )[1] =
        'profile'

      and

      (
        (
          storage.foldername(
            name
          )
        )[2]::uuid =
          (select auth.uid())

        or

        exists (
          select 1

          from public.tenancy_members tm

          where
            tm.user_id =
              (
                storage.foldername(
                  name
                )
              )[2]::uuid

            and

            public.can_manage_tenancy(
              tm.tenancy_id
            )
        )
      )
    )

    or

    (
      (
        storage.foldername(
          name
        )
      )[1] =
        'manual'

      and

      public.can_manage_property(
        (
          storage.foldername(
            name
          )
        )[3]::uuid
      )
    )

    or

    (
      (
        storage.foldername(
          name
        )
      )[1] =
        'agreement'

      and

      (
        public.can_manage_property(
          (
            storage.foldername(
              name
            )
          )[3]::uuid
        )

        or

        public.has_tenant_access_to_property(
          (
            storage.foldername(
              name
            )
          )[3]::uuid
        )
      )
    )
  )
);


drop policy if exists
  dometra_tenant_documents_insert
on storage.objects;


create policy
  dometra_tenant_documents_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id =
    'tenant-documents'

  and

  (
    (
      (
        storage.foldername(
          name
        )
      )[1] =
        'profile'

      and

      (
        storage.foldername(
          name
        )
      )[2]::uuid =
        (select auth.uid())
    )

    or

    (
      (
        storage.foldername(
          name
        )
      )[1] in (
        'manual',
        'agreement'
      )

      and

      public.can_manage_property(
        (
          storage.foldername(
            name
          )
        )[3]::uuid
      )
    )
  )
);


drop policy if exists
  dometra_tenant_documents_delete
on storage.objects;


create policy
  dometra_tenant_documents_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id =
    'tenant-documents'

  and

  (
    (
      (
        storage.foldername(
          name
        )
      )[1] =
        'profile'

      and

      (
        storage.foldername(
          name
        )
      )[2]::uuid =
        (select auth.uid())
    )

    or

    (
      (
        storage.foldername(
          name
        )
      )[1] in (
        'manual',
        'agreement'
      )

      and

      public.can_manage_property(
        (
          storage.foldername(
            name
          )
        )[3]::uuid
      )
    )
  )
);


-- ============================================================
-- TENANCY AUDIT
--
-- Apartment History will use these records.
-- ============================================================

create or replace function public.audit_tenancy_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row jsonb;

  v_property_id uuid;

  v_workspace_id uuid;

  v_tenancy_id uuid;

  v_entity_id uuid;

  v_session_id uuid;
begin

  v_row :=
    case
      when tg_op =
        'DELETE'
      then
        to_jsonb(old)

      else
        to_jsonb(new)
    end;


  v_entity_id :=
    nullif(
      v_row ->> 'id',
      ''
    )::uuid;


  if
    tg_table_name =
    'tenancies'
  then

    v_tenancy_id :=
      v_entity_id;

    v_property_id :=
      nullif(
        v_row ->>
          'property_id',
        ''
      )::uuid;


  elsif
    tg_table_name in (
      'rent_terms',
      'tenancy_members',
      'tenancy_invitations'
    )
  then

    v_tenancy_id :=
      nullif(
        v_row ->>
          'tenancy_id',
        ''
      )::uuid;


    select
      property_id

    into
      v_property_id

    from public.tenancies

    where
      id =
        v_tenancy_id;

  end if;


  select
    workspace_id

  into
    v_workspace_id

  from public.properties

  where
    id =
      v_property_id;


  begin

    v_session_id :=
      nullif(
        (select auth.jwt()) ->>
          'session_id',
        ''
      )::uuid;

  exception
    when others then

      v_session_id :=
        null;

  end;


  insert into public.audit_log (
    workspace_id,
    property_id,
    user_id,
    session_id,
    table_name,
    entity_id,
    action,
    before_data,
    after_data
  )
  values (
    v_workspace_id,

    v_property_id,

    (select auth.uid()),

    v_session_id,

    tg_table_name,

    v_entity_id,

    case
      when tg_op =
        'INSERT'
      then
        'CREATE'

      when tg_op =
        'UPDATE'
      then
        'UPDATE'

      else
        'DELETE'
    end,

    case
      when tg_op in (
        'UPDATE',
        'DELETE'
      )
      then
        to_jsonb(old)

      else
        null
    end,

    case
      when tg_op in (
        'INSERT',
        'UPDATE'
      )
      then
        to_jsonb(new)

      else
        null
    end
  );


  if
    tg_op =
    'DELETE'
  then
    return old;
  end if;


  return new;

end;
$$;


do $$
declare
  v_table text;
begin

  foreach v_table in array array[
    'tenancies',
    'rent_terms',
    'tenancy_members',
    'tenancy_invitations'
  ]

  loop

    execute format(
      'drop trigger if exists trg_%I_tenancy_audit on public.%I',
      v_table,
      v_table
    );


    execute format(
      'create trigger trg_%I_tenancy_audit
       after insert or update or delete
       on public.%I
       for each row
       execute function public.audit_tenancy_change()',
      v_table,
      v_table
    );

  end loop;

end;
$$;


-- ============================================================
-- GRANTS
-- ============================================================

grant select, insert, update
on public.tenant_profiles
to authenticated;


grant select, insert, update, delete
on public.manual_tenant_contacts
to authenticated;


grant select, insert, update
on public.tenancies
to authenticated;


grant select
on public.tenancy_members
to authenticated;


grant select, insert, update
on public.rent_terms
to authenticated;


grant select, insert, update
on public.tenancy_invitations
to authenticated;


revoke execute
on function public.save_my_tenant_profile(
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text
)
from public, anon;


grant execute
on function public.save_my_tenant_profile(
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text
)
to authenticated;


revoke execute
on function public.create_manual_tenancy(
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  numeric,
  char,
  date,
  integer,
  date,
  numeric,
  char,
  text
)
from public, anon;


grant execute
on function public.create_manual_tenancy(
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  numeric,
  char,
  date,
  integer,
  date,
  numeric,
  char,
  text
)
to authenticated;


revoke execute
on function public.create_tenant_invitation(
  uuid,
  numeric,
  char,
  date,
  integer,
  date,
  numeric,
  char,
  text
)
from public, anon;


grant execute
on function public.create_tenant_invitation(
  uuid,
  numeric,
  char,
  date,
  integer,
  date,
  numeric,
  char,
  text
)
to authenticated;


revoke execute
on function public.get_tenant_invitation(text)
from public, anon;


grant execute
on function public.get_tenant_invitation(text)
to authenticated;


revoke execute
on function public.accept_tenant_invitation(text)
from public, anon;


grant execute
on function public.accept_tenant_invitation(text)
to authenticated;


revoke execute
on function public.revoke_tenant_invitation(uuid)
from public, anon;


grant execute
on function public.revoke_tenant_invitation(uuid)
to authenticated;