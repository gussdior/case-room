"use server";

import { revalidatePath } from "next/cache";
import { getUserId } from "@/lib/auth";
import { scrub } from "@/lib/drafts/scrub";
import { createClient } from "@/lib/supabase/server";
import { UUID_RE } from "@/lib/time";

export type QuestionResult = { error?: string; ok?: string } | undefined;

// Messages from our own database functions, safe to show as they are.
const OUR_ERRORS = [
  "Sign in first",
  "Write a question first",
  "Keep it under 500 characters",
  "This case is not taking questions",
  "You are already on this case. Ask in the discussion instead",
  "You have 3 questions waiting for a reply. Wait for an answer first",
  "Question not found",
  "Write a reply first",
  "Keep the reply under 1000 characters",
  "Only the case creator or co-approver can do this",
  "Reply first, then show it on the public page",
  "Only the case creator or co-approver can invite",
  "They are already on the case",
];

function friendly(error: { message?: string } | null): QuestionResult {
  if (!error) return undefined;
  const known = OUR_ERRORS.find((m) => error.message?.includes(m));
  return { error: known ? `${known}.` : "Something went wrong. Try again." };
}

async function ready(...ids: string[]): Promise<QuestionResult> {
  if (!(await getUserId())) return { error: "Your sign in expired. Sign in again." };
  if (ids.some((id) => !UUID_RE.test(id))) return { error: "That link is broken." };
  return undefined;
}

// Asking for or offering money is never allowed on Case Room.
const MONEY =
  /\b(?:pay|paid|paying|payment|fee|fees|invoice|donat\w*|venmo|paypal|zelle|cash ?app|crypto|bitcoin|wire transfer|gofundme|bank account|\d+\s?(?:usd|dollars))\b|\$\s?\d/i;

function refresh(caseId: string) {
  revalidatePath(`/case/${caseId}`, "layout");
}

/** A visitor asks the team a question from the public preview. */
export async function askQuestion(caseId: string, _: QuestionResult, form: FormData): Promise<QuestionResult> {
  const bad = await ready(caseId);
  if (bad) return bad;
  const raw = String(form.get("body") ?? "").trim();
  if (raw.length < 3) return { error: "Write a question first." };
  if (raw.length > 500) return { error: "Keep it under 500 characters." };
  if (MONEY.test(raw)) {
    return { error: "Questions about money can't be sent here. Nobody on Case Room pays or gets paid. Try asking it another way." };
  }
  const { text } = scrub(raw);
  const supabase = await createClient();
  const { error } = await supabase.rpc("ask_case_question", { c: caseId, p_body: text });
  if (error) return friendly(error);
  refresh(caseId);
  return { ok: "Sent. The team will reply here." };
}

/** Any approved member replies to a question. */
export async function answerQuestion(caseId: string, questionId: string, _: QuestionResult, form: FormData): Promise<QuestionResult> {
  const bad = await ready(caseId, questionId);
  if (bad) return bad;
  const raw = String(form.get("reply") ?? "").trim();
  if (raw.length < 2) return { error: "Write a reply first." };
  if (raw.length > 1000) return { error: "Keep the reply under 1000 characters." };
  const { text } = scrub(raw);
  const supabase = await createClient();
  const { error } = await supabase.rpc("answer_case_question", { q: questionId, p_reply: text });
  if (error) return friendly(error);
  refresh(caseId);
  return { ok: "Reply sent." };
}

/** Creator or co-approver: show or hide an answered question on the public page. */
export async function setQuestionPublic(caseId: string, questionId: string, isPublic: boolean): Promise<QuestionResult> {
  const bad = await ready(caseId, questionId);
  if (bad) return bad;
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_question_public", { q: questionId, p_public: isPublic });
  if (error) return friendly(error);
  refresh(caseId);
  return { ok: isPublic ? "Shown on the public page." : "Hidden from the public page." };
}

/** Creator or co-approver: invite the person who asked to join the case. */
export async function inviteAsker(caseId: string, questionId: string): Promise<QuestionResult> {
  const bad = await ready(caseId, questionId);
  if (bad) return bad;
  const supabase = await createClient();
  const { error } = await supabase.rpc("invite_question_asker", { q: questionId });
  if (error) return friendly(error);
  refresh(caseId);
  return { ok: "Invited. They can now see the case." };
}
