import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { UUID_RE } from "@/lib/time";
import { composeDraft } from "@/lib/drafts/ai";
import { DRAFT_COLUMNS, loadDraft, toDraft } from "@/lib/drafts/db";
import type { IdType } from "@/lib/drafts/types";

export const maxDuration = 300;

function json(status: number, body: Record<string, unknown>) {
  return Response.json(body, { status });
}

export async function POST(_: Request, ctx: RouteContext<"/api/drafts/[id]/compose">) {
  const { id } = await ctx.params;
  if (!UUID_RE.test(id)) return json(400, { error: "That link is broken." });

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) return json(401, { error: "Sign in first." });

  const loaded = await loadDraft(supabase, id);
  if (!loaded) return json(404, { error: "Draft not found." });
  if (loaded.draft.status !== "editing") return json(409, { error: "This case is already open." });
  const read = loaded.docs.filter((d) => d.status === "read");
  if (read.length === 0) return json(400, { error: "Add at least one document the AI could read." });
  if (!process.env.ANTHROPIC_API_KEY)
    return json(503, { error: "The AI writer isn't switched on yet. The site owner needs to add an ANTHROPIC_API_KEY." });

  try {
    const result = await composeDraft(
      read.map((d) => ({
        label: d.label || d.found.label || d.filename,
        facts: d.found.facts ?? [],
        treatments: d.found.treatments ?? [],
      })),
      loaded.draft.answers,
    );

    const identifiers: Partial<Record<IdType, number>> = {};
    for (const d of loaded.docs)
      for (const [k, v] of Object.entries(d.found.identifiers ?? {}))
        identifiers[k as IdType] = (identifiers[k as IdType] ?? 0) + (v ?? 0);

    const { data, error } = await supabase
      .from("case_drafts")
      .update({
        sections: result.sections,
        treatments: result.treatments,
        suggested_tasks: result.tasks,
        cancer_type: result.cancerType || null,
        visit_date: loaded.draft.visitDate ?? result.visitDate,
        identifiers,
        facts: read.flatMap((d) => (d.found.facts ?? []).map((f) => ({ ...f, doc: d.label || d.filename }))),
        confirmations: {},
        privacy_ok: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select(DRAFT_COLUMNS)
      .single();
    if (error || !data) return json(500, { error: "Couldn't save the draft. Try again." });
    return json(200, { draft: toDraft(data as Parameters<typeof toDraft>[0]) });
  } catch (e) {
    const status = e instanceof Anthropic.APIError ? e.status : undefined;
    return json(502, {
      error:
        status === 401
          ? "The AI key is not valid. The site owner needs to update ANTHROPIC_API_KEY."
          : status === 429 || status === 529
            ? "The AI writer is busy. Try again in a minute."
            : "The AI couldn't write the draft. Try again.",
    });
  }
}
