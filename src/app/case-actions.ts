"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getUserId, getViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { UUID_RE } from "@/lib/time";
import { AGE_RANGES, EXPERTISE_ORDER, type AgeRange, type Expertise } from "@/lib/types";

// Every action here is also enforced by the database's access rules.
// The checks in this file only give clearer messages.

type Result = { error?: string; ok?: string } | undefined;

const OUR_ERRORS = [
  "Patient consent is required",
  "Add a goal",
  "Sign in first",
  "Only the case creator or co-approver can decide",
  "No pending request",
  "Not allowed",
  "The creator cannot be removed",
  "Join the case first",
  "Someone already took this task. Offer to help instead.",
  "Only the task owner can add helpers",
  "Only the task owner can change this",
  "Only the case creator or co-approver can change settings",
  "Only the case creator can change how the case is listed",
  "Add a one line public goal before listing the case",
  "Only the case creator can choose a co-approver",
  "Only the case creator can list the case",
  "Only the case creator can change the public preview",
  "Pick an approved volunteer",
  "Only the case creator or co-approver can pin",
  "Section does not belong to this case",
];

function friendly(error: { message?: string; code?: string } | null): Result {
  if (!error) return undefined;
  const known = OUR_ERRORS.find((m) => error.message?.includes(m));
  if (known) return { error: known };
  if (error.code === "23505") return { error: "That was already done." };
  if (error.code === "42501" || error.message?.includes("row-level security"))
    return { error: "You can't do that on this case." };
  return { error: "Something went wrong. Try again." };
}

async function ready(...ids: (string | null | undefined)[]): Promise<Result> {
  if (!(await getUserId())) return { error: "Your sign in expired. Sign in again." };
  if (ids.some((id) => id != null && !UUID_RE.test(id))) return { error: "That link is broken." };
  return undefined;
}

function refresh(caseId: string) {
  revalidatePath(`/case/${caseId}`, "layout");
  revalidatePath("/cases");
}

function text(form: FormData, key: string, max: number): string {
  return String(form.get(key) ?? "").trim().slice(0, max);
}

function parseUrls(raw: string): string[] | "invalid" {
  const parts = raw
    .split(/[\s,]+/)
    .map((p) => p.trim())
    .filter(Boolean);
  const out: string[] = [];
  for (const p of parts) {
    try {
      const u = new URL(p);
      if (u.protocol !== "https:" && u.protocol !== "http:") return "invalid";
      out.push(u.toString());
    } catch {
      return "invalid";
    }
  }
  return out.slice(0, 20);
}

// ---------- Cases ----------

export async function createCase(_: Result, form: FormData): Promise<Result> {
  const bad = await ready();
  if (bad) return bad;
  if (!(await getViewer())) return { error: "Set up your profile first." };

  const goal = text(form, "goal", 200);
  const summary = text(form, "summary", 4000);
  const visit = text(form, "visit", 10) || null;
  const consent = form.get("consent") === "on";
  const noIds = form.get("no_ids") === "on";

  if (goal.length < 10) return { error: "Write the goal of this case as a plain sentence of at least 10 characters." };
  if (!consent) return { error: "You need the patient's consent (or their legal representative's) to share this case." };
  if (!noIds) return { error: "Confirm the summary has no names, ID numbers, addresses or dates of birth." };
  if (visit && !/^\d{4}-\d{2}-\d{2}$/.test(visit)) return { error: "Pick the visit date from the calendar." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_case", {
    p_goal: goal,
    p_summary: summary,
    p_consent: true,
    p_visit: visit,
  });
  if (error || !data) return friendly(error) ?? { error: "Couldn't create the case." };
  const age = text(form, "age_range", 20);
  const current = text(form, "current_treatment", 80);
  const cancerType = text(form, "cancer_type", 60);
  const stage = text(form, "cancer_stage", 40);
  if (age || current || cancerType || stage) {
    await supabase.rpc("set_case_facts", {
      c: data,
      p_goal: null,
      p_age_range: AGE_RANGES.includes(age as AgeRange) ? age : null,
      p_current_treatment: current || null,
      p_cancer_type: cancerType || null,
      p_cancer_stage: stage || null,
    });
  }
  revalidatePath("/cases");
  // Last step: Find your helpers. It also asks the AI to suggest leads and draft the brief right away.
  redirect(`/case/${data}/share?new=manual`);
}

export async function updateCaseSettings(caseId: string, _: Result, form: FormData): Promise<Result> {
  const bad = await ready(caseId);
  if (bad) return bad;
  const goal = text(form, "goal", 200);
  const summary = text(form, "summary", 4000);
  const visit = text(form, "visit", 10) || null;
  const joinMode = form.get("join_mode") === "invite_only" ? "invite_only" : "approve";
  if (goal.length < 10) return { error: "Write the goal as a plain sentence of at least 10 characters." };
  if (form.has("listed_present") && form.get("listed") === "on") {
    const pg = text(form, "public_goal", 140);
    if (pg.length < 10) return { error: "Write a one line public goal of at least 10 characters before listing the case." };
  }
  if (visit && !/^\d{4}-\d{2}-\d{2}$/.test(visit)) return { error: "Pick the visit date from the calendar." };
  const supabase = await createClient();
  // Forms with the "listed" switch (creator only) use the newer settings call.
  const withListing = form.has("listed_present");
  const cancerType = text(form, "cancer_type", 60);
  const { error } = await supabase.rpc(
    "update_case_settings",
    withListing
      ? {
          c: caseId,
          p_goal: goal,
          p_summary: summary,
          p_visit: visit,
          p_join_mode: joinMode,
          p_listed: form.get("listed") === "on",
          p_cancer_type: cancerType,
          p_public_goal: text(form, "public_goal", 140) || null,
          p_cancer_stage: text(form, "cancer_stage", 40) || null,
          p_public_preview: form.get("public_preview") === "on" || form.get("listed") === "on",
          p_preview_show_visit: form.get("preview_show_visit") === "on",
        }
      : { c: caseId, p_goal: goal, p_summary: summary, p_visit: visit, p_join_mode: joinMode },
  );
  if (error) return friendly(error);
  if (form.has("facts_present")) {
    const age = text(form, "age_range", 20);
    const { error: factsError } = await supabase.rpc("set_case_facts", {
      c: caseId,
      p_goal: null,
      p_age_range: AGE_RANGES.includes(age as AgeRange) ? age : null,
      p_current_treatment: text(form, "current_treatment", 80) || null,
    });
    if (factsError) return friendly(factsError);
  }
  refresh(caseId);
  if (withListing && form.get("listed") === "on" && form.get("had_preview") !== "1")
    return { ok: "Saved. Listing the case also turned on the public preview." };
  return { ok: "Saved." };
}

// ---------- Joining and people ----------

export async function requestToJoin(caseId: string, _: Result, form: FormData): Promise<Result> {
  const bad = await ready(caseId);
  if (bad) return bad;
  const viewer = await getViewer();
  if (!viewer) return { error: "Set up your profile first." };

  const note = text(form, "note", 500);
  const hoursRaw = Number(form.get("hours"));
  const hours = Number.isFinite(hoursRaw) && hoursRaw > 0 ? Math.min(80, Math.round(hoursRaw)) : null;
  const proofList = parseUrls(text(form, "proof", 500));
  if (proofList === "invalid") return { error: "The link should start with https://" };
  const proof = proofList[0] ?? viewer.proofUrl ?? null;
  const rules = form.get("rules") === "on";

  if (note.length < 10) return { error: "Say in a sentence or two how you can help." };
  if (!rules) return { error: "Agree to the room rules to ask to join." };
  if (viewer.expertise === "doctor_nurse" && !proof)
    return { error: "Doctors and nurses need a link that shows their license or workplace." };

  const supabase = await createClient();
  const { error } = await supabase.from("case_members").insert({
    case_id: caseId,
    user_id: viewer.id,
    request_note: note,
    hours_per_week: hours,
    proof_url: proof,
  });
  if (error) {
    if (error.code === "23505") return { error: "You already asked to join this case." };
    return friendly(error);
  }
  refresh(caseId);
  return { ok: "Request sent. You'll see the case once the creator approves you." };
}

export async function decideRequest(caseId: string, userId: string, approve: boolean): Promise<Result> {
  const bad = await ready(caseId, userId);
  if (bad) return bad;
  const supabase = await createClient();
  const { error } = await supabase.rpc("decide_join_request", { c: caseId, u: userId, approve });
  if (error) return friendly(error);
  refresh(caseId);
  return { ok: approve ? "Approved." : "Declined." };
}

export async function removeMember(caseId: string, userId: string): Promise<Result> {
  const bad = await ready(caseId, userId);
  if (bad) return bad;
  const supabase = await createClient();
  const { error } = await supabase.rpc("remove_member", { c: caseId, u: userId });
  if (error) return friendly(error);
  refresh(caseId);
  return { ok: "Removed." };
}

export async function setCoApprover(caseId: string, _: Result, form: FormData): Promise<Result> {
  const userId = String(form.get("user") ?? "");
  const bad = await ready(caseId, userId || null);
  if (bad) return bad;
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_co_approver", { c: caseId, u: userId || null });
  if (error) return friendly(error);
  refresh(caseId);
  return { ok: "Saved." };
}

// ---------- Tasks ----------

export async function claimTask(caseId: string, taskId: string): Promise<Result> {
  const bad = await ready(caseId, taskId);
  if (bad) return bad;
  const supabase = await createClient();
  const { error } = await supabase.rpc("claim_task", { t: taskId });
  if (error) return friendly(error);
  refresh(caseId);
  redirect(`/case/${caseId}/task/${taskId}`);
}

export async function releaseTask(caseId: string, taskId: string): Promise<Result> {
  const bad = await ready(caseId, taskId);
  if (bad) return bad;
  const supabase = await createClient();
  const { error } = await supabase.rpc("release_task", { t: taskId });
  if (error) return friendly(error);
  refresh(caseId);
  return { ok: "Task handed back." };
}

export async function setStuck(caseId: string, taskId: string, stuck: boolean, _: Result, form: FormData): Promise<Result> {
  const bad = await ready(caseId, taskId);
  if (bad) return bad;
  const reason = text(form, "reason", 1000);
  if (stuck && reason.length < 5) return { error: "Say what you're stuck on so others can help." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_task_stuck", { t: taskId, stuck });
  if (error) return friendly(error);
  const userId = await getUserId();
  await supabase.from("messages").insert({
    case_id: caseId,
    task_id: taskId,
    author_id: userId,
    kind: stuck ? "stuck" : "message",
    body: stuck ? reason : "Unstuck, working on it again.",
  });
  refresh(caseId);
  return { ok: stuck ? "Marked as stuck. Others can see it and help." : "Back in progress." };
}

export async function offerHelp(caseId: string, taskId: string, _: Result, form: FormData): Promise<Result> {
  const bad = await ready(caseId, taskId);
  if (bad) return bad;
  const note = text(form, "note", 1000);
  if (note.length < 5) return { error: "Say how you'd like to help." };
  const userId = await getUserId();
  const supabase = await createClient();
  const { error } = await supabase.from("task_helpers").insert({ task_id: taskId, user_id: userId });
  if (error && error.code !== "23505") return friendly(error);
  await supabase.from("messages").insert({ case_id: caseId, task_id: taskId, author_id: userId, body: note });
  refresh(caseId);
  return { ok: "Sent. The task owner can add you as a helper." };
}

export async function acceptHelper(caseId: string, taskId: string, userId: string): Promise<Result> {
  const bad = await ready(caseId, taskId, userId);
  if (bad) return bad;
  const supabase = await createClient();
  const { error } = await supabase.rpc("accept_helper", { t: taskId, u: userId });
  if (error) return friendly(error);
  refresh(caseId);
  return { ok: "Added as helper." };
}

export async function addTask(caseId: string, _: Result, form: FormData): Promise<Result> {
  const bad = await ready(caseId);
  if (bad) return bad;
  const title = text(form, "title", 200);
  const sectionId = String(form.get("section") ?? "");
  const expertise = String(form.get("expertise") ?? "") as Expertise;
  const minutes = Math.min(120, Math.max(10, Number(form.get("minutes")) || 45));
  const why = text(form, "why", 1000);
  const done = text(form, "done", 2000)
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 10);

  if (title.length < 5) return { error: "Describe the task in a few words." };
  if (!UUID_RE.test(sectionId)) return { error: "Pick which part of the brief it fills." };
  if (!EXPERTISE_ORDER.includes(expertise)) return { error: "Pick who it's for." };

  const userId = await getUserId();
  const supabase = await createClient();
  const { error } = await supabase.from("tasks").insert({
    case_id: caseId,
    section_id: sectionId,
    title,
    why_it_matters: why,
    done_looks_like: done,
    expertise,
    minutes,
    created_by: userId,
  });
  if (error) return friendly(error);
  refresh(caseId);
  return { ok: "Gap added to the brief." };
}

// ---------- Work and checks ----------

export async function submitWork(caseId: string, taskId: string, _: Result, form: FormData): Promise<Result> {
  const bad = await ready(caseId, taskId);
  if (bad) return bad;
  const body = text(form, "body", 10000);
  const sources = parseUrls(text(form, "sources", 4000));
  if (body.length < 20) return { error: "Write up what you found (at least a couple of sentences)." };
  if (sources === "invalid") return { error: "Each source must be a full link starting with https://" };
  if (sources.length === 0) return { error: "Add at least one source link. Every claim needs a source." };

  const userId = await getUserId();
  const supabase = await createClient();
  const { error } = await supabase.from("submissions").insert({ task_id: taskId, author_id: userId, body, sources, ai_assisted: form.get("ai_assisted") === "on" });
  if (error) return friendly(error);
  refresh(caseId);
  return { ok: "Submitted. It goes into the brief once someone checks it." };
}

export async function checkWork(caseId: string, submissionId: string, _: Result, form: FormData): Promise<Result> {
  const bad = await ready(caseId, submissionId);
  if (bad) return bad;
  const verdict = form.get("verdict") === "pass" ? "pass" : "needs_fix";
  const note = text(form, "note", 2000);
  const confirmed = form.get("confirmed") === "on";
  if (verdict === "pass" && !confirmed) return { error: "Confirm you opened the sources and they support the work." };
  if (verdict === "needs_fix" && note.length < 5) return { error: "Say what needs fixing." };

  const userId = await getUserId();
  const supabase = await createClient();
  const { error } = await supabase
    .from("checks")
    .insert({ submission_id: submissionId, checker_id: userId, verdict, note: note || null });
  if (error) {
    if (error.message?.includes("row-level security"))
      return {
        error:
          "You can't check this one. Checks must come from someone else with the same expertise as the task, or a doctor or nurse.",
      };
    return friendly(error);
  }
  refresh(caseId);
  return { ok: verdict === "pass" ? "Checked. It's now in the brief." : "Sent back with your note." };
}

// ---------- Messages ----------

export async function postMessage(caseId: string, taskId: string | null, _: Result, form: FormData): Promise<Result> {
  const bad = await ready(caseId, taskId);
  if (bad) return bad;
  const body = text(form, "body", 4000);
  const sources = parseUrls(text(form, "source", 1000));
  if (!body) return { error: "Write a message first." };
  if (sources === "invalid") return { error: "The source must be a full link starting with https://" };
  const userId = await getUserId();
  const supabase = await createClient();
  const { error } = await supabase
    .from("messages")
    .insert({ case_id: caseId, task_id: taskId, author_id: userId, body, sources });
  if (error) return friendly(error);
  refresh(caseId);
  return { ok: "Posted." };
}

export async function reportMessage(caseId: string, messageId: string, _: Result, form: FormData): Promise<Result> {
  const bad = await ready(caseId, messageId);
  if (bad) return bad;
  const reason = text(form, "reason", 500);
  if (reason.length < 3) return { error: "Say briefly what's wrong." };
  const userId = await getUserId();
  const supabase = await createClient();
  const { error } = await supabase.from("reports").insert({ message_id: messageId, reporter_id: userId, reason });
  if (error) {
    if (error.code === "23505") return { ok: "You already reported this." };
    return friendly(error);
  }
  return { ok: "Reported. The case creator will review it." };
}

export async function pinMessage(caseId: string, messageId: string, pin: boolean): Promise<Result> {
  const bad = await ready(caseId, messageId);
  if (bad) return bad;
  const supabase = await createClient();
  const { error } = await supabase.rpc("pin_message", { m: messageId, p: pin });
  if (error) return friendly(error);
  refresh(caseId);
  return { ok: pin ? "Pinned." : "Unpinned." };
}
