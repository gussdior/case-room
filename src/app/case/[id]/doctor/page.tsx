import { notFound, redirect } from "next/navigation";
import { Brief } from "@/components/brief";
import { Composer, MessageItem } from "@/components/message-list";
import { caseMessages, getRoom } from "@/lib/data";
import { SAMPLE_QUESTIONS } from "@/lib/sample-case";

const SEGMENT = { checked: "bg-ok", draft: "bg-brand", empty: "bg-[#dde1dd]" } as const;

export const metadata = { title: "For the doctor | Case Room" };

export default async function DoctorPage({ params }: PageProps<"/case/[id]/doctor">) {
  const { id } = await params;
  const loaded = await getRoom(id);
  if (!loaded) notFound();
  if (loaded.teaser) redirect(`/case/${id}`);
  const room = loaded.room;
  const demo = room.viewer === null;

  const discussion = caseMessages(room);
  const pinned = discussion.filter((m) => m.pinned);
  const recent = discussion.filter((m) => !m.pinned).slice(-6);
  const counts = {
    checked: room.sections.filter((s) => s.status === "checked").length,
    draft: room.sections.filter((s) => s.status === "draft").length,
    empty: room.sections.filter((s) => s.status === "empty").length,
  };

  return (
    <div className="flex flex-col">
      <section aria-label="Goal" className="flex flex-wrap items-end gap-x-10 gap-y-4">
        <div className="min-w-0 flex-[1_1_560px]">
          <p className="text-sm font-semibold text-muted">For the doctor</p>
          <h1 className="mt-1 max-w-[820px] font-display text-[34px] leading-[1.1] font-medium tracking-[-0.015em] sm:text-[44px]">
            {room.goal}
          </h1>
          <p className="mt-3 max-w-[640px] text-base text-muted">
            What the team checked, written for the family to bring to the doctor. Ideas that hold up end up here as
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
        <span>{counts.empty} not started</span>
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
            sections={room.sections}
            tasks={room.tasks}
            members={room.members}
            questions={demo ? SAMPLE_QUESTIONS : []}
          />
        </div>

        <aside className="flex min-w-0 flex-col gap-9">
          <section aria-label="Case discussion" className="flex flex-col gap-3">
            <div id="discussion" className="scroll-mt-6">
              <h2 className="font-semibold">Discussion</h2>
              <p className="text-xs text-muted">Everyone on the case can read this. Questions about one idea go on that idea.</p>
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
