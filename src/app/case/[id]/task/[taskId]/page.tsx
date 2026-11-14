import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { DemoButton } from "@/components/demo-button";
import { Composer, MessageItem } from "@/components/message-list";
import { TaskHeaderActions, TaskWorkPanels } from "@/components/task-actions";
import { Avatar, Badge, Card, ExpertiseBadge } from "@/components/ui";
import { getRoom, memberById, taskMessages } from "@/lib/data";
import type { TaskStatus } from "@/lib/types";

const STATUS: Record<TaskStatus, { label: string; tone: "neutral" | "brand" | "ok" | "warn" | "bad" }> = {
  open: { label: "Open", tone: "brand" },
  taken: { label: "In progress", tone: "brand" },
  submitted: { label: "Waiting for check", tone: "warn" },
  checked: { label: "Checked", tone: "ok" },
  stuck: { label: "Stuck · needs help", tone: "bad" },
};

export default async function TaskPage({ params }: PageProps<"/case/[id]/task/[taskId]">) {
  const { id, taskId } = await params;
  const loaded = await getRoom(id);
  if (!loaded) notFound();
  if (loaded.teaser) redirect(`/case/${id}`);
  const room = loaded.room;
  const task = room.tasks.find((t) => t.id === taskId);
  if (!task) notFound();
  const demo = room.viewer === null;

  const owner = memberById(room, task.ownerId);
  const section = room.sections.find((s) => s.id === task.sectionId);
  const thread = taskMessages(room, task.id);
  const helpers = task.helperIds.map((h) => memberById(room, h)).filter((m) => m !== undefined);
  const requested = task.requestedHelperIds.map((h) => memberById(room, h)).filter((m) => m !== undefined);
  const isTaken = task.status === "taken" || task.status === "stuck";
  const visit = room.visitInDays;

  return (
    <div className="mx-auto flex max-w-[1136px] flex-col gap-5">
      <nav aria-label="Breadcrumb" className="text-[13px] text-subtle">
        <Link href={`/case/${room.id}`}>Case room</Link> / {section ? `${section.position}. ${section.title}` : "Task"} / This task
      </nav>

      <header className="flex flex-wrap items-start gap-5 rounded-2xl border border-line bg-white px-5 py-6 sm:px-7">
        <div className="flex min-w-0 flex-[1_1_480px] flex-col gap-2.5">
          <div className="flex flex-wrap gap-2">
            <ExpertiseBadge expertise={task.expertise} />
            <Badge tone={STATUS[task.status].tone}>{STATUS[task.status].label}</Badge>
            <Badge>{task.minutes} min</Badge>
          </div>
          <h1 className="font-display text-2xl leading-tight font-bold sm:text-[26px]">{task.title}</h1>
          <p className="text-sm text-muted">
            {owner ? (
              <>
                Taken by <strong>{owner.id === room.viewer?.id ? "you" : owner.name}</strong> · last update {task.lastUpdate}
                {helpers.length > 0 && ` · ${helpers.length} helper${helpers.length > 1 ? "s" : ""}`}
              </>
            ) : (
              "Nobody has taken this yet"
            )}
          </p>
        </div>
        <div className="flex min-w-56 flex-col gap-2">
          {demo ? (
            <>
              {task.status === "open" && <DemoButton variant="primary">Take this task</DemoButton>}
              {isTaken && (
                <>
                  <DemoButton variant="primary">Offer to help</DemoButton>
                  <DemoButton>Ask to take over</DemoButton>
                  <span className="text-xs leading-snug text-subtle">
                    No update for 3 days and the task opens again on its own.
                  </span>
                </>
              )}
              {task.status === "submitted" && <DemoButton variant="primary">Check this work</DemoButton>}
            </>
          ) : (
            <TaskHeaderActions room={room} task={task} />
          )}
        </div>
      </header>

      <div className="flex flex-wrap items-start gap-5">
        <div className="flex min-w-0 flex-[2_1_360px] flex-col gap-5">
          {task.whyItMatters && (
            <Card label="Why this matters" className="flex flex-col gap-2.5">
              <h2 className="text-base font-bold">Why this matters</h2>
              <p className="text-sm leading-relaxed text-ink-2">{task.whyItMatters}</p>
              <div className="flex flex-wrap items-center gap-2 text-[13px]">
                <span className="rounded-lg bg-brand-soft px-2.5 py-1.5 font-semibold">This task</span>
                <span aria-hidden="true">→</span>
                <span className="rounded-lg bg-soft px-2.5 py-1.5">&ldquo;{section?.title}&rdquo; in the brief</span>
                <span aria-hidden="true">→</span>
                <span className="rounded-lg bg-ink px-2.5 py-1.5 text-white">
                  {visit !== null && visit > 0 ? `Doctor visit in ${visit} days` : "The doctor visit"}
                </span>
              </div>
            </Card>
          )}

          <Card label="What done looks like" className="flex flex-col gap-2.5">
            <h2 className="text-base font-bold">What done looks like</h2>
            <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm leading-normal text-ink-2">
              {task.doneLooksLike.map((d) => (
                <li key={d}>{d}</li>
              ))}
              <li>A source link for every claim</li>
              <li>Questions and options for the doctor, never treatment advice</li>
            </ul>
          </Card>

          {task.inputs.length > 0 && (
            <Card label="What you get to work with" className="flex flex-col gap-2.5">
              <h2 className="text-base font-bold">What you get to work with</h2>
              {task.inputs.map((i) => (
                <div key={i.label} className={`flex flex-wrap gap-2 rounded-[10px] px-3 py-2.5 text-sm ${i.ready ? "bg-soft" : "bg-bad-tint"}`}>
                  <span className="flex-[1_1_200px]">{i.label}</span>
                  <span className={`text-xs font-semibold ${i.ready ? "text-ok" : "text-bad"}`}>
                    {i.ready ? "Ready" : "Missing · blocks this task"}
                  </span>
                </div>
              ))}
            </Card>
          )}

          {!demo && <TaskWorkPanels room={room} task={task} />}

          {task.submissions
            .slice()
            .reverse()
            .map((s, i) => {
              const author = memberById(room, s.authorId);
              const checkers = (s.checkedBy ?? []).map((c) => (c === "ai" ? "AI" : (memberById(room, c)?.name ?? "a volunteer")));
              return (
                <Card key={s.id} label="Submitted work" className="flex flex-col gap-2.5">
                  <h2 className="text-base font-bold">{i === 0 ? "Latest submitted work" : "Earlier version"}</h2>
                  <div className="text-[13px] text-subtle">
                    {author?.name ?? "Former member"} · {s.createdAt}
                  </div>
                  <p className="whitespace-pre-line break-words text-sm leading-relaxed">{s.body}</p>
                  <div className="flex flex-wrap gap-3 text-xs">
                    {s.sources.map((src, n) => (
                      <a key={n} href={src} target="_blank" rel="noopener noreferrer nofollow">
                        Source {n + 1}
                      </a>
                    ))}
                  </div>
                  {s.aiCheck && (
                    <div
                      className={`rounded-lg px-2.5 py-2 text-xs leading-snug ${
                        s.aiCheck.matched === s.aiCheck.claims ? "bg-ok-soft text-ok" : "bg-warn-soft text-warn-text"
                      }`}
                    >
                      AI check: {s.aiCheck.note}
                    </div>
                  )}
                  {(s.fixRequests ?? []).map((f, n) => (
                    <div key={n} className="rounded-lg bg-bad-tint px-2.5 py-2 text-xs leading-snug text-bad">
                      Needs a fix ({f.by === "ai" ? "AI" : (memberById(room, f.by)?.name ?? "a volunteer")}): {f.note}
                    </div>
                  ))}
                  <span className={`text-xs font-semibold ${checkers.length ? "text-ok" : "text-warn"}`}>
                    {checkers.length ? `Checked by ${checkers.join(" and ")}` : "Needs a second person to check"}
                  </span>
                </Card>
              );
            })}

          <Card label="People on this task" className="flex flex-col gap-3">
            <h2 className="text-base font-bold">People on this task</h2>
            {!owner && <p className="text-sm text-subtle">No one yet.</p>}
            {[
              ...(owner ? [{ p: owner, role: "owner" }] : []),
              ...helpers.map((p) => ({ p, role: "helper" })),
              ...requested.map((p) => ({ p, role: "offered to help" })),
            ].map(({ p, role }) => (
              <div key={p.id} className="flex items-center gap-3">
                <Avatar person={p} />
                <div className="text-sm">
                  <strong>{p.name}</strong> · {role}
                  <br />
                  <span className="text-xs text-subtle">{p.headline}</span>
                </div>
              </div>
            ))}
          </Card>
        </div>

        <Card label="Task discussion" className="flex min-w-0 flex-[3_1_440px] flex-col gap-4">
          <div className="flex flex-wrap items-baseline gap-2.5">
            <h2 className="text-base font-bold">Discussion on this task</h2>
            <span className="text-xs text-subtle">Everyone on the case can read it. No private messages.</span>
          </div>
          {thread.length === 0 && <p className="text-sm text-subtle">No messages yet. Ask a question to get started.</p>}
          {thread.map((m) => (
            <MessageItem key={m.id} room={room} msg={m} />
          ))}
          {demo && requested.length > 0 && owner && (
            <div className="flex flex-col gap-2 rounded-xl border border-line px-3.5 py-3">
              <span className="text-[13px]">
                <strong>{requested.map((r) => r.name).join(", ")}</strong> asked to join this task.
              </span>
              <div className="flex flex-wrap gap-2">
                <DemoButton variant="primary">Add as helper</DemoButton>
                <DemoButton>Split off part as a new task</DemoButton>
              </div>
              <span className="text-xs text-subtle">Only {owner.name} sees these buttons, as the owner.</span>
            </div>
          )}
          <Composer room={room} taskId={task.id} label="Write a message" placeholder="Ask a question, share an update, or add a source link" />
          <span className="text-xs text-subtle">
            Room rules apply: medical claims need a source. No treatment advice. No asking for money.
          </span>
        </Card>
      </div>
    </div>
  );
}
