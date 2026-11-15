export type Expertise =
  | "doctor_nurse"
  | "researcher"
  | "bioinformatics"
  | "insurance_legal"
  | "no_medical";

export const EXPERTISE_LABEL: Record<Expertise, string> = {
  doctor_nurse: "Doctor or nurse",
  researcher: "Researcher",
  bioinformatics: "Bioinformatics",
  insurance_legal: "Insurance or legal",
  no_medical: "No medical background",
};

export const EXPERTISE_ORDER: Expertise[] = [
  "doctor_nurse",
  "researcher",
  "bioinformatics",
  "insurance_legal",
  "no_medical",
];

export type MemberRole = "creator" | "co_approver" | "volunteer" | "family";
export type MemberStatus = "pending" | "approved" | "declined" | "removed";
export type TaskStatus = "open" | "taken" | "submitted" | "checked" | "stuck";
export type SectionStatus = "empty" | "draft" | "checked";

export type Person = {
  id: string;
  name: string;
  headline: string;
  expertise: Expertise;
};

export type Member = Person & {
  role: MemberRole;
  status: MemberStatus;
  requestNote?: string;
  hoursPerWeek?: number;
  proofChecked?: boolean;
  aiNote?: string;
  aiFlag?: boolean;
  requestedAt?: string;
  proofUrl?: string | null;
};

export type Submission = {
  id: string;
  authorId: string;
  body: string;
  sources: string[];
  aiCheck?: { claims: number; matched: number; note: string };
  checkedBy?: string[]; // person ids, "ai" for the AI
  fixRequests?: { by: string; note: string }[];
  createdAt: string;
};

export type Task = {
  id: string;
  sectionId: string;
  title: string;
  whyItMatters: string;
  doneLooksLike: string[];
  inputs: { label: string; ready: boolean }[];
  expertise: Expertise;
  minutes: number;
  status: TaskStatus;
  ownerId?: string;
  helperIds: string[];
  requestedHelperIds: string[];
  stuckReason?: string;
  progressNote?: string;
  submissions: Submission[];
  lastUpdate: string;
  leadId?: string | null;
};

export type Section = {
  id: string;
  position: number;
  title: string;
  body: string;
  status: SectionStatus;
  statusNote: string;
  /** Where the starting text came from, e.g. the family's documents. */
  sourceNote?: string;
};

export type Message = {
  id: string;
  taskId?: string;
  authorId?: string; // undefined = AI
  isAi?: boolean;
  kind: "message" | "stuck" | "ai_summary";
  body: string;
  sources?: string[];
  pinned?: boolean;
  createdAt: string;
};

export type ViewerContext = {
  id: string;
  expertise: Expertise;
  role: MemberRole;
  isAdmin: boolean;
};

export type CaseRoom = {
  id: string;
  viewer: ViewerContext | null; // null = public sample, nothing can be changed
  goal: string;
  summary: string;
  facts: { label: string; value: string }[];
  visitInDays: number | null;
  visitDate?: string | null;
  isSample: boolean;
  joinMode: "approve" | "invite_only";
  listed?: boolean;
  cancerType?: string | null;
  publicGoal?: string | null;
  cancerStage?: string | null;
  coApproverId?: string;
  creatorId?: string;
  sections: Section[];
  tasks: Task[];
  members: Member[];
  messages: Message[];
  missingExpertise: string[];
};

/** A source the AI helper found or cited. */
export type Source = {
  url: string;
  title: string;
  kind: "trial" | "paper" | "preprint" | "link";
  peerReviewed: boolean;
  note?: string;
};

export type TreatmentOutcome = "worked" | "stopped_working" | "side_effects" | "waiting" | "unknown";
export type FindingStatus = "may_fit" | "ruled_out" | "waiting";
export type FindingKind = "trial" | "paper" | "treatment_idea" | "insurance" | "other";

export type Treatment = {
  id: string;
  title: string;
  details: string;
  startedOn: string | null; // YYYY-MM-DD
  endedOn: string | null;
  outcome: TreatmentOutcome;
  outcomeNote: string;
};

export type Finding = {
  id: string;
  taskId: string | null;
  taskTitle?: string;
  kind: FindingKind;
  title: string;
  summary: string;
  status: FindingStatus;
  sources: string[];
  foundBy: string; // person id, or "ai"
  checkedBy: string | null; // person id, "ai", or null
  checkedAt: string | null;
  createdAt: string;
};

export const FINDING_STATUS_LABEL: Record<FindingStatus, string> = {
  may_fit: "May fit her",
  ruled_out: "Ruled out",
  waiting: "Waiting on results",
};

export const FINDING_KIND_LABEL: Record<FindingKind, string> = {
  trial: "Trial",
  paper: "Paper",
  treatment_idea: "Treatment idea",
  insurance: "Insurance",
  other: "Other",
};

export const OUTCOME_LABEL: Record<TreatmentOutcome, string> = {
  worked: "Worked",
  stopped_working: "Stopped working",
  side_effects: "Stopped for side effects",
  waiting: "Waiting on results",
  unknown: "Outcome not added",
};

export type LeadKind = "trial" | "drug_repurposing" | "vaccine_or_personalized" | "test_or_diagnostic" | "support_or_access" | "other";
export type LeadStatus = "needs_someone" | "exploring" | "promising" | "ruled_out";
export type AiTool = "case_room_ai" | "chatgpt" | "claude" | "gemini" | "other";

export const LEAD_KIND_LABEL: Record<LeadKind, string> = {
  trial: "Clinical trial",
  drug_repurposing: "Existing drug, new use",
  vaccine_or_personalized: "Personalized or vaccine",
  test_or_diagnostic: "Test or scan",
  support_or_access: "Access and support",
  other: "Other idea",
};
export const LEAD_KINDS = Object.keys(LEAD_KIND_LABEL) as LeadKind[];

export const LEAD_STATUS_LABEL: Record<LeadStatus, string> = {
  needs_someone: "Needs someone",
  exploring: "Exploring",
  promising: "Promising",
  ruled_out: "Ruled out",
};

export const AI_TOOL_LABEL: Record<AiTool, string> = {
  case_room_ai: "Case Room AI",
  chatgpt: "ChatGPT",
  claude: "Claude",
  gemini: "Gemini",
  other: "Other AI",
};

export type SourceCheck = {
  results?: { url: string; ok: boolean; note: string }[];
  ok?: number;
  failed?: number;
};

export type AiRun = {
  id: string;
  leadId: string | null;
  leadTitle?: string;
  taskId: string | null;
  userId: string;
  tool: AiTool;
  toolOther: string | null;
  prompt: string;
  result: string;
  sources: Source[];
  check: SourceCheck;
  reuseCount: number;
  createdAt: string; // already "time ago"
};

export type Lead = {
  id: string;
  title: string;
  idea: string;
  kind: LeadKind;
  status: LeadStatus;
  conditions: { text: string; checked: boolean }[];
  nextStep: string;
  nextStepExpertise: Expertise | null;
  aiSuggested: boolean;
  ruledOutReason: string | null;
  createdBy: string;
  runCount: number;
  checkedSources: number;
  people: string[]; // person ids who ran AI or own tasks on it
  updatedAt: string;
};
