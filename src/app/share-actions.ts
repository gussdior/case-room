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

const AI_LINK_ROLES = ["everyone", "researcher", "doctor_nurse", "bioinformatics", "insurance_legal"];

export type AiLinkResult = { error?: string; token?: string } | undefined;

/** Creates a link any AI can read. Any approved member of the case; the database checks membership and the limit of 10. */
export async function createAiLink(
  caseId: string,
  role: string,
  includes: { genes_treatments: boolean; leads: boolean; ruled_out: boolean; runs: boolean },
  days: number,
): Promise<AiLinkResult> {
  const bad = await check(caseId);
  if (bad) return bad;
  if (!AI_LINK_ROLES.includes(role) || ![1, 7, 30].includes(days)) return { error: "Pick a role and how long the link should work." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_ai_link", {
    c: caseId,
    p_role: role,
    p_includes: {
      genes_treatments: !!includes.genes_treatments,
      leads: !!includes.leads,
      ruled_out: !!includes.ruled_out,
      runs: !!includes.runs,
    },
    p_days: days,
  });
  if (error) {
    const m = error.message ?? "";
    if (m.includes("10 active")) return { error: "This case already has 10 active AI links. Turn one off first." };
    if (m.includes("turned off")) return { error: "The case creator has turned off AI links for this case." };
    return { error: "Couldn't create the link. Try again." };
  }
  const token = (data as { token?: string } | null)?.token;
  if (!token) return { error: "Couldn't create the link. Try again." };
  revalidatePath(`/case/${caseId}/share`);
  return { token };
}

/** Turns one AI link off. The person who made it, the creator or a co-approver. */
export async function revokeAiLink(caseId: string, linkId: string): Promise<ShareResult> {
  const bad = await check(caseId, linkId);
  if (bad) return bad;
  const supabase = await createClient();
  const { error } = await supabase.rpc("revoke_ai_link", { l: linkId });
  if (error) return { error: "Only the person who made this link, the case creator or a co-approver can turn it off." };
  revalidatePath(`/case/${caseId}/share`);
  return { ok: "The link is off." };
}

/** The creator's switch for AI links. Off blocks new links and stops every existing one. */
export async function setAiLinksAllowed(caseId: string, on: boolean): Promise<ShareResult> {
  const bad = await check(caseId);
  if (bad) return bad;
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_ai_links_allowed", { c: caseId, p_on: on });
  if (error) return { error: "Only the case creator can change this." };
  revalidatePath(`/case/${caseId}`, "layout");
  return { ok: on ? "AI links are allowed." : "AI links are off. Existing links stopped working." };
}
