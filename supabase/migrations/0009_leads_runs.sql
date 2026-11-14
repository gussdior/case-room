-- Leads (ideas the team is checking) and AI runs (what someone asked an AI, what came back, and whether the sources held up).
-- The case page centers on these; the brief becomes "For the doctor".

create type lead_kind as enum ('trial', 'drug_repurposing', 'vaccine_or_personalized', 'test_or_diagnostic', 'support_or_access', 'other');
create type lead_status as enum ('needs_someone', 'exploring', 'promising', 'ruled_out');
create type ai_tool as enum ('case_room_ai', 'chatgpt', 'claude', 'gemini', 'other');

-- "What would need to be true": a short list of {text, checked}.
create or replace function private.valid_conditions(c jsonb)
returns boolean language sql immutable set search_path = public, private, pg_temp as $$
  select coalesce(jsonb_typeof(c) = 'array', false)
     and jsonb_array_length(c) <= 8
     and not exists (
       select 1 from jsonb_array_elements(c) e
       where coalesce(jsonb_typeof(e) <> 'object', true)
          or coalesce(jsonb_typeof(e->'text') <> 'string', true)
          or coalesce(char_length(e->>'text') not between 2 and 300, true)
          or (e ? 'checked' and coalesce(jsonb_typeof(e->'checked') <> 'boolean', true))
     );
$$;

create table leads (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references cases(id) on delete cascade,
  title text not null check (char_length(title) between 3 and 200),
  idea text not null default '' check (char_length(idea) <= 1000),
  kind lead_kind not null default 'other',
  status lead_status not null default 'needs_someone',
  conditions jsonb not null default '[]'::jsonb check (private.valid_conditions(conditions)),
  next_step text not null default '' check (char_length(next_step) <= 300),
  next_step_expertise expertise,
  ai_suggested boolean not null default false,
  ruled_out_reason text check (ruled_out_reason is null or char_length(ruled_out_reason) between 3 and 1000),
  created_by uuid not null references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'ruled_out') = (ruled_out_reason is not null))
);
create index leads_case on leads(case_id, status, updated_at desc);
alter table leads enable row level security;
create policy leads_read on leads for select to authenticated using (private.is_case_member(case_id));
-- Members add leads as open ideas. Only admins (or the server for them) may mark one as suggested by the AI.
create policy leads_insert on leads for insert to authenticated with check (
  private.is_case_member(case_id)
  and created_by = auth.uid()
  and status in ('needs_someone', 'exploring')
  and ruled_out_reason is null
  and (not ai_suggested or private.is_case_admin(case_id))
);
create policy leads_delete on leads for delete to authenticated using (
  created_by = auth.uid() or private.is_case_admin(case_id)
);
-- No direct updates: status, conditions and edits go through the functions below, which log each change.

create table lead_events (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads(id) on delete cascade,
  user_id uuid references profiles(id) on delete set null,
  detail text not null check (char_length(detail) <= 400),
  created_at timestamptz not null default now()
);
create index lead_events_lead on lead_events(lead_id, created_at desc);
alter table lead_events enable row level security;
create policy lead_events_read on lead_events for select to authenticated using (
  exists (select 1 from leads l where l.id = lead_id and private.is_case_member(l.case_id))
);

alter table tasks add column if not exists lead_id uuid references leads(id) on delete set null;
create index if not exists tasks_lead on tasks(lead_id);

create or replace function private.lead_case(l uuid)
returns uuid language sql stable security definer set search_path = public, private, pg_temp as $$
  select case_id from leads where id = l;
$$;
revoke all on function private.lead_case(uuid) from public, anon;
grant execute on function private.lead_case(uuid) to authenticated;

-- A task's lead must belong to the same case.
create or replace function private.task_lead_check()
returns trigger language plpgsql set search_path = public, private, pg_temp as $$
begin
  if new.lead_id is not null and private.lead_case(new.lead_id) is distinct from new.case_id then
    raise exception 'That lead belongs to another case';
  end if;
  return new;
end $$;
create trigger task_lead_check before insert or update of lead_id on tasks
  for each row execute function private.task_lead_check();

create table ai_runs (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references cases(id) on delete cascade,
  lead_id uuid references leads(id) on delete set null,
  task_id uuid references tasks(id) on delete set null,
  user_id uuid not null references profiles(id) on delete cascade,
  tool ai_tool not null,
  tool_other text check (tool_other is null or char_length(tool_other) <= 60),
  prompt text not null check (char_length(prompt) between 2 and 4000),
  result text not null check (char_length(result) between 2 and 20000),
  sources jsonb not null default '[]'::jsonb check (jsonb_typeof(sources) = 'array'),
  source_check jsonb not null default '{}'::jsonb check (jsonb_typeof(source_check) = 'object'),
  -- True only when the server cleaned names and IDs out of the prompt and result. Only such prompts are ever
  -- shown outside their own case.
  scrubbed boolean not null default false,
  reuse_count int not null default 0 check (reuse_count >= 0),
  created_at timestamptz not null default now()
);
create index ai_runs_case on ai_runs(case_id, created_at desc);
create index ai_runs_lead on ai_runs(lead_id, reuse_count desc);
alter table ai_runs enable row level security;
create policy ai_runs_read on ai_runs for select to authenticated using (private.is_case_member(case_id));
-- People can add their own pasted runs directly, but never as the built in AI, never "scrubbed",
-- never with a source check result (those come from the server) and never with reuse counts.
create policy ai_runs_insert on ai_runs for insert to authenticated with check (
  private.is_case_member(case_id)
  and user_id = auth.uid()
  and tool <> 'case_room_ai'
  and source_check = '{}'::jsonb
  and not scrubbed
  and reuse_count = 0
);
create policy ai_runs_delete on ai_runs for delete to authenticated using (
  user_id = auth.uid() or private.is_case_admin(case_id)
);

create or replace function private.run_links_check()
returns trigger language plpgsql set search_path = public, private, pg_temp as $$
begin
  if new.lead_id is not null and private.lead_case(new.lead_id) is distinct from new.case_id then
    raise exception 'That lead belongs to another case';
  end if;
  if new.task_id is not null and private.task_case(new.task_id) is distinct from new.case_id then
    raise exception 'That task belongs to another case';
  end if;
  return new;
end $$;
create trigger ai_runs_links before insert or update on ai_runs
  for each row execute function private.run_links_check();

-- ---------- Functions ----------

create or replace function public.set_lead_status(l uuid, p_status lead_status)
returns void language plpgsql security definer set search_path = public, private, pg_temp as $$
declare r leads;
begin
  select * into r from leads where id = l for update;
  if r.id is null or not private.is_case_member(r.case_id) then raise exception 'Lead not found'; end if;
  if p_status = 'ruled_out' then raise exception 'Use rule out, with a reason and a source'; end if;
  if r.status = 'ruled_out' and not private.is_case_admin(r.case_id) then
    raise exception 'Only a case admin can reopen a ruled out lead';
  end if;
  if r.status = p_status then return; end if;
  update leads set status = p_status, ruled_out_reason = null, updated_at = now() where id = l;
  insert into lead_events (lead_id, user_id, detail)
    values (l, auth.uid(), 'Moved to ' || replace(p_status::text, '_', ' '));
end $$;

create or replace function public.set_lead_condition(l uuid, idx int, p_checked boolean)
returns void language plpgsql security definer set search_path = public, private, pg_temp as $$
declare r leads; c jsonb;
begin
  select * into r from leads where id = l for update;
  if r.id is null or not private.is_case_member(r.case_id) then raise exception 'Lead not found'; end if;
  if idx < 0 or idx >= jsonb_array_length(r.conditions) then raise exception 'No such condition'; end if;
  c := r.conditions -> idx;
  if coalesce((c->>'checked')::boolean, false) = p_checked then return; end if;
  update leads set conditions = jsonb_set(conditions, array[idx::text, 'checked'], to_jsonb(p_checked)), updated_at = now()
    where id = l;
  insert into lead_events (lead_id, user_id, detail)
    values (l, auth.uid(), case when p_checked then 'Ticked: ' else 'Unticked: ' end || left(c->>'text', 300));
end $$;

create or replace function public.edit_lead(
  l uuid, p_title text, p_idea text, p_kind lead_kind, p_conditions jsonb, p_next_step text, p_next_expertise expertise
) returns void language plpgsql security definer set search_path = public, private, pg_temp as $$
declare r leads;
begin
  select * into r from leads where id = l for update;
  if r.id is null or not private.is_case_member(r.case_id) then raise exception 'Lead not found'; end if;
  if r.created_by <> auth.uid() and not private.is_case_admin(r.case_id) then
    raise exception 'Only the person who added this lead or a case admin can edit it';
  end if;
  update leads set title = p_title, idea = coalesce(p_idea, ''), kind = p_kind, conditions = coalesce(p_conditions, '[]'::jsonb),
    next_step = coalesce(p_next_step, ''), next_step_expertise = p_next_expertise, updated_at = now()
    where id = l;
  insert into lead_events (lead_id, user_id, detail) values (l, auth.uid(), 'Edited the lead');
end $$;

-- Ruling a lead out needs a reason and a source, and logs it on What we tried so nobody repeats it.
create or replace function public.rule_out_lead(l uuid, p_reason text, p_source text)
returns uuid language plpgsql security definer set search_path = public, private, pg_temp as $$
declare r leads; f uuid; reason text := trim(coalesce(p_reason, ''));
begin
  select * into r from leads where id = l for update;
  if r.id is null or not private.is_case_member(r.case_id) then raise exception 'Lead not found'; end if;
  if r.status = 'ruled_out' then raise exception 'Already ruled out'; end if;
  if char_length(reason) < 3 then raise exception 'Say why it is ruled out'; end if;
  if p_source is null or not private.all_http(array[trim(p_source)]) then
    raise exception 'Add a source link for the reason';
  end if;
  update leads set status = 'ruled_out', ruled_out_reason = left(reason, 1000), updated_at = now() where id = l;
  insert into findings (case_id, kind, title, summary, status, sources, found_by)
    values (r.case_id,
            case r.kind when 'trial' then 'trial'::finding_kind when 'drug_repurposing' then 'treatment_idea'::finding_kind
                        else 'other'::finding_kind end,
            left(r.title, 200), left(reason, 2000), 'ruled_out', array[trim(p_source)], auth.uid())
    returning id into f;
  insert into lead_events (lead_id, user_id, detail) values (l, auth.uid(), 'Ruled out: ' || left(reason, 300));
  return f;
end $$;

-- Built in AI answers, and pasted runs whose sources the server checked. When the server has the service key it
-- writes these directly instead, so nobody can plant an "AI answer" or a "sources checked" badge by calling this.
create or replace function public.save_ai_run(
  c uuid, l uuid, t uuid, p_tool ai_tool, p_tool_other text, p_prompt text, p_result text, p_sources jsonb, p_check jsonb
) returns uuid language plpgsql security definer set search_path = public, private, pg_temp as $$
declare new_id uuid;
begin
  if auth.uid() is null or not private.is_case_member(c) then raise exception 'Join this case first'; end if;
  insert into ai_runs (case_id, lead_id, task_id, user_id, tool, tool_other, prompt, result, sources, source_check, scrubbed)
    values (c, l, t, auth.uid(), p_tool, nullif(left(trim(coalesce(p_tool_other, '')), 60), ''),
            left(p_prompt, 4000), left(p_result, 20000),
            case when jsonb_typeof(p_sources) = 'array' then p_sources else '[]'::jsonb end,
            case when jsonb_typeof(p_check) = 'object' then p_check else '{}'::jsonb end,
            true)
    returning id into new_id;
  if l is not null then update leads set updated_at = now() where id = l; end if;
  return new_id;
end $$;

create or replace function public.bump_reuse(r uuid)
returns void language plpgsql security definer set search_path = public, private, pg_temp as $$
begin
  update ai_runs set reuse_count = reuse_count + 1
    where id = r and private.is_case_member(case_id) and user_id <> auth.uid();
end $$;

-- Prompts that worked: this lead's most reused prompts first, then well reused prompts from leads of the same kind
-- in other cases. Prompt text only, and only prompts the server already cleaned of names and IDs.
create or replace function public.top_prompts(l uuid)
returns table (prompt text, uses int, here boolean)
language plpgsql stable security definer set search_path = public, private, pg_temp as $$
declare r leads;
begin
  select * into r from leads where id = l;
  if r.id is null or not private.is_case_member(r.case_id) then return; end if;
  return query
  (select a.prompt, a.reuse_count, true from ai_runs a
     where a.lead_id = l and a.reuse_count >= 1
     order by a.reuse_count desc, a.created_at desc limit 4)
  union all
  (select a.prompt, a.reuse_count, false from ai_runs a join leads o on o.id = a.lead_id
     where o.kind = r.kind and o.case_id <> r.case_id and a.scrubbed and a.reuse_count >= 2
       and char_length(a.prompt) <= 300
     order by a.reuse_count desc, a.created_at desc limit 4);
end $$;

revoke all on function public.set_lead_status(uuid, lead_status) from public, anon;
revoke all on function public.set_lead_condition(uuid, int, boolean) from public, anon;
revoke all on function public.edit_lead(uuid, text, text, lead_kind, jsonb, text, expertise) from public, anon;
revoke all on function public.rule_out_lead(uuid, text, text) from public, anon;
revoke all on function public.save_ai_run(uuid, uuid, uuid, ai_tool, text, text, text, jsonb, jsonb) from public, anon;
revoke all on function public.bump_reuse(uuid) from public, anon;
revoke all on function public.top_prompts(uuid) from public, anon;
revoke all on function private.valid_conditions(jsonb) from public, anon;
grant execute on function private.valid_conditions(jsonb) to authenticated;
grant execute on function public.set_lead_status(uuid, lead_status) to authenticated;
grant execute on function public.set_lead_condition(uuid, int, boolean) to authenticated;
grant execute on function public.edit_lead(uuid, text, text, lead_kind, jsonb, text, expertise) to authenticated;
grant execute on function public.rule_out_lead(uuid, text, text) to authenticated;
grant execute on function public.save_ai_run(uuid, uuid, uuid, ai_tool, text, text, text, jsonb, jsonb) to authenticated;
grant execute on function public.bump_reuse(uuid) to authenticated;
grant execute on function public.top_prompts(uuid) to authenticated;

revoke all on leads, lead_events, ai_runs from anon;
grant select, insert, delete on leads to authenticated;
grant select on lead_events to authenticated;
grant select, insert, delete on ai_runs to authenticated;
