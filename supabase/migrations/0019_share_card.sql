-- The share card ("the empty seat"): which skill a case needs most and which professions already help.
-- Only labels and counts, never names. Readable signed out when the public preview is on, and by the case's own members.
create or replace function public.case_share_card(c uuid)
returns table (
  cancer_type text,
  cancer_stage text,
  needed text[],
  seats text[],
  public_preview boolean
) language sql stable security definer set search_path = public, private, pg_temp as $$
  with pc as (
    select * from cases
    where id = c and not is_sample and (public_preview or private.is_case_member(c))
  ),
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
    pc.cancer_type,
    pc.cancer_stage,
    coalesce((select array_agg(distinct w.expertise::text) from wanted w
              where w.expertise <> 'no_medical'
                and not exists (select 1 from members m where m.expertise = w.expertise)), '{}'),
    coalesce((select array_agg(s.e) from (
                select m.expertise::text as e from members m where m.helper
                group by m.expertise order by count(*) desc, m.expertise::text limit 3) s), '{}'),
    pc.public_preview
  from pc;
$$;
revoke all on function public.case_share_card(uuid) from public;
grant execute on function public.case_share_card(uuid) to anon, authenticated;
