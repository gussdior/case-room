-- Tighter rules found while wiring the app, plus starter tasks for new cases.

-- 1. Case settings change only through update_case_settings (no editing consent, creator or sample flag).
-- (Disabled in place rather than dropped.)
alter policy cases_update on cases using (false) with check (false);

create or replace function public.update_case_settings(
  c uuid, p_goal text, p_summary text, p_visit date, p_join_mode join_mode
) returns void language plpgsql security definer set search_path = public, private as $$
begin
  if not is_case_admin(c) then raise exception 'Only the case creator or co-approver can change settings'; end if;
  update cases set goal = p_goal, summary = p_summary, visit_date = p_visit, join_mode = p_join_mode
    where id = c;
end; $$;

-- Only the creator picks a co-approver (an approved volunteer), or clears it.
create or replace function public.set_co_approver(c uuid, u uuid)
returns void language plpgsql security definer set search_path = public, private as $$
begin
  if not exists (select 1 from case_members where case_id = c and user_id = auth.uid()
                 and role = 'creator' and status = 'approved') then
    raise exception 'Only the case creator can choose a co-approver';
  end if;
  update case_members set role = 'volunteer' where case_id = c and role = 'co_approver';
  if u is not null then
    update case_members set role = 'co_approver'
      where case_id = c and user_id = u and status = 'approved' and role = 'volunteer';
    if not found then raise exception 'Pick an approved volunteer'; end if;
  end if;
end; $$;

-- 2. Pinning goes through pin_message; nobody edits other people's messages.
alter policy messages_pin on messages using (false) with check (false);

create or replace function public.pin_message(m uuid, p boolean)
returns void language plpgsql security definer set search_path = public, private as $$
begin
  update messages set pinned = p where id = m and is_case_admin(case_id);
  if not found then raise exception 'Only the case creator or co-approver can pin'; end if;
end; $$;

-- 3. Checks: not by the author, not by the task owner, and by someone with the right expertise
--    (the same expertise as the task, or a doctor or nurse).
create or replace function private.can_check(s uuid)
returns boolean language sql stable security definer set search_path = public, private as $$
  select exists (
    select 1
    from submissions sb
    join tasks t on t.id = sb.task_id
    join profiles p on p.id = auth.uid()
    where sb.id = s
      and is_case_member(t.case_id)
      and sb.author_id <> auth.uid()
      and coalesce(t.owner_id, '00000000-0000-0000-0000-000000000000'::uuid) <> auth.uid()
      and t.status = 'submitted'
      and (p.expertise = t.expertise or p.expertise = 'doctor_nurse')
  );
$$;
grant execute on function private.can_check(uuid) to authenticated;

alter policy checks_insert on checks with check (
  is_ai = false and checker_id = auth.uid() and private.can_check(submission_id)
);

-- Submissions only while the task is being worked on.
alter policy submissions_insert on submissions with check (
  author_id = auth.uid()
  and exists (
    select 1 from tasks t
    where t.id = task_id and private.is_case_member(t.case_id)
      and t.status in ('taken', 'stuck', 'submitted')
      and (t.owner_id = auth.uid()
           or exists (select 1 from task_helpers h where h.task_id = t.id and h.user_id = auth.uid() and h.status = 'helper'))
  )
);

-- 4. A task's brief section must belong to the same case.
create or replace function private.task_section_check() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.section_id is not null and not exists (
    select 1 from brief_sections where id = new.section_id and case_id = new.case_id
  ) then
    raise exception 'Section does not belong to this case';
  end if;
  return new;
end; $$;
create trigger task_section_matches before insert or update of section_id, case_id on tasks
  for each row execute function private.task_section_check();

-- Reports: only by members of that case, and only on messages they can see.
alter policy reports_insert on reports with check (
  reporter_id = auth.uid()
  and exists (select 1 from messages m where m.id = message_id and private.is_case_member(m.case_id))
);

-- Helpers: can't ask to help on your own task, or on a finished one.
alter policy helpers_request on task_helpers with check (
  user_id = auth.uid() and status = 'requested'
  and exists (
    select 1 from tasks t where t.id = task_id and private.is_case_member(t.case_id)
      and t.status in ('taken', 'stuck', 'submitted')
      and coalesce(t.owner_id, '00000000-0000-0000-0000-000000000000'::uuid) <> auth.uid()
  )
);

-- Tell the case creator and co-approver about new join requests.
create or replace function private.notify_join_request() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'pending' then
    insert into notifications (user_id, case_id, kind, payload)
      select m.user_id, new.case_id, 'join_request', jsonb_build_object('from', new.user_id)
      from case_members m
      where m.case_id = new.case_id and m.status = 'approved' and m.role in ('creator', 'co_approver');
  end if;
  return new;
end; $$;
create trigger join_request_notify after insert on case_members
  for each row execute function private.notify_join_request();

-- New cases start with useful tasks in every section (until the AI helper drafts them).
create or replace function public.create_case(p_goal text, p_summary text, p_consent boolean, p_visit date)
returns uuid language plpgsql security definer set search_path = public, private as $$
declare
  new_id uuid;
  s1 uuid; s2 uuid; s3 uuid; s4 uuid; s5 uuid;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  if not p_consent then raise exception 'Patient consent is required'; end if;
  if coalesce(trim(p_goal), '') = '' then raise exception 'Add a goal'; end if;

  insert into cases (created_by, goal, summary, consent_confirmed, visit_date)
    values (auth.uid(), trim(p_goal), coalesce(p_summary, ''), true, p_visit) returning id into new_id;
  insert into case_members (case_id, user_id, role, status, decided_by, decided_at)
    values (new_id, auth.uid(), 'creator', 'approved', auth.uid(), now());

  insert into brief_sections (case_id, position, title) values (new_id, 1, 'The case in plain words') returning id into s1;
  insert into brief_sections (case_id, position, title) values (new_id, 2, 'What is happening now') returning id into s2;
  insert into brief_sections (case_id, position, title) values (new_id, 3, 'Options to ask about') returning id into s3;
  insert into brief_sections (case_id, position, title) values (new_id, 4, 'Access and cost') returning id into s4;
  insert into brief_sections (case_id, position, title) values (new_id, 5, 'Questions for the doctor') returning id into s5;

  insert into tasks (case_id, section_id, title, why_it_matters, done_looks_like, expertise, minutes) values
    (new_id, s1, 'Review the case summary for mistakes',
     'Everything else builds on the summary, so it has to be right.',
     array['Each fact checked against the records the family shared', 'Fixes listed with a reason'],
     'doctor_nurse', 30),
    (new_id, s2, 'Explain the latest scan or test results in plain words',
     'The family needs to understand what changed before the visit.',
     array['What changed since the last result', 'Two plain sentences a family member can read'],
     'doctor_nurse', 45),
    (new_id, s3, 'Find every open clinical trial that could fit and check the entry rules',
     'Trials are often a real option when standard treatment stops working.',
     array['Every open trial listed with a link', 'Entry rules summarized', 'Distance from the patient'],
     'researcher', 60),
    (new_id, s3, 'Summarize recent papers on treatments for this situation',
     'Gives the family approved options to ask about, not only trials.',
     array['3 papers, 3 sentences each', 'A link to each paper'],
     'researcher', 60),
    (new_id, s4, 'Find insurance coverage and financial help options',
     'An option the family can''t pay for isn''t a real option.',
     array['What insurance usually covers', '2 or more financial help programs with links'],
     'insurance_legal', 45),
    (new_id, s5, 'Turn checked findings into clear questions for the doctor',
     'Clear questions get clear answers in a short visit.',
     array['5 to 8 questions, most important first', 'Each question points to the finding behind it'],
     'no_medical', 30);
  return new_id;
end; $$;

-- Permissions for the new actions.
revoke execute on function public.update_case_settings(uuid, text, text, date, join_mode) from public, anon;
revoke execute on function public.set_co_approver(uuid, uuid) from public, anon;
revoke execute on function public.pin_message(uuid, boolean) from public, anon;
revoke execute on function public.create_case(text, text, boolean, date) from public, anon;
revoke execute on function private.task_section_check() from public, anon, authenticated;
revoke execute on function private.notify_join_request() from public, anon, authenticated;
grant execute on function public.update_case_settings(uuid, text, text, date, join_mode) to authenticated;
grant execute on function public.set_co_approver(uuid, uuid) to authenticated;
grant execute on function public.pin_message(uuid, boolean) to authenticated;
grant execute on function public.create_case(text, text, boolean, date) to authenticated;

-- Leaderboard: credit goes to whoever wrote the work that passed a check.
create or replace function public.case_leaderboard(c uuid, since timestamptz default null)
returns table (user_id uuid, display_name text, headline text, tasks_checked int, reviews_done int, points int)
language sql stable security definer set search_path = public, private as $$
  with passed as (
    select distinct on (sb.id) sb.id, sb.author_id, ch.created_at
    from submissions sb
    join tasks t on t.id = sb.task_id
    join checks ch on ch.submission_id = sb.id and ch.verdict = 'pass'
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
revoke execute on function public.case_leaderboard(uuid, timestamptz) from public, anon;
grant execute on function public.case_leaderboard(uuid, timestamptz) to authenticated;
