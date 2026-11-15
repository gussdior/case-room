-- Public preview of a shared case link. Account soft delete column.

alter table cases
  add column if not exists public_preview boolean not null default false,
  add column if not exists preview_show_visit boolean not null default true;

-- A listed case always has a public preview.
update cases set public_preview = true where listed and not public_preview;

alter table profiles add column if not exists deleted_at timestamptz;

-- What anyone with a shared link may see. Nothing else, and only when the creator turned it on.
create or replace function public.case_preview(c uuid)
returns table (
  case_id uuid,
  goal text,
  cancer_type text,
  cancer_stage text,
  visit_in_days int,
  needed text[],
  helpers int,
  join_mode join_mode
) language sql stable security definer set search_path = public, private, pg_temp as $$
  with pc as (select * from cases where id = c and public_preview and not is_sample),
  members as (
    select m.expertise, m.role in ('volunteer', 'co_approver') as helper
    from case_members m join pc on pc.id = m.case_id where m.status = 'approved'
  ),
  wanted as (
    select t.expertise from tasks t join pc on pc.id = t.case_id where t.status = 'open'
    union
    select l.next_step_expertise from leads l join pc on pc.id = l.case_id
      where l.status in ('needs_someone', 'exploring') and l.next_step_expertise is not null
  )
  select
    pc.id,
    pc.goal,
    pc.cancer_type,
    pc.cancer_stage,
    case when pc.preview_show_visit and pc.visit_date is not null then (pc.visit_date - current_date)::int end,
    coalesce((select array_agg(distinct w.expertise::text) from wanted w
              where w.expertise <> 'no_medical'
                and not exists (select 1 from members m where m.expertise = w.expertise)), '{}'),
    (select count(*)::int from members m where m.helper),
    pc.join_mode
  from pc;
$$;
revoke all on function public.case_preview(uuid) from public;
grant execute on function public.case_preview(uuid) to anon, authenticated;

-- Settings with the public preview switches. Older versions keep working.
create or replace function public.update_case_settings(
  c uuid, p_goal text, p_summary text, p_visit date, p_join_mode join_mode,
  p_listed boolean, p_cancer_type text, p_public_goal text, p_cancer_stage text,
  p_public_preview boolean, p_preview_show_visit boolean
) returns void language plpgsql security definer set search_path = public, private, pg_temp as $$
declare
  is_creator boolean := exists (select 1 from case_members where case_id = c and user_id = auth.uid()
                                and role = 'creator' and status = 'approved');
  cur cases;
  want_preview boolean;
begin
  if not private.is_case_admin(c) then raise exception 'Only the case creator or co-approver can change settings'; end if;
  select * into cur from cases where id = c;
  want_preview := coalesce(p_public_preview, cur.public_preview) or coalesce(p_listed, cur.listed);
  if (want_preview is distinct from cur.public_preview
      or coalesce(p_preview_show_visit, cur.preview_show_visit) is distinct from cur.preview_show_visit)
     and not is_creator then
    raise exception 'Only the case creator can change the public preview';
  end if;
  -- The 9 argument version checks listing, goal and stage rules.
  perform public.update_case_settings(c, p_goal, p_summary, p_visit, p_join_mode,
    p_listed, p_cancer_type, p_public_goal, p_cancer_stage);
  update cases set
    public_preview = want_preview,
    preview_show_visit = coalesce(p_preview_show_visit, preview_show_visit)
  where id = c;
end; $$;
revoke execute on function public.update_case_settings(uuid, text, text, date, join_mode, boolean, text, text, text, boolean, boolean) from public, anon;
grant execute on function public.update_case_settings(uuid, text, text, date, join_mode, boolean, text, text, text, boolean, boolean) to authenticated;

