import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { UUID_RE } from "@/lib/time";
import { EXPERTISE_LABEL, type Expertise } from "@/lib/types";
import type { Source } from "@/lib/types";
import { TOOL_DEFS, TOOL_LABEL, runTool } from "@/lib/ai/tools";
import { saveRun, saveTaskExchange } from "@/lib/ai/runs";
import { LEAD_KIND_LABEL, LEAD_STATUS_LABEL, type LeadKind, type LeadStatus } from "@/lib/types";

export const maxDuration = 60;

const MODEL = "claude-sonnet-5-5";
const MAX_TURNS = 5;

const SYSTEM = `You are the research helper inside Case Room, where volunteers work together on one cancer patient's case.
You help one volunteer do their task or check one lead (an idea the team is investigating) well: find trials, papers and facts, and turn them into good questions.

Rules you always follow:
- Everything you write is research and questions for the patient's own doctor. Never give treatment advice, never say what the patient should take, start or stop, and never predict outcomes.
- Every claim needs a source. Cite each claim inline with the full link in square brackets, e.g. [https://clinicaltrials.gov/study/NCT01234567]. Only cite links that came from your tools or the task material. Never invent links, trial ids or numbers.
- Mark preprints (bioRxiv, medRxiv) as "preprint, not peer reviewed" every time you mention one.
- Never ask for or repeat names, birth dates, record numbers, addresses or other IDs. If the volunteer shares one, remind them to remove it.
- Say plainly when you are unsure, when the tools found nothing, or when the answer needs a doctor to judge.
- Prefer checking a trial's current status and entry rules with get_trial before listing it.
- Before suggesting a trial, drug or idea, compare it with "What the team already looked into" and her treatments so far. If it was already ruled out, say so plainly, give the reason recorded there with its source, and don't suggest it again. If she already had a treatment, say so.
- Keep it short and practical: plain words, short lists, and end with one suggested next step for the task.`;

type Body = { taskId?: unknown; leadId?: unknown; question?: unknown };

function json(status: number, error: string) {
  return Response.json({ error }, { status });
}

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return json(400, "Send JSON with a taskId or leadId, and a question.");
  }
  const taskId = typeof body.taskId === "string" ? body.taskId : "";
  const leadOnlyId = typeof body.leadId === "string" ? body.leadId : "";
  const question = typeof body.question === "string" ? body.question.trim().slice(0, 4000) : "";
  if (taskId ? !UUID_RE.test(taskId) : !UUID_RE.test(leadOnlyId)) return json(400, "That link is broken.");
  if (question.length < 2) return json(400, "Type a question first.");

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub as string | undefined;
  if (!userId) return json(401, "Sign in to use the AI helper.");

  // Row level security only returns the task or lead to approved members of its case.
  const { data: task } = taskId
    ? await supabase
        .from("tasks")
        .select("id, case_id, section_id, lead_id, title, why_it_matters, done_looks_like, inputs, expertise, status, owner_id")
        .eq("id", taskId)
        .maybeSingle()
    : { data: null };
  if (taskId && !task) return json(403, "Join this case to use the AI helper on its tasks.");
  const leadId = task ? (task.lead_id as string | null) : leadOnlyId;
  const { data: lead } = leadId
    ? await supabase
        .from("leads")
        .select("id, case_id, title, idea, kind, status, conditions, next_step, ruled_out_reason")
        .eq("id", leadId)
        .maybeSingle()
    : { data: null };
  if (!task && !lead) return json(403, "Join this case to use the AI helper.");
  const caseId = (task?.case_id ?? lead?.case_id) as string;

  if (!process.env.ANTHROPIC_API_KEY)
    return json(503, "The AI helper isn't switched on yet. The site owner needs to add an ANTHROPIC_API_KEY.");

  const [{ data: kase }, { data: sections }, { data: history }, { data: treatments }, { data: findings }] = await Promise.all([
    supabase.from("cases").select("goal, summary, cancer_type, visit_date").eq("id", caseId).maybeSingle(),
    supabase.from("brief_sections").select("id, position, title, body").eq("case_id", caseId).order("position"),
    task
      ? supabase
          .from("ai_messages")
          .select("role, content")
          .eq("task_id", taskId)
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(6)
      : supabase
          .from("ai_runs")
          .select("prompt, result")
          .eq("lead_id", leadId as string)
          .eq("user_id", userId)
          .eq("tool", "case_room_ai")
          .order("created_at", { ascending: false })
          .limit(3)
          .then(({ data }) => ({
            data: (data ?? []).flatMap((r) => [
              { role: "assistant", content: r.result },
              { role: "user", content: r.prompt },
            ]),
          })),
    supabase
      .from("treatments")
      .select("title, details, started_on, ended_on, outcome, outcome_note")
      .eq("case_id", caseId)
      .order("started_on", { ascending: true, nullsFirst: false })
      .limit(30),
    supabase
      .from("findings")
      .select("title, status, summary, sources, checked_by")
      .eq("case_id", caseId)
      .order("updated_at", { ascending: false })
      .limit(60),
  ]);

  const section = task ? (sections ?? []).find((s) => s.id === task.section_id) : undefined;
  const conds = (Array.isArray(lead?.conditions) ? lead.conditions : []) as { text: string; checked?: boolean }[];
  const context = [
    `Case goal: ${kase?.goal ?? ""}`,
    kase?.cancer_type ? `Cancer type: ${kase.cancer_type}` : "",
    kase?.visit_date ? `Next doctor visit: ${kase.visit_date}` : "",
    `Case summary (plain words, no IDs):\n${(kase?.summary ?? "").slice(0, 4000) || "Not written yet."}`,
    `Brief sections so far:\n${(sections ?? [])
      .map((s) => `${s.position}. ${s.title}${s.body ? `: ${s.body.slice(0, 600)}` : " (empty)"}`)
      .join("\n")}`,
    task ? `This task: ${task.title}` : "",
    task ? `Expertise it needs: ${EXPERTISE_LABEL[task.expertise as Expertise] ?? task.expertise}` : "",
    section ? `It fills the brief section: ${section.title}` : "",
    task?.why_it_matters ? `Why it matters: ${task.why_it_matters}` : "",
    task && (task.done_looks_like ?? []).length ? `Done looks like:\n- ${(task.done_looks_like as string[]).join("\n- ")}` : "",
    lead
      ? `${task ? "This task belongs to the lead" : "The lead (an idea the team is investigating)"}: ${lead.title} (${LEAD_KIND_LABEL[lead.kind as LeadKind]}, ${LEAD_STATUS_LABEL[lead.status as LeadStatus].toLowerCase()})${lead.idea ? `\n${lead.idea}` : ""}${conds.length ? `\nWhat would need to be true:\n${conds.map((c) => `- ${c.checked ? "[confirmed]" : "[open]"} ${c.text}`).join("\n")}` : ""}${lead.next_step ? `\nNext step: ${lead.next_step}` : ""}${lead.ruled_out_reason ? `\nRuled out because: ${lead.ruled_out_reason}` : ""}`
      : "",
    (treatments ?? []).length
      ? `Her treatments so far (from the family):\n${(treatments ?? [])
          .map(
            (t) =>
              `- ${t.title}${t.started_on ? ` (${t.started_on.slice(0, 7)}${t.ended_on ? ` to ${t.ended_on.slice(0, 7)}` : ""})` : ""}: ${t.outcome.replace(/_/g, " ")}${t.outcome_note ? `, ${t.outcome_note}` : ""}${t.details ? `. ${t.details.slice(0, 200)}` : ""}`,
          )
          .join("\n")}`
      : "",
    (findings ?? []).length
      ? `What the team already looked into ("What we tried" page). Status is may fit, ruled out, or waiting on results:\n${(findings ?? [])
          .map(
            (f) =>
              `- [${f.status.replace(/_/g, " ")}${f.checked_by ? "" : ", not checked yet"}] ${f.title}: ${f.summary.slice(0, 300)} (source: ${(f.sources ?? [])[0] ?? "none"})`,
          )
          .join("\n")}`
      : "",
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
          const okChat = task ? await saveTaskExchange(supabase, userId, taskId, question, answer.trim(), sources) : true;
          const run = await saveRun(supabase, userId, {
            caseId,
            leadId: leadId || null,
            taskId: task ? taskId : null,
            tool: "case_room_ai",
            prompt: question,
            result: answer.trim(),
            sources,
            check: { ok: sources.length, failed: 0 },
          });
          if (!okChat || run.error) send("status", { text: "Answer not saved." });
          else if (run.id) send("run", { id: run.id });
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
