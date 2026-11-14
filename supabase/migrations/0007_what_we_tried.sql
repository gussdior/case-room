-- "What we tried": the patient's treatment history and the team's research log.

create type treatment_outcome as enum ('worked', 'stopped_working', 'side_effects', 'waiting', 'unknown');
create type finding_status as enum ('may_fit', 'ruled_out', 'waiting');
create type finding_kind as enum ('trial', 'paper', 'treatment_idea', 'insurance', 'other');

create or replace function private.can_edit_treatments(c uuid)
returns boolean language sql stable security definer set search_path = public, private, pg_temp as $$
  select exists (
    select 1 from case_members
    where case_id = c and user_id = auth.uid() and status = 'approved'
      and role in ('creator', 'co_approver', 'family')
  );
$$;
revoke all on function private.can_edit_treatments(uuid) from public, anon;
grant execute on function private.can_edit_treatments(uuid) to authenticated;

-- Treatments: added by the family or case admins, readable by approved members.
create table treatments (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references cases(id) on delete cascade,
  title text not null check (char_length(title) between 2 and 160),
  details text not null default '' check (char_length(details) <= 1000),
  started_on date,
  ended_on date,
  outcome treatment_outcome not null default 'unknown',
  outcome_note text not null default '' check (char_length(outcome_note) <= 160),
  created_by uuid not null references profiles(id),
  created_at timestamptz not null default now(),
  check (ended_on is null or started_on is null or ended_on >= started_on)
);
create index treatments_case on treatments(case_id, started_on);
alter table treatments enable row level security;
create policy treatments_read on treatments for select to authenticated using (private.is_case_member(case_id));
create policy treatments_insert on treatments for insert to authenticated
  with check (private.can_edit_treatments(case_id) and created_by = auth.uid());
create policy treatments_update on treatments for update to authenticated
  using (private.can_edit_treatments(case_id)) with check (private.can_edit_treatments(case_id));
create policy treatments_delete on treatments for delete to authenticated using (private.can_edit_treatments(case_id));

-- Findings: anything the team looked into. Needs at least one http source.
-- Nothing counts until someone other than the author checks it (checked_by), set only via check_finding().
create table findings (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references cases(id) on delete cascade,
  task_id uuid references tasks(id) on delete set null,
  kind finding_kind not null default 'other',
  title text not null check (char_length(title) between 3 and 200),
  summary text not null check (char_length(summary) between 3 and 2000),
  status finding_status not null,
  sources text[] not null check (cardinality(sources) >= 1 and private.all_http(sources)),
  found_by uuid not null references profiles(id),
  checked_by uuid references profiles(id),
  checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index findings_case on findings(case_id, status, created_at desc);
alter table findings enable row level security;
create policy findings_read on findings for select to authenticated using (private.is_case_member(case_id));
create policy findings_insert on findings for insert to authenticated with check (
  private.is_case_member(case_id)
  and found_by = auth.uid()
  and checked_by is null and checked_at is null
  and (task_id is null or exists (select 1 from tasks t where t.id = task_id and t.case_id = findings.case_id))
);
create policy findings_delete on findings for delete to authenticated using (
  found_by = auth.uid() or private.is_case_admin(case_id)
);
-- No direct updates: use update_finding() and check_finding().

create or replace function public.update_finding(f uuid, p_status finding_status, p_summary text, p_sources text[])
returns void language plpgsql security definer set search_path = public, private, pg_temp as $$
declare r findings;
begin
  select * into r from findings where id = f;
  if r.id is null or not private.is_case_member(r.case_id) then raise exception 'Finding not found'; end if;
  if r.found_by <> auth.uid() and not private.is_case_admin(r.case_id) then
    raise exception 'Only the person who logged this or a case admin can change it';
  end if;
  if p_sources is null or cardinality(p_sources) < 1 or not private.all_http(p_sources) then
    raise exception 'Add at least one source link';
  end if;
  update findings set
    status = p_status,
    summary = p_summary,
    sources = p_sources,
    updated_at = now(),
    -- any real change needs a fresh check
    checked_by = case when (p_status, p_summary, p_sources) is distinct from (r.status, r.summary, r.sources) then null else checked_by end,
    checked_at = case when (p_status, p_summary, p_sources) is distinct from (r.status, r.summary, r.sources) then null else checked_at end
  where id = f;
end $$;

create or replace function public.check_finding(f uuid)
returns void language plpgsql security definer set search_path = public, private, pg_temp as $$
declare r findings;
begin
  select * into r from findings where id = f;
  if r.id is null or not private.is_case_member(r.case_id) then raise exception 'Finding not found'; end if;
  if r.found_by = auth.uid() then raise exception 'Someone else has to check your finding'; end if;
  if r.checked_by is not null then raise exception 'Already checked'; end if;
  update findings set checked_by = auth.uid(), checked_at = now() where id = f;
end $$;

revoke all on function public.update_finding(uuid, finding_status, text, text[]) from public, anon;
revoke all on function public.check_finding(uuid) from public, anon;
grant execute on function public.update_finding(uuid, finding_status, text, text[]) to authenticated;
grant execute on function public.check_finding(uuid) to authenticated;
revoke all on treatments, findings from anon;
grant select, insert, update, delete on treatments to authenticated;
grant select, insert, delete on findings to authenticated;
