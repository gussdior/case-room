import "server-only";
import { cache } from "react";
import { requireViewer } from "./auth";
import { loadCase, type Teaser } from "./db-case";
import { SAMPLE_CASE } from "./sample-case";
import type { CaseRoom, Member, Task } from "./types";

export type Loaded = { room: CaseRoom; teaser?: never } | { teaser: Teaser; room?: never } | null;

/** The public sample case needs no sign in. Real cases need a signed in user with a profile. */
export const getRoom = cache(async (id: string): Promise<Loaded> => {
  if (id === SAMPLE_CASE.id) return { room: SAMPLE_CASE };
  await requireViewer(`/case/${id}`);
  const r = await loadCase(id);
  if (!r) return null;
  if ("kind" in r) return { teaser: r };
  return { room: r };
});

export function memberById(room: CaseRoom, id?: string): Member | undefined {
  return id ? room.members.find((m) => m.id === id) : undefined;
}

export function approvedMembers(room: CaseRoom): Member[] {
  return room.members.filter((m) => m.status === "approved");
}

/** Approved people doing the work: everyone except the case creator and family. */
export function volunteers(room: CaseRoom): Member[] {
  return approvedMembers(room).filter((m) => m.role !== "creator" && m.role !== "family");
}

export function pendingRequests(room: CaseRoom): Member[] {
  return room.members.filter((m) => m.status === "pending");
}

export function taskMessages(room: CaseRoom, taskId: string) {
  return room.messages.filter((m) => m.taskId === taskId);
}

export function caseMessages(room: CaseRoom) {
  return room.messages.filter((m) => !m.taskId);
}

/** Share of the brief that is done: checked tasks count fully, submitted ones half. */
export function briefProgress(room: CaseRoom): number {
  if (room.tasks.length === 0) return 0;
  const score = room.tasks.reduce(
    (sum, t) => sum + (t.status === "checked" ? 1 : t.status === "submitted" ? 0.5 : 0),
    0,
  );
  return Math.round((score / room.tasks.length) * 100);
}

export function stuckOrWaiting(room: CaseRoom): Task[] {
  return room.tasks.filter((t) => t.status === "stuck" || t.status === "submitted");
}

export type LeaderRow = {
  member: Member;
  tasksChecked: number;
  reviewsDone: number;
  points: number;
};

/** Same rule as the database: 3 per piece of your work that passed a check, 2 per check you did for someone else. */
export function leaderboard(room: CaseRoom): LeaderRow[] {
  const subs = room.tasks.flatMap((t) => t.submissions);
  return approvedMembers(room)
    .filter((m) => m.role !== "family")
    .map((member) => {
      const tasksChecked = subs.filter((s) => s.authorId === member.id && (s.checkedBy?.length ?? 0) > 0).length;
      const reviewsDone = subs.filter((s) => s.authorId !== member.id && s.checkedBy?.includes(member.id)).length;
      return { member, tasksChecked, reviewsDone, points: tasksChecked * 3 + reviewsDone * 2 };
    })
    .sort((a, b) => b.points - a.points || a.member.name.localeCompare(b.member.name));
}

/** Can this viewer check this submission? Mirrors the database rule, to show the right button. */
export function canCheck(room: CaseRoom, task: Task, authorId: string): boolean {
  const v = room.viewer;
  if (!v || task.status !== "submitted") return false;
  if (v.id === authorId || v.id === task.ownerId) return false;
  return v.expertise === task.expertise || v.expertise === "doctor_nurse";
}
