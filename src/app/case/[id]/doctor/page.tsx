import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AddGapForm } from "@/components/add-gap-form";
import { Brief } from "@/components/brief";
import { DemoButton } from "@/components/demo-button";
import { InviteLink } from "@/components/invite-link";
import { Composer, MessageItem } from "@/components/message-list";
import { Avatar, ExpertiseBadge, PersonLink, btn } from "@/components/ui";
import { caseMessages, getRoom, stuckOrWaiting, volunteers } from "@/lib/data";
import { SAMPLE_QUESTIONS } from "@/lib/sample-case";
import type { CaseRoom, Task } from "@/lib/types";

const SEGMENT = { checked: "bg-ok", draft: "bg-brand", empty: "bg-[#dde1dd]" } as const;

/** The one thing this person should do next. */
function nextStep(room: CaseRoom): { title: string; task?: Task; label: string } | null {
  const v = room.viewer;
  const exp = v?.expertise ?? "researcher";
  const mine = v ? room.tasks.find((t) => t.ownerId === v.id && (t.status === "taken" || t.status === "stuck")) : undefined;
  if (mine) return { title: mine.progressNote || mine.title, task: mine, label: "Continue my task" };
  const check = room.tasks.find(
    (t) => t.status === "submitted" && (t.expertise === exp || exp === "doctor_nurse") && t.ownerId !== v?.id,
  );
  if (check) return { title: `Check: ${check.title}`, task: check, label: "Check this work" };
  const open = room.tasks.find((t) => t.status === "open" && t.expertise === exp);
  if (open) return { title: open.title, task: open, label: "Open this task" };
  return null;
}

export const metadata = { title: "For the doctor | Case Room" };

export default async function DoctorPage({ params }: PageProps<"/case/[id]/doctor">) {
  const { id } = await params;
  const loaded = await getRoom(id);
  if (!loaded) notFound();
  if (loaded.teaser) redirect(`/case/${id}`);
  const room = loaded.room;
  const demo = room.viewer === null;

  const members = volunteers(room);
  const discussion = caseMessages(room);
  const pinned = discussion.filter((m) => m.pinned);
  const recent = discussion.filter((m) => !m.pinned).slice(-6);
  const messageCounts = Object.fromEntries(
    room.tasks.map((t) => [t.id, room.messages.filter((m) => m.taskId === t.id).length]),
  );
  const needsHelp = stuckOrWaiting(room).filter((t) => t.status === "stuck");
  const counts = {
    checked: room.sections.filter((s) => s.status === "checked").length,
    draft: room.sections.filter((s) => s.status === "draft").length,
    empty: room.sections.filter((s) => s.status === "empty").length,
  };
  const next = nextStep(room);

  return (
    <div className="flex flex-col">
      <section aria-label="Goal" className="flex flex-wrap items-end gap-x-10 gap-y-4">
        <div className="min-w-0 flex-[1_1_560px]">
          <p className="text-sm font-semibold text-muted">For the doctor</p>
          <h1 className="mt-1 max-w-[820px] font-display text-[34px] leading-[1.1] font-medium tracking-[-0.015em] sm:text-[44px]">
            {room.goal}
          </h1>
          <p className="mt-3 max-w-[640px] text-base text-muted">
            What the team checked, written for the family to bring to her doctor. Leads that hold up end up here as
            questions and options, never treatment advice.
          </p>
        </div>
        {room.visitInDays !== null && (
          <div className="flex-none text-right">
            <strong className="block font-display text-[40px] leading-none font-medium">
              {room.visitInDays > 0
                ? `${room.visitInDays} day${room.visitInDays === 1 ? "" : "s"}`
                : room.visitInDays === 0
                  ? "Today"
                  : "Passed"}
            </strong>
            <span className="text-sm text-muted">until the doctor visit</span>
          </div>
        )}
      </section>

      <div
        className="mt-7 flex gap-1.5"
        role="img"
        aria-label={`Brief progress: ${counts.checked} of ${room.sections.length} parts checked`}
      >
        {room.sections.map((s) => (
          <i key={s.id} className={`h-1.5 flex-1 rounded-full ${SEGMENT[s.status]}`} />
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-5 text-[13px] text-muted">
        <span>
          <b className="text-ok">{counts.checked} checked</b>
        </span>
        <span>
          <b className="text-brand">{counts.draft} in progress</b>
        </span>
        <span>{counts.empty} need people</span>
      </div>

      {room.summary && !demo && (
        <section aria-label="Case summary" className="mt-8 max-w-[860px] border-l-[3px] border-mark py-1 pl-5">
          <h2 className="text-sm font-semibold text-muted">Case summary</h2>
          <p className="mt-1 whitespace-pre-line font-serif text-lg leading-relaxed text-ink-2">{room.summary}</p>
          <span className="text-xs text-subtle">Shared with consent. Names and ID numbers removed.</span>
        </section>
      )}

      <div className="mt-8 grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex min-w-0 flex-col gap-8">
          <Brief
            caseId={room.id}
            demo={demo}
            viewerId={room.viewer?.id}
            viewerExpertise={room.viewer?.expertise}
            sections={room.sections}
            tasks={room.tasks}
            members={room.members}
            messageCounts={messageCounts}
            questions={demo ? SAMPLE_QUESTIONS : []}
          />
          {!demo && (
            <details className="panel group p-5 sm:p-6">
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3">
                <span>
                  <span id="add-gap" className="block scroll-mt-6 font-display text-xl font-medium">
                    Suggest a missing gap
                  </span>
                  <span className="text-sm text-muted">See something the brief needs that no task covers? Add a small task.</span>
                </span>
                <span className="text-sm font-semibold text-brand group-open:hidden">Add a gap</span>
              </summary>
              <div className="mt-4 border-t border-line pt-4">
                <AddGapForm caseId={room.id} sections={room.sections} />
              </div>
            </details>
          )}
        </div>

        <aside className="flex min-w-0 flex-col gap-9">
          {next && (
            <section aria-label="Your next step" className="rounded-[14px] bg-ink p-[22px] text-white">
              <p className="text-sm text-[#c9cfd8]">Your next step</p>
              <h2 className="mt-1.5 mb-4 font-display text-[22px] leading-tight font-medium">{next.title}</h2>
              <div className="flex flex-wrap gap-2">
                {demo ? (
                  <DemoButton variant="mark">{next.label}</DemoButton>
                ) : next.task ? (
                  <Link href={`/case/${room.id}/task/${next.task.id}`} className={btn.mark}>
                    {next.label}
                  </Link>
                ) : null}
                {next.task && (
                  <Link
                    href={`/case/${room.id}/task/${next.task.id}#ai`}
                    className="btn border border-[#4a5563] text-white hover:bg-[#26303d] hover:text-white"
                  >
                    Ask AI
                  </Link>
                )}
              </div>
            </section>
          )}

          {needsHelp.length > 0 && (
            <section aria-label="Stuck tasks" className="flex flex-col gap-2">
              <h2 className="font-semibold">Stuck, needs a hand</h2>
              {needsHelp.map((t) => (
                <Link key={t.id} href={`/case/${room.id}/task/${t.id}#help`} className="row-link border-bad-line bg-bad-tint text-sm">
                  <span className="flex-1">{t.title}</span>
                </Link>
              ))}
            </section>
          )}

          <section aria-label="Who is helping">
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="font-semibold">Who is helping</h2>
              {(demo || room.viewer?.isAdmin) && (
                <Link href={`/case/${room.id}/people`} className="text-[13px] font-semibold">
                  Manage people
                </Link>
              )}
            </div>
            {members.length === 0 ? (
              <p className="text-sm text-muted">No volunteers yet. Share the invite link below.</p>
            ) : (
              <ul className="-mx-2 flex flex-col">
                {members.map((m) => (
                  <li key={m.id} className="flex items-center gap-3 rounded-[10px] px-2 py-2.5 transition-colors hover:bg-hover">
                    <Avatar person={m} size={34} />
                    <div className="min-w-0 flex-1">
                      <PersonLink person={m} className="text-sm font-semibold" />
                      {m.id === room.viewer?.id && <span className="text-sm text-muted"> (you)</span>}
                      {m.headline && <div className="truncate text-xs text-muted">{m.headline}</div>}
                    </div>
                    <ExpertiseBadge expertise={m.expertise} />
                  </li>
                ))}
              </ul>
            )}
            {room.missingExpertise.length > 0 && (
              <p className="mt-2 rounded-[10px] border border-dashed border-mark-edge bg-mark-tint px-3.5 py-3 text-[13px] text-mark-text">
                Missing: {room.missingExpertise.join(", ").toLowerCase()}.
              </p>
            )}
            <div className="mt-3">
              {demo ? <DemoButton>Copy invite link</DemoButton> : <InviteLink caseId={room.id} />}
            </div>
          </section>

          <section aria-label="Case discussion" className="flex flex-col gap-3">
            <div id="discussion" className="scroll-mt-6">
              <h2 className="font-semibold">Discussion</h2>
              <p className="text-xs text-muted">Everyone on the case can read this. Task questions go in the task.</p>
            </div>
            {pinned.map((m) =>
              m.isAi ? (
                <div key={m.id} className="flex flex-col gap-1 rounded-[10px] border border-line bg-sheet px-3.5 py-3">
                  <span className="text-xs font-semibold text-muted">Pinned AI summary</span>
                  <p className="text-[13px] leading-normal">{m.body}</p>
                </div>
              ) : (
                <MessageItem key={m.id} room={room} msg={m} compact />
              ),
            )}
            {recent.length === 0 && pinned.length === 0 && (
              <p className="text-sm text-muted">No messages yet. Say hello and share what you&apos;re working on.</p>
            )}
            <div className="flex flex-col divide-y divide-line">
              {recent.map((m) => (
                <div key={m.id} className="py-3 first:pt-0">
                  <MessageItem room={room} msg={m} compact />
                </div>
              ))}
            </div>
            <Composer room={room} taskId={null} label="Write to everyone on this case" placeholder="Share an update or ask the group" />
          </section>

          <p className="text-xs leading-relaxed text-muted">
            <strong className="text-ink">Room rules:</strong> every claim needs a source link. Nothing counts until
            checked. No treatment advice. No asking the family for money. No private messages.
          </p>
        </aside>
      </div>
    </div>
  );
}
