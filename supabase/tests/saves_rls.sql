-- Run after the migration with a database-owner connection. All fixtures roll back.
begin;
insert into auth.users (id, email) values
  ('11111111-1111-4111-8111-111111111111', 'save-test-owner@example.invalid'),
  ('22222222-2222-4222-8222-222222222222', 'save-test-other@example.invalid');
create function pg_temp.denied(statement text) returns void language plpgsql as $$
begin
  begin
    execute statement;
  exception when insufficient_privilege then return;
  end;
  raise exception 'Expected permission denied: %', statement;
end;
$$;
set local role anon;
select pg_temp.denied('select * from public.saves');
select pg_temp.denied($q$insert into public.saves values ('11111111-1111-4111-8111-111111111111','mpt.profile','{}',1,false,now())$q$);
select pg_temp.denied('update public.saves set version=2');
select pg_temp.denied('delete from public.saves');
select pg_temp.denied($q$select public.put_save('11111111-1111-4111-8111-111111111111','mpt.profile','{}',1,false,now(),null)$q$);

set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
do $$ begin
  assert public.put_save(auth.uid(),'mpt.profile','{"xp":5}',2,false,'2026-10-23T00:00:00Z',null), 'owner insert';
  assert (select data->>'xp' from public.saves where user_id=auth.uid()) = '5', 'owner read';
  assert public.put_save(auth.uid(),'mpt.profile','{"xp":6}',2,false,'2026-10-23T00:00:01Z','2026-10-23T00:00:00Z'), 'owner update';
  assert not public.put_save(auth.uid(),'mpt.profile','{"xp":999}',2,false,'2026-10-23T00:00:02Z','2026-10-23T00:00:00Z'), 'stale upsert rejected';
  assert (select data->>'xp' from public.saves where user_id=auth.uid()) = '6', 'stale upsert left data intact';
  assert public.put_save(auth.uid(),'mpt.run',null,1,false,now(),null), 'nullable slot payload';
  assert (select data='null'::jsonb and not deleted from public.saves where user_id=auth.uid() and slot_key='mpt.run'), 'JSON null is distinct from deletion';
  delete from public.saves where user_id=auth.uid() and slot_key='mpt.run';
end $$;

set local request.jwt.claim.sub = '22222222-2222-4222-8222-222222222222';
do $$ declare affected integer; begin
  assert (select count(*) from public.saves) = 0, 'other user cannot read';
  update public.saves set data='{"xp":999}' where user_id='11111111-1111-4111-8111-111111111111';
  get diagnostics affected = row_count;
  assert affected = 0, 'other user cannot update';
  delete from public.saves where user_id='11111111-1111-4111-8111-111111111111';
  get diagnostics affected = row_count;
  assert affected = 0, 'other user cannot delete';
end $$;
select pg_temp.denied($q$insert into public.saves values ('11111111-1111-4111-8111-111111111111','mpt.settings','{}',1,false,now())$q$);
select pg_temp.denied($q$select public.put_save('11111111-1111-4111-8111-111111111111','mpt.profile','{}',2,false,now(),null)$q$);
do $$ begin
  assert public.put_save(auth.uid(),'mpt.profile','{"xp":2}',2,false,now(),null), 'other user can own a save';
end $$;
select pg_temp.denied($q$update public.saves set user_id='11111111-1111-4111-8111-111111111111' where user_id=auth.uid()$q$);

set local request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
do $$ declare affected integer; begin
  assert (select data->>'xp' from public.saves where user_id=auth.uid()) = '6', 'other user left owner data intact';
  assert public.put_save(auth.uid(),'mpt.profile',null,1,true,now(),'2026-10-23T00:00:01Z'), 'owner tombstone';
  assert (select deleted and data is null from public.saves where user_id=auth.uid()), 'tombstone retained';
  delete from public.saves where user_id=auth.uid();
  get diagnostics affected = row_count;
  assert affected=1, 'owner delete';
end $$;
reset role;
do $$ begin
  assert (select relrowsecurity and relforcerowsecurity from pg_class where oid='public.saves'::regclass), 'RLS enabled and forced';
  assert (select count(*) from pg_policies where schemaname='public' and tablename='saves')=4, 'four owner policies';
  assert not (select prosecdef from pg_proc where oid='public.put_save(uuid,text,jsonb,integer,boolean,timestamptz,timestamptz)'::regprocedure), 'RPC preserves RLS';
end $$;
rollback;
