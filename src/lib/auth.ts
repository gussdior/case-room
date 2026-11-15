import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient, supabaseConfigured } from "./supabase/server";
import type { Expertise } from "./types";

export type Viewer = {
  id: string;
  email?: string;
  name: string;
  headline: string;
  expertise: Expertise;
  proofUrl: string | null;
};

/** The signed in user id, verified, or null. */
export const getUserId = cache(async (): Promise<string | null> => {
  if (!supabaseConfigured()) return null;
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return (data?.claims?.sub as string | undefined) ?? null;
});

/** The signed in user's profile, or null if signed out or not set up yet. */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const id = await getUserId();
  if (!id) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, display_name, headline, expertise, proof_url, deleted_at")
    .eq("id", id)
    .maybeSingle();
  // A deleted account starts over: no profile until they set one up again.
  if (!data || data.deleted_at) return null;
  return {
    id: data.id,
    name: data.display_name,
    headline: data.headline ?? "",
    expertise: data.expertise as Expertise,
    proofUrl: data.proof_url,
  };
});

/** Use in pages that need a signed in user with a profile. */
export async function requireViewer(next: string): Promise<Viewer> {
  const id = await getUserId();
  if (!id) redirect(`/login?next=${encodeURIComponent(next)}`);
  const viewer = await getViewer();
  if (!viewer) redirect(`/onboarding?next=${encodeURIComponent(next)}`);
  return viewer;
}

/** Only allow redirects to paths on this site. */
export function safeNext(next: unknown, fallback = "/cases"): string {
  if (typeof next !== "string" || next.length > 500) return fallback;
  // No control characters or backslashes (browsers strip or flip them into "//evil.com").
  if (/[\u0000-\u001f\u007f\\]/.test(next)) return fallback;
  if (!next.startsWith("/") || next.startsWith("//")) return fallback;
  try {
    const base = "http://local.invalid";
    const u = new URL(next, base);
    if (u.origin !== base) return fallback;
    return u.pathname + u.search + u.hash;
  } catch {
    return fallback;
  }
}
