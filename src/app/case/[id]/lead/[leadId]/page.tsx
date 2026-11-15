import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AiHelper } from "@/components/ai-helper";
import { CopyPackButton } from "@/components/case-ai-bar";
import { LeadStatusChip, RailHeading, RunItem } from "@/components/lead-bits";
import { LeadConditions, LeadStatusControl } from "@/components/lead-forms";
import { PasteRun } from "@/components/paste-run";
import { ReusePromptButton } from "@/components/reuse-prompt-button";
import { Avatar, ExpertiseBadge, PersonLink } from "@/components/ui";
import { getRoom, memberById } from "@/lib/data";
import { loadLeadEvents, loadLeads, loadRuns, loadTopPrompts } from "@/lib/db-leads";
import { EXPERTISE_LABEL, LEAD_KIND_LABEL, roleLabel, type Member } from "@/lib/types";

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
  const [runs, prompts, events] = await Promise.all([
    loadRuns(room.id, { leadId: lead.id }),
    loadTopPrompts(room.id, lead.id),
    demo ? Promise.resolve([]) : loadLeadEvents(lead.id),
  ]);
  const out = lead.status === "ruled_out";
  const author = memberById(room, lead.createdBy);
  const tasks = room.tasks.filter((t) => t.leadId === lead.id);
  const people = lead.people.map((p) => memberById(room, p)).filter((m): m is Member => !!m);
  const needExp = lead.nextStepExpertise;
  const hasExpert = needExp ? room.members.some((m) => m.status === "approved" && m.expertise === needExp) : true;

  return (
    <div className="flex flex-col">
      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1 text-sm text-muted">
        <Link href={`/case/${room.id}`} className="rounded-lg px-2 py-1 text-muted no-underline transition-colors hover:bg-hover hover:text-ink">
          Leads
        </Link>
        <span aria-hidden="true" className="text-line-2">
          /
        </span>
        <span className="px-2">{LEAD_KIND_LABEL[lead.kind]}</span>
      </nav>

      <header className="mt-3 max-w-[900px]">
        <LeadStatusChip status={lead.status} />
        <h1 className="mt-3 font-display text-[32px] leading-[1.12] font-medium tracking-[-0.015em] sm:text-[44px]">{lead.title}</h1>
        {lead.idea && <p className="mt-3 max-w-[640px] text-base text-muted">{lead.idea}</p>}
      </header>

      <div className="mt-8 grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex min-w-0 flex-col gap-6">
          <article aria-label="The lead" className="sheet px-5 py-8 sm:px-10 sm:py-8">
            {out && lead.ruledOutReason && (
              <div className="mb-6 rounded-[10px] bg-soft px-4 py-3 text-sm">
                <b>Ruled out.</b> {lead.ruledOutReason}{" "}
                <Link href={`/case/${room.id}/tried`} className="font-semibold">
                  See it on What we tried
                </Link>
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

            {tasks.length > 0 && (
              <div className="mt-7">
                <h3 className="mb-2 text-sm font-semibold">Tasks on this lead</h3>
                <div className="flex flex-col gap-2">
                  {tasks.map((t) => (
                    <Link key={t.id} href={`/case/${room.id}/task/${t.id}`} className="row-link">
                      <ExpertiseBadge expertise={t.expertise} />
                      <span className="min-w-0 flex-1 text-[15px] font-semibold">{t.title}</span>
                      <span className="text-xs text-muted">{t.status === "open" ? "Open" : t.status === "checked" ? "Checked" : "In progress"}</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-8 mb-1 flex flex-wrap items-baseline gap-3 border-b border-line pb-3">
              <h2 className="font-display text-2xl font-medium">Runs on this lead</h2>
              <span className="ml-auto text-[13px] text-muted">
                {runs.length} {runs.length === 1 ? "run" : "runs"}
              </span>
            </div>
            {runs.length === 0 ? (
              <p className="py-3 text-sm text-muted">No runs yet. Ask the AI below, or paste what your own AI found.</p>
            ) : (
              runs.map((r, i) => (
                <RunItem key={r.id} caseId={room.id} run={r} members={room.members} demo={demo} viewerId={v?.id} onLead first={i === 0} />
              ))
            )}
          </article>

          <section id="ai" aria-label="Ask AI about this lead" className="panel scroll-mt-6 p-5 sm:p-6">
            <h2 className="mb-4 font-display text-xl font-medium">Ask AI about this lead</h2>
            <AiHelper
              caseId={room.id}
              leadId={lead.id}
              taskTitle={lead.title}
              demo={demo}
              canWrite={false}
              initial={[]}
              prefill={sp.ask === "1" ? "What should I check first for this lead?" : undefined}
            />
          </section>

          <section aria-label="Status" className="panel p-5 sm:p-6">
            <h2 className="mb-3 font-semibold">Where this lead stands</h2>
            <LeadStatusControl caseId={room.id} leadId={lead.id} status={lead.status} demo={demo} isAdmin={!!v?.isAdmin} />
            {events.length > 0 && (
              <ul className="mt-4 flex flex-col gap-1 border-t border-line pt-3 text-xs text-muted" aria-label="Recent changes">
                {events.map((e) => (
                  <li key={e.id}>
                    {(e.userId && memberById(room, e.userId)?.name) ?? "Someone"}: {e.detail}, {e.createdAt}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="flex min-w-0 flex-col gap-9">
          <section aria-label="Add a run" className="rounded-[14px] bg-ink p-[22px] text-white">
            <p className="text-sm text-[#c9cfd8]">Add a run</p>
            <h2 className="mt-1.5 mb-4 font-display text-[22px] leading-tight font-medium">Paste what your AI found</h2>
            <div className="mb-4">
              <CopyPackButton caseId={room.id} leadId={lead.id} demo={demo} />
            </div>
            <PasteRun caseId={room.id} leadId={lead.id} demo={demo} dark />
          </section>

          <section aria-label="People on this lead">
            <RailHeading>People on this lead</RailHeading>
            {people.length === 0 ? (
              <p className="text-sm text-muted">No one yet. Run the AI on it and you&apos;re on it.</p>
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
                      <Link href={`/case/${room.id}/people`} className="font-semibold">
                        Invite one
                      </Link>
                    )}
                  </>
                )}
              </p>
            )}
          </section>

          <section aria-label="Prompts that worked here">
            <RailHeading>Prompts that worked here</RailHeading>
            {prompts.length === 0 ? (
              <p className="text-sm text-muted">When people reuse a prompt, it shows up here.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {prompts.map((p) => (
                  <li key={p.prompt}>
                    <ReusePromptButton prompt={p.prompt} uses={p.uses} here={p.here} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
