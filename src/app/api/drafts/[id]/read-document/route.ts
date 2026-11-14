import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { UUID_RE } from "@/lib/time";
import { readDocument } from "@/lib/drafts/ai";
import { DOC_COLUMNS, toDoc } from "@/lib/drafts/db";

export const maxDuration = 300;

const READABLE = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

function json(status: number, body: Record<string, unknown>) {
  return Response.json(body, { status });
}

export async function POST(req: Request, ctx: RouteContext<"/api/drafts/[id]/read-document">) {
  const { id: draftId } = await ctx.params;
  let documentId = "";
  try {
    documentId = String(((await req.json()) as { documentId?: unknown }).documentId ?? "");
  } catch {
    return json(400, { error: "Send JSON with documentId." });
  }
  if (!UUID_RE.test(draftId) || !UUID_RE.test(documentId)) return json(400, { error: "That link is broken." });

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) return json(401, { error: "Sign in first." });

  // Row level security: only the draft's owner gets the row back.
  const { data: row } = await supabase
    .from("case_documents")
    .select(DOC_COLUMNS)
    .eq("id", documentId)
    .eq("draft_id", draftId)
    .maybeSingle();
  if (!row) return json(404, { error: "That file isn't part of your draft." });

  const save = async (patch: Record<string, unknown>) => {
    const { data } = await supabase.from("case_documents").update(patch).eq("id", documentId).select(DOC_COLUMNS).single();
    return data ? toDoc(data as Parameters<typeof toDoc>[0]) : null;
  };

  if (!READABLE.includes(row.mime)) {
    const doc = await save({
      status: "unreadable",
      note: "iPhone HEIC photos can't be read yet. Take a screenshot of it, or export it as JPG, then replace it.",
    });
    return json(200, { doc });
  }
  if (!process.env.ANTHROPIC_API_KEY)
    return json(503, { error: "The AI reader isn't switched on yet. The site owner needs to add an ANTHROPIC_API_KEY." });

  await save({ status: "reading", note: null });
  const { data: blob, error: dlError } = await supabase.storage.from("case-docs").download(row.storage_path);
  if (dlError || !blob) {
    const doc = await save({ status: "uploaded", note: "Couldn't open the uploaded file. Try again." });
    return json(502, { error: "Couldn't open the uploaded file. Try again.", doc });
  }

  try {
    const result = await readDocument({
      bytes: Buffer.from(await blob.arrayBuffer()),
      mime: row.mime,
      filename: row.filename,
    });
    const doc = await save({
      status: result.readable ? "read" : "unreadable",
      note: result.readable ? null : result.reason || "This file couldn't be read. Try a clearer copy.",
      label: result.label,
      pages: result.pages,
      found: result.found,
    });
    return json(200, { doc });
  } catch (e) {
    const status = e instanceof Anthropic.APIError ? e.status : undefined;
    const message =
      status === 401
        ? "The AI key is not valid. The site owner needs to update ANTHROPIC_API_KEY."
        : status === 429 || status === 529
          ? "The AI reader is busy. Try again in a minute."
          : status === 400 || status === 413
            ? "This file is too big or has too many pages for the AI. Split it or upload the key pages."
            : "The AI couldn't read this file. Try again.";
    const doc = await save({ status: status === 400 || status === 413 ? "unreadable" : "uploaded", note: message });
    return json(status === 400 || status === 413 ? 200 : 502, { error: message, doc });
  }
}
