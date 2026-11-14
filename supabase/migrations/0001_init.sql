-- Case Room: initial schema
-- One case = one patient. Volunteers ask to join, the creator approves.
-- Work is organized as a brief (sections) with tasks that fill its gaps.

create extension if not exists pgcrypto;

-- ---------- Types ----------

create type expertise as enum (
  'doctor_nurse', 'researcher', 'bioinformatics', 'insurance_legal', 'no_medical'
);
create type member_role as enum ('creator', 'co_approver', 'volunteer', 'family');
create type member_status as enum ('pending', 'approved', 'declined', 'removed');
create type join_mode as enum ('approve', 'invite_only');
create type section_status as enum ('empty', 'draft', 'checked');
create type task_status as enum ('open', 'taken', 'submitted', 'checked', 'stuck');
create type helper_status as enum ('requested', 'helper');
create type check_verdict as enum ('pass', 'needs_fix');
create type message_kind as enum ('message', 'stuck', 'ai_summary');
create type report_status as enum ('open', 'resolved');

-- ---------- Tables ----------

create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 60),
  headline text check (char_length(headline) <= 120),        -- e.g. "Oncology nurse, 12 years"
  expertise expertise not null default 'no_medical',
  proof_url text,                                            -- license, university page, LinkedIn
  created_at timestamptz not null default now()
);

create table cases (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references profiles (id),
  goal text not null check (char_length(goal) <= 200),
  summary text not null default '',                          -- plain language, no name or IDs
  consent_confirmed boolean not null default false,
  join_mode join_mode not null default 'approve',
  visit_date date,                                           -- next doctor visit
  is_sample boolean not null default false,
  created_at timestamptz not null default now()
);

create table case_members (
  case_id uuid not null references cases (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  role member_role not null default 'volunteer',
  status member_status not null default 'pending',
  request_note text check (char_length(request_note) <= 500),
  hours_per_week smallint check (hours_per_week between 0 and 80),
  proof_url text,
  ai_note text,                                              -- AI review of the request
  decided_by uuid references profiles (id),
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (case_id, user_id)
);

create table brief_sections (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references cases (id) on delete cascade,
  position smallint not null,
  title text not null,
  body text not null default '',
  status section_status not null default 'empty',
  unique (case_id, position)
);

create table tasks (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references cases (id) on delete cascade,
  section_id uuid references brief_sections (id) on delete set null,
  title text not null check (char_length(title) <= 200),
  why_it_matters text not null default '',
  done_looks_like text[] not null default '{}',
  inputs jsonb not null default '[]',                        -- [{label, ready}]
  expertise expertise not null,
  minutes smallint not null default 45 check (minutes between 10 and 120),
  status task_status not null default 'open',
  owner_id uuid references profiles (id),
  created_by uuid references profiles (id),                  -- null = AI suggested
  last_update_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table task_helpers (
  task_id uuid not null references tasks (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  status helper_status not null default 'requested',
  created_at timestamptz not null default now(),
  primary key (task_id, user_id)
);

create table submissions (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks (id) on delete cascade,
  author_id uuid not null references profiles (id),
  body text not null check (char_length(body) <= 10000),
  sources text[] not null check (cardinality(sources) >= 1),  -- every claim needs a source
  ai_check jsonb,                                            -- {claims, matched, notes}
  created_at timestamptz not null default now()
);

create table checks (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references submissions (id) on delete cascade,
  checker_id uuid references profiles (id),                  -- null when is_ai
  is_ai boolean not null default false,
  verdict check_verdict not null,
  note text,
  created_at timestamptz not null default now(),
  check (is_ai or checker_id is not null)
);

create table messages (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references cases (id) on delete cascade,
  task_id uuid references tasks (id) on delete cascade,      -- null = case discussion
  author_id uuid references profiles (id),                   -- null when is_ai
  is_ai boolean not null default false,
  kind message_kind not null default 'message',
  body text not null check (char_length(body) between 1 and 4000),
  sources text[] not null default '{}',
  pinned boolean not null default false,
  created_at timestamptz not null default now(),
  check (is_ai or author_id is not null)
);

create table reports (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references messages (id) on delete cascade,
  reporter_id uuid not null references profiles (id),
  reason text not null check (char_length(reason) <= 500),
  status report_status not null default 'open',
  created_at timestamptz not null default now(),
  unique (message_id, reporter_id)
);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  case_id uuid references cases (id) on delete cascade,
  kind text not null,                                        -- join_request, reply, check_needed ...
  payload jsonb not null default '{}',
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index on case_members (user_id);
create index on tasks (case_id, status);
create index on submissions (task_id);
create index on checks (submission_id);
create index on messages (case_id, task_id, created_at);
create index on notifications (user_id, read_at);

-- ---------- Helper functions (security definer, used by policies) ----------

create or replace function is_case_member(c uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from case_members
    where case_id = c and user_id = auth.uid() and status = 'approved'
  );
$$;

create or replace function is_case_admin(c uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from case_members
    where case_id = c and user_id = auth.uid() and status = 'approved'
      and role in ('creator', 'co_approver')
  );
$$;

create or replace function case_accepts_requests(c uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from cases where id = c and join_mode = 'approve');
$$;

create or replace function task_case(t uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select case_id from tasks where id = t;
$$;

create or replace function submission_case(s uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select t.case_id from submissions sb join tasks t on t.id = sb.task_id where sb.id = s;
$$;

-- ---------- Row level security ----------

alter table profiles enable row level security;
alter table cases enable row level security;
alter table case_members enable row level security;
alter table brief_sections enable row level security;
alter table tasks enable row level security;
alter table task_helpers enable row level security;
alter table submissions enable row level security;
alter table checks enable row level security;
alter table messages enable row level security;
alter table reports enable row level security;
alter table notifications enable row level security;

-- Profiles: any signed in user can see names and expertise; you edit only yours.
create policy profiles_read on profiles for select to authenticated using (true);
create policy profiles_insert on profiles for insert to authenticated with check (id = auth.uid());
create policy profiles_update on profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- Cases: only approved members see case details. Outsiders use case_teaser().
create policy cases_read on cases for select to authenticated using (is_case_member(id));
create policy cases_insert on cases for insert to authenticated with check (created_by = auth.uid());
create policy cases_update on cases for update to authenticated
  using (is_case_admin(id)) with check (is_case_admin(id));

-- Members: you see your own row; approved members see approved members;
-- admins see everything for their case, including pending requests.
create policy members_read on case_members for select to authenticated using (
  user_id = auth.uid()
  or is_case_admin(case_id)
  or (status = 'approved' and is_case_member(case_id))
);
-- Asking to join: only as a pending volunteer, only for yourself, never re-asking after a decline
-- (the primary key blocks a second row).
create policy members_request on case_members for insert to authenticated with check (
  user_id = auth.uid() and status = 'pending' and role = 'volunteer'
  and case_accepts_requests(case_id)
);
-- Decisions go through decide_join_request(); no direct updates.

-- Brief, tasks, submissions, checks, messages: approved members only.
create policy sections_read on brief_sections for select to authenticated using (is_case_member(case_id));
create policy sections_write on brief_sections for all to authenticated
  using (is_case_admin(case_id)) with check (is_case_admin(case_id));

create policy tasks_read on tasks for select to authenticated using (is_case_member(case_id));
create policy tasks_insert on tasks for insert to authenticated with check (
  is_case_member(case_id) and created_by = auth.uid() and status = 'open' and owner_id is null
);
-- Claiming, releasing and status changes go through RPC functions below.

create policy helpers_read on task_helpers for select to authenticated using (is_case_member(task_case(task_id)));
create policy helpers_request on task_helpers for insert to authenticated with check (
  user_id = auth.uid() and status = 'requested' and is_case_member(task_case(task_id))
);

create policy submissions_read on submissions for select to authenticated using (is_case_member(task_case(task_id)));
create policy submissions_insert on submissions for insert to authenticated with check (
  author_id = auth.uid()
  and exists (
    select 1 from tasks t
    where t.id = task_id and is_case_member(t.case_id)
      and (t.owner_id = auth.uid()
           or exists (select 1 from task_helpers h where h.task_id = t.id and h.user_id = auth.uid() and h.status = 'helper'))
  )
);

create policy checks_read on checks for select to authenticated using (is_case_member(submission_case(submission_id)));
-- Human checks: a member who did not write the submission. AI checks are written by the server (service role).
create policy checks_insert on checks for insert to authenticated with check (
  is_ai = false and checker_id = auth.uid()
  and is_case_member(submission_case(submission_id))
  and not exists (select 1 from submissions s where s.id = submission_id and s.author_id = auth.uid())
);

create policy messages_read on messages for select to authenticated using (is_case_member(case_id));
create policy messages_insert on messages for insert to authenticated with check (
  is_ai = false and author_id = auth.uid() and pinned = false and kind <> 'ai_summary'
  and is_case_member(case_id)
  and (task_id is null or task_case(task_id) = case_id)
);
create policy messages_pin on messages for update to authenticated
  using (is_case_admin(case_id)) with check (is_case_admin(case_id));

create policy reports_insert on reports for insert to authenticated with check (reporter_id = auth.uid());
create policy reports_read on reports for select to authenticated using (
  reporter_id = auth.uid()
  or exists (select 1 from messages m where m.id = message_id and is_case_admin(m.case_id))
);

create policy notifications_read on notifications for select to authenticated using (user_id = auth.uid());
create policy notifications_mark on notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------- Actions (RPC) ----------

-- What an outsider sees before joining: goal and needed skills only.
create or replace function case_teaser(c uuid)
returns table (goal text, join_mode join_mode, needed expertise[], volunteers int)
language sql stable security definer set search_path = public as $$
  select cs.goal, cs.join_mode,
    array(select distinct t.expertise from tasks t where t.case_id = cs.id and t.status = 'open'),
    (select count(*)::int from case_members m where m.case_id = cs.id and m.status = 'approved')
  from cases cs where cs.id = c;
$$;

-- Creating a case also makes you its creator member.
create or replace function create_case(p_goal text, p_summary text, p_consent boolean, p_visit date)
returns uuid language plpgsql security definer set search_path = public as $$
declare new_id uuid;
begin
  if not p_consent then raise exception 'Patient consent is required'; end if;
  insert into cases (created_by, goal, summary, consent_confirmed, visit_date)
    values (auth.uid(), p_goal, p_summary, true, p_visit) returning id into new_id;
  insert into case_members (case_id, user_id, role, status, decided_by, decided_at)
    values (new_id, auth.uid(), 'creator', 'approved', auth.uid(), now());
  insert into brief_sections (case_id, position, title) values
    (new_id, 1, 'The case in plain words'),
    (new_id, 2, 'Why it may be growing'),
    (new_id, 3, 'Options to ask about'),
    (new_id, 4, 'Access and cost'),
    (new_id, 5, 'Questions for the doctor');
  return new_id;
end; $$;

-- Approve or decline a join request (creator or co-approver only).
create or replace function decide_join_request(c uuid, u uuid, approve boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_case_admin(c) then raise exception 'Only the case creator or co-approver can decide'; end if;
  update case_members
    set status = case when approve then 'approved'::member_status else 'declined'::member_status end,
        decided_by = auth.uid(), decided_at = now()
    where case_id = c and user_id = u and status = 'pending';
  if not found then raise exception 'No pending request'; end if;
  insert into notifications (user_id, case_id, kind, payload)
    values (u, c, case when approve then 'join_approved' else 'join_declined' end, '{}');
end; $$;

-- Remove a member. Their checked work stays.
create or replace function remove_member(c uuid, u uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_case_admin(c) then raise exception 'Not allowed'; end if;
  if exists (select 1 from case_members where case_id = c and user_id = u and role = 'creator') then
    raise exception 'The creator cannot be removed';
  end if;
  update case_members set status = 'removed', decided_by = auth.uid(), decided_at = now()
    where case_id = c and user_id = u;
  update tasks set status = 'open', owner_id = null, last_update_at = now()
    where case_id = c and owner_id = u and status in ('taken', 'stuck');
end; $$;

-- Take an open task.
create or replace function claim_task(t uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_case_member(task_case(t)) then raise exception 'Join the case first'; end if;
  update tasks set status = 'taken', owner_id = auth.uid(), last_update_at = now()
    where id = t and status = 'open';
  if not found then raise exception 'Someone already took this task. Offer to help instead.'; end if;
end; $$;

-- Owner adds a helper who asked to join the task.
create or replace function accept_helper(t uuid, u uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from tasks where id = t and owner_id = auth.uid()) then
    raise exception 'Only the task owner can add helpers';
  end if;
  update task_helpers set status = 'helper' where task_id = t and user_id = u;
end; $$;

-- Owner marks the task stuck (or unstuck).
create or replace function set_task_stuck(t uuid, stuck boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  update tasks
    set status = case when stuck then 'stuck'::task_status else 'taken'::task_status end,
        last_update_at = now()
    where id = t and owner_id = auth.uid() and status in ('taken', 'stuck');
  if not found then raise exception 'Only the task owner can change this'; end if;
end; $$;

-- Hand a task back.
create or replace function release_task(t uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update tasks set status = 'open', owner_id = null, last_update_at = now()
    where id = t and owner_id = auth.uid() and status in ('taken', 'stuck');
end; $$;

-- ---------- Triggers ----------

-- A submission moves its task to "submitted" and counts as an update.
create or replace function on_submission() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update tasks set status = 'submitted', last_update_at = now() where id = new.task_id;
  return new;
end; $$;
create trigger submission_after_insert after insert on submissions
  for each row execute function on_submission();

-- A passing check (by a second person or the AI) marks the task checked.
-- A "needs fix" check sends it back to the owner.
create or replace function on_check() returns trigger
language plpgsql security definer set search_path = public as $$
declare t uuid;
begin
  select task_id into t from submissions where id = new.submission_id;
  if new.verdict = 'pass' then
    update tasks set status = 'checked', last_update_at = now() where id = t;
  else
    update tasks set status = 'taken', last_update_at = now() where id = t;
  end if;
  return new;
end; $$;
create trigger check_after_insert after insert on checks
  for each row execute function on_check();

-- A message in a task thread from the owner counts as an update.
create or replace function on_task_message() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.task_id is not null then
    update tasks set last_update_at = now()
      where id = new.task_id and owner_id = new.author_id;
  end if;
  return new;
end; $$;
create trigger message_after_insert after insert on messages
  for each row execute function on_task_message();

-- Tasks with no update for 3 days open up again. Run daily (pg_cron or a Vercel cron).
create or replace function reopen_stale_tasks()
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  update tasks set status = 'open', owner_id = null, last_update_at = now()
    where status in ('taken', 'stuck') and last_update_at < now() - interval '3 days';
  get diagnostics n = row_count;
  return n;
end; $$;
revoke execute on function reopen_stale_tasks() from public, anon, authenticated;

-- ---------- Leaderboard ----------
-- 3 points per checked task you own, 2 per check you did for someone else.

create or replace function case_leaderboard(c uuid, since timestamptz default null)
returns table (user_id uuid, display_name text, headline text, tasks_checked int, reviews_done int, points int)
language sql stable security definer set search_path = public as $$
  with tc as (
    select t.owner_id as uid, count(*)::int as n
    from tasks t
    where t.case_id = c and t.status = 'checked'
      and (since is null or t.last_update_at >= since)
    group by t.owner_id
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
