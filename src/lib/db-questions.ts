import "server-only";
import { createClient } from "./supabase/server";
import { UUID_RE } from "./time";
import type { Expertise } from "./types";

/** A question a visitor asked from the public preview, as the team sees it. */
export type TeamQuestion = {
  id: string;
  body: string;
  reply: string | null;
  repliedAt: string | null;
  repliedByName: string | null;
  isPublic: boolean;
  createdAt: string;
  askerId: string;
  askerInitial: string;
  askerRoleTitle: string | null;
  askerExpertise: Expertise;
  /** The asker's membership on this case, if any. */
  askerStatus: "pending" | "approved" | "declined" | "removed" | null;
};

/** A question as the person who asked it sees it. */
export type MyQuestion = { id: string; body: string; reply: string | null; createdAt: string };

/** An answered question the team chose to show on the public page. No names. */
export type PublicQuestion = { body: string; reply: string };

export async function loadPublicQuestions(caseId: string): Promise<PublicQuestion[]> {
  if (!UUID_RE.test(caseId)) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("public_case_questions", { c: caseId });
  if (error || !Array.isArray(data)) return [];
  return data.map((r: { body: string; reply: string }) => ({ body: r.body, reply: r.reply }));
}

export async function loadMyQuestions(caseId: string, userId: string): Promise<MyQuestion[]> {
  if (!UUID_RE.test(caseId)) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("case_questions")
    .select("id, body, reply, created_at")
    .eq("case_id", caseId)
    .eq("asker_id", userId)
    .order("created_at", { ascending: false });
  return (data ?? []).map((r) => ({ id: r.id, body: r.body, reply: r.reply, createdAt: r.created_at }));
}

export async function loadTeamQuestions(caseId: string): Promise<TeamQuestion[]> {
  if (!UUID_RE.test(caseId)) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("case_questions_for_team", { c: caseId });
  if (error || !Array.isArray(data)) return [];
  return data.map(
    (r: {
      id: string;
      body: string;
      reply: string | null;
      replied_at: string | null;
      replied_by_name: string | null;
      public: boolean;
      created_at: string;
      asker_id: string;
      asker_initial: string | null;
      asker_role_title: string | null;
      asker_expertise: Expertise;
      asker_status: TeamQuestion["askerStatus"];
    }) => ({
      id: r.id,
      body: r.body,
      reply: r.reply,
      repliedAt: r.replied_at,
      repliedByName: r.replied_by_name,
      isPublic: r.public,
      createdAt: r.created_at,
      askerId: r.asker_id,
      askerInitial: r.asker_initial || "?",
      askerRoleTitle: r.asker_role_title,
      askerExpertise: r.asker_expertise,
      askerStatus: r.asker_status,
    }),
  );
}
