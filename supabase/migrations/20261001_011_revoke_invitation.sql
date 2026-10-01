-- ============================================================
-- DOMETRA
-- REVOKE / DELETE PENDING TENANT INVITATION
--
-- Behaviour:
--
-- PENDING invitation
--        ↓
-- landlord presses Delete invitation
--        ↓
-- invitation = REVOKED
-- tenancy    = CANCELLED
--        ↓
-- token no longer works
-- apartment becomes available
--
-- We intentionally DO NOT physically delete records.
-- This preserves audit/history.
-- ============================================================

begin;


-- ============================================================
-- RPC
-- ============================================================

create or replace function public.revoke_tenant_invitation(
  p_invitation_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_user_id uuid;

  v_invitation public.tenancy_invitations%rowtype;

  v_tenancy public.tenancies%rowtype;
begin

  v_user_id :=
    auth.uid();


  if
    v_user_id is null
  then
    raise exception
      'Authentication required';
  end if;


  -- ----------------------------------------------------------
  -- Lock invitation
  -- ----------------------------------------------------------

  select
    *
  into
    v_invitation

  from public.tenancy_invitations

  where
    id =
      p_invitation_id

  for update;


  if
    not found
  then
    raise exception
      'Invitation not found';
  end if;


  -- ----------------------------------------------------------
  -- Load tenancy
  -- ----------------------------------------------------------

  select
    *
  into
    v_tenancy

  from public.tenancies

  where
    id =
      v_invitation.tenancy_id

  for update;


  if
    not found
  then
    raise exception
      'Tenancy not found';
  end if;


  -- ----------------------------------------------------------
  -- Permission
  -- ----------------------------------------------------------

  if
    not public.can_manage_property(
      v_tenancy.property_id
    )
  then
    raise exception
      'Not allowed to revoke this invitation';
  end if;


  -- ----------------------------------------------------------
  -- Only pending invitation can be revoked
  -- ----------------------------------------------------------

  if
    v_invitation.status <>
      'PENDING'
  then
    raise exception
      'Only a pending invitation can be revoked';
  end if;


  -- ----------------------------------------------------------
  -- Safety:
  --
  -- If invitation was accepted, tenancy_members already has
  -- a tenant. In that case this operation must not be allowed.
  -- ----------------------------------------------------------

  if
    exists (
      select
        1

      from public.tenancy_members tm

      where
        tm.tenancy_id =
          v_tenancy.id

        and tm.role =
          'TENANT'
    )
  then
    raise exception
      'Invitation has already been accepted';
  end if;


  -- ----------------------------------------------------------
  -- Revoke invitation
  -- ----------------------------------------------------------

  update public.tenancy_invitations

  set
    status =
      'REVOKED'

  where
    id =
      p_invitation_id;


  -- ----------------------------------------------------------
  -- Cancel the pending tenancy.
  --
  -- Do not delete:
  -- we preserve history and audit trail.
  -- ----------------------------------------------------------

  if
    v_tenancy.status =
      'PENDING'
  then

    update public.tenancies

    set
      status =
        'CANCELLED',

      updated_at =
        now()

    where
      id =
        v_tenancy.id;

  end if;

end;
$$;


revoke all
on function public.revoke_tenant_invitation(uuid)
from public;

revoke all
on function public.revoke_tenant_invitation(uuid)
from anon;


grant execute
on function public.revoke_tenant_invitation(uuid)
to authenticated;


commit;