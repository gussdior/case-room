-- Day one value and lead taking.
-- Case facts shown under the title, who is working on a lead, and the AI's first brief draft.

alter table cases
  add column if not exists age_range text
    check (age_range is null or age_range in ('under_18', '18_34', '35_54', '55_64', '65_74', '75_plus')),
  add column if not exists current_treatment text
    check (current_treatment is null or char_length(current_treatment) <= 80);

-- Admins set the goal (title) and the short facts. Null goal keeps the current one.
create or replace function public.set_case_facts(c uuid, p_goal text, p_age_range text, p_current_treatment text)
returns void language plpgsql security definer set search_path = public, private, pg_temp as $$
declare g text := nullif(regexp_replace(trim(coalesce(p_goal, '')), '\s+', ' ', 'g'), '');
begin
  if not private.is_case_admin(c) then raise exception 'Only the case creator or co-approver can change this'; end if;
  if g is not null and char_length(g) not between 10 and 200 then
    raise exception 'Write the goal as a sentence of 10 to 200 characters';
  end if;
  update cases set
    goal = coalesce(g, goal),
    age_range = nullif(trim(coalesce(p_age_range, '')), ''),
    current_treatment = nullif(left(trim(coalesce(p_current_treatment, '')), 80), '')
  where id = c;
end $$;
revoke all on function public.set_case_facts(uuid, text, text, text) from public, anon;
grant execute on function public.set_case_facts(uuid, text, text, text) to authenticated;

-- Who is working on a lead.
create table if not exists lead_members (
  lead_id uuid not null references leads(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (lead_id, user_id)
);
alter table lead_members enable row level security;
create policy lead_members_read on lead_members for select to authenticated using (
  private.is_case_member(private.lead_case(lead_id))
);
-- Writes only through take_lead.
revoke all on lead_members from anon;
grant select on lead_members to authenticated;

create or replace function public.take_lead(l uuid)
returns void language plpgsql security definer set search_path = public, private, pg_temp as $$
declare r leads;
begin
  select * into r from leads where id = l for update;
  if r.id is null or not private.is_case_member(r.case_id) then raise exception 'Lead not found'; end if;
  if r.status = 'ruled_out' then raise exception 'This lead was ruled out'; end if;
  insert into lead_members (lead_id, user_id) values (l, auth.uid()) on conflict do nothing;
  if not found then return; end if;
  if r.status = 'needs_someone' then
    update leads set status = 'exploring', updated_at = now() where id = l;
  end if;
  insert into lead_events (lead_id, user_id, detail) values (l, auth.uid(), 'Took this lead');
end $$;
revoke all on function public.take_lead(uuid) from public, anon;
grant execute on function public.take_lead(uuid) to authenticated;

-- The AI's first draft of the brief. Fills only empty sections, always labeled.
create or replace function public.save_ai_brief_draft(c uuid, p_sections jsonb)
returns int language plpgsql security definer set search_path = public, private, pg_temp as $$
declare e jsonb; n int := 0; b text;
begin
  if not private.is_case_admin(c) then raise exception 'Only the case creator or co-approver can do this'; end if;
  if jsonb_typeof(p_sections) <> 'array' then raise exception 'Sections must be a list'; end if;
  for e in select * from jsonb_array_elements(p_sections) loop
    b := left(trim(coalesce(e->>'body', '')), 4000);
    if b = '' then continue; end if;
    update brief_sections set body = b, source_note = 'AI draft, not yet checked by a person'
      where id = (e->>'id')::uuid and case_id = c and trim(body) = '';
    if found then n := n + 1; end if;
  end loop;
  return n;
end $$;
revoke all on function public.save_ai_brief_draft(uuid, jsonb) from public, anon;
grant execute on function public.save_ai_brief_draft(uuid, jsonb) to authenticated;

-- At case creation: the same facts plus cancer type and stage. Null cancer type or stage keeps the current value.
create or replace function public.set_case_facts(c uuid, p_goal text, p_age_range text, p_current_treatment text,
  p_cancer_type text, p_cancer_stage text)
returns void language plpgsql security definer set search_path = public, private, pg_temp as $$
begin
  perform public.set_case_facts(c, p_goal, p_age_range, p_current_treatment);
  update cases set
    cancer_type = coalesce(nullif(left(trim(coalesce(p_cancer_type, '')), 60), ''), cancer_type),
    cancer_stage = coalesce(nullif(left(trim(coalesce(p_cancer_stage, '')), 40), ''), cancer_stage)
  where id = c;
end $$;
revoke all on function public.set_case_facts(uuid, text, text, text, text, text) from public, anon;
grant execute on function public.set_case_facts(uuid, text, text, text, text, text) to authenticated;
