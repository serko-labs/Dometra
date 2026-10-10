-- ============================================================
-- DOMETRA
-- REPAIR CANONICAL MOVE-IN BASELINE
--
-- Fix:
-- tenancy_meter_readings.created_by is NOT NULL in live DB.
--
-- Previous migration inserted:
--
--   tenancy_id
--   meter_register_id
--   reading_type
--   reading_date
--   value
--
-- but omitted:
--
--   created_by
--
-- This migration is idempotent and safe whether the previous
-- canonical baseline migration was fully or partially applied.
-- ============================================================


-- ============================================================
-- CANONICAL MOVE-IN HELPER
-- ============================================================

create or replace function public.ensure_canonical_move_in_readings(
  p_tenancy_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_property_id uuid;

  v_start_date date;

  v_status text;

  v_created_by uuid;

  v_tenancy_json jsonb;

  v_property_json jsonb;

  v_inserted integer := 0;
begin

  if p_tenancy_id is null then
    return 0;
  end if;


  -- ----------------------------------------------------------
  -- LOAD TENANCY
  -- ----------------------------------------------------------
  --
  -- to_jsonb() is intentional.
  --
  -- We already know live schema has diverged from the old
  -- snapshot. Reading created_by through JSON keeps this helper
  -- more tolerant if a historical environment has a slightly
  -- different row definition.
  -- ----------------------------------------------------------

  select
    t.property_id,
    t.start_date,
    t.status::text,
    to_jsonb(t)

  into
    v_property_id,
    v_start_date,
    v_status,
    v_tenancy_json

  from public.tenancies t

  where
    t.id =
      p_tenancy_id;


  if not found then
    return 0;
  end if;


  if v_property_id is null then
    return 0;
  end if;


  /*
   * Only ACTIVE tenancy needs the canonical move-in baseline.
   *
   * Invitation / draft tenancy will be handled when it becomes
   * ACTIVE.
   */

  if v_status is distinct from
    'ACTIVE'
  then
    return 0;
  end if;


  -- ----------------------------------------------------------
  -- RESOLVE CREATED_BY
  -- ----------------------------------------------------------
  --
  -- Preferred order:
  --
  --   1. tenancy creator
  --   2. authenticated user executing the activation
  --   3. property creator
  --
  -- Backfills executed in Supabase SQL Editor normally do not
  -- have an auth.uid(), therefore tenancy.created_by is the
  -- important source here.
  -- ----------------------------------------------------------

  begin

    v_created_by :=
      nullif(
        v_tenancy_json
          ->> 'created_by',
        ''
      )::uuid;

  exception
    when others then

      v_created_by :=
        null;

  end;


  if v_created_by is null then

    v_created_by :=
      auth.uid();

  end if;


  if v_created_by is null then

    select
      to_jsonb(p)

    into
      v_property_json

    from public.properties p

    where
      p.id =
        v_property_id;


    if v_property_json is not null then

      begin

        v_created_by :=
          nullif(
            v_property_json
              ->> 'created_by',
            ''
          )::uuid;

      exception
        when others then

          v_created_by :=
            null;

      end;

    end if;

  end if;


  -- ----------------------------------------------------------
  -- HARD FAIL IF WE STILL CANNOT ATTRIBUTE THE READING
  -- ----------------------------------------------------------
  --
  -- tenancy_meter_readings.created_by is NOT NULL and points
  -- to auth.users.
  --
  -- We deliberately do not invent a UUID.
  -- ----------------------------------------------------------

  if v_created_by is null then

    raise exception using

      errcode =
        '23502',

      message =
        format(
          'Unable to create canonical MOVE_IN readings for tenancy %s because no created_by user could be resolved.',
          p_tenancy_id
        );

  end if;


  -- ----------------------------------------------------------
  -- INSERT MISSING CANONICAL MOVE-IN READINGS
  -- ----------------------------------------------------------
  --
  -- Explicit opening readings have priority.
  --
  -- If a MOVE_IN reading already exists for this tenancy /
  -- register, it is NOT replaced.
  -- ----------------------------------------------------------

  insert into public.tenancy_meter_readings (

    tenancy_id,

    meter_register_id,

    reading_type,

    reading_date,

    value,

    created_by

  )

  select
    p_tenancy_id,

    mr.id,

    'MOVE_IN',

    v_start_date,

    canonical.current_value,

    v_created_by

  from public.meter_registers mr

  join public.meters m
    on m.id =
      mr.meter_id

  join public.v_canonical_latest_meter_register_readings canonical
    on canonical.meter_register_id =
      mr.id

  where
    m.property_id =
      v_property_id

    and m.status::text =
      'ACTIVE'

    and mr.active =
      true

    and canonical.current_value
      is not null

    /*
     * Never use a physical reading from after tenancy start as
     * its opening value.
     */
    and (
      canonical.reading_date
        is null

      or canonical.reading_date <=
        v_start_date
    )

    /*
     * User-entered / RPC-created opening reading wins.
     */
    and not exists (

      select
        1

      from public.tenancy_meter_readings existing

      where
        existing.tenancy_id =
          p_tenancy_id

        and existing.meter_register_id =
          mr.id

        and existing.reading_type::text =
          'MOVE_IN'
    );


  get diagnostics
    v_inserted =
      row_count;


  return v_inserted;

end;
$$;


-- Internal helper only.

revoke all
on function public.ensure_canonical_move_in_readings(uuid)
from public;


revoke all
on function public.ensure_canonical_move_in_readings(uuid)
from anon;


revoke all
on function public.ensure_canonical_move_in_readings(uuid)
from authenticated;


-- ============================================================
-- TRIGGER FUNCTION
-- ============================================================

create or replace function public.handle_canonical_move_in_baseline()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin

  /*
   * Run only when the resulting tenancy is ACTIVE.
   *
   * This also protects against unnecessary calls when unrelated
   * tenancy fields are updated.
   */

  if new.status::text <>
    'ACTIVE'
  then
    return new;
  end if;


  /*
   * On INSERT:
   *
   *   tenancy created immediately as ACTIVE
   *
   * On UPDATE:
   *
   *   DRAFT / PENDING -> ACTIVE
   *
   * Updating an already ACTIVE tenancy does not need another
   * baseline attempt unless rows were somehow missing.
   *
   * Calling the helper is still safe because it only inserts
   * missing MOVE_IN rows.
   */

  perform
    public.ensure_canonical_move_in_readings(
      new.id
    );


  return new;

end;
$$;


revoke all
on function public.handle_canonical_move_in_baseline()
from public;


revoke all
on function public.handle_canonical_move_in_baseline()
from anon;


revoke all
on function public.handle_canonical_move_in_baseline()
from authenticated;


-- ============================================================
-- RECREATE CONSTRAINT TRIGGER
-- ============================================================
--
-- Deferred is important.
--
-- Existing tenancy RPCs may:
--
--   1. create tenancy
--   2. create explicit MOVE_IN readings
--
-- Running at transaction end means:
--
-- explicit readings already exist -> preserve them
-- missing readings                -> canonical fallback
-- ============================================================

drop trigger if exists
  trg_canonical_move_in_baseline
on public.tenancies;


create constraint trigger
  trg_canonical_move_in_baseline

after insert or update
on public.tenancies

deferrable
initially deferred

for each row

execute function
  public.handle_canonical_move_in_baseline();


-- ============================================================
-- BACKFILL EXISTING ACTIVE TENANCIES
-- ============================================================

do $$
declare
  v_tenancy record;

  v_inserted integer;

  v_total integer := 0;
begin

  for v_tenancy in

    select
      t.id

    from public.tenancies t

    where
      t.status::text =
        'ACTIVE'

    order by
      t.created_at,
      t.id

  loop

    v_inserted :=
      public.ensure_canonical_move_in_readings(
        v_tenancy.id
      );


    v_total :=
      v_total +
      coalesce(
        v_inserted,
        0
      );

  end loop;


  raise notice
    'Dometra canonical MOVE_IN backfill inserted % reading(s).',
    v_total;

end
$$;


-- ============================================================
-- VALIDATION
-- ============================================================

do $$
begin

  if to_regclass(
    'public.v_canonical_latest_meter_register_readings'
  ) is null
  then
    raise exception
      'v_canonical_latest_meter_register_readings does not exist.';
  end if;


  if not exists (

    select
      1

    from pg_proc p

    join pg_namespace n
      on n.oid =
        p.pronamespace

    where
      n.nspname =
        'public'

      and p.proname =
        'ensure_canonical_move_in_readings'
  )
  then
    raise exception
      'ensure_canonical_move_in_readings() was not created.';
  end if;


  if not exists (

    select
      1

    from pg_trigger

    where
      tgname =
        'trg_canonical_move_in_baseline'

      and not tgisinternal
  )
  then
    raise exception
      'trg_canonical_move_in_baseline was not created.';
  end if;

end
$$;