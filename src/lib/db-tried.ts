import "server-only";
import { createClient } from "./supabase/server";
import { SAMPLE_CASE, SAMPLE_FINDINGS, SAMPLE_TREATMENTS } from "./sample-case";
import { UUID_RE } from "./time";
import type { Finding, FindingKind, FindingStatus, Treatment, TreatmentOutcome } from "./types";

export type Tried = { treatments: Treatment[]; findings: Finding[] };

/** Treatment history and the team's research log for one case. */
export async function loadTried(caseId: string): Promise<Tried> {
  if (caseId === SAMPLE_CASE.id) return { treatments: SAMPLE_TREATMENTS, findings: SAMPLE_FINDINGS };
  if (!UUID_RE.test(caseId)) return { treatments: [], findings: [] };
  const supabase = await createClient();
  const [{ data: t }, { data: f }] = await Promise.all([
    supabase
      .from("treatments")
      .select("id, title, details, started_on, ended_on, outcome, outcome_note")
      .eq("case_id", caseId)
      .order("started_on", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true }),
    supabase
      .from("findings")
      .select("id, task_id, kind, title, summary, status, sources, found_by, checked_by, checked_at, created_at, tasks(title)")
      .eq("case_id", caseId)
      .order("updated_at", { ascending: false }),
  ]);
  return {
    treatments: (t ?? []).map((r) => ({
      id: r.id,
      title: r.title,
      details: r.details ?? "",
      startedOn: r.started_on,
      endedOn: r.ended_on,
      outcome: r.outcome as TreatmentOutcome,
      outcomeNote: r.outcome_note ?? "",
    })),
    findings: (f ?? []).map((r) => {
      const task = r.tasks as { title?: string } | { title?: string }[] | null;
      return {
        id: r.id,
        taskId: r.task_id,
        taskTitle: (Array.isArray(task) ? task[0]?.title : task?.title) ?? undefined,
        kind: r.kind as FindingKind,
        title: r.title,
        summary: r.summary,
        status: r.status as FindingStatus,
        sources: r.sources ?? [],
        foundBy: r.found_by,
        checkedBy: r.checked_by,
        checkedAt: r.checked_at,
        createdAt: r.created_at,
      };
    }),
  };
}
