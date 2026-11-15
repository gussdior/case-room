import "server-only";
import { getUserId } from "./auth";
import { createClient } from "./supabase/server";
import { daysUntil, timeAgo, UUID_RE } from "./time";
import {
  EXPERTISE_LABEL,
  EXPERTISE_ORDER,
  type CaseRoom,
  type Expertise,
  type Member,
  type MemberRole,
  type Message,
  type Section,
  type Submission,
  type Task,
  type TaskStatus,
} from "./types";

type ProfileRow = { display_name: string; headline: string | null; expertise: Expertise; proof_url: string | null };

export type Teaser = {
  kind: "teaser";
  id: string;
  goal: string;
  joinMode: "approve" | "invite_only";
  needed: Expertise[];
  volunteers: number;
  myRequest: "pending" | "declined" | "removed" | null;
  /** Present when the creator turned on the public preview. */
  preview?: CasePreview | null;
  /** True when nobody is signed in. */
  signedOut?: boolean;
};

/** What anyone with a shared link may see, only when the creator turned on the public preview. */
export type CasePreview = {
  goal: string;
  cancerType: string | null;
  cancerStage: string | null;
  visitInDays: number | null;
  needed: Expertise[];
  helpers: number;
  joinMode: "approve" | "invite_only";
};

/** Public preview of a case. Works signed out. Null if the creator has not turned it on. */
export async function loadPreview(id: string): Promise<CasePreview | null> {
  if (!UUID_RE.test(id)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("case_preview", { c: id });
  if (error) return null;
  const p = Array.isArray(data) ? data[0] : null;
  if (!p) return null;
  return {
    goal: p.goal,
    cancerType: p.cancer_type ?? null,
    cancerStage: p.cancer_stage ?? null,
    visitInDays: typeof p.visit_in_days === "number" ? p.visit_in_days : null,
    needed: (p.needed ?? []) as Expertise[],
    helpers: p.helpers ?? 0,
    joinMode: p.join_mode,
  };
}

/** Loads a real case the signed in user is an approved member of.
 *  Returns a teaser (goal and skills needed) for non-members, or null if it doesn't exist. */
export async function loadCase(id: string): Promise<CaseRoom | Teaser | null> {
  if (!UUID_RE.test(id)) return null;
  const userId = await getUserId();
  if (!userId) return null;
  const supabase = await createClient();

  const { data: c } = await supabase
    .from("cases")
    .select("id, goal, summary, visit_date, join_mode, is_sample, created_by, listed, cancer_type, public_goal, cancer_stage, public_preview, preview_show_visit")
    .eq("id", id)
    .maybeSingle();

  if (!c) {
    const [{ data: teaser }, { data: mine }] = await Promise.all([
      supabase.rpc("case_teaser", { c: id }),
      supabase.from("case_members").select("status").eq("case_id", id).eq("user_id", userId).maybeSingle(),
    ]);
    const t = Array.isArray(teaser) ? teaser[0] : null;
    if (!t) return null;
    return {
      kind: "teaser",
      id,
      goal: t.goal,
      joinMode: t.join_mode,
      needed: (t.needed ?? []) as Expertise[],
      volunteers: t.volunteers ?? 0,
      myRequest: (mine?.status as Teaser["myRequest"]) ?? null,
      preview: await loadPreview(id),
    };
  }

  const [membersRes, sectionsRes, tasksRes, messagesRes] = await Promise.all([
    supabase
      .from("case_members")
      .select(
        "user_id, role, status, expertise, request_note, hours_per_week, proof_url, ai_note, created_at, profile:profiles!case_members_user_id_fkey(display_name, headline, expertise, proof_url)",
      )
      .eq("case_id", id)
      .in("status", ["approved", "pending"]),
    supabase.from("brief_sections").select("id, position, title, body, source_note").eq("case_id", id).order("position"),
    supabase
      .from("tasks")
      .select(
        "id, section_id, lead_id, title, why_it_matters, done_looks_like, inputs, expertise, minutes, status, owner_id, last_update_at, created_at, helpers:task_helpers(user_id, status), submissions(id, author_id, body, sources, ai_check, created_at, checks(checker_id, is_ai, verdict, note, created_at))",
      )
      .eq("case_id", id)
      .order("created_at"),
    supabase
      .from("messages")
      .select("id, task_id, author_id, is_ai, kind, body, sources, pinned, created_at")
      .eq("case_id", id)
      .order("created_at"),
  ]);

  const members: Member[] = (membersRes.data ?? []).map((m) => {
    const p = (Array.isArray(m.profile) ? m.profile[0] : m.profile) as ProfileRow | null;
    const proof = m.proof_url ?? p?.proof_url ?? null;
    return {
      id: m.user_id,
      name: p?.display_name ?? "Volunteer",
      headline: p?.headline ?? "",
      // Expertise as approved for this case (fixed at join time), not the current profile.
      expertise: (m.expertise ?? p?.expertise ?? "no_medical") as Expertise,
      role: m.role as MemberRole,
      status: m.status,
      requestNote: m.request_note ?? undefined,
      hoursPerWeek: m.hours_per_week ?? undefined,
      proofUrl: proof,
      proofChecked: false,
      aiNote: m.ai_note ?? undefined,
      requestedAt: timeAgo(m.created_at),
    };
  });

  const tasks: Task[] = (tasksRes.data ?? []).map((t) => {
    const submissions: Submission[] = (t.submissions ?? [])
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map((s) => {
        const checks = s.checks ?? [];
        return {
          id: s.id,
          authorId: s.author_id,
          body: s.body,
          sources: s.sources ?? [],
          aiCheck: s.ai_check ?? undefined,
          checkedBy: checks.filter((ch) => ch.verdict === "pass").map((ch) => (ch.is_ai ? "ai" : ch.checker_id!)),
          fixRequests: checks
            .filter((ch) => ch.verdict === "needs_fix")
            .map((ch) => ({ by: ch.is_ai ? "ai" : ch.checker_id!, note: ch.note ?? "" })),
          createdAt: timeAgo(s.created_at),
        };
      });
    const helpers = t.helpers ?? [];
    return {
      id: t.id,
      sectionId: t.section_id ?? "",
      title: t.title,
      whyItMatters: t.why_it_matters,
      doneLooksLike: t.done_looks_like ?? [],
      inputs: Array.isArray(t.inputs) ? t.inputs : [],
      expertise: t.expertise,
      minutes: t.minutes,
      status: t.status as TaskStatus,
      ownerId: t.owner_id ?? undefined,
      helperIds: helpers.filter((h) => h.status === "helper").map((h) => h.user_id),
      requestedHelperIds: helpers.filter((h) => h.status === "requested").map((h) => h.user_id),
      stuckReason: t.status === "stuck" ? "needs help" : undefined,
      submissions,
      lastUpdate: timeAgo(t.last_update_at),
      leadId: t.lead_id ?? null,
    };
  });

  const sections: Section[] = (sectionsRes.data ?? []).map((s) => {
    const own = tasks.filter((t) => t.sectionId === s.id);
    const checked = own.filter((t) => t.status === "checked").length;
    const started = own.some((t) => t.status === "checked" || t.status === "submitted");
    const status = own.length > 0 && checked === own.length ? "checked" : started ? "draft" : "empty";
    const statusNote =
      own.length === 0
        ? "No tasks yet"
        : status === "checked"
          ? "Checked"
          : started
            ? `${checked} of ${own.length} parts checked`
            : "Empty";
    return { id: s.id, position: s.position, title: s.title, body: s.body, status, statusNote, sourceNote: s.source_note ?? undefined };
  });

  const messages: Message[] = (messagesRes.data ?? []).map((m) => ({
    id: m.id,
    taskId: m.task_id ?? undefined,
    authorId: m.author_id ?? undefined,
    isAi: m.is_ai,
    kind: m.kind,
    body: m.body,
    sources: m.sources ?? [],
    pinned: m.pinned,
    createdAt: timeAgo(m.created_at),
  }));

  const me = members.find((m) => m.id === userId && m.status === "approved");
  const approved = members.filter((m) => m.status === "approved");
  const neededNow = new Set(tasks.filter((t) => t.status === "open").map((t) => t.expertise));
  const missingExpertise = EXPERTISE_ORDER.filter(
    (e) => neededNow.has(e) && e !== "no_medical" && !approved.some((m) => m.expertise === e),
  ).map((e) => EXPERTISE_LABEL[e]);

  return {
    id: c.id,
    viewer: me
      ? { id: me.id, expertise: me.expertise, role: me.role, isAdmin: me.role === "creator" || me.role === "co_approver" }
      : null,
    goal: c.goal,
    summary: c.summary,
    facts: [],
    visitInDays: daysUntil(c.visit_date),
    visitDate: c.visit_date,
    isSample: c.is_sample,
    joinMode: c.join_mode,
    listed: !!c.listed,
    cancerType: c.cancer_type ?? null,
    publicGoal: c.public_goal ?? null,
    cancerStage: c.cancer_stage ?? null,
    publicPreview: !!c.public_preview,
    previewShowVisit: c.preview_show_visit !== false,
    coApproverId: members.find((m) => m.role === "co_approver" && m.status === "approved")?.id,
    creatorId: c.created_by,
    sections,
    tasks,
    members,
    messages,
    missingExpertise,
  };
}

export type MyCase = {
  id: string;
  goal: string;
  role: MemberRole;
  status: string;
  visitInDays: number | null;
};

export async function loadMyCases(): Promise<MyCase[]> {
  const userId = await getUserId();
  if (!userId) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("case_members")
    .select("case_id, role, status, created_at")
    .eq("user_id", userId)
    .in("status", ["approved", "pending"])
    .order("created_at", { ascending: false });
  if (!data?.length) return [];
  const ids = data.map((d) => d.case_id);
  const { data: cases } = await supabase.from("cases").select("id, goal, visit_date").in("id", ids);
  const byId = new Map((cases ?? []).map((c) => [c.id, c]));
  const out: MyCase[] = [];
  for (const d of data) {
    const c = byId.get(d.case_id);
    if (c) {
      out.push({ id: c.id, goal: c.goal, role: d.role, status: d.status, visitInDays: daysUntil(c.visit_date) });
    } else if (d.status === "pending") {
      const { data: t } = await supabase.rpc("case_teaser", { c: d.case_id });
      const teaser = Array.isArray(t) ? t[0] : null;
      if (teaser) out.push({ id: d.case_id, goal: teaser.goal, role: d.role, status: d.status, visitInDays: null });
    }
  }
  return out;
}

export async function loadLeaderboard(caseId: string) {
  const supabase = await createClient();
  const { data } = await supabase.rpc("case_leaderboard", { c: caseId });
  return (data ?? []) as {
    user_id: string;
    display_name: string;
    headline: string | null;
    tasks_checked: number;
    reviews_done: number;
    points: number;
  }[];
}
