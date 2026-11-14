-- Fixes from the independent security review.

-- Harden search_path on every security definer function (pg_temp last).
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'private') and p.prosecdef
  loop
    execute format('alter function %s set search_path = public, private, pg_temp', f.sig);
  end loop;
end $$;

-- ---------- 1. Expertise is fixed per case at the moment someone joins ----------
-- A profile edit can no longer turn someone into a "doctor or nurse" for checking purposes.

alter table case_members add column expertise expertise;

update case_members m set expertise = p.expertise from profiles p where p.id = m.user_id and m.expertise is null;

create or replace function private.set_member_expertise() returns trigger
language plpgsql security definer set search_path = public, private, pg_temp as $$
begin
  select expertise into new.expertise from profiles where id = new.user_id;
  return new;
end; $$;
revoke execute on function private.set_member_expertise() from public, anon, authenticated;
create trigger member_expertise_snapshot before insert on case_members
  for each row execute function private.set_member_expertise();

-- Members cannot change it later (no direct updates on case_members exist; functions never touch it).

-- ---------- 2, 5. Who may check, and what ----------
-- Not the author, the task owner or a task helper; same expertise as the task (as approved for this case)
-- or a doctor/nurse; only the latest submission, and only if nobody asked for a fix on it.
create or replace function private.can_check(s uuid)
returns boolean language sql stable security definer set search_path = public, private, pg_temp as $$
  select exists (
    select 1
    from submissions sb
    join tasks t on t.id = sb.task_id
    join case_members me on me.case_id = t.case_id and me.user_id = auth.uid() and me.status = 'approved'
    where sb.id = s
      and sb.author_id <> auth.uid()
      and coalesce(t.owner_id, '00000000-0000-0000-0000-000000000000'::uuid) <> auth.uid()
      and not exists (select 1 from task_helpers h where h.task_id = t.id and h.user_id = auth.uid())
      and t.status = 'submitted'
      and (me.expertise = t.expertise or me.expertise = 'doctor_nurse')
      and not exists (select 1 from submissions newer where newer.task_id = t.id and newer.created_at > sb.created_at)
      and not exists (select 1 from checks c where c.submission_id = sb.id and c.verdict = 'needs_fix')
  );
$$;

-- ---------- 3. Users can't plant AI notes or decision stamps ----------
alter policy submissions_insert on submissions with check (
  author_id = auth.uid()
  and ai_check is null
  and exists (
    select 1 from tasks t
    where t.id = task_id and private.is_case_member(t.case_id)
      and t.status in ('taken', 'stuck', 'submitted')
      and (t.owner_id = auth.uid()
           or exists (select 1 from task_helpers h where h.task_id = t.id and h.user_id = auth.uid() and h.status = 'helper'))
  )
);

alter policy members_request on case_members with check (
  user_id = auth.uid() and status = 'pending' and role = 'volunteer'
  and ai_note is null and decided_by is null and decided_at is null
  and private.case_accepts_requests(case_id)
);

-- ---------- 4. Links must be web links ----------
create or replace function private.all_http(arr text[])
returns boolean language sql immutable set search_path = pg_catalog, pg_temp as $$
  select coalesce(bool_and(u ~* '^https?://[^\s/$.?#][^\s]*$' and length(u) <= 2000), true) from unnest(arr) u;
$$;
grant execute on function private.all_http(text[]) to authenticated;

alter table submissions add constraint submissions_sources_http check (private.all_http(sources));
alter table messages add constraint messages_sources_http check (private.all_http(sources));
alter table profiles add constraint profiles_proof_http check (proof_url is null or private.all_http(array[proof_url]));
alter table case_members add constraint members_proof_http check (proof_url is null or private.all_http(array[proof_url]));

-- ---------- 6. The brief is only checked work: sections are read-only ----------
alter policy sections_write on brief_sections using (false) with check (false);

-- ---------- 7. Profiles: only people you share a case with ----------
create or replace function private.can_see_profile(p uuid)
returns boolean language sql stable security definer set search_path = public, private, pg_temp as $$
  select p = auth.uid() or exists (
    select 1
    from case_members me
    join case_members them on them.case_id = me.case_id and them.user_id = p
    where me.user_id = auth.uid() and me.status = 'approved'
      and (them.status = 'approved'
           or (them.status = 'pending' and me.role in ('creator', 'co_approver')))
  );
$$;
grant execute on function private.can_see_profile(uuid) to authenticated;
alter policy profiles_read on profiles using (private.can_see_profile(id));

-- ---------- 10. Tasks owned by people who left ----------
create or replace function public.remove_member(c uuid, u uuid)
returns void language plpgsql security definer set search_path = public, private, pg_temp as $$
begin
  if not is_case_admin(c) then raise exception 'Not allowed'; end if;
  if exists (select 1 from case_members where case_id = c and user_id = u and role = 'creator') then
    raise exception 'The creator cannot be removed';
  end if;
  update case_members set status = 'removed', role = 'volunteer', decided_by = auth.uid(), decided_at = now()
    where case_id = c and user_id = u;
  update tasks set status = 'open', owner_id = null, last_update_at = now()
    where case_id = c and owner_id = u and status in ('taken', 'stuck');
  delete from task_helpers h using tasks t where h.task_id = t.id and t.case_id = c and h.user_id = u;
end; $$;

create or replace function public.accept_helper(t uuid, u uuid)
returns void language plpgsql security definer set search_path = public, private, pg_temp as $$
begin
  if not exists (select 1 from tasks where id = t and owner_id = auth.uid() and is_case_member(case_id)) then
    raise exception 'Only the task owner can add helpers';
  end if;
  update task_helpers set status = 'helper' where task_id = t and user_id = u;
end; $$;

create or replace function public.set_task_stuck(t uuid, stuck boolean)
returns void language plpgsql security definer set search_path = public, private, pg_temp as $$
begin
  update tasks
    set status = case when stuck then 'stuck'::task_status else 'taken'::task_status end,
        last_update_at = now()
    where id = t and owner_id = auth.uid() and status in ('taken', 'stuck') and is_case_member(case_id);
  if not found then raise exception 'Only the task owner can change this'; end if;
end; $$;

create or replace function public.release_task(t uuid)
returns void language plpgsql security definer set search_path = public, private, pg_temp as $$
begin
  update tasks set status = 'open', owner_id = null, last_update_at = now()
    where id = t and owner_id = auth.uid() and status in ('taken', 'stuck') and is_case_member(case_id);
end; $$;

-- ---------- 13. Only a human check moves work into the brief ----------
-- AI checks are recorded as notes; a needs-fix sends the task back, or reopens it if its owner left.
create or replace function public.on_check() returns trigger
language plpgsql security definer set search_path = public, private, pg_temp as $$
declare t uuid; c uuid; o uuid;
begin
  select sb.task_id, tk.case_id, tk.owner_id into t, c, o
    from submissions sb join tasks tk on tk.id = sb.task_id where sb.id = new.submission_id;
  if new.verdict = 'pass' then
    if not new.is_ai then
      update tasks set status = 'checked', last_update_at = now() where id = t;
    end if;
  elsif exists (select 1 from case_members where case_id = c and user_id = o and status = 'approved') then
    update tasks set status = 'taken', last_update_at = now() where id = t;
  else
    update tasks set status = 'open', owner_id = null, last_update_at = now() where id = t;
  end if;
  return new;
end; $$;

-- Leaderboard counts only human passes (consistent with the rule above).
create or replace function public.case_leaderboard(c uuid, since timestamptz default null)
returns table (user_id uuid, display_name text, headline text, tasks_checked int, reviews_done int, points int)
language sql stable security definer set search_path = public, private, pg_temp as $$
  with passed as (
    select distinct on (sb.id) sb.id, sb.author_id, ch.created_at
    from submissions sb
    join tasks t on t.id = sb.task_id
    join checks ch on ch.submission_id = sb.id and ch.verdict = 'pass' and ch.is_ai = false
    where t.case_id = c
    order by sb.id, ch.created_at
  ), tc as (
    select author_id as uid, count(*)::int as n from passed
    where since is null or created_at >= since group by author_id
  ), rv as (
    select ch.checker_id as uid, count(*)::int as n
    from checks ch join submissions s on s.id = ch.submission_id join tasks t on t.id = s.task_id
    where t.case_id = c and ch.is_ai = false and ch.verdict = 'pass'
      and (since is null or ch.created_at >= since)
    group by ch.checker_id
  )
  select p.id, p.display_name, p.headline,
    coalesce(tc.n, 0), coalesce(rv.n, 0),
    coalesce(tc.n, 0) * 3 + coalesce(rv.n, 0) * 2
  from case_members m
  join profiles p on p.id = m.user_id
  left join tc on tc.uid = p.id
  left join rv on rv.uid = p.id
  where m.case_id = c and m.status = 'approved' and m.role <> 'family'
    and is_case_member(c)
  order by 6 desc, 2;
$$;

-- ---------- 11. Cases only through create_case (consent check, creator membership) ----------
alter policy cases_insert on cases with check (false);

-- ---------- 12. Member-added tasks: clean shape, always in a section ----------
alter policy tasks_insert on tasks with check (
  private.is_case_member(case_id) and created_by = auth.uid() and status = 'open' and owner_id is null
  and section_id is not null and inputs = '[]'::jsonb and cardinality(done_looks_like) <= 10
);

-- ---------- 14. "Stuck" messages only from the task owner ----------
alter policy messages_insert on messages with check (
  is_ai = false and author_id = auth.uid() and pinned = false and kind <> 'ai_summary'
  and private.is_case_member(case_id)
  and (task_id is null or private.task_case(task_id) = case_id)
  and (kind = 'message'
       or (kind = 'stuck' and exists (select 1 from tasks t where t.id = task_id and t.owner_id = auth.uid())))
);

-- create_case: record the creator's expertise too (trigger does it), keep pg_temp search path.
alter function public.create_case(text, text, boolean, date) set search_path = public, private, pg_temp;
