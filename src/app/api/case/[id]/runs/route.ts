import { revalidatePath } from "next/cache";
import { checkUrls, linksIn, sourcesFromLinks } from "@/lib/ai/check";
import { saveRun } from "@/lib/ai/runs";
import { createClient } from "@/lib/supabase/server";
import { UUID_RE } from "@/lib/time";
import { aiLimit } from "@/lib/ai/limits";
import type { AiTool } from "@/lib/types";

export const maxDuration = 60;

const PASTED: AiTool[] = ["chatgpt", "claude", "gemini", "other"];

type Body = { leadId?: unknown; taskId?: unknown; tool?: unknown; toolOther?: unknown; prompt?: unknown; result?: unknown };

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** Save what someone's own AI found: check every link, clean out names and IDs, then save it as a run. */
export async function POST(req: Request, ctx: RouteContext<"/api/case/[id]/runs">) {
  const { id } = await ctx.params;
  if (!UUID_RE.test(id)) return Response.json({ error: "That case link is broken." }, { status: 400 });
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return Response.json({ error: "Send JSON." }, { status: 400 });
  }
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub as string | undefined;
  if (!userId) return Response.json({ error: "Sign in first." }, { status: 401 });

  const tool = str(body.tool, 20) as AiTool;
  const prompt = str(body.prompt, 4000);
  const result = str(body.result, 20000);
  const leadId = str(body.leadId, 40) || null;
  const taskId = str(body.taskId, 40) || null;
  if (!PASTED.includes(tool)) return Response.json({ error: "Pick which AI you used." }, { status: 400 });
  if (prompt.length < 2) return Response.json({ error: "Add the prompt you used." }, { status: 400 });
  if (result.length < 2) return Response.json({ error: "Paste what the AI said." }, { status: 400 });
  if ((leadId && !UUID_RE.test(leadId)) || (taskId && !UUID_RE.test(taskId)))
    return Response.json({ error: "That link is broken." }, { status: 400 });

  // Membership: row level security only returns the case, lead and task to approved members.
  const [{ data: kase }, lead, task] = await Promise.all([
    supabase.from("cases").select("id").eq("id", id).maybeSingle(),
    leadId ? supabase.from("leads").select("id").eq("id", leadId).eq("case_id", id).maybeSingle() : Promise.resolve({ data: null }),
    taskId ? supabase.from("tasks").select("id").eq("id", taskId).eq("case_id", id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  if (!kase) return Response.json({ error: "Join this case first." }, { status: 403 });
  if (leadId && !lead.data) return Response.json({ error: "That lead isn't in this case." }, { status: 400 });
  if (taskId && !task.data) return Response.json({ error: "That task isn't in this case." }, { status: 400 });

  const limited = await aiLimit(supabase, "runs");
  if (limited) return limited;
  const links = linksIn(result);
  const results = await checkUrls(links);
  const check = { results, ok: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok).length };
  const saved = await saveRun(supabase, userId, {
    caseId: id,
    leadId,
    taskId,
    tool,
    toolOther: tool === "other" ? str(body.toolOther, 60) : null,
    prompt,
    result,
    sources: sourcesFromLinks(links),
    check,
  });
  if (saved.error) return Response.json({ error: saved.error }, { status: 400 });
  revalidatePath(`/case/${id}`, "layout");
  return Response.json({ id: saved.id, check, noLinks: links.length === 0 });
}
