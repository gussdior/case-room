-- Public ongoing cases on the homepage. Privacy first:
-- a case shows publicly only when its creator listed it AND wrote a one line public goal.
-- The public functions return counts and labels only: no names, brief text, documents,
-- messages or member identities.

alter table cases
  add column if not exists public_goal text check (public_goal is null or char_length(public_goal) between 10 and 140),
  add column if not exists cancer_stage text check (cancer_stage is null or char_length(cancer_stage) <= 40);

-- Settings with the public goal and stage. Older versions keep working.
create or replace function public.update_case_settings(
  c uuid, p_goal text, p_summary text, p_visit date, p_join_mode join_mode,
  p_listed boolean, p_cancer_type text, p_public_goal text, p_cancer_stage text
) returns void language plpgsql security definer set search_path = public, private, pg_temp as $$
declare
  is_creator boolean := exists (select 1 from case_members where case_id = c and user_id = auth.uid()
                                and role = 'creator' and status = 'approved');
  cur cases;
  new_goal text := nullif(trim(coalesce(p_public_goal, '')), '');
begin
  if not private.is_case_admin(c) then raise exception 'Only the case creator or co-approver can change settings'; end if;
  select * into cur from cases where id = c;
  if (p_listed is distinct from cur.listed
      or new_goal is distinct from cur.public_goal
      or nullif(trim(coalesce(p_cancer_stage, '')), '') is distinct from cur.cancer_stage)
     and not is_creator then
    raise exception 'Only the case creator can change how the case is listed';
  end if;
  if coalesce(p_listed, cur.listed) and new_goal is null then
    raise exception 'Add a one line public goal before listing the case';
  end if;
  update cases set goal = p_goal, summary = p_summary, visit_date = p_visit, join_mode = p_join_mode,
    listed = coalesce(p_listed, listed),
    cancer_type = nullif(trim(p_cancer_type), ''),
    public_goal = new_goal,
    cancer_stage = nullif(trim(coalesce(p_cancer_stage, '')), '')
  where id = c;
end; $$;
revoke execute on function public.update_case_settings(uuid, text, text, date, join_mode, boolean, text, text, text) from public, anon;
grant execute on function public.update_case_settings(uuid, text, text, date, join_mode, boolean, text, text, text) to authenticated;

-- Which cases count as public.
create or replace function private.is_public_case(c cases)
returns boolean language sql immutable set search_path = public, private, pg_temp as $$
  select c.listed and c.public_goal is not null and not c.is_sample and c.join_mode = 'approve';
$$;

create or replace function public.public_cases(p_limit int default 6)
returns table (
  case_id uuid,
  cancer_type text,
  cancer_stage text,
  public_goal text,
  leads_promising int,
  leads_exploring int,
  leads_needs_someone int,
  leads_ruled_out int,
  helpers int,
  professions text[],
  needed text[],
  last_activity timestamptz
) language sql stable security definer set search_path = public, private, pg_temp as $$
  with pc as (
    select c.* from cases c where private.is_public_case(c)
  ),
  -- helper = a volunteer or co-approver (not the family). Missing professions consider everyone approved.
  members as (
    select m.case_id, m.expertise, m.role in ('volunteer', 'co_approver') as helper
    from case_members m join pc on pc.id = m.case_id where m.status = 'approved'
  ),
  wanted as (
    select t.case_id, t.expertise from tasks t join pc on pc.id = t.case_id where t.status = 'open'
    union
    select l.case_id, l.next_step_expertise from leads l join pc on pc.id = l.case_id
      where l.status in ('needs_someone', 'exploring') and l.next_step_expertise is not null
  ),
  activity as (
    select case_id, max(at) as at from (
      select case_id, updated_at as at from leads
      union all select case_id, created_at from ai_runs
      union all select case_id, created_at from messages
      union all select case_id, last_update_at from tasks
    ) a where case_id in (select id from pc) group by case_id
  )
  select
    pc.id,
    coalesce(pc.cancer_type, 'Cancer case'),
    pc.cancer_stage,
    pc.public_goal,
    (select count(*)::int from leads l where l.case_id = pc.id and l.status = 'promising'),
    (select count(*)::int from leads l where l.case_id = pc.id and l.status = 'exploring'),
    (select count(*)::int from leads l where l.case_id = pc.id and l.status = 'needs_someone'),
    (select count(*)::int from leads l where l.case_id = pc.id and l.status = 'ruled_out'),
    (select count(*)::int from members m where m.case_id = pc.id and m.helper),
    coalesce((select array_agg(distinct m.expertise::text) from members m where m.case_id = pc.id and m.helper), '{}'),
    coalesce((select array_agg(distinct w.expertise::text) from wanted w
              where w.case_id = pc.id and w.expertise <> 'no_medical'
                and not exists (select 1 from members m where m.case_id = pc.id and m.expertise = w.expertise)), '{}'),
    greatest(pc.created_at, (select a.at from activity a where a.case_id = pc.id))
  from pc
  order by greatest(pc.created_at, (select a.at from activity a where a.case_id = pc.id)) desc
  limit least(greatest(coalesce(p_limit, 6), 1), 60);
$$;

create or replace function public.public_stats()
returns table (listed_cases int, volunteers int, leads_checked int, ai_runs int)
language sql stable security definer set search_path = public, private, pg_temp as $$
  select
    (select count(*)::int from cases c where private.is_public_case(c)),
    (select count(distinct m.user_id)::int from case_members m join cases c on c.id = m.case_id
       where private.is_public_case(c) and m.status = 'approved' and m.role in ('volunteer', 'co_approver')),
    (select count(*)::int from leads l join cases c on c.id = l.case_id
       where not c.is_sample and l.status in ('promising', 'ruled_out')),
    (select count(*)::int from ai_runs r join cases c on c.id = r.case_id where not c.is_sample);
$$;

revoke all on function private.is_public_case(cases) from public;

revoke all on function public.public_cases(int) from public;
revoke all on function public.public_stats() from public;
grant execute on function public.public_cases(int) to anon, authenticated;
grant execute on function public.public_stats() to anon, authenticated;
