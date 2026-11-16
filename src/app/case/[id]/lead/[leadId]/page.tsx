import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AiHelper } from "@/components/ai-helper";
import { CopyPackButton } from "@/components/case-ai-bar";
import { LeadStatusChip, RailHeading, RunItem } from "@/components/lead-bits";
import { LeadConditions, LeadStatusControl } from "@/components/lead-forms";
import { PasteRun } from "@/components/paste-run";
import { Avatar, ExpertiseBadge, PersonLink } from "@/components/ui";
import { getRoom, memberById } from "@/lib/data";
import { loadLeads, loadRuns } from "@/lib/db-leads";
import { EXPERTISE_LABEL, roleLabel, type Member } from "@/lib/types";

export default async function LeadPage({ params, searchParams }: PageProps<"/case/[id]/lead/[leadId]">) {
  const { id, leadId } = await params;
  const sp = await searchParams;
  const loaded = await getRoom(id);
  if (!loaded) notFound();
  if (loaded.teaser) redirect(`/case/${id}`);
  const room = loaded.room;
  const demo = room.viewer === null;
  const v = room.viewer;
  const leads = await loadLeads(room.id);
  const lead = leads.find((l) => l.id === leadId);
  if (!lead) notFound();
  const runs = await loadRuns(room.id, { leadId: lead.id });
  const out = lead.status === "ruled_out";
  const author = memberById(room, lead.createdBy);
  const people = lead.people.map((p) => memberById(room, p)).filter((m): m is Member => !!m);
  const needExp = lead.nextStepExpertise;
  const hasExpert = needExp ? room.members.some((m) => m.status === "approved" && m.expertise === needExp) : true;

  return (
    <div className="flex flex-col">
      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1 text-sm text-muted">
        <Link href={`/case/${room.id}`} className="rounded-lg px-2 py-1 text-muted no-underline transition-colors hover:bg-hover hover:text-ink">
          The case
        </Link>
        <span aria-hidden="true" className="text-line-2">
          /
        </span>
        <span className="max-w-[420px] truncate px-2">{lead.title}</span>
      </nav>

      <header className="mt-3 max-w-[900px]">
        <LeadStatusChip status={lead.status} />
        <h1 className="mt-3 font-display text-[32px] leading-[1.12] font-medium tracking-[-0.015em] sm:text-[44px]">{lead.title}</h1>
        {lead.idea && <p className="mt-3 max-w-[640px] text-base text-muted">{lead.idea}</p>}
      </header>

      <div className="mt-8 grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex min-w-0 flex-col gap-6">
          <article aria-label="The idea" className="sheet px-5 py-8 sm:px-10 sm:py-8">
            {out && lead.ruledOutReason && (
              <div className="mb-6 rounded-[10px] bg-soft px-4 py-3 text-sm">
                <b>Ruled out.</b> {lead.ruledOutReason}
              </div>
            )}
            <div className="mb-4 flex flex-wrap items-baseline gap-3 border-b border-line pb-4">
              <h2 className="font-display text-2xl font-medium">What would need to be true</h2>
              <span className="ml-auto text-[13px] text-muted">
                {lead.aiSuggested ? "Suggested by the AI" : "Added"}
                {author ? (
                  <>
                    {lead.aiSuggested ? ", added by " : " by "}
                    <PersonLink person={author} />
                  </>
                ) : null}
              </span>
            </div>
            <LeadConditions caseId={room.id} leadId={lead.id} conditions={lead.conditions} demo={demo} locked={out} />

            <div className="mt-8 mb-1 flex flex-wrap items-baseline gap-3 border-b border-line pb-3">
              <h2 className="font-display text-2xl font-medium">What we found so far</h2>
              <span className="ml-auto text-[13px] text-muted">
                {runs.length} {runs.length === 1 ? "answer" : "answers"}
              </span>
            </div>
            {runs.length === 0 ? (
              <p className="py-3 text-sm text-muted">Nothing yet. Ask the AI below, or paste what your own AI found.</p>
            ) : (
              runs.map((r, i) => (
                <RunItem key={r.id} caseId={room.id} run={r} members={room.members} demo={demo} viewerId={v?.id} onLead first={i === 0} />
              ))
            )}
          </article>

          <section id="ai" aria-label="Ask AI about this idea" className="panel scroll-mt-6 p-5 sm:p-6">
            <h2 className="mb-4 font-display text-xl font-medium">Ask AI about this idea</h2>
            <AiHelper
              caseId={room.id}
              leadId={lead.id}
              taskTitle={lead.title}
              demo={demo}
              canWrite={false}
              initial={[]}
              prefill={sp.ask === "1" ? "What should I check first for this idea?" : undefined}
            />
          </section>

          <section aria-label="Status" className="panel p-5 sm:p-6">
            <h2 className="mb-3 font-semibold">Where this idea stands</h2>
            <LeadStatusControl caseId={room.id} leadId={lead.id} status={lead.status} demo={demo} isAdmin={!!v?.isAdmin} />
          </section>
        </div>

        <aside className="flex min-w-0 flex-col gap-9">
          <section aria-label="Use your own AI" className="rounded-[14px] bg-ink p-[22px] text-white">
            <h2 className="mb-4 font-display text-[22px] leading-tight font-medium">Paste what your AI found</h2>
            <div className="mb-4">
              <CopyPackButton caseId={room.id} leadId={lead.id} demo={demo} />
            </div>
            <PasteRun caseId={room.id} leadId={lead.id} demo={demo} dark />
          </section>

          <section aria-label="People on this idea">
            <RailHeading>People on this idea</RailHeading>
            {people.length === 0 ? (
              <p className="text-sm text-muted">No one yet. Ask the AI about it and you&apos;re on it.</p>
            ) : (
              <ul className="-mx-2 flex flex-col">
                {people.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 rounded-[10px] px-2 py-2.5 transition-colors hover:bg-hover">
                    <Avatar person={p} size={34} />
                    <div className="min-w-0 flex-1">
                      <PersonLink person={p} className="text-sm font-semibold" />
                      <div className="truncate text-xs text-muted">{p.headline || roleLabel(p)}</div>
                    </div>
                    <ExpertiseBadge expertise={p.expertise} />
                  </li>
                ))}
              </ul>
            )}
            {!out && lead.nextStep && (
              <p className="mt-2 rounded-[10px] border border-dashed border-mark-edge bg-mark-tint px-3.5 py-3 text-[13px] text-mark-text">
                Next: {lead.nextStep}
                {needExp && !hasExpert && (
                  <>
                    {" "}
                    Needs someone in {EXPERTISE_LABEL[needExp].toLowerCase()}.{" "}
                    {(demo || v?.isAdmin) && (
                      <Link href={`/case/${room.id}`} className="font-semibold">
                        Share the open seat
                      </Link>
                    )}
                  </>
                )}
              </p>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
