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

/** A short value that changes when the card would change, so link previews refresh. */
export function cardVersion(parts: readonly (string | null | undefined)[]): string {
  let h = 5381;
  for (const ch of parts.map((p) => p ?? "").join("|")) h = ((h << 5) + h + ch.charCodeAt(0)) >>> 0;
  return h.toString(36);
}
