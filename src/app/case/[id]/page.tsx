import Link from "next/link";
import { notFound } from "next/navigation";
import { AddIdea } from "@/components/add-idea";
import { CasePreview, PrivateCase } from "@/components/case-preview";
import { JoinPanel } from "@/components/join-panel";
import { ShareMenu } from "@/components/share-menu";
import { SuggestIdeas } from "@/components/suggest-ideas";
import { TakeIdea } from "@/components/take-idea";
import { Avatar, ExpertiseBadge } from "@/components/ui";
import { getViewer } from "@/lib/auth";
import { approvedMembers, getRoom, pendingRequests } from "@/lib/data";
import { loadMyQuestions, loadPublicQuestions, loadTeamQuestions } from "@/lib/db-questions";
import { SAMPLE_PUBLIC_QUESTIONS, SAMPLE_VISITOR_QUESTIONS, samplePreviewTeaser } from "@/lib/sample-case";
import { loadLeads } from "@/lib/db-leads";
import { ideasFor, openSeats, splitGoal, type Idea, type IdeaGroup } from "@/lib/ideas";
import { loadShareCard } from "@/lib/share-card";
import { SHARE_ROLES, cardVersion } from "@/lib/share-text";
import { CASE_SAFETY_LINE, EXPERTISE_LABEL, caseFacts, personLabel, roleLabel, type Member } from "@/lib/types";

const GROUPS: { key: IdeaGroup; label: string; dot: string }[] = [
  { key: "needs", label: "Needs someone", dot: "bg-[#e0b43a]" },
  { key: "progress", label: "In progress", dot: "bg-brand" },
  { key: "done", label: "Done", dot: "bg-ok" },
];

const initial = (m: Member) => m.name.replace("Dr. ", "").charAt(0).toUpperCase();

function PartNumber({ n }: { n: number }) {
  return (
    <span aria-hidden="true" className="grid h-[26px] w-[26px] flex-none place-items-center self-center rounded-full bg-ink text-[13px] font-bold text-white">
      {n}
    </span>
  );
}

/** One idea in the list. The title opens it; the button takes it. */
function IdeaRow({ idea, caseId, demo, canTake, viewerId }: { idea: Idea; caseId: string; demo: boolean; canTake: boolean; viewerId?: string }) {
  const done = idea.group === "done";
  return (
    <li className={`row-link relative flex-wrap ${done ? "bg-[#f6f7f6]" : ""}`}>
      <div className="flex min-w-0 flex-[1_1_260px] flex-col">
        <Link
          href={idea.href}
          className={`text-[15px] leading-snug font-semibold no-underline after:absolute after:inset-0 after:rounded-[10px] ${done ? "text-muted hover:text-muted" : "text-ink hover:text-ink"}`}
        >
          {idea.title}
        </Link>
        {idea.line && <span className="text-[13px] text-muted">{idea.line}</span>}
      </div>
      {idea.group === "needs" && idea.expertise && <ExpertiseBadge expertise={idea.expertise} />}
      {idea.group === "progress" &&
        idea.people.slice(0, 2).map((p) => (
          <span key={p.id} className="inline-flex items-center gap-1.5 text-[13px] whitespace-nowrap text-muted">
            <Avatar person={p} size={26} />
            {personLabel(p)}
            {p.id === viewerId ? " (you)" : ""}
          </span>
        ))}
      {idea.group === "needs" && canTake ? (
        <TakeIdea caseId={caseId} kind={idea.kind} id={idea.id} demo={demo} />
      ) : (
        <span aria-hidden="true" className="btn btn-secondary btn-sm">
          Open
        </span>
      )}
    </li>
  );
}

export default async function LeadsPage({ params, searchParams }: PageProps<"/case/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const loaded = await getRoom(id);
  if (!loaded) notFound();
  if (loaded.teaser) {
    const teaser = loaded.teaser;
    if (teaser.signedOut) {
      if (!teaser.preview) return <PrivateCase id={teaser.id} />;
      return <CasePreview teaser={teaser} viewer={null} questions={await loadPublicQuestions(teaser.id)} />;
    }
    const viewer = await getViewer();
    if (!viewer) notFound();
    if (!teaser.preview) return <JoinPanel teaser={teaser} viewer={viewer} />;
    const [questions, mine] = await Promise.all([loadPublicQuestions(teaser.id), loadMyQuestions(teaser.id, viewer.id)]);
    return <CasePreview teaser={teaser} viewer={viewer} questions={questions} mine={mine} />;
  }
  const room = loaded.room;
  // The sample case can show what its public preview looks like.
  if (room.viewer === null && sp.preview === "1") {
    return <CasePreview teaser={samplePreviewTeaser()} viewer={null} questions={SAMPLE_PUBLIC_QUESTIONS} demo />;
  }
  const demo = room.viewer === null;
  const v = room.viewer;
  const isAdmin = demo || !!v?.isAdmin;
  const [leads, card, questions] = await Promise.all([
    loadLeads(room.id),
    isAdmin ? loadShareCard(room.id) : Promise.resolve(null),
    demo ? Promise.resolve(SAMPLE_VISITOR_QUESTIONS) : v?.isAdmin ? loadTeamQuestions(room.id) : Promise.resolve([]),
  ]);
  const ideas = ideasFor(room, leads);
  const facts = caseFacts(room);
  const goal = splitGoal(room.goal);
  const approved = approvedMembers(room);
  const family = approved.filter((m) => m.role === "creator" || m.role === "family");
  const helpers = approved.filter((m) => m.role !== "creator" && m.role !== "family");
  const seats = openSeats(room);
  const waiting = isAdmin ? pendingRequests(room).length : 0;
  const newQuestions = isAdmin ? questions.filter((q) => !q.reply).length : 0;
  const checkedParts = room.sections.filter((s) => s.status === "checked").length;
  const aiSuggested = leads.some((l) => l.aiSuggested);
  const version = cardVersion([card?.cancerType, card?.cancerStage, ...(card?.needed ?? []), "/", ...(card?.seats ?? [])]);
  const workingOn = (m: Member) => ideas.find((i) => i.group === "progress" && i.people.some((p) => p.id === m.id))?.title;
  const short = (t: string) => (t.length > 38 ? `${t.slice(0, 36).trimEnd()}...` : t);

  return (
    <div className="mx-auto flex max-w-[1180px] flex-col">
      <section aria-labelledby="goal-h" className="panel grid items-end gap-6 rounded-2xl px-5 py-6 sm:grid-cols-[minmax(0,1fr)_auto] sm:px-8 sm:py-7">
        <div className="min-w-0">
          <div className="mb-2.5 flex items-center gap-2.5">
            <PartNumber n={1} />
            <span className="text-sm font-bold">The goal</span>
          </div>
          <h1 id="goal-h" className="font-display text-[30px] leading-[1.1] font-medium tracking-[-0.015em] sm:text-[40px]">
            {goal.head}
            <span className="hl" data-on="true">
              {goal.tail}
            </span>
          </h1>
          {facts.length > 0 && (
            <ul aria-label="Case facts" className="mt-3.5 flex flex-wrap gap-2">
              {facts.map((f) => (
                <li key={f} className="rounded-full bg-soft px-3 py-1 text-sm text-ink">
                  {f}
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2.5 text-[13px] text-muted">{CASE_SAFETY_LINE}</p>
        </div>
        {room.visitInDays !== null && (
          <div className="sm:text-right">
            <strong className="block font-display text-[40px] leading-none font-medium">
              {room.visitInDays > 0
                ? `${room.visitInDays} day${room.visitInDays === 1 ? "" : "s"}`
                : room.visitInDays === 0
                  ? "Today"
                  : "Passed"}
            </strong>
            <span className="text-sm text-muted">{room.visitInDays >= 0 ? "until the doctor visit" : "the doctor visit date"}</span>
          </div>
        )}
      </section>

      <div className="mt-9 grid items-start gap-9 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section aria-labelledby="work-h" className="relative min-w-0">
          <div className="mb-3.5 flex flex-wrap items-baseline gap-x-2.5 gap-y-2">
            <PartNumber n={2} />
            <h2 id="work-h" className="font-display text-[26px] font-medium">
              The work
            </h2>
            <span className="text-sm text-muted">Ideas the team is checking</span>
          </div>

          {ideas.length === 0 ? (
            <div className="panel flex flex-col items-start gap-3 p-6">
              <p className="max-w-[56ch] text-[15px]">
                {isAdmin ? "No ideas yet. Let the AI read the case and suggest a few, or add your own." : "No ideas yet. Add the first one."}
              </p>
              <div className="flex flex-wrap items-start gap-2">
                {isAdmin && <SuggestIdeas caseId={room.id} demo={demo} primary autoStart={sp.new === "1"} />}
                <AddIdea caseId={room.id} demo={demo} primary={!isAdmin} />
              </div>
            </div>
          ) : (
            <>
              <AddIdea caseId={room.id} demo={demo} corner />
              {isAdmin && !demo && !aiSuggested && (
                <div className="mb-5 flex flex-wrap items-center gap-3 rounded-xl border border-line bg-white px-4 py-3 text-sm">
                  <span className="min-w-0 flex-[1_1_240px]">Let the AI read the case and suggest a few more ideas.</span>
                  <SuggestIdeas caseId={room.id} demo={demo} autoStart={sp.new === "1"} />
                </div>
              )}
              {GROUPS.map((g) => {
                const rows = ideas.filter((i) => i.group === g.key);
                if (rows.length === 0) return null;
                return (
                  <div key={g.key} className="mb-5 last:mb-0">
                    <h3 className="mb-2 flex items-center gap-2 text-[13px] font-bold">
                      <i aria-hidden="true" className={`h-[9px] w-[9px] rounded-full ${g.dot}`} />
                      {g.label} <span className="font-medium text-muted">{rows.length}</span>
                    </h3>
                    <ul className="flex flex-col gap-2">
                      {rows.map((i) => (
                        <IdeaRow key={i.key} idea={i} caseId={room.id} demo={demo} canTake={demo || !i.people.some((p) => p.id === v?.id)} viewerId={v?.id} />
                      ))}
                    </ul>
                  </div>
                );
              })}
            </>
          )}
        </section>

        <aside aria-labelledby="people-h" className="min-w-0">
          <div className="mb-3.5 flex items-baseline gap-2.5">
            <PartNumber n={3} />
            <h2 id="people-h" className="font-display text-[26px] font-medium">
              The people
            </h2>
          </div>
          <ul className="panel rounded-2xl px-[18px] py-2">
            {family.map((m) => (
              <li key={m.id} className="flex items-center gap-3 border-t border-line py-3 first:border-t-0">
                <span aria-hidden="true" className="grid h-9 w-9 flex-none place-items-center rounded-full bg-hover text-sm font-bold text-ink">
                  F
                </span>
                <div className="min-w-0">
                  <b className="block text-sm">Family{m.id === v?.id ? " (you)" : ""}</b>
                  <span className="text-[13px] text-muted">Started this case</span>
                </div>
              </li>
            ))}
            {helpers.map((m) => {
              const on = workingOn(m);
              return (
                <li key={m.id} className="flex items-center gap-3 border-t border-line py-3 first:border-t-0">
                  <Avatar person={m} size={36} />
                  <div className="min-w-0">
                    <b className="block text-sm">
                      {/^[0-9a-f-]{36}$/i.test(m.id) ? (
                        <Link href={`/profile/${m.id}`} className="text-ink no-underline hover:text-brand hover:underline hover:underline-offset-4">
                          {initial(m)}, {roleLabel(m)}
                        </Link>
                      ) : (
                        <>
                          {initial(m)}, {roleLabel(m)}
                        </>
                      )}
                      {m.id === v?.id ? " (you)" : ""}
                    </b>
                    <span className="block truncate text-[13px] text-muted">{on ? `On: ${short(on)}` : "Not on an idea yet"}</span>
                  </div>
                </li>
              );
            })}
            {seats.map((e) => {
              const slug = SHARE_ROLES.find((r) => r.expertise === e)?.slug ?? "anyone";
              return (
                <li key={e} className="flex items-center gap-3 border-t border-line py-3 first:border-t-0">
                  <span aria-hidden="true" className="grid h-9 w-9 flex-none place-items-center rounded-full border-2 border-dashed border-mark-edge bg-mark-tint text-sm font-bold text-mark-text">
                    ?
                  </span>
                  <div className="min-w-0 flex-1">
                    <b className="block text-sm">Open seat</b>
                    <span className="text-[13px] text-muted">{EXPERTISE_LABEL[e]}</span>
                  </div>
                  {isAdmin && (
                    <ShareMenu
                      caseId={room.id}
                      suggested={slug}
                      version={version}
                      previewOn={demo || !!room.publicPreview}
                      canTurnOn={v?.role === "creator"}
                      buttonClass="btn btn-secondary btn-sm"
                      buttonLabel={`Share to find: ${EXPERTISE_LABEL[e]}`}
                    />
                  )}
                </li>
              );
            })}
          </ul>

          {(waiting > 0 || newQuestions > 0) && (
            <p className="mt-2.5 flex flex-col gap-1 text-[13px] text-muted">
              {waiting > 0 && (
                <span>
                  {waiting} waiting to join.{" "}
                  <Link href={`/case/${room.id}/people`} className="font-semibold">
                    Review
                  </Link>
                </span>
              )}
              {newQuestions > 0 && (
                <span>
                  {newQuestions} new {newQuestions === 1 ? "question" : "questions"}.{" "}
                  <Link href={`/case/${room.id}/people#questions`} className="font-semibold">
                    Review
                  </Link>
                </span>
              )}
            </p>
          )}

          <section aria-label="For the doctor" className="mt-4 rounded-[14px] bg-ink px-[18px] py-4 text-white">
            <b className="block font-display text-[19px] font-medium">For the doctor</b>
            <p className="mt-1 mb-3 text-[13px] text-[#c9cfd8]">
              {checkedParts} of {room.sections.length} parts {checkedParts === 1 ? "is" : "are"} checked and ready.
            </p>
            <Link href={`/case/${room.id}/doctor`} className="btn btn-mark btn-sm">
              Read the brief
            </Link>
          </section>
        </aside>
      </div>
    </div>
  );
}
