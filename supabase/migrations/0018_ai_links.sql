-- Share a case with any AI: a link that shows chosen case text, with no names, documents or messages,
-- to anyone holding it until it expires or is turned off. Also Reddit posts for Find your helpers.

alter table cases add column if not exists ai_links_allowed boolean not null default true;

-- Reddit posts reuse case_outreach. The kind check stays as it is: Reddit rows are kind 'other' with reddit = true,
-- and carry a separate short comment that holds the link.
alter table case_outreach add column if not exists reddit boolean not null default false;
alter table case_outreach add column if not exists comment text check (comment is null or char_length(comment) <= 600);

create table case_ai_links (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references cases (id) on delete cascade,
  -- Only a hash of the token is kept. The link is shown once, when it is created.
  token_hash text not null unique,
  role text not null check (role in ('everyone', 'researcher', 'doctor_nurse', 'bioinformatics', 'insurance_legal')),
  includes jsonb not null default '{}'::jsonb,
  created_by uuid not null references profiles (id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  open_count integer not null default 0,
  last_opened_at timestamptz
);
create index case_ai_links_case on case_ai_links (case_id, created_at desc);
alter table case_ai_links enable row level security;
create policy ai_links_read on case_ai_links for select to authenticated using (private.is_case_member(case_id));
-- Creating and turning off go through the functions below.

-- Small counters that slow down hammering of one link or from one address.
create table ai_link_rate (
  key text primary key,
  window_start timestamptz not null default now(),
  n integer not null default 0
);
alter table ai_link_rate enable row level security;

create or replace function private.ai_token_hash(t text)
returns text language sql immutable set search_path = public, pg_temp as $$
  select encode(sha256(convert_to(coalesce(t, ''), 'UTF8')), 'hex');
$$;

-- True when the key is still under its per minute limit. Counts the call.
create or replace function private.ai_link_rate_ok(k text, lim int)
returns boolean language plpgsql security definer set search_path = public, private, pg_temp as $$
declare cur int;
begin
  insert into ai_link_rate as r (key, window_start, n) values (k, now(), 1)
  on conflict (key) do update set
    n = case when r.window_start < now() - interval '1 minute' then 1 else r.n + 1 end,
    window_start = case when r.window_start < now() - interval '1 minute' then now() else r.window_start end
  returning n into cur;
  return cur <= lim;
end; $$;

-- The link row when it is live: not expired, not turned off, and the case still allows AI links.
create or replace function private.live_ai_link(t text)
returns case_ai_links language sql stable security definer set search_path = public, private, pg_temp as $$
  select l.* from case_ai_links l join cases c on c.id = l.case_id
  where l.token_hash = private.ai_token_hash(t)
    and char_length(coalesce(t, '')) between 32 and 128
    and l.revoked_at is null and l.expires_at > now()
    and c.ai_links_allowed and not c.is_sample;
$$;

create or replace function public.create_ai_link(c uuid, p_role text, p_includes jsonb, p_days int)
returns jsonb language plpgsql security definer set search_path = public, private, pg_temp as $$
declare tok text; new_id uuid; inc jsonb;
begin
  if auth.uid() is null or not private.is_case_member(c) then raise exception 'Only people on this case can create an AI link'; end if;
  if exists (select 1 from cases where id = c and is_sample) then raise exception 'Not for the sample case'; end if;
  if not exists (select 1 from cases where id = c and ai_links_allowed) then raise exception 'AI links are turned off for this case'; end if;
  if p_days not in (1, 7, 30) then raise exception 'Pick 24 hours, 7 days or 30 days'; end if;
  if p_role not in ('everyone', 'researcher', 'doctor_nurse', 'bioinformatics', 'insurance_legal') then raise exception 'Pick a role'; end if;
  if (select count(*) from case_ai_links where case_id = c and revoked_at is null and expires_at > now()) >= 10 then
    raise exception 'This case already has 10 active AI links. Turn one off first';
  end if;
  inc := jsonb_build_object(
    'genes_treatments', coalesce((p_includes ->> 'genes_treatments')::boolean, false),
    'leads', coalesce((p_includes ->> 'leads')::boolean, false),
    'ruled_out', coalesce((p_includes ->> 'ruled_out')::boolean, false),
    'runs', coalesce((p_includes ->> 'runs')::boolean, false));
  tok := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  insert into case_ai_links (case_id, token_hash, role, includes, created_by, expires_at)
  values (c, private.ai_token_hash(tok), p_role, inc, auth.uid(), now() + make_interval(days => p_days))
  returning id into new_id;
  return jsonb_build_object('id', new_id, 'token', tok);
end; $$;

-- Turning a link off: the person who made it, or the creator or a co-approver.
create or replace function public.revoke_ai_link(l uuid)
returns void language plpgsql security definer set search_path = public, private, pg_temp as $$
declare r case_ai_links;
begin
  select * into r from case_ai_links where id = l;
  if r.id is null or not private.is_case_member(r.case_id) then raise exception 'Not found'; end if;
  if r.created_by <> auth.uid() and not private.is_case_admin(r.case_id) then
    raise exception 'Only the person who made this link, the case creator or a co-approver can turn it off';
  end if;
  update case_ai_links set revoked_at = coalesce(revoked_at, now()) where id = l;
end; $$;

create or replace function public.set_ai_links_allowed(c uuid, p_on boolean)
returns void language plpgsql security definer set search_path = public, private, pg_temp as $$
begin
  if not private.is_case_creator(c) then raise exception 'Only the case creator can change this'; end if;
  update cases set ai_links_allowed = p_on where id = c;
end; $$;

-- What the link preview card shows. Counts and labels only. Does not count as an open.
create or replace function public.ai_link_card(p_token text)
returns jsonb language plpgsql stable security definer set search_path = public, private, pg_temp as $$
declare l case_ai_links; k cases;
begin
  l := private.live_ai_link(p_token);
  if l.id is null then return null; end if;
  select * into k from cases where id = l.case_id;
  return jsonb_build_object(
    'role', l.role,
    'cancer_type', k.cancer_type,
    'cancer_stage', k.cancer_stage,
    'open_leads', (select count(*) from leads where case_id = k.id and status <> 'ruled_out'),
    'visit_days', case when k.preview_show_visit and k.visit_date is not null then k.visit_date - current_date end);
end; $$;

-- The case text behind a link. Never names, member identities, documents, messages or discussion.
create or replace function public.ai_link_pack(p_token text, p_ip text default null)
returns jsonb language plpgsql security definer set search_path = public, private, pg_temp as $$
declare l case_ai_links; k cases; inc jsonb; out jsonb;
begin
  if p_ip is not null and not private.ai_link_rate_ok('ip:' || private.ai_token_hash(p_ip), 30) then
    return jsonb_build_object('busy', true);
  end if;
  l := private.live_ai_link(p_token);
  if l.id is null then return null; end if;
  if not private.ai_link_rate_ok('link:' || l.id::text, 120) then return jsonb_build_object('busy', true); end if;
  update case_ai_links set open_count = open_count + 1, last_opened_at = now() where id = l.id;
  select * into k from cases where id = l.case_id;
  inc := l.includes;
  out := jsonb_build_object(
    'case_id', k.id,
    'role', l.role,
    'includes', inc,
    'expires_at', l.expires_at,
    'goal', k.goal,
    'summary', k.summary,
    'cancer_type', k.cancer_type,
    'cancer_stage', k.cancer_stage,
    'age_range', k.age_range,
    'current_treatment', k.current_treatment,
    'visit_days', case when k.preview_show_visit and k.visit_date is not null then k.visit_date - current_date end,
    'public_preview', k.public_preview);
  if (inc ->> 'genes_treatments')::boolean then
    out := out || jsonb_build_object(
      'sections', coalesce((select jsonb_agg(jsonb_build_object('title', s.title, 'body', left(s.body, 1500), 'note', s.source_note) order by s.position)
        from brief_sections s where s.case_id = k.id and coalesce(s.body, '') <> ''), '[]'::jsonb),
      'treatments', coalesce((select jsonb_agg(jsonb_build_object('title', t.title, 'started', to_char(t.started_on, 'YYYY-MM'),
          'ended', to_char(t.ended_on, 'YYYY-MM'), 'outcome', t.outcome, 'note', t.outcome_note) order by t.started_on nulls last)
        from (select * from treatments where case_id = k.id order by started_on nulls last limit 30) t), '[]'::jsonb));
  end if;
  if (inc ->> 'leads')::boolean then
    out := out || jsonb_build_object(
      'leads', coalesce((select jsonb_agg(jsonb_build_object('title', d.title, 'idea', left(d.idea, 600), 'kind', d.kind, 'status', d.status,
          'expertise', d.next_step_expertise, 'next_step', d.next_step, 'conditions', d.conditions) order by d.updated_at desc)
        from (select * from leads where case_id = k.id and status <> 'ruled_out' order by updated_at desc limit 20) d), '[]'::jsonb),
      'tasks', coalesce((select jsonb_agg(jsonb_build_object('title', t.title, 'expertise', t.expertise, 'done', t.done_looks_like,
          'lead', (select title from leads where id = t.lead_id)) order by t.created_at)
        from (select * from tasks where case_id = k.id and status = 'open' order by created_at limit 20) t), '[]'::jsonb));
  end if;
  if (inc ->> 'ruled_out')::boolean then
    out := out || jsonb_build_object(
      'ruled_out_leads', coalesce((select jsonb_agg(jsonb_build_object('title', d.title, 'reason', left(d.ruled_out_reason, 400)) order by d.updated_at desc)
        from (select * from leads where case_id = k.id and status = 'ruled_out' order by updated_at desc limit 20) d), '[]'::jsonb),
      'ruled_out_findings', coalesce((select jsonb_agg(jsonb_build_object('title', f.title, 'summary', left(f.summary, 300), 'source', f.sources[1]) order by f.updated_at desc)
        from (select * from findings where case_id = k.id and status = 'ruled_out' order by updated_at desc limit 30) f), '[]'::jsonb));
  end if;
  if (inc ->> 'runs')::boolean then
    out := out || jsonb_build_object(
      'runs', coalesce((select jsonb_agg(jsonb_build_object('tool', r.tool, 'prompt', left(r.prompt, 300), 'result', left(r.result, 700),
          'sources', r.sources, 'verified', r.written_by_server) order by r.created_at desc)
        from (select * from ai_runs where case_id = k.id order by created_at desc limit 8) r), '[]'::jsonb));
  end if;
  return out;
end; $$;

revoke all on function private.ai_token_hash(text) from public, anon;
revoke all on function private.ai_link_rate_ok(text, int) from public, anon, authenticated;
revoke all on function private.live_ai_link(text) from public, anon, authenticated;
grant execute on function private.ai_token_hash(text) to authenticated, service_role;
revoke all on function public.create_ai_link(uuid, text, jsonb, int) from public, anon;
revoke all on function public.revoke_ai_link(uuid) from public, anon;
revoke all on function public.set_ai_links_allowed(uuid, boolean) from public, anon;
grant execute on function public.create_ai_link(uuid, text, jsonb, int) to authenticated;
grant execute on function public.revoke_ai_link(uuid) to authenticated;
grant execute on function public.set_ai_links_allowed(uuid, boolean) to authenticated;
revoke all on function public.ai_link_card(text) from public;
revoke all on function public.ai_link_pack(text, text) from public;
grant execute on function public.ai_link_card(text) to anon, authenticated;
grant execute on function public.ai_link_pack(text, text) to anon, authenticated;
revoke all on case_ai_links from anon;
revoke all on ai_link_rate from anon, authenticated;
grant select on case_ai_links to authenticated;

-- The creator's outreach insert policy already covers the new columns. Reddit rows keep the same rules.
