-- Security audit fixes (OWASP review of 2026-11-15).

-- 1. Fake AI answers. Only the server (service role) can mark a row as written by the server.
--    The app shows "Case Room AI" and "sources checked" as verified only for those rows.
alter table ai_runs add column if not exists written_by_server boolean not null default false;
alter table ai_messages add column if not exists written_by_server boolean not null default false;

create or replace function private.guard_written_by_server()
returns trigger language plpgsql security definer set search_path = public, private, pg_temp as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    if tg_op = 'INSERT' then
      new.written_by_server := false;
    else
      new.written_by_server := old.written_by_server;
    end if;
  end if;
  return new;
end $$;
revoke all on function private.guard_written_by_server() from public, anon, authenticated;

create trigger ai_runs_written_by_server before insert or update on ai_runs
  for each row execute function private.guard_written_by_server();
create trigger ai_messages_written_by_server before insert or update on ai_messages
  for each row execute function private.guard_written_by_server();

-- 2. Daily AI limits per user, plus an optional global cap.
create table if not exists ai_usage (
  user_id uuid not null references profiles(id) on delete cascade,
  day date not null default (now() at time zone 'utc')::date,
  route text not null check (char_length(route) between 2 and 40),
  count int not null default 0,
  primary key (user_id, day, route)
);
alter table ai_usage enable row level security;
create policy ai_usage_read on ai_usage for select to authenticated using (user_id = auth.uid());
revoke all on ai_usage from anon;
grant select on ai_usage to authenticated;

-- Counts one AI call. Returns 'ok', 'user' (this person hit the limit) or 'global' (the site hit its cap).
create or replace function public.bump_ai_usage(p_route text, p_limit int, p_global_cap int default null)
returns text language plpgsql security definer set search_path = public, private, pg_temp as $$
declare me uuid := auth.uid(); today date := (now() at time zone 'utc')::date; n int;
begin
  if me is null then return 'user'; end if;
  if p_global_cap is not null and p_global_cap > 0
     and (select coalesce(sum(count), 0) from ai_usage where day = today) >= p_global_cap then
    return 'global';
  end if;
  insert into ai_usage (user_id, day, route, count) values (me, today, left(p_route, 40), 1)
    on conflict (user_id, day, route) do update set count = ai_usage.count + 1
    returning count into n;
  if n > greatest(coalesce(p_limit, 0), 0) then return 'user'; end if;
  return 'ok';
end $$;
revoke all on function public.bump_ai_usage(text, int, int) from public, anon;
grant execute on function public.bump_ai_usage(text, int, int) to authenticated;

-- 3. Profiles: never show task titles or ids from cases the viewer is not in.
create or replace function public.volunteer_profile(u uuid)
returns jsonb language plpgsql stable security definer set search_path = public, private, pg_temp as $$
declare out jsonb;
begin
  if auth.uid() is null or not private.can_see_profile(u) then return null; end if;

  with passed as (
    select distinct on (sb.id) sb.id, sb.task_id, t.case_id, ch.created_at
    from submissions sb
    join tasks t on t.id = sb.task_id
    join checks ch on ch.submission_id = sb.id and ch.verdict = 'pass' and ch.is_ai = false
    where sb.author_id = u
    order by sb.id, ch.created_at
  ), helped as (
    select case_id, min(created_at) as first_at, max(created_at) as last_at from passed group by case_id
  ), finished as (
    select h.case_id from helped h
    where exists (select 1 from brief_sections s where s.case_id = h.case_id)
      and not exists (
        select 1 from brief_sections s
        where s.case_id = h.case_id
          and (not exists (select 1 from tasks t where t.section_id = s.id)
               or exists (select 1 from tasks t where t.section_id = s.id and t.status <> 'checked'))
      )
  ), reviews as (
    select count(*)::int as n from checks where checker_id = u and is_ai = false and verdict = 'pass'
  )
  select jsonb_build_object(
    'id', p.id,
    'display_name', p.display_name,
    'headline', p.headline,
    'expertise', p.expertise,
    'has_proof', p.proof_url is not null,
    'role_title', p.role_title,
    'years_experience', p.years_experience,
    'time_zone', p.time_zone,
    'areas', p.areas,
    'joined_at', p.created_at,
    'is_me', p.id = auth.uid(),
    'alerts_on', case when p.id = auth.uid() then p.alerts_on end,
    'alert_frequency', case when p.id = auth.uid() then p.alert_frequency end,
    'families_helped', (select count(*) from helped),
    'briefs_finished', (select count(*) from finished),
    'tasks_checked', (select count(*) from passed),
    'checks_done', (select n from reviews),
    'points', (select count(*) from passed) * 3 + (select n from reviews) * 2,
    'current_tasks', coalesce((
      select jsonb_agg(jsonb_build_object('task_id', t.id, 'case_id', t.case_id, 'title', t.title,
                                          'status', t.status, 'expertise', t.expertise) order by t.last_update_at desc)
      from tasks t
      where t.owner_id = u and t.status in ('taken', 'stuck', 'submitted')
        and private.is_case_member(t.case_id)
    ), '[]'::jsonb),
    'cases_helped', coalesce((
      select jsonb_agg(jsonb_build_object(
               'cancer_type', coalesce(c.cancer_type, 'Cancer case'),
               'from_month', to_char(h.first_at, 'YYYY-MM'),
               'to_month', to_char(h.last_at, 'YYYY-MM'),
               'brief_finished', exists (select 1 from finished f where f.case_id = h.case_id))
             order by h.last_at desc)
      from helped h join cases c on c.id = h.case_id
    ), '[]'::jsonb),
    'recent_checked_work', coalesce((
      select jsonb_agg(x order by x->>'checked_at' desc) from (
        select case when private.is_case_member(pa.case_id) then
                 jsonb_build_object('title', t.title, 'expertise', t.expertise, 'checked_at', pa.created_at,
                                    'task_id', t.id, 'case_id', pa.case_id)
               else
                 jsonb_build_object('title', 'Checked work in another case', 'expertise', t.expertise,
                                    'checked_at', pa.created_at, 'task_id', null, 'case_id', null)
               end as x
        from passed pa join tasks t on t.id = pa.task_id
        order by pa.created_at desc limit 5
      ) r
    ), '[]'::jsonb)
  ) into out
  from profiles p where p.id = u;

  return out;
end; $$;

-- 4. Teaser: the goal only when the public preview is on or the caller already has a membership row.
create or replace function public.case_teaser(c uuid)
returns table(goal text, join_mode join_mode, needed expertise[], volunteers integer)
language sql stable security definer set search_path = public, private, pg_temp as $$
  select case when cs.public_preview
              or exists (select 1 from case_members m where m.case_id = cs.id and m.user_id = auth.uid())
         then cs.goal else null end,
    cs.join_mode,
    array(select distinct t.expertise from tasks t where t.case_id = cs.id and t.status = 'open'),
    (select count(*)::int from case_members m where m.case_id = cs.id and m.status = 'approved')
  from cases cs where cs.id = c and auth.uid() is not null;
$$;

-- 6. Older settings versions: keep only what the app calls, with the same rules everywhere.
revoke execute on function public.update_case_settings(uuid, text, text, date, join_mode, boolean, text) from authenticated, public;
revoke execute on function public.update_case_settings(uuid, text, text, date, join_mode, boolean, text, text, text) from authenticated, public;

create or replace function public.update_case_settings(c uuid, p_goal text, p_summary text, p_visit date, p_join_mode join_mode)
returns void language plpgsql security definer set search_path = public, private, pg_temp as $$
declare g text := regexp_replace(trim(coalesce(p_goal, '')), '\s+', ' ', 'g');
begin
  if not private.is_case_admin(c) then raise exception 'Only the case creator or co-approver can change settings'; end if;
  if char_length(g) not between 10 and 200 then raise exception 'Write the goal as a sentence of 10 to 200 characters'; end if;
  if char_length(coalesce(p_summary, '')) > 4000 then raise exception 'Keep the summary under 4000 characters'; end if;
  update cases set goal = g, summary = p_summary, visit_date = p_visit, join_mode = p_join_mode where id = c;
end; $$;

-- Cancer type and stage feed the public card, so only the creator can change them.
create or replace function public.set_case_facts(c uuid, p_goal text, p_age_range text, p_current_treatment text, p_cancer_type text, p_cancer_stage text)
returns void language plpgsql security definer set search_path = public, private, pg_temp as $$
begin
  perform public.set_case_facts(c, p_goal, p_age_range, p_current_treatment);
  if nullif(trim(coalesce(p_cancer_type, '')), '') is null and nullif(trim(coalesce(p_cancer_stage, '')), '') is null then
    return;
  end if;
  if not exists (select 1 from case_members where case_id = c and user_id = auth.uid()
                 and role = 'creator' and status = 'approved') then
    raise exception 'Only the case creator can change the cancer type or stage';
  end if;
  update cases set
    cancer_type = coalesce(nullif(left(trim(coalesce(p_cancer_type, '')), 60), ''), cancer_type),
    cancer_stage = coalesce(nullif(left(trim(coalesce(p_cancer_stage, '')), 40), ''), cancer_stage)
  where id = c;
end $$;

-- 7. Uploaded file rows: the path, owner and draft can never change after upload.
create or replace function private.lock_document_path()
returns trigger language plpgsql set search_path = public, private, pg_temp as $$
begin
  if new.storage_path is distinct from old.storage_path
     or new.owner_id is distinct from old.owner_id
     or new.draft_id is distinct from old.draft_id then
    raise exception 'The file location cannot change';
  end if;
  return new;
end $$;
revoke all on function private.lock_document_path() from public, anon, authenticated;
create trigger case_documents_lock_path before update on case_documents
  for each row execute function private.lock_document_path();
alter policy docs_update on case_documents
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid() and private.owns_draft(draft_id)
              and storage_path like auth.uid()::text || '/' || draft_id::text || '/%');

-- Informational: private helpers should not be callable signed out.
revoke execute on function private.can_check(uuid) from anon;
revoke execute on function private.can_see_profile(uuid) from anon;
