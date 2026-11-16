import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { createWithTool } from "@/lib/ai/call-tool";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildPack } from "@/lib/case-pack";
import { scrubDeep } from "@/lib/drafts/scrub";
import { EXPERTISE_ORDER, LEAD_KINDS, type Expertise, type LeadKind } from "@/lib/types";

import { aiErrorMessage } from "@/lib/ai/errors";
import { AI_WORDING_RULES } from "@/lib/time";
const MODEL = "claude-sonnet-5-5";

const TOOL: Anthropic.Tool = {
  name: "suggest_leads",
  description: "Propose ideas for volunteers to investigate on this case.",
  input_schema: {
    type: "object",
    properties: {
      leads: {
        type: "array",
        minItems: 1,
        maxItems: 6,
        items: {
          type: "object",
          properties: {
            title: { type: "string", description: "Short plain words, under 90 characters" },
            idea: { type: "string", description: "One or two sentences: what to look into and why it might matter" },
            kind: { type: "string", enum: LEAD_KINDS },
            conditions: {
              type: "array",
              maxItems: 4,
              items: { type: "string" },
              description: "What would need to be true for this to be worth asking the doctor about",
            },
            next_step: { type: "string", description: "The first concrete research step, under 120 characters" },
            next_step_expertise: { type: "string", enum: EXPERTISE_ORDER },
          },
          required: ["title", "idea", "kind", "conditions", "next_step", "next_step_expertise"],
          additionalProperties: false,
        },
      },
    },
    required: ["leads"],
    additionalProperties: false,
  },
};

const SYSTEM = `You help a team of volunteers decide what to research for one cancer patient.
Propose 4 to 6 distinct leads, each tagged with the one skill its first step needs: ideas to investigate with AI tools and public sources, then turn into questions for the patient's own doctor.
Good kinds of leads: open clinical trials that might fit, approved drugs studied for a new use, personalized or vaccine approaches, tests or scans worth asking about, access and cost help.
Rules:
- Ideas to investigate and ask about, never advice. Never say the patient should take, start or stop anything.
- Don't repeat anything listed as already looked into or ruled out, and don't repeat existing ideas.
- Use plain words a family member can read. No names or ID numbers.
- Be honest about long shots in the idea text.
${AI_WORDING_RULES}`;

export type SuggestedLead = {
  title: string;
  idea: string;
  kind: LeadKind;
  conditions: string[];
  next_step: string;
  next_step_expertise: Expertise;
};

/** Asks the AI for leads and saves them as "needs someone". The caller must be a case admin. */
export async function suggestLeads(supabase: SupabaseClient, caseId: string, userId: string): Promise<{ added?: number; error?: string }> {
  if (!process.env.ANTHROPIC_API_KEY) return { error: "The AI isn't switched on yet. The site owner needs to add the AI key." };
  const pack = await buildPack(supabase, caseId);
  if (!pack) return { error: "Join this case first." };
  const client = new Anthropic();
  let leads: SuggestedLead[] = [];
  try {
    const msg = await createWithTool(client, {
      model: MODEL,
      max_tokens: 2000,
      system: SYSTEM,
      tools: [TOOL],
      messages: [{ role: "user", content: pack }],
    });
    const use = msg.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
    leads = ((use?.input as { leads?: SuggestedLead[] } | undefined)?.leads ?? []).slice(0, 6);
  } catch (err) {
    return { error: aiErrorMessage(err, "suggest-leads") };
  }
  leads = scrubDeep(leads);
  const { data: existing } = await supabase.from("leads").select("title").eq("case_id", caseId);
  const have = new Set((existing ?? []).map((l) => l.title.trim().toLowerCase()));
  const rows = leads
    .filter((l) => l.title?.trim().length >= 3 && !have.has(l.title.trim().toLowerCase()))
    .map((l) => ({
      case_id: caseId,
      title: l.title.trim().slice(0, 200),
      idea: (l.idea ?? "").trim().slice(0, 1000),
      kind: LEAD_KINDS.includes(l.kind) ? l.kind : "other",
      conditions: (l.conditions ?? [])
        .map((c) => c.trim())
        .filter((c) => c.length >= 2)
        .slice(0, 4)
        .map((c) => ({ text: c.slice(0, 300), checked: false })),
      next_step: (l.next_step ?? "").trim().slice(0, 300),
      next_step_expertise: EXPERTISE_ORDER.includes(l.next_step_expertise) ? l.next_step_expertise : null,
      ai_suggested: true,
      created_by: userId,
    }));
  if (rows.length === 0) return { added: 0 };
  const { error } = await supabase.from("leads").insert(rows);
  if (error) return { error: "Couldn't save the suggested leads." };
  return { added: rows.length };
}
