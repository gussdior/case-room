-- Deleting a case or an account. Not applied automatically: the database tool asks for
-- a confirmation on statements that delete rows. Apply it from the Supabase SQL editor.

-- Shared: removes one case and its drafts. Returns storage paths of the files to remove.
create or replace function private.remove_case(c uuid)
returns text[] language plpgsql security definer set search_path = public, private, pg_temp as $$
declare paths text[];
begin
  select coalesce(array_agg(d.storage_path), '{}') into paths
    from case_documents d join case_drafts r on r.id = d.draft_id where r.case_id = c;
  delete from case_drafts where case_id = c;
  delete from cases where id = c;
  return paths;
end; $$;
revoke all on function private.remove_case(uuid) from public, anon, authenticated;

-- The creator deletes a case and everything under it.
create or replace function public.delete_case(c uuid)
returns text[] language plpgsql security definer set search_path = public, private, pg_temp as $$
begin
  if not exists (select 1 from case_members where case_id = c and user_id = auth.uid()
                 and role = 'creator' and status = 'approved') then
    raise exception 'Only the case creator can delete this case';
  end if;
  if exists (select 1 from cases where id = c and is_sample) then
    raise exception 'The sample case cannot be deleted';
  end if;
  return private.remove_case(c);
end; $$;
revoke all on function public.delete_case(uuid) from public, anon;
grant execute on function public.delete_case(uuid) to authenticated;

-- Deletes the caller's account: their cases, drafts, files, memberships and private AI chats.
-- Work they shared in other people's cases stays, shown as "Deleted user".
create or replace function public.delete_my_account()
returns jsonb language plpgsql security definer set search_path = public, private, pg_temp as $$
declare
  me uuid := auth.uid();
  paths text[] := '{}';
  c record;
  n int := 0;
begin
  if me is null then raise exception 'Sign in first'; end if;
  for c in select m.case_id from case_members m join cases cs on cs.id = m.case_id
           where m.user_id = me and m.role = 'creator' and not cs.is_sample loop
    paths := paths || private.remove_case(c.case_id);
    n := n + 1;
  end loop;
  paths := paths || coalesce((select array_agg(storage_path) from case_documents where owner_id = me), '{}');
  delete from case_drafts where owner_id = me;
  update tasks set owner_id = null, status = 'open', last_update_at = now()
    where owner_id = me and status in ('taken', 'stuck');
  delete from task_helpers where user_id = me;
  delete from case_members where user_id = me;
  delete from notifications where user_id = me;
  delete from ai_messages where user_id = me;
  update profiles set display_name = 'Deleted user', headline = null, proof_url = null, role_title = null,
    years_experience = null, time_zone = null, areas = '{}', alerts_on = false, deleted_at = now()
  where id = me;
  return jsonb_build_object('paths', to_jsonb(paths), 'cases_deleted', n);
end; $$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
