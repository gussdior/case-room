import "server-only";
import { createClient, supabaseConfigured } from "@/lib/supabase/server";
import type { Expertise } from "@/lib/types";

// Only what a listed case's creator agreed to show: counts and labels, never names or case text.
export type PublicCase = {
  id: string;
  cancerType: string;
  cancerStage: string | null;
  goal: string;
  promising: number;
  exploring: number;
  needsSomeone: number;
  ruledOut: number;
  helpers: number;
  professions: Expertise[];
  needed: Expertise[];
  lastActivity: string;
};

export type PublicStats = { cases: number; volunteers: number; leadsChecked: number; aiRuns: number };

type Row = {
  case_id: string;
  cancer_type: string;
  cancer_stage: string | null;
  public_goal: string;
  leads_promising: number;
  leads_exploring: number;
  leads_needs_someone: number;
  leads_ruled_out: number;
  helpers: number;
  professions: string[];
  needed: string[];
  last_activity: string;
};

// Local screenshots only: fake cards when the database is unreachable from a sandbox.
const PREVIEW = process.env.NODE_ENV !== "production" && process.env.CASEROOM_PREVIEW_PUBLIC === "1";

export async function loadPublicCases(limit = 6): Promise<PublicCase[]> {
  if (PREVIEW) return previewCases().slice(0, limit);
  if (!supabaseConfigured()) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("public_cases", { p_limit: limit });
  if (error || !data) return [];
  return (data as Row[]).map((r) => ({
    id: r.case_id,
    cancerType: r.cancer_type,
    cancerStage: r.cancer_stage,
    goal: r.public_goal,
    promising: r.leads_promising,
    exploring: r.leads_exploring,
    needsSomeone: r.leads_needs_someone,
    ruledOut: r.leads_ruled_out,
    helpers: r.helpers,
    professions: (r.professions ?? []) as Expertise[],
    needed: (r.needed ?? []) as Expertise[],
    lastActivity: r.last_activity,
  }));
}

export async function loadPublicStats(): Promise<PublicStats | null> {
  if (PREVIEW) return { cases: 3, volunteers: 18, leadsChecked: 11, aiRuns: 240 };
  if (!supabaseConfigured()) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("public_stats");
  const row = Array.isArray(data) ? data[0] : data;
  if (error || !row) return null;
  return { cases: row.listed_cases, volunteers: row.volunteers, leadsChecked: row.leads_checked, aiRuns: row.ai_runs };
}

// Shown only when there are no real listed cases, clearly labeled as a sample.
export const SAMPLE_PUBLIC_CASE: PublicCase = {
  id: "sample",
  cancerType: "Lung cancer",
  cancerStage: "Stage IV",
  goal: "Find her next options after the first targeted pill stopped working",
  promising: 2,
  exploring: 3,
  needsSomeone: 1,
  ruledOut: 4,
  helpers: 6,
  professions: ["doctor_nurse", "researcher", "bioinformatics", "insurance_legal"],
  needed: ["doctor_nurse"],
  lastActivity: new Date().toISOString(),
};

function previewCases(): PublicCase[] {
  const now = new Date().toISOString();
  return [
    { ...SAMPLE_PUBLIC_CASE, id: "p1", professions: ["researcher", "doctor_nurse", "bioinformatics"], lastActivity: now },
    {
      id: "p2",
      cancerType: "Pancreatic cancer",
      cancerStage: "Stage III",
      goal: "Check if any trials take people after two rounds of chemo",
      promising: 0,
      exploring: 4,
      needsSomeone: 1,
      ruledOut: 0,
      helpers: 5,
      professions: ["researcher", "insurance_legal"],
      needed: ["insurance_legal"],
      lastActivity: now,
    },
    {
      id: "p3",
      cancerType: "Brain cancer",
      cancerStage: "Glioblastoma",
      goal: "Understand the gene report and what it opens up",
      promising: 1,
      exploring: 2,
      needsSomeone: 0,
      ruledOut: 0,
      helpers: 3,
      professions: ["bioinformatics"],
      needed: ["bioinformatics", "doctor_nurse"],
      lastActivity: now,
    },
  ];
}
