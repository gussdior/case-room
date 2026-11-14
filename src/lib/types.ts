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
};

export type Section = {
  id: string;
  position: number;
  title: string;
  body: string;
  status: SectionStatus;
  statusNote: string;
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
  coApproverId?: string;
  creatorId?: string;
  sections: Section[];
  tasks: Task[];
  members: Member[];
  messages: Message[];
  missingExpertise: string[];
};
