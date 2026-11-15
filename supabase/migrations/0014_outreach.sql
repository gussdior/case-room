-- Find your helpers: AI written posts per case, for the creator only.
-- Regenerating archives the old set instead of removing rows.

create or replace function private.is_case_creator(c uuid)
returns boolean language sql stable security definer set search_path = public, private, pg_temp as $$
  select exists (select 1 from case_members where case_id = c and user_id = auth.uid()
                 and role = 'creator' and status = 'approved');
$$;
revoke all on function private.is_case_creator(uuid) from public, anon;
grant execute on function private.is_case_creator(uuid) to authenticated;

create table case_outreach (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references cases (id) on delete cascade,
  place text not null check (char_length(place) between 2 and 120),
  kind text not null check (kind in ('patients', 'science', 'clinicians', 'people_you_know', 'other')),
  skill expertise,
  why text not null default '' check (char_length(why) <= 400),
  post text not null check (char_length(post) between 20 and 2000),
  community boolean not null default false,
  posted boolean not null default false,
  posted_at timestamptz,
  archived boolean not null default false,
  created_by uuid not null references profiles (id),
  created_at timestamptz not null default now()
);
create index case_outreach_case on case_outreach (case_id, archived, created_at);
alter table case_outreach enable row level security;

create policy outreach_read on case_outreach for select to authenticated using (private.is_case_creator(case_id));
create policy outreach_insert on case_outreach for insert to authenticated with check (
  private.is_case_creator(case_id) and created_by = auth.uid() and posted = false and posted_at is null and archived = false
);
-- Updates only for the posted checkbox and archiving, through the RPCs below.

create or replace function public.set_outreach_posted(o uuid, p_posted boolean)
returns void language plpgsql security definer set search_path = public, private, pg_temp as $$
declare r case_outreach;
begin
  select * into r from case_outreach where id = o;
  if r.id is null or not private.is_case_creator(r.case_id) then raise exception 'Not found'; end if;
  update case_outreach set posted = p_posted, posted_at = case when p_posted then coalesce(posted_at, now()) else null end
  where id = o;
end; $$;

create or replace function public.archive_outreach(c uuid)
returns void language plpgsql security definer set search_path = public, private, pg_temp as $$
begin
  if not private.is_case_creator(c) then raise exception 'Only the case creator can do this'; end if;
  update case_outreach set archived = true where case_id = c and not archived;
end; $$;

-- The creator turns the public preview on from the share page.
create or replace function public.set_public_preview(c uuid, p_on boolean)
returns void language plpgsql security definer set search_path = public, private, pg_temp as $$
begin
  if not private.is_case_creator(c) then raise exception 'Only the case creator can change the public preview'; end if;
  if exists (select 1 from cases where id = c and is_sample) then raise exception 'Not for the sample case'; end if;
  update cases set public_preview = p_on or listed where id = c;
end; $$;

-- Places posted, and how many people asked to join since the first post.
create or replace function public.outreach_stats(c uuid)
returns jsonb language plpgsql stable security definer set search_path = public, private, pg_temp as $$
declare first_at timestamptz; posted_n int; asked int;
begin
  if not private.is_case_creator(c) then raise exception 'Only the case creator can see this'; end if;
  select min(posted_at), count(*) filter (where posted) into first_at, posted_n
    from case_outreach where case_id = c and not archived;
  select count(*) into asked from case_members
    where case_id = c and role = 'volunteer' and first_at is not null and created_at >= first_at;
  return jsonb_build_object('posted', coalesce(posted_n, 0), 'asked', coalesce(asked, 0), 'since', first_at);
end; $$;

revoke all on function public.set_outreach_posted(uuid, boolean) from public, anon;
revoke all on function public.archive_outreach(uuid) from public, anon;
revoke all on function public.set_public_preview(uuid, boolean) from public, anon;
revoke all on function public.outreach_stats(uuid) from public, anon;
grant execute on function public.set_outreach_posted(uuid, boolean) to authenticated;
grant execute on function public.archive_outreach(uuid) to authenticated;
grant execute on function public.set_public_preview(uuid, boolean) to authenticated;
grant execute on function public.outreach_stats(uuid) to authenticated;
revoke all on case_outreach from anon;
grant select, insert on case_outreach to authenticated;
