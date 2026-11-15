import Link from "next/link";
import { notFound } from "next/navigation";
import { CaseAiBar } from "@/components/case-ai-bar";
import { DayOneStrip } from "@/components/day-one";
import { ShareCaseButton } from "@/components/share-case";
import { CasePreview, PrivateCase } from "@/components/case-preview";
import { JoinPanel } from "@/components/join-panel";
import { LeadCard, RailHeading, RunItem } from "@/components/lead-bits";
import { AddLeadForm } from "@/components/lead-forms";
import { SuggestLeadsButton } from "@/components/suggest-leads";
import { toolsForCase } from "@/lib/ai-tools";
import { getViewer } from "@/lib/auth";
import { getRoom, volunteers } from "@/lib/data";
import { loadMyQuestions, loadPublicQuestions } from "@/lib/db-questions";
import { SAMPLE_PUBLIC_QUESTIONS, samplePreviewTeaser } from "@/lib/sample-case";
import { loadLeads, loadRuns } from "@/lib/db-leads";
import { AI_DRAFT_LABEL, caseFacts } from "@/lib/types";

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
  const [leads, runs] = await Promise.all([loadLeads(room.id), loadRuns(room.id, { limit: 3 })]);
  const people = volunteers(room).length;
  const openKinds = leads.filter((l) => l.status !== "ruled_out").map((l) => l.kind);
  const tools = toolsForCase(openKinds, 4);
  const canSuggest = demo || !!room.viewer?.isAdmin;
  const facts = caseFacts(room);
  const isCreator = demo || room.viewer?.role === "creator";
  const aiLeads = leads.filter((l) => l.aiSuggested).length;
  const draftedParts = room.sections.filter((s) => s.body.trim() && (s.sourceNote === AI_DRAFT_LABEL || s.sourceNote?.startsWith("From the family"))).length;
  // The strip is for day one: it goes away once a person has checked any part of the brief.
  const humanChecked = room.tasks.some((t) => t.status === "checked");
  const showDayOne = demo || (!humanChecked && (aiLeads + draftedParts > 0 || !!room.viewer?.isAdmin));

  return (
    <div className="flex flex-col">
      <section aria-label="Case" className="flex flex-wrap items-end gap-x-10 gap-y-4">
        <div className="min-w-0 flex-[1_1_560px]">
          <h1 className="max-w-[860px] font-display text-[34px] leading-[1.1] font-medium tracking-[-0.015em] sm:text-[44px]">
            {room.goal}
          </h1>
          {facts.length > 0 ? (
            <ul aria-label="Case facts" className="mt-3.5 flex flex-wrap gap-2">
              {facts.map((f) => (
                <li key={f} className="rounded-full bg-[#e7eae7] px-3 py-1 text-sm text-ink">
                  {f}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-muted">
              {people > 0 ? `${people} ${people === 1 ? "person is" : "people are"} helping.` : "No helpers yet."}
            </p>
          )}
        </div>
        <div className="flex flex-none flex-col items-end gap-3">
          {isCreator && <ShareCaseButton caseId={room.id} publicPreview={!!room.publicPreview} demo={demo} />}
          {room.visitInDays !== null && (
            <div className="text-right">
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
        </div>
      </section>

      <CaseAiBar caseId={room.id} demo={demo} />

      {showDayOne && (
        <DayOneStrip
          caseId={room.id}
          demo={demo}
          isAdmin={!!room.viewer?.isAdmin}
          leads={aiLeads}
          sections={draftedParts}
          autoStart={sp.new === "1"}
        />
      )}

      <div className="mt-8 grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_380px]">
        <section aria-labelledby="leads-h" className="min-w-0">
          <div className="mb-3.5 flex flex-wrap items-baseline gap-x-3 gap-y-2">
            <h2 id="leads-h" className="font-display text-[28px] font-medium">
              Leads
            </h2>
            <span className="text-sm text-muted">Ideas the team is checking</span>
            <a href="#add-lead" className="btn btn-secondary ml-auto">
              Add a lead
            </a>
          </div>

          {leads.length === 0 ? (
            <div className="panel flex flex-col items-start gap-3 p-6">
              <h3 className="font-display text-xl font-medium">No leads yet</h3>
              <p className="max-w-[60ch] text-sm text-muted">
                A lead is one idea to check: a trial, an existing drug used a new way, a test worth asking about.
                {canSuggest ? " Let the AI read the case and suggest a few, or add your own below." : " Add the first one below."}
              </p>
              {canSuggest && <SuggestLeadsButton caseId={room.id} demo={demo} primary />}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {leads.map((l) => (
                <LeadCard key={l.id} caseId={room.id} lead={l} members={room.members} demo={demo} viewerId={room.viewer?.id} />
              ))}
            </div>
          )}

          <details id="add-lead" className="panel group mt-5 scroll-mt-6 p-5 sm:p-6">
            <summary className="flex min-h-11 cursor-pointer list-none flex-wrap items-center justify-between gap-3">
              <span>
                <span className="block font-display text-xl font-medium">Add a lead</span>
                <span className="text-sm text-muted">Found something worth checking? Add it so others can run AI on it too.</span>
              </span>
              <span className="text-sm font-semibold text-brand group-open:hidden">Add a lead</span>
            </summary>
            <div className="mt-4 border-t border-line pt-4">
              <AddLeadForm caseId={room.id} demo={demo} />
            </div>
          </details>
          {canSuggest && leads.length > 0 && (
            <div className="mt-4">
              <SuggestLeadsButton caseId={room.id} demo={demo} />
            </div>
          )}
        </section>

        <aside className="flex min-w-0 flex-col gap-9">
          <section aria-label="Latest AI runs">
            <div className="flex items-baseline justify-between">
              <RailHeading>Latest AI runs</RailHeading>
              <Link href={`/case/${room.id}/runs`} className="text-[13px] font-semibold">
                See all
              </Link>
            </div>
            {runs.length === 0 ? (
              <p className="text-sm text-muted">
                No runs yet. Ask the AI on a lead, or copy the case into your own AI and paste back what it found.
              </p>
            ) : (
              runs.map((r, i) => (
                <RunItem key={r.id} caseId={room.id} run={r} members={room.members} demo={demo} viewerId={room.viewer?.id} showLead first={i === 0} />
              ))
            )}
          </section>

          <section aria-label="AI tools for this case">
            <RailHeading>AI tools for this case</RailHeading>
            <ul className="flex flex-col">
              {tools.map((t) => (
                <li key={t.id}>
                  <div className="-mx-3 flex items-start gap-3 rounded-xl p-3 transition-colors hover:bg-hover">
                    <span aria-hidden="true" className={`grid h-[34px] w-[34px] flex-none place-items-center rounded-[10px] text-[13px] font-bold ${t.tone}`}>
                      {t.icon}
                    </span>
                    <div className="min-w-0 text-sm">
                      {t.url ? (
                        <a href={t.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-ink no-underline hover:text-brand hover:underline">
                          {t.name}
                        </a>
                      ) : (
                        <b className="font-semibold">{t.name}</b>
                      )}
                      <span className="block text-xs text-muted">{t.does}</span>
                      {t.builtIn && <span className="text-[11px] font-semibold text-ok">Built in</span>}
                      {t.note && <span className="text-[11px] font-semibold text-mark-text">{t.note}</span>}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            <Link href={`/case/${room.id}/runs#tools`} className="mt-1 inline-block text-[13px] font-semibold">
              All tools
            </Link>
          </section>
        </aside>
      </div>
    </div>
  );
}
