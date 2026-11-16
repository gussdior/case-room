"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getUserId } from "@/lib/auth";
import { scrub } from "@/lib/drafts/scrub";
import { createClient } from "@/lib/supabase/server";
import { UUID_RE } from "@/lib/time";
import { EXPERTISE_ORDER, LEAD_KINDS, type Expertise, type LeadKind, type LeadStatus } from "@/lib/types";

// The database rules enforce who can do what. These checks only give clearer messages.

type Result = { error?: string; ok?: string } | undefined;

const text = (form: FormData, key: string, max: number) => String(form.get(key) ?? "").trim().slice(0, max);
const clean = (s: string) => scrub(s).text;

async function ready(...ids: (string | null | undefined)[]): Promise<Result> {
  if (!(await getUserId())) return { error: "Your sign in expired. Sign in again." };
  if (ids.some((id) => id != null && !UUID_RE.test(id))) return { error: "That link is broken." };
  return undefined;
}

const MESSAGES = [
  "Use rule out, with a reason and a source",
  "Only a case admin can reopen a ruled out idea",
  "Already ruled out",
  "Say why it is ruled out",
  "Add a source link for the reason",
  "Only the person who added this idea or a case admin can edit it",
];

function friendly(error: { message?: string; code?: string } | null): Result {
  if (!error) return undefined;
  const known = MESSAGES.find((m) => error.message?.includes(m));
  if (known) return { error: `${known}.` };
  if (error.code === "42501" || error.message?.includes("row-level security")) return { error: "You can't do that on this case." };
  if (error.code === "23514") return { error: "Check the fields: something is too short or too long." };
  return { error: "Something went wrong. Try again." };
}

const refresh = (caseId: string) => revalidatePath(`/case/${caseId}`, "layout");

export async function addLead(caseId: string, _: Result, form: FormData): Promise<Result> {
  const bad = await ready(caseId);
  if (bad) return bad;
  const title = clean(text(form, "title", 200));
  if (title.length < 3) return { error: "Give the idea a short title." };
  const kind = text(form, "kind", 40) as LeadKind;
  const expertise = text(form, "next_step_expertise", 40) as Expertise;
  const conditions = text(form, "conditions", 2000)
    .split("\n")
    .map((c) => clean(c.trim().replace(/^[-*\d.)\s]+/, "")))
    .filter((c) => c.length >= 2)
    .slice(0, 8)
    .map((c) => ({ text: c.slice(0, 300), checked: false }));
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("leads")
    .insert({
      case_id: caseId,
      title,
      idea: clean(text(form, "idea", 1000)),
      kind: LEAD_KINDS.includes(kind) ? kind : "other",
      status: "needs_someone",
      conditions,
      next_step: clean(text(form, "next_step", 300)),
      next_step_expertise: EXPERTISE_ORDER.includes(expertise) ? expertise : null,
      created_by: await getUserId(),
    })
    .select("id")
    .single();
  if (error) return friendly(error);
  refresh(caseId);
  redirect(`/case/${caseId}/lead/${data.id}`);
}

const OPEN_STATUSES: LeadStatus[] = ["needs_someone", "exploring", "promising"];

export async function setLeadStatus(caseId: string, leadId: string, status: LeadStatus): Promise<Result> {
  const bad = await ready(caseId, leadId);
  if (bad) return bad;
  if (!OPEN_STATUSES.includes(status)) return { error: "Pick a status." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_lead_status", { l: leadId, p_status: status });
  if (error) return friendly(error);
  refresh(caseId);
  return { ok: "Updated." };
}

export async function setLeadCondition(caseId: string, leadId: string, idx: number, checked: boolean): Promise<Result> {
  const bad = await ready(caseId, leadId);
  if (bad) return bad;
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_lead_condition", { l: leadId, idx, p_checked: checked });
  if (error) return friendly(error);
  refresh(caseId);
  return { ok: checked ? "Ticked." : "Unticked." };
}

export async function ruleOutLead(caseId: string, leadId: string, _: Result, form: FormData): Promise<Result> {
  const bad = await ready(caseId, leadId);
  if (bad) return bad;
  const reason = clean(text(form, "reason", 1000));
  const source = text(form, "source", 2000);
  if (reason.length < 3) return { error: "Say why it is ruled out." };
  try {
    const u = new URL(source);
    if (u.protocol !== "https:" && u.protocol !== "http:") throw new Error();
  } catch {
    return { error: "Add a full source link starting with https://" };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("rule_out_lead", { l: leadId, p_reason: reason, p_source: source });
  if (error) return friendly(error);
  refresh(caseId);
  return { ok: "Ruled out and logged on What we tried. It counts once someone else checks it." };
}

/** Someone reused a prompt: count it, so good prompts rise to the top. */
export async function bumpReuse(caseId: string, runId: string): Promise<Result> {
  const bad = await ready(caseId, runId);
  if (bad) return bad;
  const supabase = await createClient();
  await supabase.rpc("bump_reuse", { r: runId });
  return undefined;
}

// ---------- Taking a lead ----------

export async function takeLead(caseId: string, leadId: string): Promise<Result> {
  const bad = await ready(caseId, leadId);
  if (bad) return bad;
  const supabase = await createClient();
  const { error } = await supabase.rpc("take_lead", { l: leadId });
  if (error) {
    if (error.message?.includes("Lead not found")) return { error: "Join this case first to take a lead." };
    if (error.message?.includes("ruled out")) return { error: "This lead was ruled out." };
    return friendly(error);
  }
  revalidatePath(`/case/${caseId}`, "layout");
  return { ok: "You're on it." };
}
