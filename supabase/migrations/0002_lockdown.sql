-- Lock down functions flagged by the Supabase security advisor.
-- 1. Internal helpers used by access rules move to a private schema that the web API does not expose.
-- 2. Nothing is callable without signing in.
-- 3. Trigger functions can't be called directly.

create schema if not exists private;
grant usage on schema private to authenticated;

alter function public.is_case_member(uuid) set schema private;
alter function public.is_case_admin(uuid) set schema private;
alter function public.case_accepts_requests(uuid) set schema private;
alter function public.task_case(uuid) set schema private;
alter function public.submission_case(uuid) set schema private;

-- Functions that call the helpers by name need to find them.
alter function public.decide_join_request(uuid, uuid, boolean) set search_path = public, private;
alter function public.remove_member(uuid, uuid) set search_path = public, private;
alter function public.claim_task(uuid) set search_path = public, private;
alter function public.case_leaderboard(uuid, timestamptz) set search_path = public, private;

-- Signed-out visitors can call nothing.
revoke execute on all functions in schema public from public, anon;
revoke execute on all functions in schema private from public, anon;
alter default privileges in schema public revoke execute on functions from public, anon;

-- Helpers: only usable inside access rules by signed-in users.
grant execute on all functions in schema private to authenticated;

-- Trigger functions are not actions.
revoke execute on function public.on_submission() from authenticated;
revoke execute on function public.on_check() from authenticated;
revoke execute on function public.on_task_message() from authenticated;

-- The actions signed-in users may call.
grant execute on function public.case_teaser(uuid) to authenticated;
grant execute on function public.create_case(text, text, boolean, date) to authenticated;
grant execute on function public.decide_join_request(uuid, uuid, boolean) to authenticated;
grant execute on function public.remove_member(uuid, uuid) to authenticated;
grant execute on function public.claim_task(uuid) to authenticated;
grant execute on function public.accept_helper(uuid, uuid) to authenticated;
grant execute on function public.set_task_stuck(uuid, boolean) to authenticated;
grant execute on function public.release_task(uuid) to authenticated;
grant execute on function public.case_leaderboard(uuid, timestamptz) to authenticated;
