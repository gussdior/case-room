import "server-only";
import { SAMPLE_CASE } from "./sample-case";
import type { CaseRoom, Member, Task } from "./types";

// For now every page reads the made up sample case.
// Once Supabase is connected, these functions read from the database instead
// and the pages stay the same.
export async function getCaseRoom(id: string): Promise<CaseRoom | null> {
  if (id === SAMPLE_CASE.id) return SAMPLE_CASE;
  return null;
}

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

/** Same rule as the database: 3 per checked task you own, 2 per check you did for someone else. */
export function leaderboard(room: CaseRoom): LeaderRow[] {
  return approvedMembers(room)
    .filter((m) => m.role !== "family")
    .map((member) => {
      const tasksChecked = room.tasks.filter(
        (t) => t.status === "checked" && t.ownerId === member.id,
      ).length;
      const reviewsDone = room.tasks
        .flatMap((t) => t.submissions)
        .filter((s) => s.authorId !== member.id && s.checkedBy?.includes(member.id)).length;
      return { member, tasksChecked, reviewsDone, points: tasksChecked * 3 + reviewsDone * 2 };
    })
    .sort((a, b) => b.points - a.points || a.member.name.localeCompare(b.member.name));
}
