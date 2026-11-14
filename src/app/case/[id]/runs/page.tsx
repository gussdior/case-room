import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CaseAiBar } from "@/components/case-ai-bar";
import { RunItem } from "@/components/lead-bits";
import { AI_TOOLS } from "@/lib/ai-tools";
import { getRoom } from "@/lib/data";
import { loadLeads, loadRuns } from "@/lib/db-leads";
import { AI_TOOL_LABEL, EXPERTISE_LABEL, type AiTool } from "@/lib/types";

export const metadata = { title: "AI runs | Case Room" };

const TOOLS = Object.keys(AI_TOOL_LABEL) as AiTool[];

export default async function RunsPage({ params, searchParams }: PageProps<"/case/[id]/runs">) {
  const { id } = await params;
  const sp = await searchParams;
  const loaded = await getRoom(id);
  if (!loaded) notFound();
  if (loaded.teaser) redirect(`/case/${id}`);
  const room = loaded.room;
  const demo = room.viewer === null;
  const tool = typeof sp.tool === "string" && TOOLS.includes(sp.tool as AiTool) ? (sp.tool as AiTool) : undefined;
  const leadId = typeof sp.lead === "string" ? sp.lead : undefined;
  const [leads, runs] = await Promise.all([loadLeads(room.id), loadRuns(room.id, { tool, leadId, limit: 200 })]);
  const lead = leads.find((l) => l.id === leadId);

  const href = (next: { tool?: AiTool; lead?: string }) => {
    const q = new URLSearchParams();
    if (next.tool) q.set("tool", next.tool);
    if (next.lead) q.set("lead", next.lead);
    const s = q.toString();
    return `/case/${room.id}/runs${s ? `?${s}` : ""}`;
  };

  return (
    <div className="flex flex-col">
      <h1 className="font-display text-[34px] leading-[1.1] font-medium tracking-[-0.015em] sm:text-[44px]">AI runs</h1>
      <p className="mt-3 max-w-[660px] text-base text-muted">
        Every prompt the team ran, with any AI, what came back, and whether its sources held up. Reuse what worked.
      </p>

      <CaseAiBar caseId={room.id} demo={demo} />

      <div className="mt-8 grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section aria-label="Runs" className="min-w-0">
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter by AI">
              <span className="mr-1 text-[13px] text-muted">AI</span>
              <Link href={href({ lead: leadId })} aria-current={!tool ? "true" : undefined} className="chip no-underline aria-[current]:border-ink aria-[current]:bg-ink aria-[current]:text-white">
                All
              </Link>
              {TOOLS.map((t) => (
                <Link
                  key={t}
                  href={href({ tool: t, lead: leadId })}
                  aria-current={tool === t ? "true" : undefined}
                  className="chip no-underline aria-[current]:border-ink aria-[current]:bg-ink aria-[current]:text-white"
                >
                  {AI_TOOL_LABEL[t]}
                </Link>
              ))}
            </div>
            {leads.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter by lead">
                <span className="mr-1 text-[13px] text-muted">Lead</span>
                <Link href={href({ tool })} aria-current={!leadId ? "true" : undefined} className="chip no-underline aria-[current]:border-ink aria-[current]:bg-ink aria-[current]:text-white">
                  All leads
                </Link>
                {leads.map((l) => (
                  <Link
                    key={l.id}
                    href={href({ tool, lead: l.id })}
                    aria-current={leadId === l.id ? "true" : undefined}
                    className="chip max-w-[280px] no-underline aria-[current]:border-ink aria-[current]:bg-ink aria-[current]:text-white"
                  >
                    <span className="truncate">{l.title}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="panel mt-5 px-5 py-1 sm:px-6">
            {runs.length === 0 ? (
              <p className="py-5 text-sm text-muted">
                {tool || lead ? "No runs match this filter." : "No runs yet. Ask the AI on a lead, or paste what your own AI found."}
              </p>
            ) : (
              runs.map((r, i) => (
                <RunItem key={r.id} caseId={room.id} run={r} members={room.members} demo={demo} viewerId={room.viewer?.id} showLead={!leadId} first={i === 0} />
              ))
            )}
          </div>
        </section>

        <aside id="tools" aria-label="AI tools" className="flex min-w-0 scroll-mt-6 flex-col gap-3">
          <h2 className="text-[15px] font-bold">AI tools for cancer research</h2>
          <p className="text-[13px] text-muted">Use any of these, then paste what you found so the team can check it.</p>
          <ul className="flex flex-col">
            {AI_TOOLS.map((t) => (
              <li key={t.id} className="-mx-3 flex items-start gap-3 rounded-xl p-3 transition-colors hover:bg-hover">
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
                  <span className="block text-[11px] text-subtle">
                    Suits: {t.suits.length >= 4 ? "anyone" : t.suits.map((s) => EXPERTISE_LABEL[s].toLowerCase()).join(", ")}
                    {t.note ? `. ${t.note}` : ""}
                  </span>
                  {t.builtIn && <span className="text-[11px] font-semibold text-ok">Built in</span>}
                </div>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  );
}
