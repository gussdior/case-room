import { revalidatePath } from "next/cache";
import { draftBrief } from "@/lib/ai/draft-brief";
import { suggestLeads } from "@/lib/ai/suggest-leads";
import { createClient } from "@/lib/supabase/server";
import { aiLimit } from "@/lib/ai/limits";
import { UUID_RE } from "@/lib/time";

export const maxDuration = 240;

/** Day one: the AI suggests leads and drafts the empty parts of the brief, so a family gets value before anyone joins.
 *  Case admins only. Safe to run again: it only adds leads when none were suggested and only fills empty parts. */
export async function POST(_: Request, ctx: RouteContext<"/api/case/[id]/setup-ai">) {
  const { id } = await ctx.params;
  if (!UUID_RE.test(id)) return Response.json({ error: "That case link is broken." }, { status: 400 });
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub as string | undefined;
  if (!userId) return Response.json({ error: "Sign in first." }, { status: 401 });
  const { data: me } = await supabase.from("case_members").select("role, status").eq("case_id", id).eq("user_id", userId).maybeSingle();
  if (!me || me.status !== "approved" || !["creator", "co_approver"].includes(me.role))
    return Response.json({ error: "Only the case creator or co approver can do this." }, { status: 403 });
  if (!process.env.ANTHROPIC_API_KEY)
    return Response.json({ error: "The AI isn't switched on yet. The site owner needs to add the AI key." }, { status: 503 });
  const limited = await aiLimit(supabase, "setup_ai");
  if (limited) return limited;

  const { count } = await supabase.from("leads").select("id", { count: "exact", head: true }).eq("case_id", id).eq("ai_suggested", true);
  const [leads, brief] = await Promise.all([
    (count ?? 0) > 0 ? Promise.resolve<{ added?: number; error?: string }>({ added: 0 }) : suggestLeads(supabase, id, userId),
    draftBrief(supabase, id),
  ]);
  revalidatePath(`/case/${id}`, "layout");
  const error = leads.error && brief.error ? leads.error : undefined;
  return Response.json(
    { leads: leads.added ?? 0, sections: brief.filled ?? 0, error, partial: !!(leads.error || brief.error) && !error },
    { status: error ? 502 : 200 },
  );
}
