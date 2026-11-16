"use server";

import { revalidatePath } from "next/cache";
import { getUserId } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { UUID_RE } from "@/lib/time";
import type { FindingKind, FindingStatus, TreatmentOutcome } from "@/lib/types";

// The database rules enforce who can do what. These checks only give clearer messages.

type Result = { error?: string; ok?: string } | undefined;

const OUTCOMES: TreatmentOutcome[] = ["worked", "stopped_working", "side_effects", "waiting", "unknown"];
const STATUSES: FindingStatus[] = ["may_fit", "ruled_out", "waiting"];
const KINDS: FindingKind[] = ["trial", "paper", "treatment_idea", "insurance", "other"];

const text = (form: FormData, key: string, max: number) => String(form.get(key) ?? "").trim().slice(0, max);
const date = (form: FormData, key: string) => {
  const v = text(form, key, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : /^\d{4}-\d{2}$/.test(v) ? `${v}-01` : null;
};

function urls(raw: string): string[] | "invalid" {
  const out: string[] = [];
  for (const p of raw.split(/[\s,]+/).filter(Boolean)) {
    try {
      const u = new URL(p);
      if (u.protocol !== "https:" && u.protocol !== "http:") return "invalid";
      out.push(u.toString());
    } catch {
      return "invalid";
    }
  }
  return out.slice(0, 10);
}

async function ready(...ids: (string | null | undefined)[]): Promise<Result> {
  if (!(await getUserId())) return { error: "Your sign in expired. Sign in again." };
  if (ids.some((id) => id != null && !UUID_RE.test(id))) return { error: "That link is broken." };
  return undefined;
}

function friendly(error: { message?: string; code?: string } | null, fallback = "Something went wrong. Try again."): Result {
  if (!error) return undefined;
  for (const m of ["Someone else has to check your finding", "Already checked", "Only the person who logged this", "Add at least one source link"])
    if (error.message?.includes(m)) return { error: m === "Only the person who logged this" ? "Only the person who logged this or a case admin can change it." : `${m}.` };
  if (error.code === "42501" || error.message?.includes("row-level security")) return { error: "You can't do that on this case." };
  if (error.code === "23514") return { error: "Check the fields: something is too short, too long or the dates are out of order." };
  return { error: fallback };
}

const refresh = (caseId: string) => revalidatePath(`/case/${caseId}`, "layout");

export async function addTreatment(caseId: string, _: Result, form: FormData): Promise<Result> {
  const bad = await ready(caseId);
  if (bad) return bad;
  const title = text(form, "title", 160);
  if (title.length < 2) return { error: "Name the treatment or event." };
  const outcome = text(form, "outcome", 20) as TreatmentOutcome;
  const startedOn = date(form, "started_on");
  const endedOn = date(form, "ended_on");
  if (startedOn && endedOn && endedOn < startedOn) return { error: "The end date is before the start date." };
  const supabase = await createClient();
  const { error } = await supabase.from("treatments").insert({
    case_id: caseId,
    title,
    details: text(form, "details", 1000),
    started_on: startedOn,
    ended_on: endedOn,
    outcome: OUTCOMES.includes(outcome) ? outcome : "unknown",
    outcome_note: text(form, "outcome_note", 160),
    created_by: await getUserId(),
  });
  if (error) {
    if (error.code === "42501" || error.message?.includes("row-level security"))
      return { error: "Only the family, the case creator or the co-approver can add treatments." };
    return friendly(error);
  }
  refresh(caseId);
  return { ok: "Added to the timeline." };
}

export async function deleteTreatment(caseId: string, id: string): Promise<Result> {
  const bad = await ready(caseId, id);
  if (bad) return bad;
  const supabase = await createClient();
  const { error, count } = await supabase.from("treatments").delete({ count: "exact" }).eq("id", id).eq("case_id", caseId);
  if (error) return friendly(error);
  if (!count) return { error: "You can't remove this one." };
  refresh(caseId);
  return { ok: "Removed." };
}

export async function logFinding(caseId: string, _: Result, form: FormData): Promise<Result> {
  const bad = await ready(caseId);
  if (bad) return bad;
  const taskId = text(form, "task_id", 40) || null;
  if (taskId && !UUID_RE.test(taskId)) return { error: "That task link is broken." };
  const title = text(form, "title", 200);
  const summary = text(form, "summary", 2000);
  const status = text(form, "status", 20) as FindingStatus;
  const kind = text(form, "kind", 20) as FindingKind;
  const sources = urls(text(form, "sources", 4000));
  if (title.length < 3) return { error: "Give it a short title." };
  if (summary.length < 3) return { error: "Say what you found, in a sentence or two." };
  if (!STATUSES.includes(status)) return { error: "Pick: may fit the patient, ruled out, or waiting on results." };
  if (sources === "invalid") return { error: "Each source must be a full link starting with https://" };
  if (sources.length === 0) return { error: "Add at least one source link." };
  const supabase = await createClient();
  const { error } = await supabase.from("findings").insert({
    case_id: caseId,
    task_id: taskId,
    kind: KINDS.includes(kind) ? kind : "other",
    title,
    summary,
    status,
    sources,
    found_by: await getUserId(),
  });
  if (error) return friendly(error);
  refresh(caseId);
  return { ok: "Logged. It counts once someone else checks it." };
}

export async function updateFinding(caseId: string, id: string, _: Result, form: FormData): Promise<Result> {
  const bad = await ready(caseId, id);
  if (bad) return bad;
  const status = text(form, "status", 20) as FindingStatus;
  const summary = text(form, "summary", 2000);
  const sources = urls(text(form, "sources", 4000));
  if (!STATUSES.includes(status)) return { error: "Pick a status." };
  if (summary.length < 3) return { error: "Say what you found." };
  if (sources === "invalid" || sources.length === 0) return { error: "Add at least one full source link." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_finding", { f: id, p_status: status, p_summary: summary, p_sources: sources });
  if (error) return friendly(error);
  refresh(caseId);
  return { ok: "Saved. A change needs a fresh check." };
}

export async function checkFinding(caseId: string, id: string): Promise<Result> {
  const bad = await ready(caseId, id);
  if (bad) return bad;
  const supabase = await createClient();
  const { error } = await supabase.rpc("check_finding", { f: id });
  if (error) return friendly(error);
  refresh(caseId);
  return { ok: "Checked." };
}

export async function deleteFinding(caseId: string, id: string): Promise<Result> {
  const bad = await ready(caseId, id);
  if (bad) return bad;
  const supabase = await createClient();
  const { error, count } = await supabase.from("findings").delete({ count: "exact" }).eq("id", id).eq("case_id", caseId);
  if (error) return friendly(error);
  if (!count) return { error: "Only the person who logged it or a case admin can remove it." };
  refresh(caseId);
  return { ok: "Removed." };
}
