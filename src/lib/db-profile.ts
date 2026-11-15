import "server-only";
import { createClient } from "./supabase/server";
import { UUID_RE } from "./time";
import type { Expertise, Source, TaskStatus } from "./types";

export type VolunteerProfile = {
  id: string;
  name: string;
  headline: string;
  expertise: Expertise;
  hasProof: boolean;
  roleTitle: string | null;
  yearsExperience: number | null;
  timeZone: string | null;
  areas: string[];
  joinedAt: string;
  isMe: boolean;
  /** Only filled for your own profile. */
  alertsOn: boolean | null;
  alertFrequency: "instant" | "weekly" | null;
  familiesHelped: number;
  briefsFinished: number;
  tasksChecked: number;
  checksDone: number;
  points: number;
  currentTasks: { taskId: string; caseId: string; title: string; status: TaskStatus; expertise: Expertise }[];
  /** Cancer type and months only: never the case or patient. */
  casesHelped: { cancerType: string; fromMonth: string; toMonth: string; briefFinished: boolean }[];
  /** Task and case ids are null when you're not in that case. */
  recentCheckedWork: { title: string; expertise: Expertise; checkedAt: string; taskId: string | null; caseId: string | null }[];
};

type Raw = Record<string, unknown> & {
  current_tasks: { task_id: string; case_id: string; title: string; status: TaskStatus; expertise: Expertise }[];
  cases_helped: { cancer_type: string; from_month: string; to_month: string; brief_finished: boolean }[];
  recent_checked_work: { title: string; expertise: Expertise; checked_at: string; task_id: string | null; case_id: string | null }[];
};

/** Profile plus stats, or null if you don't share a case with this person. */
export async function loadVolunteerProfile(userId: string): Promise<VolunteerProfile | null> {
  if (!UUID_RE.test(userId)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("volunteer_profile", { u: userId });
  if (error || !data) return null;
  const r = data as Raw;
  return {
    id: r.id as string,
    name: r.display_name as string,
    headline: (r.headline as string | null) ?? "",
    expertise: r.expertise as Expertise,
    hasProof: Boolean(r.has_proof),
    roleTitle: (r.role_title as string | null) ?? null,
    yearsExperience: (r.years_experience as number | null) ?? null,
    timeZone: (r.time_zone as string | null) ?? null,
    areas: (r.areas as string[] | null) ?? [],
    joinedAt: r.joined_at as string,
    isMe: Boolean(r.is_me),
    alertsOn: (r.alerts_on as boolean | null) ?? null,
    alertFrequency: (r.alert_frequency as "instant" | "weekly" | null) ?? null,
    familiesHelped: Number(r.families_helped ?? 0),
    briefsFinished: Number(r.briefs_finished ?? 0),
    tasksChecked: Number(r.tasks_checked ?? 0),
    checksDone: Number(r.checks_done ?? 0),
    points: Number(r.points ?? 0),
    currentTasks: (r.current_tasks ?? []).map((t) => ({
      taskId: t.task_id,
      caseId: t.case_id,
      title: t.title,
      status: t.status,
      expertise: t.expertise,
    })),
    casesHelped: (r.cases_helped ?? []).map((c) => ({
      cancerType: c.cancer_type,
      fromMonth: c.from_month,
      toMonth: c.to_month,
      briefFinished: c.brief_finished,
    })),
    recentCheckedWork: (r.recent_checked_work ?? []).map((w) => ({
      title: w.title,
      expertise: w.expertise,
      checkedAt: w.checked_at,
      taskId: w.task_id,
      caseId: w.case_id,
    })),
  };
}

export type ListedCase = { caseId: string; goal: string; cancerType: string | null; visitDate: string | null; openTasks: number };

/** Listed cases with open tasks for your expertise that you haven't joined. */
export async function loadListedCasesForMe(): Promise<ListedCase[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("listed_cases_for_me");
  return ((data ?? []) as { case_id: string; goal: string; cancer_type: string | null; visit_date: string | null; open_tasks: number }[]).map(
    (c) => ({ caseId: c.case_id, goal: c.goal, cancerType: c.cancer_type, visitDate: c.visit_date, openTasks: c.open_tasks }),
  );
}

export type AiMessage = {
  id: string;
  userId: string;
  role: "user" | "assistant";
  content: string;
  sources: Source[];
  createdAt: string;
  /** Written by the server itself, so it really came from the built in AI. */
  verified: boolean;
};

/** The task's saved AI chat (everyone in the case can read it, so good prompts get reused). */
export async function loadAiMessages(taskId: string, limit = 40): Promise<AiMessage[]> {
  if (!UUID_RE.test(taskId)) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("ai_messages")
    .select("id, user_id, role, content, sources, created_at, written_by_server")
    .eq("task_id", taskId)
    .order("created_at", { ascending: true })
    .limit(limit);
  return (data ?? []).map((m) => ({
    id: m.id,
    userId: m.user_id,
    role: m.role as "user" | "assistant",
    content: m.content,
    sources: (m.sources as Source[]) ?? [],
    createdAt: m.created_at,
    verified: !!m.written_by_server,
  }));
}
