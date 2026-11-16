import type { Expertise } from "@/lib/types";

/** Which skill to ask for first when several are missing. */
const ASK_ORDER: Expertise[] = ["doctor_nurse", "researcher", "bioinformatics", "insurance_legal"];

const ROLE_PHRASE: Partial<Record<Expertise, string>> = {
  doctor_nurse: "a nurse or doctor",
  researcher: "a researcher",
  bioinformatics: "someone in bioinformatics",
  insurance_legal: "someone who knows insurance",
};

export type ShareLine = { before: string; role: string; after: string };

/** "Looking for <role> who wants to help someone going through cancer.", in three parts so the role can be highlighted. */
export function shareLine(needed: readonly string[]): ShareLine {
  const first = ASK_ORDER.find((e) => needed.includes(e));
  const role = (first && ROLE_PHRASE[first]) || "someone";
  // "someone who knows insurance who wants" reads badly, so that one joins with "and".
  const after = first === "insurance_legal" ? "and wants to help someone going through cancer." : "who wants to help someone going through cancer.";
  return { before: "Looking for", role, after };
}

export function shareText(needed: readonly string[]): string {
  const l = shareLine(needed);
  return `${l.before} ${l.role} ${l.after}`;
}

/** Who a share can ask for. The slug goes in the shared link, so the card matches. */
export const SHARE_ROLES = [
  { slug: "anyone", label: "Anyone who can help", expertise: null },
  { slug: "doctor", label: "Nurse or doctor", expertise: "doctor_nurse" },
  { slug: "researcher", label: "Researcher", expertise: "researcher" },
  { slug: "bioinformatics", label: "Bioinformatics", expertise: "bioinformatics" },
  { slug: "insurance", label: "Insurance or legal", expertise: "insurance_legal" },
] as const;
export type ShareRoleSlug = (typeof SHARE_ROLES)[number]["slug"];

export function isShareRole(v: string): v is ShareRoleSlug {
  return SHARE_ROLES.some((r) => r.slug === v);
}

/** The slug the case needs most right now. */
export function suggestedRole(needed: readonly string[]): ShareRoleSlug {
  const first = ASK_ORDER.find((e) => needed.includes(e));
  return SHARE_ROLES.find((r) => r.expertise === first)?.slug ?? "anyone";
}

export function shareLineFor(slug: ShareRoleSlug): ShareLine {
  if (slug === "anyone") return { before: "Looking for", role: "anyone", after: "who wants to help someone going through cancer." };
  const e = SHARE_ROLES.find((r) => r.slug === slug)?.expertise;
  return shareLine(e ? [e] : []);
}

export function shareTextFor(slug: ShareRoleSlug): string {
  const l = shareLineFor(slug);
  return `${l.before} ${l.role} ${l.after}`;
}

/** A short value that changes when the card would change, so link previews refresh. */
export function cardVersion(parts: readonly (string | null | undefined)[]): string {
  let h = 5381;
  for (const ch of parts.map((p) => p ?? "").join("|")) h = ((h << 5) + h + ch.charCodeAt(0)) >>> 0;
  return h.toString(36);
}
