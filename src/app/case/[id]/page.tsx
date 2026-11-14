import Link from "next/link";
import { notFound } from "next/navigation";
import { Brief } from "@/components/brief";
import { DemoButton } from "@/components/demo-button";
import { Composer, MessageItem } from "@/components/message-list";
import { Card } from "@/components/ui";
import {
  briefProgress,
  caseMessages,
  getCaseRoom,
  stuckOrWaiting,
  volunteers,
} from "@/lib/data";
import { SAMPLE_QUESTIONS } from "@/lib/sample-case";

export default async function CasePage({ params }: PageProps<"/case/[id]">) {
  const { id } = await params;
  const room = await getCaseRoom(id);
  if (!room) notFound();

  const progress = briefProgress(room);
  const members = volunteers(room);
  const openGaps = room.tasks.filter((t) => t.status === "open").length;
  const stuck = room.tasks.filter((t) => t.status === "stuck").length;
  const discussion = caseMessages(room);
  const pinned = discussion.find((m) => m.pinned);
  const recent = discussion.filter((m) => !m.pinned);
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
          <div className="flex justify-between text-[13px]">
            <span>Brief {progress}% filled</span>
            <span className="text-line-2">Visit in {room.visitInDays} days</span>
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
            {members.length} volunteers · {openGaps} gaps open · {stuck} task stuck
          </span>
        </div>
      </section>

      <div className="grid items-start gap-5 lg:grid-cols-3">
        <div className="min-w-0 lg:col-span-2">
          <Brief
            caseId={room.id}
            sections={room.sections}
            tasks={room.tasks}
            members={room.members}
            messageCounts={messageCounts}
            questions={SAMPLE_QUESTIONS}
          />
        </div>

        <aside className="flex min-w-0 flex-col gap-5">
          <Card label="Case discussion" className="flex flex-col gap-3.5">
            <div id="discussion" className="flex scroll-mt-6 flex-col gap-1">
              <h2 className="font-display text-xl font-bold">Case discussion</h2>
              <span className="text-xs text-subtle">For the whole case. Task questions go in the task&apos;s own thread.</span>
            </div>
            {pinned && (
              <div className="flex flex-col gap-1.5 rounded-xl bg-soft px-3.5 py-3">
                <span className="text-xs font-bold text-muted">Pinned · AI summary of today</span>
                <p className="text-[13px] leading-normal">{pinned.body}</p>
              </div>
            )}
            {recent.map((m) => (
              <MessageItem key={m.id} room={room} msg={m} compact />
            ))}
            <Composer id="casemsg" label="Message everyone on this case" placeholder="Share an update or ask the group" />
            <div className="flex items-center gap-2.5">
              <span className="text-[13px] text-subtle">{discussion.length} messages</span>
              <span className="ml-auto">
                <DemoButton variant="primary">Post</DemoButton>
              </span>
            </div>
          </Card>

          <Card label="Needs help now" className="flex flex-col gap-2.5">
            <h2 className="font-display text-lg font-bold">Needs help now</h2>
            {needsHelp.map((t) => (
              <Link key={t.id} href={`/case/${room.id}/task/${t.id}`} className="text-sm leading-snug">
                {t.status === "stuck"
                  ? `${t.title} is stuck: ${t.stuckReason}`
                  : `Waiting for a second check: ${t.title}`}
              </Link>
            ))}
          </Card>

          <Card label="Volunteers" className="flex flex-col gap-2.5">
            <div className="flex items-baseline justify-between">
              <h2 className="font-display text-lg font-bold">Volunteers</h2>
              <Link href={`/case/${room.id}/people`} className="text-[13px] font-semibold">
                See all {members.length}
              </Link>
            </div>
            <ul className="flex flex-col text-sm leading-7 text-ink-2">
              {members.map((m) => (
                <li key={m.id}>
                  <strong>{m.name}</strong> · {m.headline}
                </li>
              ))}
            </ul>
            {room.missingExpertise.length > 0 && (
              <span className="text-xs font-semibold text-warn">
                Missing expertise: {room.missingExpertise.join(", ").toLowerCase()}
              </span>
            )}
            <DemoButton>Invite someone with this expertise</DemoButton>
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
