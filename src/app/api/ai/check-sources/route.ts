import { createClient } from "@/lib/supabase/server";
import { checkUrls } from "@/lib/ai/check";

export const maxDuration = 30;

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) return Response.json({ error: "Sign in to check sources." }, { status: 401 });

  let urls: unknown;
  try {
    urls = ((await req.json()) as { urls?: unknown }).urls;
  } catch {
    return Response.json({ error: "Send JSON with a urls list." }, { status: 400 });
  }
  if (!Array.isArray(urls) || urls.some((u) => typeof u !== "string"))
    return Response.json({ error: "Send JSON with a urls list." }, { status: 400 });

  const results = await checkUrls(urls as string[]);
  return Response.json({ results, allOk: results.every((r) => r.ok) });
}
