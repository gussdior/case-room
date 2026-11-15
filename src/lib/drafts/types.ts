import type { Expertise } from "@/lib/types";

/** Draft parts the family confirms one by one, in order. */
export const DRAFT_KEYS = ["plain", "treatments", "now", "visit", "wants"] as const;
export type DraftKey = (typeof DRAFT_KEYS)[number];
export type TextKey = Exclude<DraftKey, "visit">;

export const DRAFT_TITLES: Record<DraftKey, string> = {
  plain: "The case in plain words",
  treatments: "Treatments so far",
  now: "What is happening now",
  visit: "Next doctor visit",
  wants: "What the family wants to know",
};

export const FACT_FIELDS = [
  "cancer_type",
  "stage",
  "diagnosis_date",
  "biomarker",
  "treatment",
  "latest_scan",
  "current_status",
  "next_visit",
  "other",
] as const;
export type FactField = (typeof FACT_FIELDS)[number];

export const FACT_LABEL: Record<FactField, string> = {
  cancer_type: "Cancer",
  stage: "Stage",
  diagnosis_date: "Found",
  biomarker: "Gene or marker",
  treatment: "Treatment",
  latest_scan: "Latest scan",
  current_status: "Now",
  next_visit: "Next visit",
  other: "Other",
};

export const ID_TYPES = [
  "patient_name",
  "birth_date",
  "record_number",
  "address",
  "phone",
  "email",
  "doctor_name",
  "hospital_name",
  "insurance_number",
  "other_id",
] as const;
export type IdType = (typeof ID_TYPES)[number];

export const ID_LABEL: Record<IdType, string> = {
  patient_name: "Patient name",
  birth_date: "Date of birth",
  record_number: "Record number",
  address: "Address",
  phone: "Phone number",
  email: "Email",
  doctor_name: "Doctor names",
  hospital_name: "Hospital name",
  insurance_number: "Insurance number",
  other_id: "Other ID numbers",
};

export const OUTCOMES = ["worked", "stopped_working", "side_effects", "waiting", "unknown"] as const;
export type Outcome = (typeof OUTCOMES)[number];

export type Fact = { field: FactField; value: string; page: number | null; quote: string };
export type DraftTreatment = { title: string; started: string; ended: string; outcome: Outcome; note: string };

/** What the AI found in one document. Identifier values are never stored, only counts. */
export type DocFound = {
  label?: string;
  chips?: string[];
  facts?: Fact[];
  treatments?: DraftTreatment[];
  identifiers?: Partial<Record<IdType, number>>;
};

export type DocStatus = "uploaded" | "reading" | "read" | "unreadable";
export type DraftDoc = {
  id: string;
  filename: string;
  mime: string;
  sizeBytes: number;
  pages: number | null;
  status: DocStatus;
  note: string | null;
  label: string | null;
  found: DocFound;
  storagePath: string;
};

export type Citation = { n: number; doc: string; page: number | null; quote: string };
export type DraftQuestion = {
  id: string;
  span: string;
  question: string;
  ifYes: string;
  ifNo: string;
  ifUnsure: string;
  answer?: "yes" | "no" | "unsure";
};
export type DraftSection = { text: string; citations: Citation[]; questions: DraftQuestion[] };

export const TASK_SECTIONS = ["plain", "now", "options", "access", "questions"] as const;
export type TaskSection = (typeof TASK_SECTIONS)[number];
export type SuggestedTask = {
  id: string;
  title: string;
  why: string;
  expertise: Expertise;
  section: TaskSection;
  minutes: number;
  done: string[];
  picked: boolean;
};

export type Relationship = "myself" | "family" | "caregiver";
export type DraftAnswers = {
  relationship?: Relationship;
  consent?: boolean;
  no_ids?: boolean;
  wants_to_know?: string;
  /** Case title chosen by the family, a plain sentence. */
  goal?: string;
  /** What the AI suggested from the documents, for the family to confirm. */
  suggested_goal?: string;
  cancer_stage?: string;
  age_range?: string;
  current_treatment?: string;
};

export type Draft = {
  id: string;
  status: "editing" | "published";
  answers: DraftAnswers;
  sections: Partial<Record<TextKey, DraftSection>>;
  treatments: DraftTreatment[];
  suggestedTasks: SuggestedTask[];
  confirmations: Partial<Record<DraftKey, boolean>>;
  identifiers: Partial<Record<IdType, number>>;
  cancerType: string | null;
  visitDate: string | null;
  privacyOk: boolean;
  keepFiles: boolean;
  caseId: string | null;
  updatedAt: string;
};

export const MAX_FILES = 30;
export const MAX_BYTES = 20 * 1024 * 1024;
export const ACCEPTED_MIME = ["application/pdf", "image/jpeg", "image/png", "image/heic", "image/heif", "image/webp"];
