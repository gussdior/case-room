import "server-only";
import { createClient } from "./supabase/server";
import { SAMPLE_CASE, SAMPLE_LEADS, SAMPLE_PROMPTS, SAMPLE_RUNS } from "./sample-case";
import { timeAgo, UUID_RE } from "./time";
import type { AiRun, AiTool, Expertise, Lead, LeadKind, LeadStatus, Source, SourceCheck } from "./types";

const RUN_COLS = "id, lead_id, task_id, user_id, tool, tool_other, prompt, result, sources, source_check, reuse_count, created_at, written_by_server, leads(title)";

type RunRow = {
  id: string;
  lead_id: string | null;
  task_id: string | null;
  user_id: string;
  tool: string;
  tool_other: string | null;
  prompt: string;
  result: string;
  sources: unknown;
  source_check: unknown;
  reuse_count: number;
  created_at: string;
  written_by_server?: boolean | null;
  leads: { title?: string } | { title?: string }[] | null;
};

function toRun(r: RunRow): AiRun {
  const lead = Array.isArray(r.leads) ? r.leads[0] : r.leads;
  return {
    id: r.id,
    leadId: r.lead_id,
    leadTitle: lead?.title ?? undefined,
    taskId: r.task_id,
    userId: r.user_id,
    tool: r.tool as AiTool,
    toolOther: r.tool_other,
    prompt: r.prompt,
    result: r.result,
    sources: Array.isArray(r.sources) ? (r.sources as Source[]) : [],
    check: (r.source_check ?? {}) as SourceCheck,
    reuseCount: r.reuse_count,
    verified: !!r.written_by_server,
    createdAt: timeAgo(r.created_at),
  };
}

/** Leads that need someone come first, so a visitor sees where to help. */
const ORDER: Record<LeadStatus, number> = { needs_someone: 0, exploring: 1, promising: 2, ruled_out: 3 };

/** Leads for a case, with run counts, checked sources and who has worked on each. */
export async function loadLeads(caseId: string): Promise<Lead[]> {
  if (caseId === SAMPLE_CASE.id) return [...SAMPLE_LEADS].sort((a, b) => ORDER[a.status] - ORDER[b.status]);
  if (!UUID_RE.test(caseId)) return [];
  const supabase = await createClient();
  const [{ data: leads }, { data: runs }, { data: tasks }, { data: takers }] = await Promise.all([
    supabase
      .from("leads")
      .select("id, title, idea, kind, status, conditions, next_step, next_step_expertise, ai_suggested, ruled_out_reason, created_by, updated_at")
      .eq("case_id", caseId),
    supabase.from("ai_runs").select("lead_id, user_id, source_check, written_by_server").eq("case_id", caseId).not("lead_id", "is", null).limit(2000),
    supabase.from("tasks").select("lead_id, owner_id").eq("case_id", caseId).not("lead_id", "is", null),
    supabase.from("lead_members").select("lead_id, user_id, leads!inner(case_id)").eq("leads.case_id", caseId),
  ]);
  return (leads ?? [])
    .map((l) => {
      const mine = (runs ?? []).filter((r) => r.lead_id === l.id);
      const people = [
        ...new Set([
          ...(takers ?? []).filter((t) => t.lead_id === l.id).map((t) => t.user_id as string),
          ...mine.map((r) => r.user_id),
          ...(tasks ?? []).filter((t) => t.lead_id === l.id && t.owner_id).map((t) => t.owner_id as string),
        ]),
      ];
      return {
        id: l.id,
        title: l.title,
        idea: l.idea ?? "",
        kind: l.kind as LeadKind,
        status: l.status as LeadStatus,
        conditions: (Array.isArray(l.conditions) ? l.conditions : []).map((c: { text: string; checked?: boolean }) => ({
          text: c.text,
          checked: !!c.checked,
        })),
        nextStep: l.next_step ?? "",
        nextStepExpertise: (l.next_step_expertise as Expertise | null) ?? null,
        aiSuggested: l.ai_suggested,
        ruledOutReason: l.ruled_out_reason,
        createdBy: l.created_by,
        runCount: mine.length,
        checkedSources: mine.reduce((n, r) => n + (r.written_by_server ? Number((r.source_check as SourceCheck)?.ok) || 0 : 0), 0),
        people,
        updatedAt: timeAgo(l.updated_at),
        _sort: l.updated_at as string,
      };
    })
    .sort((a, b) => ORDER[a.status] - ORDER[b.status] || b._sort.localeCompare(a._sort))
    .map(({ _sort, ...l }) => {
      void _sort;
      return l;
    });
}

/** AI runs for a case, newest first, optionally for one lead or one tool. */
export async function loadRuns(caseId: string, opts: { leadId?: string; tool?: AiTool; limit?: number } = {}): Promise<AiRun[]> {
  if (caseId === SAMPLE_CASE.id) {
    return SAMPLE_RUNS.filter((r) => (!opts.leadId || r.leadId === opts.leadId) && (!opts.tool || r.tool === opts.tool)).slice(
      0,
      opts.limit ?? 100,
    );
  }
  if (!UUID_RE.test(caseId)) return [];
  const supabase = await createClient();
  let q = supabase.from("ai_runs").select(RUN_COLS).eq("case_id", caseId);
  if (opts.leadId) q = q.eq("lead_id", opts.leadId);
  if (opts.tool) q = q.eq("tool", opts.tool);
  const { data } = await q.order("created_at", { ascending: false }).limit(opts.limit ?? 100);
  return ((data ?? []) as RunRow[]).map(toRun);
}

/** One run, for prefilling a finding. Members only (row level security). */
export async function loadRun(caseId: string, runId: string): Promise<AiRun | null> {
  if (!UUID_RE.test(caseId) || !UUID_RE.test(runId)) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("ai_runs").select(RUN_COLS).eq("id", runId).eq("case_id", caseId).maybeSingle();
  return data ? toRun(data as RunRow) : null;
}

export type LeadEvent = { id: string; userId: string | null; detail: string; createdAt: string };

export async function loadLeadEvents(leadId: string): Promise<LeadEvent[]> {
  if (!UUID_RE.test(leadId)) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("lead_events")
    .select("id, user_id, detail, created_at")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false })
    .limit(6);
  return (data ?? []).map((e) => ({ id: e.id, userId: e.user_id, detail: e.detail, createdAt: timeAgo(e.created_at) }));
}

export type TopPrompt = { prompt: string; uses: number; here: boolean };

export async function loadTopPrompts(caseId: string, leadId: string): Promise<TopPrompt[]> {
  if (caseId === SAMPLE_CASE.id) return SAMPLE_PROMPTS;
  if (!UUID_RE.test(leadId)) return [];
  const supabase = await createClient();
  const { data } = await supabase.rpc("top_prompts", { l: leadId });
  const seen = new Set<string>();
  return ((data ?? []) as TopPrompt[]).filter((p) => {
    const k = p.prompt.trim().toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
