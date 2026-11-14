import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { UUID_RE } from "@/lib/time";
import { EXPERTISE_LABEL, type Expertise } from "@/lib/types";
import type { Source } from "@/lib/types";
import { TOOL_DEFS, TOOL_LABEL, runTool } from "@/lib/ai/tools";

export const maxDuration = 60;

const MODEL = "claude-sonnet-5-5";
const MAX_TURNS = 5;

const SYSTEM = `You are the research helper inside Case Room, where volunteers work together on one cancer patient's case.
You help one volunteer do their task well: find trials, papers and facts, and turn them into good questions.

Rules you always follow:
- Everything you write is research and questions for the patient's own doctor. Never give treatment advice, never say what the patient should take, start or stop, and never predict outcomes.
- Every claim needs a source. Cite each claim inline with the full link in square brackets, e.g. [https://clinicaltrials.gov/study/NCT01234567]. Only cite links that came from your tools or the task material. Never invent links, trial ids or numbers.
- Mark preprints (bioRxiv, medRxiv) as "preprint, not peer reviewed" every time you mention one.
- Never ask for or repeat names, birth dates, record numbers, addresses or other IDs. If the volunteer shares one, remind them to remove it.
- Say plainly when you are unsure, when the tools found nothing, or when the answer needs a doctor to judge.
- Prefer checking a trial's current status and entry rules with get_trial before listing it.
- Keep it short and practical: plain words, short lists, and end with one suggested next step for the task.`;

type Body = { taskId?: unknown; question?: unknown };

function json(status: number, error: string) {
  return Response.json({ error }, { status });
}

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return json(400, "Send JSON with taskId and question.");
  }
  const taskId = typeof body.taskId === "string" ? body.taskId : "";
  const question = typeof body.question === "string" ? body.question.trim().slice(0, 4000) : "";
  if (!UUID_RE.test(taskId)) return json(400, "That task link is broken.");
  if (question.length < 2) return json(400, "Type a question first.");

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub as string | undefined;
  if (!userId) return json(401, "Sign in to use the AI helper.");

  // Row level security only returns the task to approved members of its case.
  const { data: task } = await supabase
    .from("tasks")
    .select("id, case_id, section_id, title, why_it_matters, done_looks_like, inputs, expertise, status, owner_id")
    .eq("id", taskId)
    .maybeSingle();
  if (!task) return json(403, "Join this case to use the AI helper on its tasks.");

  if (!process.env.ANTHROPIC_API_KEY)
    return json(503, "The AI helper isn't switched on yet. The site owner needs to add an ANTHROPIC_API_KEY.");

  const [{ data: kase }, { data: sections }, { data: history }] = await Promise.all([
    supabase.from("cases").select("goal, summary, cancer_type, visit_date").eq("id", task.case_id).maybeSingle(),
    supabase.from("brief_sections").select("id, position, title, body").eq("case_id", task.case_id).order("position"),
    supabase
      .from("ai_messages")
      .select("role, content")
      .eq("task_id", taskId)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(6),
  ]);

  const section = (sections ?? []).find((s) => s.id === task.section_id);
  const context = [
    `Case goal: ${kase?.goal ?? ""}`,
    kase?.cancer_type ? `Cancer type: ${kase.cancer_type}` : "",
    kase?.visit_date ? `Next doctor visit: ${kase.visit_date}` : "",
    `Case summary (plain words, no IDs):\n${(kase?.summary ?? "").slice(0, 4000) || "Not written yet."}`,
    `Brief sections so far:\n${(sections ?? [])
      .map((s) => `${s.position}. ${s.title}${s.body ? `: ${s.body.slice(0, 600)}` : " (empty)"}`)
      .join("\n")}`,
    `This task: ${task.title}`,
    `Expertise it needs: ${EXPERTISE_LABEL[task.expertise as Expertise] ?? task.expertise}`,
    section ? `It fills the brief section: ${section.title}` : "",
    task.why_it_matters ? `Why it matters: ${task.why_it_matters}` : "",
    (task.done_looks_like ?? []).length ? `Done looks like:\n- ${(task.done_looks_like as string[]).join("\n- ")}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: `Task material:\n\n${context}` },
    { role: "assistant", content: "Got it. What would you like to work on?" },
    ...(history ?? []).reverse().map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    { role: "user", content: question },
  ];
  // The API needs alternating turns; drop any doubled history left by an earlier failure.
  const clean: Anthropic.MessageParam[] = [];
  for (const m of messages) {
    if (clean.length && clean[clean.length - 1].role === m.role) clean[clean.length - 1] = m;
    else clean.push(m);
  }

  const client = new Anthropic();
  const enc = new TextEncoder();
  const found = new Map<string, Source>();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) =>
        controller.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      let answer = "";
      try {
        for (let turn = 0; turn < MAX_TURNS; turn++) {
          const last = turn === MAX_TURNS - 1;
          const s = client.messages.stream({
            model: MODEL,
            max_tokens: 2000,
            system: SYSTEM,
            messages: clean,
            ...(last ? {} : { tools: TOOL_DEFS }),
          });
          s.on("text", (t) => {
            answer += t;
            send("text", { text: t });
          });
          const msg = await s.finalMessage();
          clean.push({ role: "assistant", content: msg.content });
          const uses = msg.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
          if (msg.stop_reason !== "tool_use" || uses.length === 0) break;

          const results: Anthropic.ToolResultBlockParam[] = [];
          for (const u of uses) {
            send("status", { text: TOOL_LABEL[u.name] ?? "Looking things up" });
            try {
              const { result, sources } = await runTool(u.name, (u.input ?? {}) as Record<string, unknown>);
              sources.forEach((src) => found.set(src.url, src));
              results.push({ type: "tool_result", tool_use_id: u.id, content: JSON.stringify(result).slice(0, 12000) });
            } catch (e) {
              results.push({
                type: "tool_result",
                tool_use_id: u.id,
                is_error: true,
                content: `The lookup failed: ${e instanceof Error ? e.message : "unknown error"}. Say so if it matters.`,
              });
            }
          }
          clean.push({ role: "user", content: results });
          if (answer && !answer.endsWith("\n")) {
            answer += "\n\n";
            send("text", { text: "\n\n" });
          }
        }

        const cited = [...found.values()].filter((s) => answer.includes(s.url));
        const sources = (cited.length ? cited : [...found.values()]).slice(0, 20);
        send("sources", { sources });

        if (answer.trim()) {
          const { error } = await supabase.rpc("save_ai_exchange", { t: taskId, question, answer: answer.trim(), sources });
          if (error) send("status", { text: "Answer not saved to the task." });
        }
        send("done", {});
      } catch (e) {
        const status = e instanceof Anthropic.APIError ? e.status : undefined;
        send("error", {
          error:
            status === 401
              ? "The AI key is not valid. The site owner needs to update ANTHROPIC_API_KEY."
              : status === 429 || status === 529
                ? "The AI helper is busy. Try again in a minute."
                : "The AI helper hit a problem. Try again.",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "content-type": "text/event-stream; charset=utf-8", "cache-control": "no-cache, no-transform", "x-accel-buffering": "no" },
  });
}
