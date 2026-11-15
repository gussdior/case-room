import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildPack } from "@/lib/case-pack";
import { scrubDeep } from "@/lib/drafts/scrub";
import { AI_DRAFT_LABEL } from "@/lib/types";

import { aiErrorMessage } from "@/lib/ai/errors";
const MODEL = "claude-sonnet-5-5";

export const AI_DRAFT_NOTE = AI_DRAFT_LABEL;

const TOOL: Anthropic.Tool = {
  name: "write_brief_draft",
  description: "Write a first draft for each empty part of the brief for the patient's doctor.",
  input_schema: {
    type: "object",
    properties: {
      sections: {
        type: "array",
        items: {
          type: "object",
          properties: {
            position: { type: "integer", description: "The position number of the part you are writing" },
            body: { type: "string", description: "2 to 6 short sentences in plain words" },
          },
          required: ["position", "body"],
          additionalProperties: false,
        },
      },
    },
    required: ["sections"],
    additionalProperties: false,
  },
};

const SYSTEM = `You write the first draft of a brief that a family will bring to the patient's own doctor.
Each part has a title. Write only the parts you are asked for, using only what the case says.
Rules:
- Plain words a family member can read. Short sentences.
- Never invent facts, results, dates or treatments. If the case doesn't say, write what still needs to be found out.
- Never give treatment advice and never say what the patient should do. For options, write questions to ask the doctor.
- No names, birth dates, ID numbers, addresses, hospital or doctor names.
- A person will check this draft before it counts, so mark guesses as open questions.`;

/** Fills empty brief sections with a labeled AI draft. The caller must be a case admin. */
export async function draftBrief(supabase: SupabaseClient, caseId: string): Promise<{ filled?: number; error?: string }> {
  if (!process.env.ANTHROPIC_API_KEY) return { error: "The AI isn't switched on yet. The site owner needs to add the AI key." };
  const { data: sections } = await supabase.from("brief_sections").select("id, position, title, body").eq("case_id", caseId).order("position");
  const empty = (sections ?? []).filter((s) => !s.body?.trim());
  if (empty.length === 0) return { filled: 0 };
  const pack = await buildPack(supabase, caseId);
  if (!pack) return { error: "Join this case first." };
  let out: { position: number; body: string }[] = [];
  try {
    const msg = await new Anthropic().messages.create({
      model: MODEL,
      max_tokens: 2500,
      system: SYSTEM,
      tools: [TOOL],
      tool_choice: { type: "tool", name: TOOL.name },
      messages: [
        {
          role: "user",
          content: `${pack}\n\n## Parts to write\n${empty.map((s) => `${s.position}. ${s.title}`).join("\n")}`,
        },
      ],
    });
    const use = msg.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
    out = (use?.input as { sections?: { position: number; body: string }[] } | undefined)?.sections ?? [];
  } catch (err) {
    return { error: aiErrorMessage(err, "draft-brief") };
  }
  out = scrubDeep(out);
  const rows = out
    .map((o) => ({ id: empty.find((s) => s.position === o.position)?.id, body: String(o.body ?? "").trim().slice(0, 4000) }))
    .filter((r): r is { id: string; body: string } => !!r.id && r.body.length > 0);
  if (rows.length === 0) return { filled: 0 };
  const { data, error } = await supabase.rpc("save_ai_brief_draft", { c: caseId, p_sections: rows });
  if (error) return { error: "Couldn't save the AI draft." };
  return { filled: Number(data) || 0 };
}
