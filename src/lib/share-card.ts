import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { SAMPLE_CASE } from "@/lib/sample-case";
import { UUID_RE } from "@/lib/time";
import type { Expertise } from "@/lib/types";

export type ShareCard = {
  cancerType: string | null;
  cancerStage: string | null;
  /** Skills the case is missing. */
  needed: Expertise[];
  /** Professions already helping, most common first. Never names. */
  seats: Expertise[];
  publicPreview: boolean;
};

/** The sample case always shows its card. */
export const SAMPLE_SHARE_CARD: ShareCard = {
  cancerType: SAMPLE_CASE.cancerType ?? null,
  cancerStage: SAMPLE_CASE.cancerStage ?? null,
  needed: ["doctor_nurse"],
  seats: ["researcher", "bioinformatics"],
  publicPreview: true,
};

/** What the share card may show. Null when the case is private to this viewer or doesn't exist. */
export const loadShareCard = cache(async (id: string): Promise<ShareCard | null> => {
  if (id === SAMPLE_CASE.id) return SAMPLE_SHARE_CARD;
  if (!UUID_RE.test(id)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("case_share_card", { c: id });
  if (error) return null;
  const r = Array.isArray(data) ? data[0] : null;
  if (!r) return null;
  return {
    cancerType: r.cancer_type ?? null,
    cancerStage: r.cancer_stage ?? null,
    needed: (r.needed ?? []) as Expertise[],
    seats: (r.seats ?? []) as Expertise[],
    publicPreview: !!r.public_preview,
  };
});
