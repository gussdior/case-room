import { EXPERTISE_ORDER, type CaseRoom, type Expertise, type Lead, type Member, type Task } from "./types";

export type IdeaGroup = "needs" | "progress" | "done";

/** One thing the team is checking. Leads and tasks both show as ideas. */
export type Idea = {
  key: string;
  kind: "lead" | "task";
  id: string;
  href: string;
  title: string;
  /** Next step or status, in plain words. */
  line: string;
  group: IdeaGroup;
  /** Who it needs, when it needs someone. */
  expertise: Expertise | null;
  /** People on it. */
  people: Member[];
};

const short = (s: string, n = 110) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}...` : s);
const sentence = (s: string) => {
  const t = s.trim();
  return t && !/[.!?]$/.test(t) ? `${t}.` : t;
};

function fromLead(caseId: string, l: Lead, members: Member[]): Idea {
  const group: IdeaGroup = l.status === "needs_someone" ? "needs" : l.status === "ruled_out" ? "done" : "progress";
  const next = l.nextStep || l.idea;
  const line =
    group === "done"
      ? `Ruled out. ${sentence(l.ruledOutReason ?? "")}`.trim()
      : l.status === "promising"
        ? `Looks promising. ${sentence(next)}`.trim()
        : next;
  return {
    key: `lead-${l.id}`,
    kind: "lead",
    id: l.id,
    href: `/case/${caseId}/lead/${l.id}`,
    title: l.title,
    line: short(line),
    group,
    expertise: group === "needs" ? l.nextStepExpertise : null,
    people: l.people.map((p) => members.find((m) => m.id === p)).filter((m): m is Member => !!m),
  };
}

function fromTask(caseId: string, t: Task, members: Member[]): Idea {
  const group: IdeaGroup = t.status === "open" ? "needs" : t.status === "checked" ? "done" : "progress";
  const owner = members.find((m) => m.id === t.ownerId);
  const line =
    t.status === "open"
      ? `About ${t.minutes} minutes`
      : t.status === "checked"
        ? "Checked. Now in the brief for the doctor"
        : t.status === "submitted"
          ? "Waiting for a second person to check it"
          : t.status === "stuck"
            ? `Stuck: ${t.stuckReason ?? "needs a hand"}`
            : t.progressNote || "Being worked on";
  return {
    key: `task-${t.id}`,
    kind: "task",
    id: t.id,
    href: `/case/${caseId}/task/${t.id}`,
    title: t.title,
    line: short(line),
    group,
    expertise: group === "needs" ? t.expertise : null,
    people: group === "needs" || !owner ? [] : [owner],
  };
}

/** Everything the team is checking, as one list. */
export function ideasFor(room: CaseRoom, leads: Lead[]): Idea[] {
  return [...leads.map((l) => fromLead(room.id, l, room.members)), ...room.tasks.map((t) => fromTask(room.id, t, room.members))];
}

/** Professions with nobody on the case yet. */
export function openSeats(room: CaseRoom): Expertise[] {
  const approved = room.members.filter((m) => m.status === "approved");
  return EXPERTISE_ORDER.filter((e) => e !== "no_medical" && !approved.some((m) => m.expertise === e));
}

/** Splits the goal so the last few words can carry the highlighter. */
export function splitGoal(goal: string): { head: string; tail: string } {
  const g = goal.trim();
  for (const sep of [" now that ", " after ", " before ", " so that ", " because ", " when ", ", "]) {
    const i = g.toLowerCase().lastIndexOf(sep);
    if (i > 8 && g.length - i - sep.length >= 8) {
      const cut = sep === ", " ? i + 2 : i + sep.length;
      return { head: g.slice(0, cut), tail: g.slice(cut) };
    }
  }
  const words = g.split(/\s+/);
  if (words.length < 5) return { head: "", tail: g };
  const n = Math.min(4, Math.max(2, Math.floor(words.length / 3)));
  return { head: `${words.slice(0, -n).join(" ")} `, tail: words.slice(-n).join(" ") };
}
