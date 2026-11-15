import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Daily AI calls allowed per person, per route. Keeps one account from using up the AI budget for every family. */
export const AI_DAILY_LIMITS = {
  read_document: 40,
  compose: 10,
  ask: 60,
  setup_ai: 5,
  suggest_leads: 5,
  outreach: 10,
  runs: 60,
  check_sources: 60,
} as const;

export type AiRoute = keyof typeof AI_DAILY_LIMITS;

export const LIMIT_MESSAGE = "Daily AI limit reached. It resets tomorrow.";
const GLOBAL_MESSAGE = "The AI has done a lot of work today and is paused until tomorrow. Try again then.";

/** Counts one call. Returns a 429 response when the person (or the whole site) is over today's limit, otherwise null. */
export async function aiLimit(supabase: SupabaseClient, route: AiRoute): Promise<Response | null> {
  const cap = Number(process.env.AI_DAILY_GLOBAL_CAP);
  const { data, error } = await supabase.rpc("bump_ai_usage", {
    p_route: route,
    p_limit: AI_DAILY_LIMITS[route],
    p_global_cap: Number.isFinite(cap) && cap > 0 ? Math.floor(cap) : null,
  });
  // If counting fails, fail closed: the AI costs money and the limit protects every family's access.
  if (error) return Response.json({ error: "Couldn't start the AI just now. Try again in a minute." }, { status: 503 });
  if (data === "ok") return null;
  return Response.json({ error: data === "global" ? GLOBAL_MESSAGE : LIMIT_MESSAGE }, { status: 429 });
}
