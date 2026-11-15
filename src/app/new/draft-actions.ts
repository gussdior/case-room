"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/auth";
import { UUID_RE } from "@/lib/time";
import { AGE_RANGES, type AgeRange } from "@/lib/types";
import { scrub, type ScrubHit } from "@/lib/drafts/scrub";
import { DRAFT_COLUMNS, toDraft } from "@/lib/drafts/db";
import {
  DRAFT_KEYS,
  DRAFT_TITLES,
  type Draft,
  type DraftAnswers,
  type DraftKey,
  type DraftSection,
  type Relationship,
  type TextKey,
} from "@/lib/drafts/types";

type Out<T = Draft> = { ok: true; draft: T } | { ok: false; error: string };

async function client() {
  if (!(await getViewer())) throw new Error("Set up your profile first.");
  return createClient();
}

async function patch(id: string, values: Record<string, unknown>): Promise<Out> {
  if (!UUID_RE.test(id)) return { ok: false, error: "That draft link is broken." };
  const supabase = await client();
  const { data, error } = await supabase
    .from("case_drafts")
    .update({ ...values, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "editing")
    .select(DRAFT_COLUMNS)
    .maybeSingle();
  if (error || !data) return { ok: false, error: "Couldn't save. Refresh the page and try again." };
  return { ok: true, draft: toDraft(data as Parameters<typeof toDraft>[0]) };
}

async function current(id: string) {
  const supabase = await client();
  const { data } = await supabase.from("case_drafts").select(DRAFT_COLUMNS).eq("id", id).maybeSingle();
  return data ? toDraft(data as Parameters<typeof toDraft>[0]) : null;
}

/** Step 1. Creates the private draft, or updates it. */
export async function saveWho(input: {
  draftId?: string;
  relationship: Relationship;
  consent: boolean;
  noIds: boolean;
  wantsToKnow: string;
}): Promise<Out> {
  try {
    if (!["myself", "family", "caregiver"].includes(input.relationship)) return { ok: false, error: "Pick who the case is for." };
    if (!input.consent)
      return { ok: false, error: "You need the patient's consent (or their legal representative's) to share this case." };
    if (!input.noIds) return { ok: false, error: "Confirm you won't add names, ID numbers, addresses or dates of birth." };
    const wants = scrub(input.wantsToKnow.trim().slice(0, 1000)).text;
    const answers: DraftAnswers = {
      relationship: input.relationship,
      consent: true,
      no_ids: true,
      wants_to_know: wants,
    };
    if (input.draftId) {
      const d = await current(input.draftId);
      if (!d) return { ok: false, error: "Draft not found." };
      const sections = { ...d.sections, wants: { ...(d.sections.wants ?? { citations: [], questions: [] }), text: wants } };
      return patch(input.draftId, { answers: { ...d.answers, ...answers }, sections });
    }
    const supabase = await client();
    const { data, error } = await supabase.from("case_drafts").insert({ answers }).select(DRAFT_COLUMNS).single();
    if (error || !data) return { ok: false, error: "Couldn't start the draft. Try again." };
    return { ok: true, draft: toDraft(data as Parameters<typeof toDraft>[0]) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Something went wrong." };
  }
}

export async function saveSectionText(id: string, key: TextKey, text: string): Promise<Out> {
  try {
    const d = await current(id);
    if (!d) return { ok: false, error: "Draft not found." };
    const old: DraftSection = d.sections[key] ?? { text: "", citations: [], questions: [] };
    const clean = text.trim().slice(0, 4000);
    // Questions whose sentence was edited away no longer apply.
    const sec: DraftSection = { ...old, text: clean, questions: old.questions.filter((q) => clean.includes(q.span)) };
    return patch(id, {
      sections: { ...d.sections, [key]: sec },
      confirmations: { ...d.confirmations, [key]: false },
      privacy_ok: false,
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Something went wrong." };
  }
}

export async function answerQuestion(id: string, key: TextKey, qid: string, answer: "yes" | "no" | "unsure"): Promise<Out> {
  try {
    const d = await current(id);
    const sec = d?.sections[key];
    const q = sec?.questions.find((x) => x.id === qid);
    if (!d || !sec || !q) return { ok: false, error: "That question is gone. Refresh the page." };
    const replacement = answer === "yes" ? q.ifYes : answer === "no" ? q.ifNo : q.ifUnsure;
    const next: DraftSection = {
      ...sec,
      text: replacement ? sec.text.replace(q.span, replacement) : sec.text,
      questions: sec.questions.filter((x) => x.id !== qid),
    };
    return patch(id, { sections: { ...d.sections, [key]: next }, privacy_ok: false });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Something went wrong." };
  }
}

export async function confirmPart(id: string, key: DraftKey, value: boolean): Promise<Out> {
  try {
    const d = await current(id);
    if (!d) return { ok: false, error: "Draft not found." };
    if (value && key !== "visit" && (d.sections[key as TextKey]?.questions.length ?? 0) > 0)
      return { ok: false, error: "Answer the highlighted question first." };
    if (value && key !== "visit" && !d.sections[key as TextKey]?.text.trim())
      return { ok: false, error: "Write at least one sentence here first, or click Edit." };
    return patch(id, { confirmations: { ...d.confirmations, [key]: value } });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Something went wrong." };
  }
}

export async function saveVisit(id: string, date: string | null): Promise<Out> {
  try {
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false, error: "Pick the date from the calendar." };
    const d = await current(id);
    if (!d) return { ok: false, error: "Draft not found." };
    return patch(id, { visit_date: date, confirmations: { ...d.confirmations, visit: true } });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Something went wrong." };
  }
}

export async function toggleTask(id: string, taskId: string, picked: boolean): Promise<Out> {
  try {
    const d = await current(id);
    if (!d) return { ok: false, error: "Draft not found." };
    return patch(id, {
      suggested_tasks: d.suggestedTasks.map((t) => (t.id === taskId ? { ...t, picked } : t)),
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Something went wrong." };
  }
}

type ScanItem = { part: string; kinds: string[] };

function scanDraft(d: Draft): { items: ScanItem[]; cleaned: Draft["sections"]; treatments: Draft["treatments"] } {
  const items: ScanItem[] = [];
  const cleaned: Draft["sections"] = {};
  for (const key of DRAFT_KEYS) {
    if (key === "visit") continue;
    const s = d.sections[key];
    if (!s) continue;
    const r = scrub(s.text);
    if (r.hits.length) items.push({ part: DRAFT_TITLES[key], kinds: [...new Set(r.hits.map((h) => h.kind))] });
    cleaned[key] = { ...s, text: r.text };
  }
  const hits: ScrubHit[] = [];
  const treatments = d.treatments.map((t) => {
    const a = scrub(t.title);
    const b = scrub(t.note);
    hits.push(...a.hits, ...b.hits);
    return { ...t, title: a.text, note: b.text };
  });
  const taskHits = d.suggestedTasks.flatMap((t) => [...scrub(t.title).hits, ...scrub(t.why).hits]);
  if (hits.length) items.push({ part: "Treatment timeline", kinds: [...new Set(hits.map((h) => h.kind))] });
  if (taskHits.length) items.push({ part: "Suggested tasks", kinds: [...new Set(taskHits.map((h) => h.kind))] });
  return { items, cleaned, treatments };
}

/** Step 4: a last automatic check of every word that will be shared. */
export async function scanPrivacy(id: string): Promise<{ ok: true; items: ScanItem[] } | { ok: false; error: string }> {
  try {
    const d = await current(id);
    if (!d) return { ok: false, error: "Draft not found." };
    return { ok: true, items: scanDraft(d).items };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Something went wrong." };
  }
}

export async function hideFound(id: string): Promise<Out> {
  try {
    const d = await current(id);
    if (!d) return { ok: false, error: "Draft not found." };
    const { cleaned, treatments } = scanDraft(d);
    const tasks = d.suggestedTasks.map((t) => ({ ...t, title: scrub(t.title).text, why: scrub(t.why).text }));
    return patch(id, { sections: { ...d.sections, ...cleaned }, treatments, suggested_tasks: tasks });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Something went wrong." };
  }
}

export async function savePrivacy(id: string, ok: boolean, keepFiles: boolean): Promise<Out> {
  try {
    const d = await current(id);
    if (!d) return { ok: false, error: "Draft not found." };
    if (ok && scanDraft(d).items.length) return { ok: false, error: "Hide what the scan found first." };
    return patch(id, { privacy_ok: ok, keep_files: keepFiles });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Something went wrong." };
  }
}

async function removeFiles(id: string) {
  const supabase = await client();
  const { data: docs } = await supabase.from("case_documents").select("id, storage_path").eq("draft_id", id);
  const paths = (docs ?? []).map((x) => x.storage_path as string);
  if (paths.length) {
    let { error } = await supabase.storage.from("case-docs").remove(paths);
    if (error) ({ error } = await supabase.storage.from("case-docs").remove(paths));
    if (error) {
      console.error("Could not remove draft files after two tries", { draftId: id, message: error.message });
      return false;
    }
  }
  await supabase.from("case_documents").delete().eq("draft_id", id);
  return true;
}

/** Removes the original files from storage. What the AI already found stays in the draft text. */
export async function deleteMyFiles(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    if (!UUID_RE.test(id)) return { ok: false, error: "That draft link is broken." };
    return (await removeFiles(id)) ? { ok: true } : { ok: false, error: "Couldn't delete the files. Try again." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Something went wrong." };
  }
}

export async function deleteOneFile(draftId: string, docId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    if (!UUID_RE.test(draftId) || !UUID_RE.test(docId)) return { ok: false, error: "That link is broken." };
    const supabase = await client();
    const { data: doc } = await supabase
      .from("case_documents")
      .select("storage_path")
      .eq("id", docId)
      .eq("draft_id", draftId)
      .maybeSingle();
    if (!doc) return { ok: true };
    await supabase.storage.from("case-docs").remove([doc.storage_path as string]);
    await supabase.from("case_documents").delete().eq("id", docId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Something went wrong." };
  }
}

/** Step 5. Checks once more for identifiers, then opens the case. */
/** Last step: the case title (goal) and the short facts shown under it. */
export async function saveOpenDetails(
  id: string,
  input: { goal: string; ageRange: string; currentTreatment: string; stage: string },
): Promise<Out> {
  try {
    const d = await current(id);
    if (!d) return { ok: false, error: "Draft not found." };
    const goal = scrub(input.goal.replace(/\s+/g, " ").trim().slice(0, 200)).text;
    const answers: DraftAnswers = {
      ...d.answers,
      goal,
      age_range: AGE_RANGES.includes(input.ageRange as AgeRange) ? input.ageRange : "",
      current_treatment: scrub(input.currentTreatment.trim().slice(0, 80)).text,
      cancer_stage: scrub(input.stage.trim().slice(0, 40)).text,
    };
    return patch(id, { answers });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Something went wrong." };
  }
}

export async function publishDraft(id: string): Promise<{ ok: true; caseId: string } | { ok: false; error: string }> {
  try {
    const d = await current(id);
    if (!d) return { ok: false, error: "Draft not found." };
    if (d.caseId) return { ok: true, caseId: d.caseId };
    if (scanDraft(d).items.length) return { ok: false, error: "Something still looks like a name or ID. Go back to the privacy check." };
    const goal = (d.answers.goal ?? "").trim();
    if (goal.length < 10) return { ok: false, error: "Write the goal of this case as a plain sentence of at least 10 characters." };
    const supabase = await client();
    const { data, error } = await supabase.rpc("publish_draft", { d: id });
    if (error || !data) return { ok: false, error: error?.message?.split("\n")[0] || "Couldn't open the case." };
    // The goal the family wrote is the case title. Facts show under it.
    await supabase.rpc("set_case_facts", {
      c: data,
      p_goal: goal,
      p_age_range: d.answers.age_range || null,
      p_current_treatment: d.answers.current_treatment || null,
      p_cancer_type: null,
      p_cancer_stage: d.answers.cancer_stage || null,
    });
    if (!d.keepFiles) await removeFiles(id);
    revalidatePath("/cases");
    return { ok: true, caseId: data as string };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Something went wrong." };
  }
}

export async function discardDraft(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    if (!UUID_RE.test(id)) return { ok: false, error: "That draft link is broken." };
    await removeFiles(id);
    const supabase = await client();
    await supabase.from("case_drafts").delete().eq("id", id).eq("status", "editing");
    revalidatePath("/new");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Something went wrong." };
  }
}
