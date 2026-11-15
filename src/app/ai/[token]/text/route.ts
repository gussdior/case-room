import { loadAiPack, packToMarkdown, siteOrigin } from "@/lib/ai-link";

const HEADERS = { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex, nofollow" };

/** The same case text as the page, as plain markdown. For AIs and tools that read text better than pages. */
export async function GET(_: Request, ctx: RouteContext<"/ai/[token]/text">) {
  const { token } = await ctx.params;
  const r = await loadAiPack(token);
  if (r.status === "busy") return new Response("This link is being opened a lot right now. Try again in a minute.", { status: 429, headers: HEADERS });
  if (r.status === "gone") return new Response("This link is no longer active. Ask the person who shared it for a new one.", { status: 410, headers: HEADERS });
  return new Response(packToMarkdown(r.pack, await siteOrigin()), { headers: HEADERS });
}
