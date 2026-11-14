import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { scrubKeepLinks } from "@/lib/drafts/scrub";
import { LEAD_KIND_LABEL, LEAD_STATUS_LABEL, type LeadKind, type LeadStatus } from "@/lib/types";

const month = (d: string | null) => (d ? d.slice(0, 7) : "");

/** A plain text summary of a case to paste into any AI, with the rules it should follow.
 *  Returns null when the user can't see the case. Names and IDs are scrubbed again on the way out. */
export async function buildPack(supabase: SupabaseClient, caseId: string, leadId?: string | null): Promise<string | null> {
  const { data: kase } = await supabase
    .from("cases")
    .select("goal, summary, cancer_type, visit_date")
    .eq("id", caseId)
    .maybeSingle();
  if (!kase) return null;
  const [{ data: sections }, { data: treatments }, { data: findings }, { data: leads }] = await Promise.all([
    supabase.from("brief_sections").select("position, title, body").eq("case_id", caseId).order("position"),
    supabase
      .from("treatments")
      .select("title, details, started_on, ended_on, outcome, outcome_note")
      .eq("case_id", caseId)
      .order("started_on", { ascending: true, nullsFirst: false })
      .limit(30),
    supabase.from("findings").select("title, status, summary, sources").eq("case_id", caseId).order("updated_at", { ascending: false }).limit(40),
    supabase
      .from("leads")
      .select("id, title, idea, kind, status, conditions, ruled_out_reason")
      .eq("case_id", caseId)
      .order("updated_at", { ascending: false })
      .limit(20),
  ]);

  const focus = leadId ? (leads ?? []).find((l) => l.id === leadId) : undefined;
  const lines: string[] = [
    "Case Room case pack",
    "Shared with the family's consent. Names, birth dates and ID numbers are removed. Do not try to identify the patient.",
    "",
    "## About the case",
    `Goal: ${kase.goal}`,
    kase.cancer_type ? `Cancer type: ${kase.cancer_type}` : "",
    kase.visit_date ? `Next doctor visit: ${kase.visit_date}` : "",
    kase.summary ? `Summary: ${kase.summary}` : "",
    "",
  ];
  const filled = (sections ?? []).filter((s) => s.body);
  if (filled.length) {
    lines.push("## What the team has written so far");
    filled.forEach((s) => lines.push(`${s.title}: ${s.body.slice(0, 1500)}`));
    lines.push("");
  }
  if ((treatments ?? []).length) {
    lines.push("## Treatments so far");
    (treatments ?? []).forEach((t) =>
      lines.push(
        `- ${t.title}${t.started_on ? ` (${month(t.started_on)}${t.ended_on ? ` to ${month(t.ended_on)}` : ""})` : ""}: ${String(t.outcome).replace(/_/g, " ")}${t.outcome_note ? `, ${t.outcome_note}` : ""}`,
      ),
    );
    lines.push("");
  }
  if ((findings ?? []).length) {
    lines.push("## Already looked into (don't repeat these)");
    (findings ?? []).forEach((f) =>
      lines.push(`- [${String(f.status).replace(/_/g, " ")}] ${f.title}: ${f.summary.slice(0, 300)}${f.sources?.[0] ? ` (${f.sources[0]})` : ""}`),
    );
    lines.push("");
  }
  if ((leads ?? []).length) {
    lines.push("## Ideas the team is checking");
    (leads ?? []).forEach((l) => {
      const conds = (Array.isArray(l.conditions) ? l.conditions : [])
        .map((c: { text: string; checked?: boolean }) => `${c.checked ? "[done]" : "[open]"} ${c.text}`)
        .join("; ");
      lines.push(
        `- ${l.title} (${LEAD_KIND_LABEL[l.kind as LeadKind]}, ${LEAD_STATUS_LABEL[l.status as LeadStatus].toLowerCase()})${l.idea ? `: ${l.idea}` : ""}${conds ? `. Needs to be true: ${conds}` : ""}${l.ruled_out_reason ? `. Ruled out because: ${l.ruled_out_reason}` : ""}`,
      );
    });
    lines.push("");
  }
  if (focus) {
    lines.push("## Focus on this idea", `${focus.title}${focus.idea ? `: ${focus.idea}` : ""}`, "");
  }
  lines.push(
    "## How to answer",
    "- You are helping volunteers research this case. Give ideas to investigate and questions for the patient's own doctor.",
    "- Never give treatment advice. Never say what she should take, start or stop, and never predict outcomes.",
    "- Give a source link for every claim. Only use real links you can see. Never invent trial numbers or papers.",
    "- Say which sources are preprints (not peer reviewed).",
    "- Check the list above before suggesting something already ruled out.",
    "- End with 1 to 3 questions she could ask her doctor.",
  );
  return scrubKeepLinks(lines.filter((l, i, a) => !(l === "" && a[i - 1] === "")).join("\n")).text;
}
