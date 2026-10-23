begin;
create table public.saves (
  user_id uuid not null references auth.users(id) on delete cascade,
  slot_key text not null check (slot_key in ('mpt.profile', 'mpt.settings', 'mpt.run', 'mpt.run.ui')),
  data jsonb,
  version integer not null check (version > 0),
  deleted boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, slot_key),
  check ((deleted and data is null) or (not deleted and data is not null)),
  check (pg_column_size(data) <= 2097152)
);
alter table public.saves enable row level security;
alter table public.saves force row level security;
revoke all on table public.saves from public, anon, authenticated;
grant select, insert, update, delete on table public.saves to authenticated;

create policy saves_select on public.saves for select to authenticated
  using ((select auth.uid()) = user_id);
create policy saves_insert on public.saves for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy saves_update on public.saves for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy saves_delete on public.saves for delete to authenticated
  using ((select auth.uid()) = user_id);

-- Compare-and-upsert is atomic even when two devices submit at the same time.
-- SECURITY INVOKER preserves the caller's RLS and table privileges.
create function public.put_save(
  p_user_id uuid, p_slot_key text, p_data jsonb, p_version integer,
  p_deleted boolean, p_updated_at timestamptz, p_expected_at timestamptz
) returns boolean language plpgsql security invoker set search_path = '' as $$
declare affected integer;
begin
  if (select auth.uid()) is null or p_user_id <> (select auth.uid()) then
    raise insufficient_privilege using message = 'Save owner does not match session';
  end if;
  insert into public.saves as existing (user_id, slot_key, data, version, deleted, updated_at)
    values (p_user_id, p_slot_key, case when p_deleted then null else coalesce(p_data, 'null'::jsonb) end, p_version, p_deleted, p_updated_at)
    on conflict (user_id, slot_key) do update
      set data = excluded.data, version = excluded.version, deleted = excluded.deleted, updated_at = excluded.updated_at
      where existing.updated_at = p_expected_at;
  get diagnostics affected = row_count;
  return affected = 1;
end;
$$;
revoke all on function public.put_save(uuid, text, jsonb, integer, boolean, timestamptz, timestamptz) from public, anon;
grant execute on function public.put_save(uuid, text, jsonb, integer, boolean, timestamptz, timestamptz) to authenticated;
commit;
