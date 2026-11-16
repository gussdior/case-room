import Link from "next/link";
import type { ReactNode } from "react";
import { AI_TOOL_LABEL, LEAD_STATUS_LABEL, personLabel, type AiRun, type Lead, type LeadStatus, type Member } from "@/lib/types";
import { LeadCardActions } from "./lead-card-actions";
import { RunActions } from "./run-actions";
import { LongAnswer } from "./long-answer";
import { safeHref } from "@/lib/safe-href";
import { Avatar, ExpertiseBadge, PersonLink } from "./ui";

export const STATUS_TONE: Record<LeadStatus, string> = {
  promising: "bg-ok-soft text-ok",
  exploring: "bg-brand-soft text-brand",
  needs_someone: "bg-mark-soft text-mark-text",
  ruled_out: "bg-soft text-muted",
};

export function LeadStatusChip({ status }: { status: LeadStatus }) {
  return (
    <span className={`inline-flex self-start rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap ${STATUS_TONE[status]}`}>
      {LEAD_STATUS_LABEL[status]}
    </span>
  );
}

/** Who is on a lead: initial plus role, like "D, nurse". */
export function Faces({ ids, members, max = 4 }: { ids: string[]; members: Member[]; max?: number }) {
  const people = ids.map((id) => members.find((m) => m.id === id)).filter((m): m is Member => !!m);
  if (people.length === 0) return null;
  return (
    <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
      {people.slice(0, max).map((p) => (
        <span key={p.id} className="inline-flex items-center gap-1.5" title={p.name}>
          <Avatar person={p} size={24} />
          <span className="text-[13px] text-ink-2">
            {personLabel(p)}
          </span>
        </span>
      ))}
      {people.length > max && <span className="text-[13px]">and {people.length - max} more</span>}
    </span>
  );
}

/** One lead in the list: the title links to the lead, the whole card lifts on hover, ruled out ones fade back. */
export function LeadCard({
  caseId,
  lead,
  members,
  demo = false,
  signedIn = true,
  viewerId,
}: {
  caseId: string;
  lead: Lead;
  members: Member[];
  demo?: boolean;
  signedIn?: boolean;
  viewerId?: string;
}) {
  const out = lead.status === "ruled_out";
  const mine = !!viewerId && lead.people.includes(viewerId);
  const href = `/case/${caseId}/lead/${lead.id}`;
  return (
    <article
      className={`group relative grid grid-cols-[minmax(0,1fr)_auto] gap-x-5 gap-y-2.5 rounded-[14px] border border-line bg-white px-[22px] py-5 text-ink transition-[border-color,transform,box-shadow,opacity] duration-150 focus-within:border-brand-line hover:-translate-y-0.5 hover:border-brand-line hover:shadow-[0_14px_30px_-20px_rgba(43,63,160,0.55)] ${
        out ? "opacity-75 hover:opacity-100" : ""
      }`}
    >
      <div className="min-w-0">
        <h3 className="font-display text-[22px] leading-tight font-medium">
          <Link
            href={href}
            className="text-ink no-underline after:absolute after:inset-0 after:rounded-[14px] after:content-[''] hover:text-ink"
          >
            {lead.title}
          </Link>
        </h3>
        {(lead.idea || lead.ruledOutReason) && (
          <p className="mt-1 text-[15px] text-ink-2">{out && lead.ruledOutReason ? lead.ruledOutReason : lead.idea}</p>
        )}
      </div>
      <LeadStatusChip status={lead.status} />
      <div className="col-span-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-muted">
        <span>
          <b className="text-ink">{lead.runCount}</b> AI {lead.runCount === 1 ? "run" : "runs"}
        </span>
        {lead.checkedSources > 0 && (
          <span>
            <b className="text-ink">{lead.checkedSources}</b> {lead.checkedSources === 1 ? "source" : "sources"} checked
          </span>
        )}
        <Faces ids={lead.people} members={members} />
        {lead.aiSuggested && lead.runCount === 0 && <span>Suggested by the AI from the case</span>}
        {out && <span>Logged on What we tried</span>}
      </div>
      {!out && lead.nextStep && lead.status !== "promising" && (
        <div className="col-span-2 flex items-center gap-2.5 rounded-[10px] bg-[#f6f7f6] px-3 py-2.5 text-sm">
          <i aria-hidden="true" className="h-2 w-2 flex-none rounded-full bg-mark shadow-[0_0_0_3px_var(--color-mark-soft)]" />
          <span className="min-w-0 flex-1">{lead.nextStep}</span>
          {lead.nextStepExpertise && <ExpertiseBadge expertise={lead.nextStepExpertise} />}
        </div>
      )}
      {!out && lead.nextStep && lead.status === "promising" && (
        <div className="col-span-2 text-[13px] text-muted">{lead.nextStep}</div>
      )}
      <LeadCardActions
        caseId={caseId}
        leadId={lead.id}
        canTake={lead.status === "needs_someone" && !mine}
        demo={demo}
        signedIn={signedIn}
      />
    </article>
  );
}

function CheckLine({ run }: { run: AiRun }) {
  // Only runs the server wrote itself can show a source check. Anything else could have been typed in by hand.
  if (!run.verified)
    return <span className="text-xs font-semibold text-muted">Not verified: saved without the server check</span>;
  const failed = Number(run.check.failed) || 0;
  const ok = Number(run.check.ok) || 0;
  if (failed > 0)
    return (
      <span className="text-xs font-semibold text-bad">
        {failed} of {failed + ok} {failed + ok === 1 ? "link" : "links"} failed the source check
      </span>
    );
  if (ok > 0)
    return (
      <span className="text-xs font-semibold text-ok">
        {run.tool === "case_room_ai" ? "Sources from its searches" : "Sources checked"}
      </span>
    );
  return <span className="text-xs font-semibold text-mark-text">No source links</span>;
}

/** One AI run: who, which AI, the prompt, what came back, and whether the sources held up. */
export function RunItem({
  caseId,
  run,
  members,
  demo,
  viewerId,
  onLead,
  showLead,
  first,
}: {
  caseId: string;
  run: AiRun;
  members: Member[];
  demo: boolean;
  viewerId?: string;
  /** On a lead page, "Reuse prompt" fills the Ask box instead of copying. */
  onLead?: boolean;
  showLead?: boolean;
  first?: boolean;
}) {
  const who = members.find((m) => m.id === run.userId);
  const failedLinks = run.verified ? (run.check.results ?? []).filter((r) => !r.ok) : [];
  const baseName = run.tool === "other" && run.toolOther ? run.toolOther : AI_TOOL_LABEL[run.tool];
  const toolName = run.tool === "case_room_ai" && !run.verified ? `${baseName}, not verified` : baseName;
  return (
    <article className={`py-3.5 ${first ? "" : "border-t border-line"}`}>
      <div className="flex flex-wrap items-center gap-2 text-[13px]">
        {who ? <Avatar person={who} size={26} /> : <Avatar ai size={26} />}
        {who ? <PersonLink person={who} className="font-semibold" /> : <b>Former member</b>}
        <span className="rounded-lg bg-soft px-2 py-0.5 font-semibold">{toolName}</span>
        <span className="text-muted">{run.createdAt}</span>
      </div>
      {showLead && run.leadTitle && run.leadId && (
        <Link href={`/case/${caseId}/lead/${run.leadId}`} className="mt-1.5 inline-block text-xs font-semibold no-underline hover:underline">
          {run.leadTitle}
        </Link>
      )}
      <p className="mt-2 mb-1.5 rounded-[10px] border-l-[3px] border-brand bg-[#f6f7f6] px-3 py-2.5 text-sm">{run.prompt}</p>
      <LongAnswer text={run.result} open={!!onLead && !!first} className="max-w-[68ch] font-serif text-base leading-normal text-ink-2" />
      {run.sources.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Sources">
          {run.sources.slice(0, 6).map((s, n) => (
            <li key={s.url}>
              <a
                href={safeHref(s.url)}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="inline-flex rounded-full border border-line px-2.5 py-1 text-xs no-underline transition-colors hover:border-brand-line hover:bg-brand-tint"
              >
                {s.kind === "preprint" ? `Preprint ${n + 1}, not peer reviewed` : `Source ${n + 1}`}
              </a>
            </li>
          ))}
        </ul>
      )}
      {failedLinks.length > 0 && (
        <ul className="mt-2 flex flex-col gap-1">
          {failedLinks.slice(0, 3).map((f) => (
            <li key={f.url} className="rounded-lg bg-bad-tint px-2.5 py-1.5 text-xs text-bad">
              <span className="break-all">{f.url}</span>: {f.note}
            </li>
          ))}
        </ul>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
        <CheckLine run={run} />
        <RunActions
          caseId={caseId}
          runId={run.id}
          prompt={run.prompt}
          result={run.result}
          firstSource={run.sources[0]?.url}
          onLead={!!onLead}
          demo={demo}
          own={!!viewerId && viewerId === run.userId}
          reuseCount={run.reuseCount}
        />
      </div>
    </article>
  );
}

export function RailHeading({ children }: { children: ReactNode }) {
  return <h2 className="mb-3 text-[15px] font-bold">{children}</h2>;
}
