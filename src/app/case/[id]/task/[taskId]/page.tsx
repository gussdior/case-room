import Link from "next/link";
import { notFound } from "next/navigation";
import { DemoButton } from "@/components/demo-button";
import { Composer, MessageItem } from "@/components/message-list";
import { Avatar, Badge, Card, ExpertiseBadge } from "@/components/ui";
import { getCaseRoom, memberById, taskMessages } from "@/lib/data";
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
  const room = await getCaseRoom(id);
  const task = room?.tasks.find((t) => t.id === taskId);
  if (!room || !task) notFound();

  const owner = memberById(room, task.ownerId);
  const section = room.sections.find((s) => s.id === task.sectionId);
  const thread = taskMessages(room, task.id);
  const helpers = task.helperIds.map((h) => memberById(room, h)).filter(Boolean);
  const requested = task.requestedHelperIds.map((h) => memberById(room, h)).filter(Boolean);
  const isTaken = task.status === "taken" || task.status === "stuck";

  return (
    <div className="mx-auto flex max-w-[1136px] flex-col gap-5">
      <nav aria-label="Breadcrumb" className="text-[13px] text-subtle">
        <Link href={`/case/${room.id}`}>Case room</Link> / {section?.position}. {section?.title} / This task
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
                Taken by <strong>{owner.name}</strong> · last update {task.lastUpdate}
                {helpers.length > 0 && ` · ${helpers.length} helper${helpers.length > 1 ? "s" : ""}`}
              </>
            ) : (
              "Nobody has taken this yet"
            )}
          </p>
        </div>
        <div className="flex min-w-56 flex-col gap-2">
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
        </div>
      </header>

      <div className="flex flex-wrap items-start gap-5">
        <div className="flex min-w-0 flex-[2_1_360px] flex-col gap-5">
          <Card label="Why this matters" className="flex flex-col gap-2.5">
            <h2 className="text-base font-bold">Why this matters</h2>
            <p className="text-sm leading-relaxed text-ink-2">{task.whyItMatters}</p>
            <div className="flex flex-wrap items-center gap-2 text-[13px]">
              <span className="rounded-lg bg-brand-soft px-2.5 py-1.5 font-semibold">This task</span>
              <span aria-hidden="true">→</span>
              <span className="rounded-lg bg-soft px-2.5 py-1.5">
                &ldquo;{section?.title}&rdquo; in the brief
              </span>
              <span aria-hidden="true">→</span>
              <span className="rounded-lg bg-ink px-2.5 py-1.5 text-white">Doctor visit in {room.visitInDays} days</span>
            </div>
          </Card>

          <Card label="What done looks like" className="flex flex-col gap-2.5">
            <h2 className="text-base font-bold">What done looks like</h2>
            <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm leading-normal text-ink-2">
              {task.doneLooksLike.map((d) => (
                <li key={d}>{d}</li>
              ))}
              <li>A source link for every claim</li>
            </ul>
          </Card>

          <Card label="What you get to work with" className="flex flex-col gap-2.5">
            <h2 className="text-base font-bold">What you get to work with</h2>
            {task.inputs.map((i) => (
              <div
                key={i.label}
                className={`flex flex-wrap gap-2 rounded-[10px] px-3 py-2.5 text-sm ${i.ready ? "bg-soft" : "bg-bad-tint"}`}
              >
                <span className="flex-[1_1_200px]">{i.label}</span>
                <span className={`text-xs font-semibold ${i.ready ? "text-ok" : "text-bad"}`}>
                  {i.ready ? "Ready" : "Missing · blocks this task"}
                </span>
              </div>
            ))}
          </Card>

          {task.submissions.map((s) => {
            const author = memberById(room, s.authorId);
            const checkers = (s.checkedBy ?? []).map((c) => (c === "ai" ? "AI" : memberById(room, c)?.name));
            return (
              <Card key={s.id} label="Submitted work" className="flex flex-col gap-2.5">
                <h2 className="text-base font-bold">Submitted work</h2>
                <div className="text-[13px] text-subtle">
                  {author?.name} · {s.createdAt}
                </div>
                <p className="text-sm leading-relaxed">{s.body}</p>
                <div className="flex flex-wrap gap-3 text-xs">
                  {s.sources.map((src, i) => (
                    <a key={i} href={src} target="_blank" rel="noreferrer">
                      Source {i + 1}
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
              owner && { p: owner, role: "owner" },
              ...helpers.map((p) => ({ p: p!, role: "helper" })),
              ...requested.map((p) => ({ p: p!, role: "asked to join" })),
            ]
              .filter((x): x is { p: NonNullable<typeof owner>; role: string } => Boolean(x))
              .map(({ p, role }) => (
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
          {requested.length > 0 && owner && (
            <div className="flex flex-col gap-2 rounded-xl border border-line px-3.5 py-3">
              <span className="text-[13px]">
                <strong>{requested.map((r) => r?.name).join(", ")}</strong> asked to join this task.
              </span>
              <div className="flex flex-wrap gap-2">
                <DemoButton variant="primary">Add as helper</DemoButton>
                <DemoButton>Split off part as a new task</DemoButton>
              </div>
              <span className="text-xs text-subtle">Only {owner.name} sees these buttons, as the owner.</span>
            </div>
          )}
          <Composer id="taskmsg" label="Write a message" placeholder="Ask a question, share an update, or add a source link" />
          <div className="flex flex-wrap items-center gap-2.5">
            <DemoButton>Add source link</DemoButton>
            <DemoButton>Mark as stuck</DemoButton>
            <span className="ml-auto">
              <DemoButton variant="primary">Post</DemoButton>
            </span>
          </div>
          <span className="text-xs text-subtle">
            Room rules apply: medical claims need a source. No treatment advice. No asking for money.
          </span>
        </Card>
      </div>
    </div>
  );
}
