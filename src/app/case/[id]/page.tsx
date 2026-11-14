import Link from "next/link";
import { notFound } from "next/navigation";
import { AddGapForm } from "@/components/add-gap-form";
import { Brief } from "@/components/brief";
import { DemoButton } from "@/components/demo-button";
import { InviteLink } from "@/components/invite-link";
import { JoinPanel } from "@/components/join-panel";
import { Composer, MessageItem } from "@/components/message-list";
import { Card } from "@/components/ui";
import { getViewer } from "@/lib/auth";
import { briefProgress, caseMessages, getRoom, stuckOrWaiting, volunteers } from "@/lib/data";
import { SAMPLE_QUESTIONS } from "@/lib/sample-case";

export default async function CasePage({ params }: PageProps<"/case/[id]">) {
  const { id } = await params;
  const loaded = await getRoom(id);
  if (!loaded) notFound();
  if (loaded.teaser) {
    const viewer = await getViewer();
    if (!viewer) notFound();
    return <JoinPanel teaser={loaded.teaser} viewer={viewer} />;
  }
  const room = loaded.room;
  const demo = room.viewer === null;

  const progress = briefProgress(room);
  const members = volunteers(room);
  const openGaps = room.tasks.filter((t) => t.status === "open").length;
  const stuck = room.tasks.filter((t) => t.status === "stuck").length;
  const discussion = caseMessages(room);
  const pinned = discussion.filter((m) => m.pinned);
  const recent = discussion.filter((m) => !m.pinned).slice(-8);
  const messageCounts = Object.fromEntries(
    room.tasks.map((t) => [t.id, room.messages.filter((m) => m.taskId === t.id).length]),
  );
  const needsHelp = stuckOrWaiting(room);

  return (
    <div className="flex flex-col gap-5">
      <section aria-label="Goal" className="flex flex-wrap items-center gap-6 rounded-2xl bg-ink px-5 py-5 text-white sm:px-7">
        <div className="flex min-w-0 flex-[1_1_520px] flex-col gap-1.5">
          <span className="text-xs font-bold uppercase tracking-widest text-line-2">Goal</span>
          <h1 className="font-display text-2xl leading-tight font-bold sm:text-[28px]">{room.goal}</h1>
          <p className="text-[13px] text-line-2">
            We build one brief for the family. Questions and options only, never treatment advice.
          </p>
        </div>
        <div className="flex min-w-60 flex-col gap-2">
          <div className="flex justify-between gap-4 text-[13px]">
            <span>Brief {progress}% filled</span>
            {room.visitInDays !== null && (
              <span className="text-line-2">
                {room.visitInDays > 0
                  ? `Visit in ${room.visitInDays} day${room.visitInDays === 1 ? "" : "s"}`
                  : room.visitInDays === 0
                    ? "Visit today"
                    : "Visit date passed"}
              </span>
            )}
          </div>
          <div
            role="progressbar"
            aria-label="Brief progress"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
            className="h-2.5 rounded-full bg-muted"
          >
            <div className="h-2.5 rounded-full bg-[#9ec3f0]" style={{ width: `${progress}%` }} />
          </div>
          <span className="text-xs text-line-2">
            {members.length} volunteer{members.length === 1 ? "" : "s"} · {openGaps} gap{openGaps === 1 ? "" : "s"} open ·{" "}
            {stuck} stuck
          </span>
        </div>
      </section>

      {room.summary && !demo && (
        <Card label="Case summary" className="flex flex-col gap-2">
          <h2 className="text-base font-bold">Case summary</h2>
          <p className="whitespace-pre-line text-[15px] leading-relaxed text-ink-2">{room.summary}</p>
          <span className="text-xs text-subtle">Shared with consent. Names and ID numbers removed.</span>
        </Card>
      )}

      <div className="grid items-start gap-5 lg:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-5 lg:col-span-2">
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
            <Card label="Suggest a missing gap" className="flex flex-col gap-3">
              <h2 id="add-gap" className="scroll-mt-6 font-display text-lg font-bold">
                Suggest a missing gap
              </h2>
              <p className="text-sm text-muted">
                See something the brief needs that no task covers? Add it as a small task someone can pick up.
              </p>
              <AddGapForm caseId={room.id} sections={room.sections} />
            </Card>
          )}
        </div>

        <aside className="flex min-w-0 flex-col gap-5">
          <Card label="Case discussion" className="flex flex-col gap-3.5">
            <div id="discussion" className="flex scroll-mt-6 flex-col gap-1">
              <h2 className="font-display text-xl font-bold">Case discussion</h2>
              <span className="text-xs text-subtle">
                For the whole case. Everyone on the case can read it. Task questions go in the task&apos;s own thread.
              </span>
            </div>
            {pinned.map((m) =>
              m.isAi ? (
                <div key={m.id} className="flex flex-col gap-1.5 rounded-xl bg-soft px-3.5 py-3">
                  <span className="text-xs font-bold text-muted">Pinned · AI summary</span>
                  <p className="text-[13px] leading-normal">{m.body}</p>
                </div>
              ) : (
                <MessageItem key={m.id} room={room} msg={m} compact />
              ),
            )}
            {recent.length === 0 && pinned.length === 0 && (
              <p className="text-sm text-subtle">No messages yet. Say hello and share what you&apos;re working on.</p>
            )}
            {recent.map((m) => (
              <MessageItem key={m.id} room={room} msg={m} compact />
            ))}
            <Composer room={room} taskId={null} label="Message everyone on this case" placeholder="Share an update or ask the group" />
          </Card>

          {needsHelp.length > 0 && (
            <Card label="Needs help now" className="flex flex-col gap-2.5">
              <h2 className="font-display text-lg font-bold">Needs help now</h2>
              {needsHelp.map((t) => (
                <Link key={t.id} href={`/case/${room.id}/task/${t.id}`} className="text-sm leading-snug">
                  {t.status === "stuck" ? `Stuck: ${t.title}` : `Waiting for a second check: ${t.title}`}
                </Link>
              ))}
            </Card>
          )}

          <Card label="Volunteers" className="flex flex-col gap-2.5">
            <div className="flex items-baseline justify-between">
              <h2 className="font-display text-lg font-bold">Volunteers</h2>
              {(demo || room.viewer?.isAdmin) && (
                <Link href={`/case/${room.id}/people`} className="text-[13px] font-semibold">
                  Manage
                </Link>
              )}
            </div>
            {members.length === 0 ? (
              <p className="text-sm text-subtle">No volunteers yet. Share the invite link below.</p>
            ) : (
              <ul className="flex flex-col text-sm leading-7 text-ink-2">
                {members.map((m) => (
                  <li key={m.id}>
                    <strong>{m.name}</strong>
                    {m.headline ? ` · ${m.headline}` : ""}
                  </li>
                ))}
              </ul>
            )}
            {room.missingExpertise.length > 0 && (
              <span className="text-xs font-semibold text-warn">
                Missing expertise: {room.missingExpertise.join(", ").toLowerCase()}
              </span>
            )}
            {demo ? <DemoButton>Invite someone with this expertise</DemoButton> : <InviteLink caseId={room.id} />}
          </Card>

          <section aria-label="Room rules" className="rounded-2xl bg-line px-5 py-4 text-xs leading-relaxed text-ink-2">
            <strong className="text-ink">Room rules:</strong> every claim needs a source link. Nothing counts until
            checked. No treatment advice. No asking the family for money. No private messages.
          </section>
        </aside>
      </div>
    </div>
  );
}
