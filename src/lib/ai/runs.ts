import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { scrubKeepLinks } from "@/lib/drafts/scrub";
import { serviceClient } from "@/lib/supabase/service";
import type { AiTool, Source, SourceCheck } from "@/lib/types";

export type NewRun = {
  caseId: string;
  leadId: string | null;
  taskId: string | null;
  tool: AiTool;
  toolOther?: string | null;
  prompt: string;
  result: string;
  sources: Source[];
  check: SourceCheck;
};

/** Saves an AI run with names and IDs cleaned out. With the service key the server writes it directly,
 *  so nobody can plant a fake AI answer or a fake "sources checked" badge. Without it, a membership
 *  checked database function writes it. The caller must already know the user is a member. */
export async function saveRun(
  supabase: SupabaseClient,
  userId: string,
  run: NewRun,
): Promise<{ id?: string; error?: string }> {
  const prompt = scrubKeepLinks(run.prompt.slice(0, 4000)).text.trim();
  const result = scrubKeepLinks(run.result.slice(0, 20000)).text.trim();
  if (prompt.length < 2 || result.length < 2) return { error: "Add the prompt and what the AI said." };
  const svc = serviceClient();
  if (svc) {
    const { data, error } = await svc
      .from("ai_runs")
      .insert({
        case_id: run.caseId,
        lead_id: run.leadId,
        task_id: run.taskId,
        user_id: userId,
        tool: run.tool,
        tool_other: run.toolOther?.slice(0, 60) || null,
        prompt,
        result,
        sources: run.sources,
        source_check: run.check,
        scrubbed: true,
        written_by_server: true,
      })
      .select("id")
      .single();
    if (error) return { error: "Couldn't save the run." };
    if (run.leadId) await svc.from("leads").update({ updated_at: new Date().toISOString() }).eq("id", run.leadId);
    return { id: data.id };
  }
  const { data, error } = await supabase.rpc("save_ai_run", {
    c: run.caseId,
    l: run.leadId,
    t: run.taskId,
    p_tool: run.tool,
    p_tool_other: run.toolOther ?? null,
    p_prompt: prompt,
    p_result: result,
    p_sources: run.sources,
    p_check: run.check,
  });
  if (error) return { error: "Couldn't save the run." };
  return { id: data as string };
}

/** Task chat history, written by the server when it can, so assistant rows can't be faked. */
export async function saveTaskExchange(
  supabase: SupabaseClient,
  userId: string,
  taskId: string,
  question: string,
  answer: string,
  sources: Source[],
): Promise<boolean> {
  const svc = serviceClient();
  if (svc) {
    const q = await svc.from("ai_messages").insert({ task_id: taskId, user_id: userId, role: "user", content: question.slice(0, 4000) });
    if (q.error) return false;
    const a = await svc
      .from("ai_messages")
      .insert({ task_id: taskId, user_id: userId, role: "assistant", content: answer.slice(0, 20000), sources, written_by_server: true });
    return !a.error;
  }
  const { error } = await supabase.rpc("save_ai_exchange", { t: taskId, question, answer, sources });
  return !error;
}
