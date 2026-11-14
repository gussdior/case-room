import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { submitWork } from "@/app/case-actions";
import { AiHelper, type AiTurn } from "@/components/ai-helper";
import { DemoButton } from "@/components/demo-button";
import { Composer, MessageItem } from "@/components/message-list";
import { TaskHeaderActions, TaskWorkPanels } from "@/components/task-actions";
import { TaskTabs } from "@/components/task-tabs";
import { Avatar, Badge, ExpertiseBadge, PersonLink, btn } from "@/components/ui";
import { WorkForm } from "@/components/work-form";
import { getRoom, memberById, taskMessages } from "@/lib/data";
import { loadAiMessages } from "@/lib/db-profile";
import type { Task, TaskStatus } from "@/lib/types";

const STATUS: Record<TaskStatus, { label: string; tone: "neutral" | "brand" | "ok" | "warn" | "bad" }> = {
  open: { label: "Open", tone: "brand" },
  taken: { label: "In progress", tone: "brand" },
  submitted: { label: "Waiting for a check", tone: "warn" },
  checked: { label: "Checked", tone: "ok" },
  stuck: { label: "Stuck, needs help", tone: "bad" },
};

const STEPS = ["Read the case", "Take the task", "Do the research", "Submit with sources", "A second person checks"];

function stepIndex(t: Task): number {
  if (t.status === "open") return 1;
  if (t.status === "taken" || t.status === "stuck") return 3;
  if (t.status === "submitted") return 4;
  return 5;
}

const SAMPLE_AI: AiTurn[] = [
  { id: "s1", role: "user", content: "Which trials need biopsy results she doesn't have yet?", sources: [] },
  {
    id: "s2",
    role: "assistant",
    content:
      "In this sample, two of the trials found so far ask for a test result from a new biopsy.\n\nA good question for the doctor: \"Will the new biopsy be tested for the markers these trials ask about?\"\n\nNext step: note which trial needs which result, then add a source link for each.",
    sources: [],
  },
];

export default async function TaskPage({ params }: PageProps<"/case/[id]/task/[taskId]">) {
  const { id, taskId } = await params;
  const loaded = await getRoom(id);
  if (!loaded) notFound();
  if (loaded.teaser) redirect(`/case/${id}`);
  const room = loaded.room;
  const task = room.tasks.find((t) => t.id === taskId);
  if (!task) notFound();
  const demo = room.viewer === null;
  const v = room.viewer;

  const owner = memberById(room, task.ownerId);
  const section = room.sections.find((s) => s.id === task.sectionId);
  const thread = taskMessages(room, task.id);
  const helpers = task.helperIds.map((h) => memberById(room, h)).filter((m) => m !== undefined);
  const requested = task.requestedHelperIds.map((h) => memberById(room, h)).filter((m) => m !== undefined);
  const active = task.status === "taken" || task.status === "stuck";
  const isOwner = !!v && task.ownerId === v.id;
  const isHelper = !!v && task.helperIds.includes(v.id);
  const canWrite = demo ? active : (isOwner || isHelper) && (active || task.status === "submitted");
  const step = stepIndex(task);
  const visit = room.visitInDays;

  const saved = demo ? [] : await loadAiMessages(task.id);
  const initial: AiTurn[] = demo
    ? SAMPLE_AI
    : saved.map((m) => ({ id: m.id, role: m.role, content: m.content, sources: m.sources, mine: m.userId === v?.id }));

  return (
    <div className="flex flex-col">
      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1 text-sm text-muted">
        <Link href={`/case/${room.id}`} className="rounded-lg px-2 py-1 text-muted no-underline transition-colors hover:bg-hover hover:text-ink">
          The brief
        </Link>
        <span aria-hidden="true" className="text-line-2">
          /
        </span>
        <span className="px-2">{section?.title ?? "Task"}</span>
      </nav>

      <header className="mt-4 flex flex-wrap items-start gap-x-8 gap-y-4">
        <div className="min-w-0 flex-[1_1_560px]">
          <div className="flex flex-wrap gap-2">
            <ExpertiseBadge expertise={task.expertise} />
            <Badge tone={STATUS[task.status].tone}>{STATUS[task.status].label}</Badge>
            <Badge>About {task.minutes} min</Badge>
            {isOwner && <Badge tone="mark">Taken by you</Badge>}
          </div>
          <h1 className="mt-3 max-w-[860px] font-display text-[30px] leading-[1.15] font-medium tracking-[-0.01em] sm:text-[36px]">
            {task.title}
          </h1>
          <p className="mt-2.5 text-muted">
            This fills &ldquo;{section?.title}&rdquo; in the brief.
            {visit !== null && visit > 0 && ` The doctor visit is in ${visit} day${visit === 1 ? "" : "s"}.`}
            {owner && !isOwner && (
              <>
                {" "}
                Taken by <PersonLink person={owner} className="font-semibold" />, last update {task.lastUpdate}.
              </>
            )}
          </p>
        </div>
        <div className="flex max-w-xs flex-wrap items-start gap-2 sm:pt-8">
          {demo ? (
            <>
              {task.status === "open" && <DemoButton variant="mark">Take this task</DemoButton>}
              {active && <DemoButton variant="mark">Offer to help</DemoButton>}
              {task.status === "submitted" && <DemoButton variant="mark">Check this work</DemoButton>}
            </>
          ) : (
            <TaskHeaderActions room={room} task={task} />
          )}
          <Link href={`/case/${room.id}/tried?task=${task.id}#log`} className={btn.secondary}>
            Log a finding
          </Link>
        </div>
      </header>

      <ol aria-label={`Step ${Math.min(step, 5)} of 5`} className="mt-7 grid grid-cols-5 gap-1.5">
        {STEPS.map((label, i) => {
          const n = i + 1;
          const state = n < step || task.status === "checked" ? "done" : n === step ? "now" : "todo";
          return (
            <li
              key={label}
              aria-current={state === "now" ? "step" : undefined}
              className={`relative pt-3.5 text-[13px] before:absolute before:inset-x-0 before:top-0 before:h-[5px] before:rounded-full ${
                state === "done"
                  ? "text-muted before:bg-ok"
                  : state === "now"
                    ? "font-semibold text-ink before:bg-brand"
                    : "text-muted before:bg-[#dde1dd]"
              }`}
            >
              <b className="mr-1 font-semibold">{n}</b>
              <span className="hidden sm:inline">{label}</span>
            </li>
          );
        })}
      </ol>

      <div className="mt-7 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_520px]">
        <div className="flex min-w-0 flex-col gap-6">
          <article aria-label="The task" className="sheet px-5 py-8 sm:px-11 sm:py-9">
            {canWrite ? (
              <>
                <h2 id="submit" className="scroll-mt-6 font-display text-2xl font-medium">
                  Your work
                </h2>
                <p className="mt-1 mb-6 text-sm text-muted">
                  {task.whyItMatters || "Write it so the family can read it."}
                </p>
                {demo ? (
                  <WorkForm demo updating={false} />
                ) : (
                  <WorkForm action={submitWork.bind(null, room.id, task.id)} updating={task.status === "submitted"} />
                )}
              </>
            ) : (
              <>
                <h2 className="font-display text-2xl font-medium">Why this matters</h2>
                <p className="mt-2 max-w-[68ch] font-serif text-lg leading-relaxed text-ink-2">
                  {task.whyItMatters || "This task fills a gap in the brief for the doctor."}
                </p>
              </>
            )}

            <div className="mt-8 grid gap-6 border-t border-line pt-6 sm:grid-cols-2">
              <div>
                <h3 className="text-sm font-semibold">What done looks like</h3>
                <ul className="mt-2 flex flex-col gap-1.5 text-sm text-ink-2">
                  {[...task.doneLooksLike, "A source link for every claim", "Questions for the doctor, never treatment advice"].map((d) => (
                    <li key={d} className="flex gap-2.5">
                      <span aria-hidden="true" className="mt-[7px] h-1.5 w-1.5 flex-none rounded-full bg-ok" />
                      {d}
                    </li>
                  ))}
                </ul>
              </div>
              {task.inputs.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold">What you get to work with</h3>
                  <ul className="mt-2 flex flex-col gap-1.5">
                    {task.inputs.map((i) => (
                      <li
                        key={i.label}
                        className={`flex flex-wrap justify-between gap-2 rounded-[10px] px-3 py-2 text-sm ${i.ready ? "bg-paper" : "bg-bad-tint"}`}
                      >
                        <span>{i.label}</span>
                        <span className={`text-xs font-semibold ${i.ready ? "text-ok" : "text-bad"}`}>
                          {i.ready ? "Ready" : "Missing, blocks this task"}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </article>

          {!demo && <TaskWorkPanels room={room} task={task} />}

          {task.submissions
            .slice()
            .reverse()
            .map((s, i) => {
              const author = memberById(room, s.authorId);
              const checkers = (s.checkedBy ?? []).map((c) => (c === "ai" ? "AI" : (memberById(room, c)?.name ?? "a volunteer")));
              return (
                <section key={s.id} aria-label="Submitted work" className="panel flex flex-col gap-3 p-5 sm:p-6">
                  <div className="flex flex-wrap items-baseline gap-3">
                    <h2 className="font-display text-xl font-medium">{i === 0 ? "Latest submitted work" : "Earlier version"}</h2>
                    <span className="text-[13px] text-muted">
                      {author ? <PersonLink person={author} /> : "Former member"}, {s.createdAt}
                    </span>
                    <span className={`ml-auto text-xs font-semibold ${checkers.length ? "text-ok" : "text-mark-text"}`}>
                      {checkers.length ? `Checked by ${checkers.join(" and ")}` : "Needs a second person to check"}
                    </span>
                  </div>
                  <p className="max-w-[68ch] font-serif text-[17px] leading-relaxed whitespace-pre-line break-words text-ink-2">{s.body}</p>
                  <div className="flex flex-wrap gap-2 text-xs">
                    {s.sources.map((src, n) => (
                      <a
                        key={n}
                        href={src}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        className="rounded-full border border-line px-2.5 py-1 no-underline transition-colors hover:border-brand-line hover:bg-brand-tint"
                      >
                        Source {n + 1}
                      </a>
                    ))}
                  </div>
                  {s.aiCheck && (
                    <div
                      className={`rounded-[10px] px-3 py-2 text-xs leading-snug ${
                        s.aiCheck.matched === s.aiCheck.claims ? "bg-ok-soft text-ok" : "bg-mark-soft text-mark-text"
                      }`}
                    >
                      AI check: {s.aiCheck.note}
                    </div>
                  )}
                  {(s.fixRequests ?? []).map((f, n) => (
                    <div key={n} className="rounded-[10px] bg-bad-tint px-3 py-2 text-xs leading-snug text-bad">
                      Needs a fix ({f.by === "ai" ? "AI" : (memberById(room, f.by)?.name ?? "a volunteer")}): {f.note}
                    </div>
                  ))}
                </section>
              );
            })}

          <section aria-label="People on this task">
            <h2 className="mb-2 font-semibold">People on this task</h2>
            {!owner && <p className="text-sm text-muted">No one yet. Take it and it&apos;s yours.</p>}
            <ul className="-mx-2 flex flex-col">
              {[
                ...(owner ? [{ p: owner, role: "Owner" }] : []),
                ...helpers.map((p) => ({ p, role: "Helping" })),
                ...requested.map((p) => ({ p, role: "Offered to help" })),
              ].map(({ p, role }) => (
                <li key={p.id} className="flex items-center gap-3 rounded-[10px] px-2 py-2 transition-colors hover:bg-hover">
                  <Avatar person={p} size={34} />
                  <div className="min-w-0 flex-1 text-sm">
                    <PersonLink person={p} className="font-semibold" />
                    <span className="block truncate text-xs text-muted">{p.headline}</span>
                  </div>
                  <Badge>{role}</Badge>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <TaskTabs
          newCount={thread.length}
          ai={
            <AiHelper
              caseId={room.id}
              taskId={task.id}
              taskTitle={task.title}
              demo={demo}
              canWrite={canWrite}
              initial={initial}
            />
          }
          discussion={
            <div className="flex flex-col gap-3">
              <p className="text-xs text-muted">Everyone on the case can read this. No private messages.</p>
              {thread.length === 0 && <p className="text-sm text-muted">No messages yet. Ask a question to get started.</p>}
              <div className="flex flex-col divide-y divide-line">
                {thread.map((m) => (
                  <div key={m.id} className="py-3 first:pt-0">
                    <MessageItem room={room} msg={m} />
                  </div>
                ))}
              </div>
              {demo && requested.length > 0 && owner && (
                <div className="flex flex-col gap-2 rounded-xl border border-line px-3.5 py-3">
                  <span className="text-[13px]">
                    <strong>{requested.map((r) => r.name).join(", ")}</strong> asked to join this task.
                  </span>
                  <div className="flex flex-wrap gap-2">
                    <DemoButton variant="primary">Add as helper</DemoButton>
                    <DemoButton>Split off part as a new task</DemoButton>
                  </div>
                  <span className="text-xs text-muted">Only {owner.name} sees these buttons, as the owner.</span>
                </div>
              )}
              <Composer room={room} taskId={task.id} label="Write to people on this task" placeholder="Ask a question, share an update, or add a source link" />
            </div>
          }
        />
      </div>
    </div>
  );
}
