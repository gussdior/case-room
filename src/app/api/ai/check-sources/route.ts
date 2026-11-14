import { createClient } from "@/lib/supabase/server";
import { NCT_RE } from "@/lib/ai/tools";

export const maxDuration = 30;

const OPEN = new Set(["RECRUITING", "NOT_YET_RECRUITING", "ENROLLING_BY_INVITATION", "AVAILABLE"]);

type Check = { url: string; ok: boolean; note: string };

// Only public web addresses. No IP literals, localhost or internal names, so this can't probe private networks.
function publicHttps(raw: string): URL | null {
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    const h = u.hostname.toLowerCase();
    if (h === "localhost" || h.endsWith(".local") || h.endsWith(".internal") || h.endsWith(".localhost")) return null;
    if (/^[\d.]+$/.test(h) || h.includes(":") || !h.includes(".")) return null;
    if (u.username || u.password) return null;
    return u;
  } catch {
    return null;
  }
}

async function checkTrial(url: string, id: string): Promise<Check> {
  try {
    const res = await fetch(`https://clinicaltrials.gov/api/v2/studies/${id}?format=json&fields=OverallStatus,BriefTitle`, {
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });
    if (res.status === 404) return { url, ok: false, note: `${id} was not found on ClinicalTrials.gov.` };
    if (!res.ok) return { url, ok: false, note: "Couldn't reach ClinicalTrials.gov. Check this one by hand." };
    const data = (await res.json()) as { protocolSection?: { statusModule?: { overallStatus?: string } } };
    const status = data.protocolSection?.statusModule?.overallStatus ?? "UNKNOWN";
    const words = status.toLowerCase().replace(/_/g, " ");
    return OPEN.has(status)
      ? { url, ok: true, note: `${id} is ${words}.` }
      : { url, ok: false, note: `${id} is ${words}, so it is not taking new patients.` };
  } catch {
    return { url, ok: false, note: "ClinicalTrials.gov took too long. Check this one by hand." };
  }
}

async function checkLink(url: string): Promise<Check> {
  const u = publicHttps(url);
  if (!u) return { url, ok: false, note: "This isn't a public web link." };
  const attempt = (method: "HEAD" | "GET") =>
    fetch(u, {
      method,
      redirect: "manual",
      signal: AbortSignal.timeout(8_000),
      cache: "no-store",
      headers: { "user-agent": "CaseRoom/1.0 (source check)" },
    });
  try {
    let res = await attempt("HEAD");
    if (res.status === 405 || res.status === 403) res = await attempt("GET");
    if (res.status >= 200 && res.status < 400) return { url, ok: true, note: "The link opens." };
    if (res.status === 404 || res.status === 410) return { url, ok: false, note: "This page doesn't exist anymore." };
    return { url, ok: true, note: `The site answered ${res.status}. Open it to make sure it works.` };
  } catch {
    return { url, ok: false, note: "The link didn't open. Check it by hand." };
  }
}

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

  const list = [...new Set((urls as string[]).map((u) => u.trim()).filter(Boolean))].slice(0, 20);
  const results = await Promise.all(
    list.map((url) => {
      const id = url.match(NCT_RE)?.[0]?.toUpperCase();
      return id && /clinicaltrials\.gov/i.test(url) ? checkTrial(url, id) : checkLink(url);
    }),
  );
  return Response.json({ results, allOk: results.every((r) => r.ok) });
}
