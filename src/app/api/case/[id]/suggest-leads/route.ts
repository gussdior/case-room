import { revalidatePath } from "next/cache";
import { suggestLeads } from "@/lib/ai/suggest-leads";
import { createClient } from "@/lib/supabase/server";
import { UUID_RE } from "@/lib/time";

export const maxDuration = 120;

/** Case admins ask the AI for 4 to 6 leads to investigate. */
export async function POST(_: Request, ctx: RouteContext<"/api/case/[id]/suggest-leads">) {
  const { id } = await ctx.params;
  if (!UUID_RE.test(id)) return Response.json({ error: "That case link is broken." }, { status: 400 });
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub as string | undefined;
  if (!userId) return Response.json({ error: "Sign in first." }, { status: 401 });
  const { data: me } = await supabase
    .from("case_members")
    .select("role, status")
    .eq("case_id", id)
    .eq("user_id", userId)
    .maybeSingle();
  if (!me || me.status !== "approved" || !["creator", "co_approver"].includes(me.role))
    return Response.json({ error: "Only the case creator or co approver can ask for suggested leads." }, { status: 403 });
  const r = await suggestLeads(supabase, id, userId);
  if (r.error) return Response.json({ error: r.error }, { status: r.error.includes("key") ? 503 : 400 });
  revalidatePath(`/case/${id}`, "layout");
  return Response.json({ added: r.added ?? 0 });
}
