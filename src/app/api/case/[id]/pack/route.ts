import { buildPack } from "@/lib/case-pack";
import { createClient } from "@/lib/supabase/server";
import { UUID_RE } from "@/lib/time";

/** The case as plain text to paste into any AI. Members only (row level security hides the case otherwise). */
export async function GET(req: Request, ctx: RouteContext<"/api/case/[id]/pack">) {
  const { id } = await ctx.params;
  if (!UUID_RE.test(id)) return Response.json({ error: "That case link is broken." }, { status: 400 });
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) return Response.json({ error: "Sign in first." }, { status: 401 });
  const lead = new URL(req.url).searchParams.get("lead");
  const pack = await buildPack(supabase, id, lead && UUID_RE.test(lead) ? lead : null);
  if (!pack) return Response.json({ error: "Join this case to copy it." }, { status: 403 });
  return new Response(pack, { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });
}
