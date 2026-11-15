"use server";

import { revalidatePath } from "next/cache";
import { getUserId } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { UUID_RE } from "@/lib/time";

export type ShareResult = { error?: string; ok?: string } | undefined;

async function check(...ids: string[]): Promise<ShareResult> {
  if (!(await getUserId())) return { error: "Your sign in expired. Sign in again." };
  if (ids.some((id) => !UUID_RE.test(id))) return { error: "That link is broken." };
  return undefined;
}

/** "I posted here": ticks or unticks one place. Creator only. */
export async function setPosted(caseId: string, outreachId: string, posted: boolean): Promise<ShareResult> {
  const bad = await check(caseId, outreachId);
  if (bad) return bad;
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_outreach_posted", { o: outreachId, p_posted: posted });
  if (error) return { error: "Couldn't save that. Try again." };
  revalidatePath(`/case/${caseId}/share`);
  return { ok: posted ? "Marked as posted." : "Unmarked." };
}

/** Turns on the public preview so posted links show something. Creator only. */
export async function turnOnPreview(caseId: string): Promise<ShareResult> {
  const bad = await check(caseId);
  if (bad) return bad;
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_public_preview", { c: caseId, p_on: true });
  if (error) return { error: "Only the case creator can turn on the public preview." };
  revalidatePath(`/case/${caseId}`, "layout");
  return { ok: "The public preview is on." };
}
