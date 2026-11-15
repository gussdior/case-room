import { createClient } from "@/lib/supabase/server";
import { checkUrls } from "@/lib/ai/check";
import { aiLimit } from "@/lib/ai/limits";
import { UUID_RE } from "@/lib/time";

export const maxDuration = 30;

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) return Response.json({ error: "Sign in to check sources." }, { status: 401 });

  let body: { urls?: unknown; caseId?: unknown };
  try {
    body = (await req.json()) as { urls?: unknown; caseId?: unknown };
  } catch {
    return Response.json({ error: "Send JSON with a caseId and a urls list." }, { status: 400 });
  }
  const { urls, caseId } = body;
  if (typeof caseId !== "string" || !UUID_RE.test(caseId))
    return Response.json({ error: "Send JSON with a caseId and a urls list." }, { status: 400 });
  if (!Array.isArray(urls) || urls.some((u) => typeof u !== "string"))
    return Response.json({ error: "Send JSON with a caseId and a urls list." }, { status: 400 });

  // Only members of the case can use the link checker. Row level security returns the case only to them.
  const { data: kase } = await supabase.from("cases").select("id").eq("id", caseId).maybeSingle();
  if (!kase) return Response.json({ error: "Join this case to check sources." }, { status: 403 });

  const limited = await aiLimit(supabase, "check_sources");
  if (limited) return limited;

  const results = await checkUrls(urls as string[]);
  return Response.json({ results, allOk: results.every((r) => r.ok) });
}
