-- Start a case from documents: private drafts, uploaded documents, and one publish call.

-- Brief sections can carry a note about where their starting text came from.
alter table brief_sections add column if not exists source_note text;

create table case_drafts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references profiles(id) on delete cascade,
  status text not null default 'editing' check (status in ('editing', 'published')),
  answers jsonb not null default '{}'::jsonb,          -- step 1: relationship, consent, wants_to_know
  facts jsonb not null default '[]'::jsonb,            -- [{field, value, doc, page, quote}]
  sections jsonb not null default '{}'::jsonb,         -- {key: {text, citations[], questions[]}}
  treatments jsonb not null default '[]'::jsonb,       -- [{title, started, ended, outcome, note}]
  suggested_tasks jsonb not null default '[]'::jsonb,  -- [{id, title, why, expertise, section, minutes, picked}]
  identifiers jsonb not null default '{}'::jsonb,      -- {type: count}, never the values
  confirmations jsonb not null default '{}'::jsonb,    -- {key: true}
  cancer_type text check (char_length(cancer_type) <= 60),
  visit_date date,
  privacy_ok boolean not null default false,
  keep_files boolean not null default true,
  case_id uuid references cases(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index case_drafts_owner on case_drafts(owner_id, updated_at desc);
alter table case_drafts enable row level security;
create policy drafts_read on case_drafts for select to authenticated using (owner_id = auth.uid());
create policy drafts_insert on case_drafts for insert to authenticated
  with check (owner_id = auth.uid() and status = 'editing' and case_id is null);
create policy drafts_update on case_drafts for update to authenticated
  using (owner_id = auth.uid() and status = 'editing')
  with check (owner_id = auth.uid() and status = 'editing' and case_id is null);
create policy drafts_delete on case_drafts for delete to authenticated using (owner_id = auth.uid());

create table case_documents (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid not null references case_drafts(id) on delete cascade,
  owner_id uuid not null default auth.uid() references profiles(id) on delete cascade,
  storage_path text not null unique,
  filename text not null check (char_length(filename) between 1 and 200),
  mime text not null check (mime in ('application/pdf', 'image/jpeg', 'image/png', 'image/heic', 'image/heif', 'image/webp')),
  size_bytes int not null check (size_bytes between 1 and 20971520),
  pages int,
  status text not null default 'uploaded' check (status in ('uploaded', 'reading', 'read', 'unreadable')),
  note text check (char_length(note) <= 300),
  label text check (char_length(label) <= 120),
  found jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index case_documents_draft on case_documents(draft_id, created_at);
alter table case_documents enable row level security;

create or replace function private.owns_draft(d uuid)
returns boolean language sql stable security definer set search_path = public, private, pg_temp as $$
  select exists (select 1 from case_drafts where id = d and owner_id = auth.uid());
$$;
revoke all on function private.owns_draft(uuid) from public, anon;
grant execute on function private.owns_draft(uuid) to authenticated;

create policy docs_read on case_documents for select to authenticated using (owner_id = auth.uid());
create policy docs_insert on case_documents for insert to authenticated with check (
  owner_id = auth.uid() and private.owns_draft(draft_id)
  and storage_path like auth.uid()::text || '/' || draft_id::text || '/%'
  and status = 'uploaded' and found = '{}'::jsonb
);
create policy docs_update on case_documents for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid() and private.owns_draft(draft_id));
create policy docs_delete on case_documents for delete to authenticated using (owner_id = auth.uid());

grant select, insert, update, delete on case_drafts, case_documents to authenticated;
revoke all on case_drafts, case_documents from anon;

-- Private storage: each person can only touch files under their own folder.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('case-docs', 'case-docs', false, 20971520,
        array['application/pdf', 'image/jpeg', 'image/png', 'image/heic', 'image/heif', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy case_docs_read on storage.objects for select to authenticated
  using (bucket_id = 'case-docs' and (storage.foldername(name))[1] = auth.uid()::text);
create policy case_docs_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'case-docs' and (storage.foldername(name))[1] = auth.uid()::text);
create policy case_docs_delete on storage.objects for delete to authenticated
  using (bucket_id = 'case-docs' and (storage.foldername(name))[1] = auth.uid()::text);

-- Publish: creates the case with its 5 sections, fills them from the confirmed draft,
-- adds treatments and only the ticked tasks. Calling it again returns the same case.
create or replace function public.publish_draft(d uuid)
returns uuid language plpgsql security definer set search_path = public, private, pg_temp as $$
declare
  r case_drafts;
  new_id uuid;
  sec uuid[] := array[]::uuid[];
  s uuid;
  t jsonb;
  wants text;
  goal text;
  plain text;
  treat text;
  now_text text;
  note constant text := 'From the family''s documents, needs a check';
  sec_key text;
  idx int;
  keys constant text[] := array['plain', 'treatments', 'now', 'visit', 'wants'];
  k text;
  d1 date;
  d2 date;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  select * into r from case_drafts where id = d and owner_id = auth.uid() for update;
  if r.id is null then raise exception 'Draft not found'; end if;
  if r.case_id is not null then return r.case_id; end if;

  if coalesce(r.answers->>'consent', '') <> 'true' then
    raise exception 'Patient consent is required';
  end if;
  if not r.privacy_ok then raise exception 'Finish the privacy check first'; end if;
  foreach k in array keys loop
    if coalesce(r.confirmations->>k, '') <> 'true' then
      raise exception 'Confirm every part of the draft first';
    end if;
  end loop;

  wants := left(trim(coalesce(r.sections->'wants'->>'text', r.answers->>'wants_to_know', '')), 4000);
  plain := left(trim(coalesce(r.sections->'plain'->>'text', '')), 4000);
  treat := left(trim(coalesce(r.sections->'treatments'->>'text', '')), 4000);
  now_text := left(trim(coalesce(r.sections->'now'->>'text', '')), 4000);
  goal := left(coalesce(nullif(regexp_replace(wants, '\s+', ' ', 'g'), ''),
                        'Find the best next options to discuss with the oncologist'), 200);

  insert into cases (created_by, goal, summary, consent_confirmed, visit_date, cancer_type)
    values (auth.uid(), goal,
            left(concat_ws(E'\n\n', nullif(plain, ''), nullif(treat, ''), nullif(now_text, '')), 4000),
            true, r.visit_date, nullif(trim(coalesce(r.cancer_type, '')), ''))
    returning id into new_id;
  insert into case_members (case_id, user_id, role, status, decided_by, decided_at)
    values (new_id, auth.uid(), 'creator', 'approved', auth.uid(), now());

  insert into brief_sections (case_id, position, title, body, source_note)
    values (new_id, 1, 'The case in plain words',
            nullif(concat_ws(E'\n\n', nullif(plain, ''), nullif(treat, '')), ''), note) returning id into s;
  sec := sec || s;
  insert into brief_sections (case_id, position, title, body, source_note)
    values (new_id, 2, 'What is happening now', nullif(now_text, ''), case when now_text <> '' then note end) returning id into s;
  sec := sec || s;
  insert into brief_sections (case_id, position, title) values (new_id, 3, 'Options to ask about') returning id into s;
  sec := sec || s;
  insert into brief_sections (case_id, position, title) values (new_id, 4, 'Access and cost') returning id into s;
  sec := sec || s;
  insert into brief_sections (case_id, position, title, body, source_note)
    values (new_id, 5, 'Questions for the doctor',
            case when wants <> '' then 'What the family wants to know: ' || wants end,
            case when wants <> '' then 'From the family' end) returning id into s;
  sec := sec || s;

  for t in select * from jsonb_array_elements(coalesce(r.treatments, '[]'::jsonb)) loop
    continue when coalesce(trim(t->>'title'), '') = '';
    d1 := case when coalesce(t->>'started', '') ~ '^\d{4}-(0[1-9]|1[0-2])$' then (t->>'started' || '-01')::date end;
    d2 := case when coalesce(t->>'ended', '') ~ '^\d{4}-(0[1-9]|1[0-2])$' then (t->>'ended' || '-01')::date end;
    -- Keep dates sane if the AI got an end before a start.
    if d1 is not null and d2 is not null and d2 < d1 then d2 := null; end if;
    insert into treatments (case_id, title, details, started_on, ended_on, outcome, outcome_note, created_by)
    values (
      new_id, left(trim(t->>'title'), 160), left(coalesce(t->>'details', ''), 1000), d1, d2,
      case when t->>'outcome' in ('worked', 'stopped_working', 'side_effects', 'waiting', 'unknown')
           then (t->>'outcome')::treatment_outcome else 'unknown' end,
      left(coalesce(t->>'note', ''), 160),
      auth.uid()
    );
  end loop;

  for t in select * from jsonb_array_elements(coalesce(r.suggested_tasks, '[]'::jsonb)) loop
    continue when coalesce(t->>'picked', '') <> 'true' or coalesce(trim(t->>'title'), '') = '';
    sec_key := coalesce(t->>'section', 'options');
    idx := case sec_key when 'plain' then 1 when 'now' then 2 when 'options' then 3 when 'access' then 4
                        when 'questions' then 5 else 3 end;
    insert into tasks (case_id, section_id, title, why_it_matters, done_looks_like, expertise, minutes, created_by)
    values (
      new_id, sec[idx], left(trim(t->>'title'), 200), left(coalesce(t->>'why', ''), 500),
      coalesce((select array_agg(left(x, 200)) from (select jsonb_array_elements_text(
        case when jsonb_typeof(t->'done') = 'array' then t->'done' else '[]'::jsonb end) x limit 6) q), array[]::text[]),
      case when t->>'expertise' in ('doctor_nurse', 'researcher', 'bioinformatics', 'insurance_legal', 'no_medical')
           then (t->>'expertise')::expertise else 'no_medical' end,
      least(greatest(case when coalesce(t->>'minutes', '') ~ '^\d{1,3}$' then (t->>'minutes')::int else 45 end, 10), 240),
      auth.uid()
    );
  end loop;

  update case_drafts set status = 'published', case_id = new_id, updated_at = now() where id = d;
  return new_id;
end $$;
revoke all on function public.publish_draft(uuid) from public, anon;
grant execute on function public.publish_draft(uuid) to authenticated;
