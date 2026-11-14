-- Profiles with more detail, case alerts, AI on tasks.

-- ---------- 1. Profile fields (all optional) ----------
alter table profiles
  add column if not exists role_title text check (char_length(role_title) <= 80),
  add column if not exists years_experience int check (years_experience between 0 and 70),
  add column if not exists time_zone text check (char_length(time_zone) <= 64),
  add column if not exists areas text[] not null default '{}' check (cardinality(areas) <= 12),
  add column if not exists alerts_on boolean not null default false,
  add column if not exists alert_frequency text not null default 'weekly'
    check (alert_frequency in ('instant', 'weekly'));

-- ---------- 2. Cases: listed for alerts, cancer type for profiles ----------
alter table cases
  add column if not exists listed boolean not null default false,
  add column if not exists cancer_type text check (char_length(cancer_type) <= 60);

-- Settings with listing. The old 5 argument version keeps working (leaves listed as is).
create or replace function public.update_case_settings(
  c uuid, p_goal text, p_summary text, p_visit date, p_join_mode join_mode,
  p_listed boolean, p_cancer_type text
) returns void language plpgsql security definer set search_path = public, private, pg_temp as $$
begin
  if not is_case_admin(c) then raise exception 'Only the case creator or co-approver can change settings'; end if;
  if p_listed is distinct from (select listed from cases where id = c)
     and not exists (select 1 from case_members where case_id = c and user_id = auth.uid()
                     and role = 'creator' and status = 'approved') then
    raise exception 'Only the case creator can list the case';
  end if;
  update cases set goal = p_goal, summary = p_summary, visit_date = p_visit, join_mode = p_join_mode,
    listed = coalesce(p_listed, listed), cancer_type = nullif(trim(p_cancer_type), '')
    where id = c;
end; $$;
revoke execute on function public.update_case_settings(uuid, text, text, date, join_mode, boolean, text) from public, anon;
grant execute on function public.update_case_settings(uuid, text, text, date, join_mode, boolean, text) to authenticated;

-- ---------- 3. Submissions: AI assisted flag ----------
alter table submissions add column if not exists ai_assisted boolean not null default false;

-- ---------- 4. AI chat saved to the task ----------
create table if not exists ai_messages (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (char_length(content) between 1 and 20000),
  sources jsonb not null default '[]'::jsonb check (jsonb_typeof(sources) = 'array'),
  created_at timestamptz not null default now()
);
create index if not exists ai_messages_task_idx on ai_messages (task_id, created_at);
alter table ai_messages enable row level security;

create policy ai_messages_read on ai_messages for select to authenticated
  using (private.is_case_member(private.task_case(task_id)));
create policy ai_messages_insert on ai_messages for insert to authenticated
  with check (user_id = auth.uid() and role = 'user' and private.is_case_member(private.task_case(task_id)));

revoke all on ai_messages from anon;
grant select, insert on ai_messages to authenticated;

create or replace function public.save_ai_exchange(t uuid, question text, answer text, sources jsonb default '[]'::jsonb)
returns void language plpgsql security definer set search_path = public, private, pg_temp as $$
begin
  if auth.uid() is null or not private.is_case_member(private.task_case(t)) then
    raise exception 'Not allowed';
  end if;
  insert into ai_messages (task_id, user_id, role, content) values (t, auth.uid(), 'user', left(question, 4000));
  insert into ai_messages (task_id, user_id, role, content, sources)
    values (t, auth.uid(), 'assistant', left(answer, 20000),
            case when jsonb_typeof(sources) = 'array' then sources else '[]'::jsonb end);
end; $$;
revoke execute on function public.save_ai_exchange(uuid, text, text, jsonb) from public, anon;
grant execute on function public.save_ai_exchange(uuid, text, text, jsonb) to authenticated;

-- ---------- 5. Volunteer profile with stats ----------
-- Only for yourself or someone you share a case with (same rule as reading profiles).
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
        select jsonb_build_object('title', t.title, 'expertise', t.expertise, 'checked_at', pa.created_at,
                                  'task_id', case when private.is_case_member(pa.case_id) then t.id end,
                                  'case_id', case when private.is_case_member(pa.case_id) then pa.case_id end) as x
        from passed pa join tasks t on t.id = pa.task_id
        order by pa.created_at desc limit 5
      ) r
    ), '[]'::jsonb)
  ) into out
  from profiles p where p.id = u;

  return out;
end; $$;
revoke execute on function public.volunteer_profile(uuid) from public, anon;
grant execute on function public.volunteer_profile(uuid) to authenticated;

-- ---------- 6. Listed cases that need my expertise (for alerts) ----------
-- Shows only the teaser: goal, cancer type, visit date and how many open tasks fit me.
create or replace function public.listed_cases_for_me()
returns table (case_id uuid, goal text, cancer_type text, visit_date date, open_tasks int)
language sql stable security definer set search_path = public, private, pg_temp as $$
  select c.id, c.goal, c.cancer_type, c.visit_date, count(t.id)::int
  from cases c
  join profiles me on me.id = auth.uid()
  join tasks t on t.case_id = c.id and t.status = 'open' and t.expertise = me.expertise
  where c.listed and not c.is_sample and c.join_mode = 'approve'
    and not exists (select 1 from case_members m where m.case_id = c.id and m.user_id = auth.uid())
  group by c.id
  order by c.visit_date nulls last, c.created_at desc
  limit 50;
$$;
revoke execute on function public.listed_cases_for_me() from public, anon;
grant execute on function public.listed_cases_for_me() to authenticated;
