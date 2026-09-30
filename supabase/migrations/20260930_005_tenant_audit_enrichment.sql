-- ============================================================
-- DOMETRA
-- Tenant audit enrichment
--
-- Adds apartment-scoped audit events for manual tenant profile
-- changes and Dometra tenant profile changes.
-- ============================================================


-- ============================================================
-- MANUAL TENANT PROFILE AUDIT
-- ============================================================

create or replace function public.audit_manual_tenant_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row jsonb;

  v_contact_id uuid;

  v_workspace_id uuid;

  v_property_id uuid;

  v_session_id uuid;
begin

  v_row :=
    case
      when tg_op = 'DELETE'
      then to_jsonb(old)
      else to_jsonb(new)
    end;


  v_contact_id :=
    nullif(
      v_row ->> 'id',
      ''
    )::uuid;


  v_workspace_id :=
    nullif(
      v_row ->> 'workspace_id',
      ''
    )::uuid;


  select
    t.property_id
  into
    v_property_id
  from public.tenancies t
  where
    t.manual_tenant_contact_id =
      v_contact_id
  order by
    t.created_at desc
  limit 1;


  begin
    v_session_id :=
      nullif(
        (select auth.jwt()) ->> 'session_id',
        ''
      )::uuid;
  exception
    when others then
      v_session_id := null;
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
    'manual_tenant_contacts',
    v_contact_id,

    case
      when tg_op = 'INSERT' then 'CREATE'
      when tg_op = 'UPDATE' then 'UPDATE'
      else 'DELETE'
    end,

    case
      when tg_op in ('UPDATE', 'DELETE')
      then to_jsonb(old)
      else null
    end,

    case
      when tg_op in ('INSERT', 'UPDATE')
      then to_jsonb(new)
      else null
    end
  );


  if tg_op = 'DELETE'
  then
    return old;
  end if;


  return new;
end;
$$;


drop trigger if exists
  trg_manual_tenant_contacts_audit
on public.manual_tenant_contacts;


create trigger
  trg_manual_tenant_contacts_audit
after insert or update or delete
on public.manual_tenant_contacts
for each row
execute function
  public.audit_manual_tenant_change();


-- ============================================================
-- DOMETRA TENANT PROFILE AUDIT
--
-- A profile can be linked to multiple tenancies over time.
-- For every active/pending tenancy membership, create a separate
-- apartment-scoped audit record.
-- ============================================================

create or replace function public.audit_tenant_profile_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row jsonb;

  v_user_id uuid;

  v_session_id uuid;

  v_link record;
begin

  v_row :=
    case
      when tg_op = 'DELETE'
      then to_jsonb(old)
      else to_jsonb(new)
    end;


  v_user_id :=
    nullif(
      v_row ->> 'user_id',
      ''
    )::uuid;


  begin
    v_session_id :=
      nullif(
        (select auth.jwt()) ->> 'session_id',
        ''
      )::uuid;
  exception
    when others then
      v_session_id := null;
  end;


  for v_link in
    select
      t.id as tenancy_id,
      t.property_id,
      p.workspace_id
    from public.tenancy_members tm

    join public.tenancies t
      on t.id = tm.tenancy_id

    join public.properties p
      on p.id = t.property_id

    where
      tm.user_id = v_user_id
      and
      t.status in (
        'PENDING',
        'ACTIVE'
      )
  loop

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
      v_link.workspace_id,
      v_link.property_id,
      (select auth.uid()),
      v_session_id,
      'tenant_profiles',
      v_user_id,

      case
        when tg_op = 'INSERT' then 'CREATE'
        when tg_op = 'UPDATE' then 'UPDATE'
        else 'DELETE'
      end,

      case
        when tg_op in ('UPDATE', 'DELETE')
        then to_jsonb(old)
        else null
      end,

      case
        when tg_op in ('INSERT', 'UPDATE')
        then to_jsonb(new)
        else null
      end
    );

  end loop;


  if tg_op = 'DELETE'
  then
    return old;
  end if;


  return new;
end;
$$;


drop trigger if exists
  trg_tenant_profiles_audit
on public.tenant_profiles;


create trigger
  trg_tenant_profiles_audit
after insert or update or delete
on public.tenant_profiles
for each row
execute function
  public.audit_tenant_profile_change();
