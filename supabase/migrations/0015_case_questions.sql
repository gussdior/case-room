-- Visitors ask the team a question from the public preview, before joining.
-- Asking, replying and publishing all go through the functions below.

create table case_questions (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references cases (id) on delete cascade,
  asker_id uuid not null references profiles (id) on delete cascade,
  body text not null check (char_length(body) between 3 and 500),
  reply text check (char_length(reply) <= 1000),
  replied_by uuid references profiles (id) on delete set null,
  replied_at timestamptz,
  public boolean not null default false,
  created_at timestamptz not null default now()
);
create index case_questions_case on case_questions (case_id, created_at desc);
create index case_questions_asker on case_questions (asker_id, case_id);
alter table case_questions enable row level security;

-- The asker reads their own questions; approved members read every question on their case.
create policy questions_read on case_questions for select to authenticated using (
  asker_id = auth.uid() or private.is_case_member(case_id)
);
-- No direct insert or update: use the functions.

-- Ask a question. Only when the public preview is on, only for people not already on the case,
-- at most 3 unanswered questions per person per case. The app scrubs names and IDs before calling.
create or replace function public.ask_case_question(c uuid, p_body text)
returns uuid language plpgsql security definer set search_path = public, private, pg_temp as $$
declare me uuid := auth.uid(); b text := btrim(coalesce(p_body, '')); new_id uuid;
begin
  if me is null then raise exception 'Sign in first'; end if;
  if char_length(b) < 3 then raise exception 'Write a question first'; end if;
  if char_length(b) > 500 then raise exception 'Keep it under 500 characters'; end if;
  if not exists (select 1 from cases where id = c and public_preview and not is_sample) then
    raise exception 'This case is not taking questions';
  end if;
  if exists (select 1 from case_members where case_id = c and user_id = me and status = 'approved') then
    raise exception 'You are already on this case. Ask in the discussion instead';
  end if;
  if (select count(*) from case_questions where case_id = c and asker_id = me and reply is null) >= 3 then
    raise exception 'You have 3 questions waiting for a reply. Wait for an answer first';
  end if;
  insert into case_questions (case_id, asker_id, body) values (c, me, b) returning id into new_id;
  return new_id;
end; $$;

-- Any approved member replies.
create or replace function public.answer_case_question(q uuid, p_reply text)
returns void language plpgsql security definer set search_path = public, private, pg_temp as $$
declare r case_questions; t text := btrim(coalesce(p_reply, ''));
begin
  select * into r from case_questions where id = q;
  if r.id is null or not private.is_case_member(r.case_id) then raise exception 'Question not found'; end if;
  if char_length(t) < 2 then raise exception 'Write a reply first'; end if;
  if char_length(t) > 1000 then raise exception 'Keep the reply under 1000 characters'; end if;
  update case_questions set reply = t, replied_by = auth.uid(), replied_at = now() where id = q;
end; $$;

-- The creator or co-approver chooses which answered questions show on the public page.
create or replace function public.set_question_public(q uuid, p_public boolean)
returns void language plpgsql security definer set search_path = public, private, pg_temp as $$
declare r case_questions;
begin
  select * into r from case_questions where id = q;
  if r.id is null or not private.is_case_admin(r.case_id) then raise exception 'Only the case creator or co-approver can do this'; end if;
  if p_public and r.reply is null then raise exception 'Reply first, then show it on the public page'; end if;
  update case_questions set public = p_public where id = q;
end; $$;

-- The team inbox. Returns only the asker's initial and role, never their full profile.
create or replace function public.case_questions_for_team(c uuid)
returns table (
  id uuid, body text, reply text, replied_at timestamptz, replied_by_name text, public boolean, created_at timestamptz,
  asker_id uuid, asker_initial text, asker_role_title text, asker_expertise expertise, asker_status member_status
) language sql stable security definer set search_path = public, private, pg_temp as $$
  select q.id, q.body, q.reply, q.replied_at, rp.display_name, q.public, q.created_at,
         q.asker_id, upper(left(regexp_replace(coalesce(p.display_name, '?'), '^Dr\.?\s+', ''), 1)),
         p.role_title, p.expertise, m.status
  from case_questions q
  join profiles p on p.id = q.asker_id
  left join profiles rp on rp.id = q.replied_by
  left join case_members m on m.case_id = q.case_id and m.user_id = q.asker_id
  where q.case_id = c and private.is_case_member(c)
  order by (q.reply is null) desc, q.created_at desc;
$$;

-- Invite the person who asked: approve a pending request, or add them as an approved volunteer.
create or replace function public.invite_question_asker(q uuid)
returns void language plpgsql security definer set search_path = public, private, pg_temp as $$
declare r case_questions; st member_status;
begin
  select * into r from case_questions where id = q;
  if r.id is null or not private.is_case_admin(r.case_id) then raise exception 'Only the case creator or co-approver can invite'; end if;
  select status into st from case_members where case_id = r.case_id and user_id = r.asker_id;
  if st = 'approved' then raise exception 'They are already on the case'; end if;
  if st is null then
    insert into case_members (case_id, user_id, role, status, request_note, decided_by, decided_at)
      values (r.case_id, r.asker_id, 'volunteer', 'approved', 'Invited after asking a question', auth.uid(), now());
  else
    update case_members set status = 'approved', decided_by = auth.uid(), decided_at = now()
      where case_id = r.case_id and user_id = r.asker_id;
  end if;
  insert into notifications (user_id, case_id, kind, payload) values (r.asker_id, r.case_id, 'join_approved', '{}');
end; $$;

-- Answered questions the team chose to show, for anyone viewing the public preview. Never names.
create or replace function public.public_case_questions(c uuid)
returns table (body text, reply text)
language sql stable security definer set search_path = public, private, pg_temp as $$
  select q.body, q.reply from case_questions q join cases cs on cs.id = q.case_id
  where q.case_id = c and cs.public_preview and q.public and q.reply is not null
  order by q.replied_at desc limit 20;
$$;

revoke all on case_questions from anon;
grant select on case_questions to authenticated;
revoke all on function public.ask_case_question(uuid, text) from public, anon;
revoke all on function public.answer_case_question(uuid, text) from public, anon;
revoke all on function public.set_question_public(uuid, boolean) from public, anon;
revoke all on function public.case_questions_for_team(uuid) from public, anon;
revoke all on function public.invite_question_asker(uuid) from public, anon;
grant execute on function public.ask_case_question(uuid, text) to authenticated;
grant execute on function public.answer_case_question(uuid, text) to authenticated;
grant execute on function public.set_question_public(uuid, boolean) to authenticated;
grant execute on function public.case_questions_for_team(uuid) to authenticated;
grant execute on function public.invite_question_asker(uuid) to authenticated;
revoke all on function public.public_case_questions(uuid) from public;
grant execute on function public.public_case_questions(uuid) to anon, authenticated;
