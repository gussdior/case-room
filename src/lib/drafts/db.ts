import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Draft, DraftDoc } from "./types";

export const DRAFT_COLUMNS =
  "id, status, answers, sections, treatments, suggested_tasks, confirmations, identifiers, cancer_type, visit_date, privacy_ok, keep_files, case_id, updated_at";
export const DOC_COLUMNS = "id, filename, mime, size_bytes, pages, status, note, label, found, storage_path, created_at";

type DraftRow = {
  id: string;
  status: Draft["status"];
  answers: Draft["answers"] | null;
  sections: Draft["sections"] | null;
  treatments: Draft["treatments"] | null;
  suggested_tasks: Draft["suggestedTasks"] | null;
  confirmations: Draft["confirmations"] | null;
  identifiers: Draft["identifiers"] | null;
  cancer_type: string | null;
  visit_date: string | null;
  privacy_ok: boolean;
  keep_files: boolean;
  case_id: string | null;
  updated_at: string;
};

type DocRow = {
  id: string;
  filename: string;
  mime: string;
  size_bytes: number;
  pages: number | null;
  status: DraftDoc["status"];
  note: string | null;
  label: string | null;
  found: DraftDoc["found"] | null;
  storage_path: string;
};

export function toDraft(r: DraftRow): Draft {
  return {
    id: r.id,
    status: r.status,
    answers: r.answers ?? {},
    sections: r.sections ?? {},
    treatments: r.treatments ?? [],
    suggestedTasks: r.suggested_tasks ?? [],
    confirmations: r.confirmations ?? {},
    identifiers: r.identifiers ?? {},
    cancerType: r.cancer_type,
    visitDate: r.visit_date,
    privacyOk: r.privacy_ok,
    keepFiles: r.keep_files,
    caseId: r.case_id,
    updatedAt: r.updated_at,
  };
}

export function toDoc(r: DocRow): DraftDoc {
  return {
    id: r.id,
    filename: r.filename,
    mime: r.mime,
    sizeBytes: r.size_bytes,
    pages: r.pages,
    status: r.status,
    note: r.note,
    label: r.label,
    found: r.found ?? {},
    storagePath: r.storage_path,
  };
}

/** Row level security only returns the signed-in person's own drafts and files. */
export async function loadDraft(supabase: SupabaseClient, id: string) {
  const [{ data: d }, { data: docs }] = await Promise.all([
    supabase.from("case_drafts").select(DRAFT_COLUMNS).eq("id", id).maybeSingle(),
    supabase.from("case_documents").select(DOC_COLUMNS).eq("draft_id", id).order("created_at"),
  ]);
  if (!d) return null;
  return { draft: toDraft(d as DraftRow), docs: (docs ?? []).map((x) => toDoc(x as DocRow)) };
}

export async function loadOpenDrafts(supabase: SupabaseClient) {
  const { data } = await supabase
    .from("case_drafts")
    .select("id, answers, updated_at, sections")
    .eq("status", "editing")
    .order("updated_at", { ascending: false })
    .limit(3);
  return (data ?? []) as { id: string; answers: Draft["answers"]; updated_at: string; sections: Draft["sections"] }[];
}
