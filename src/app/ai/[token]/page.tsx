import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { CopyButton } from "@/components/copy-button";
import { AI_ROLE_A, AI_ROLE_LABEL, AI_RULES, expiryLine, loadAiPack, SAMPLE_AI_TOKEN, siteOrigin, visitLine } from "@/lib/ai-link";
import { SAMPLE_CASE } from "@/lib/sample-case";
import { createClient } from "@/lib/supabase/server";
import { CASE_SAFETY_LINE } from "@/lib/types";

const TITLE = "Help with this case using your AI";

/** Link previews use labels only, and never count as an open. */
export async function generateMetadata({ params }: PageProps<"/ai/[token]">): Promise<Metadata> {
  const { token } = await params;
  let description = "A cancer case on Case Room, shared so any AI can read it and help. No names, ever.";
  let card: { cancer_type?: string | null; cancer_stage?: string | null; role?: string } | null = null;
  if (token === SAMPLE_AI_TOKEN) card = { cancer_type: SAMPLE_CASE.cancerType, cancer_stage: SAMPLE_CASE.cancerStage, role: "researcher" };
  else if (/^[a-f0-9]{64}$/.test(token)) {
    const supabase = await createClient();
    const { data } = await supabase.rpc("ai_link_card", { p_token: token });
    card = (data as typeof card) ?? null;
  }
  if (card) {
    const role = card.role && card.role in AI_ROLE_A ? AI_ROLE_A[card.role as keyof typeof AI_ROLE_A] : "anyone";
    const facts = [card.cancer_type, card.cancer_stage].filter(Boolean).join(", ");
    description = `${facts ? `${facts}. ` : ""}${role === "anyone" ? "Needs helpers" : `Needs ${role}`}. Paste this link into your AI to help. No names, ever.`;
  }
  return {
    title: `${TITLE} | Case Room`,
    description,
    robots: { index: false, follow: false },
    openGraph: { title: TITLE, description, siteName: "Case Room", type: "website" },
    twitter: { card: "summary_large_image", title: TITLE, description },
  };
}

const h2 = "mt-7 mb-2 text-[15px] font-bold";

/** What a shared AI link shows. One page for people and for AIs: plain, server rendered, with the rules in the text. */
export default async function AiLinkPage({ params }: PageProps<"/ai/[token]">) {
  const { token } = await params;
  const r = await loadAiPack(token);
  if (r.status === "gone") notFound();
  if (r.status === "busy") {
    return (
      <>
        <AppHeader />
        <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-3 px-6 py-16">
          <h1 className="font-display text-[30px] leading-tight font-medium">This link is being opened a lot right now</h1>
          <p className="text-base text-muted">Try again in a minute.</p>
        </main>
      </>
    );
  }
  const p = r.pack;
  const origin = await siteOrigin();
  const url = `${origin}/ai/${token}`;
  const caseUrl = `/case/${p.caseId}${p.sample ? "?preview=1" : ""}`;
  const visit = visitLine(p.visitDays);
  const mine = p.leads.filter((l) => l.forRole);
  const rest = p.leads.filter((l) => !l.forRole);
  const forWhom = p.role === "everyone" ? "Open leads" : `Open leads for ${AI_ROLE_A[p.role]}`;

  return (
    <>
      <AppHeader
        right={
          p.sample ? (
            <span className="rounded-full bg-mark-soft px-3 py-1.5 text-xs font-semibold text-mark-text">Sample case, not a real person</span>
          ) : null
        }
      />
      <main className="mx-auto grid w-full max-w-[1100px] flex-1 items-start gap-8 px-4 pt-8 pb-14 sm:px-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-10">
        <article className="min-w-0 rounded-[16px] border border-line bg-white px-6 py-7 sm:px-9 sm:py-8">
          <p className="inline-block rounded-full bg-brand-soft px-2.5 py-1 text-[11px] font-bold text-brand">
            {p.role === "everyone" ? "Shared for anyone who can help" : `Shared for ${AI_ROLE_A[p.role]}`}
          </p>
          <h1 className="mt-3 font-display text-[28px] leading-[1.15] font-medium tracking-[-0.01em] sm:text-[34px]">{p.goal}</h1>
          <p className="mt-2 text-sm text-muted">{[...p.facts, visit].filter(Boolean).join(". ")}.</p>
          <p className="mt-2 text-[13px] text-muted">
            Shared from Case Room with the family&apos;s consent. Names, birth dates and ID numbers are removed. Do not try to
            identify the patient.
          </p>

          <section aria-labelledby="ai-role">
            <h2 id="ai-role" className={h2}>
              You are helping as: {AI_ROLE_LABEL[p.role]}
            </h2>
            {p.includes.leads ? (
              <>
                <h3 className="mb-1.5 text-sm font-semibold">{forWhom}</h3>
                {mine.length > 0 ? (
                  <ol className="list-decimal space-y-2.5 pl-5 text-[15px]">
                    {mine.map((l) => (
                      <li key={l.title}>
                        <strong className="font-semibold">{l.title}</strong>
                        {l.idea && <span className="block text-sm text-ink-2">{l.idea}</span>}
                        {l.done.length > 0 && <span className="block text-sm text-muted">Done looks like: {l.done.join("; ")}</span>}
                        {l.nextStep && <span className="block text-sm text-muted">Next step: {l.nextStep}</span>}
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="text-sm text-muted">No open lead is tagged for this role yet. Pick any open lead below.</p>
                )}
                {p.tasks.length > 0 && (
                  <>
                    <h3 className="mt-4 mb-1.5 text-sm font-semibold">Open tasks for this role</h3>
                    <ul className="list-disc space-y-1.5 pl-5 text-[15px]">
                      {p.tasks.map((t) => (
                        <li key={t.title}>
                          {t.title}
                          {t.done.length > 0 && <span className="block text-sm text-muted">Done looks like: {t.done.join("; ")}</span>}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
                {rest.length > 0 && (
                  <>
                    <h3 className="mt-4 mb-1.5 text-sm font-semibold">Other open leads on this case</h3>
                    <ul className="list-disc space-y-1 pl-5 text-sm">
                      {rest.map((l) => (
                        <li key={l.title}>
                          {l.title} ({l.status})
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </>
            ) : (
              <p className="text-sm text-muted">The person who shared this left the leads out. Ask them what they need help with.</p>
            )}
          </section>

          {p.summary && (
            <section aria-labelledby="ai-summary" data-case-text="true">
              <h2 id="ai-summary" className={h2}>
                Case summary
              </h2>
              <p className="font-display text-base leading-relaxed whitespace-pre-line text-ink-2">{p.summary}</p>
            </section>
          )}

          {p.includes.genes_treatments && (p.sections.length > 0 || p.treatments.length > 0) && (
            <section aria-labelledby="ai-genes" data-case-text="true">
              <h2 id="ai-genes" className={h2}>
                Gene results and treatments so far
              </h2>
              {p.sections.map((s) => (
                <div key={s.title} className="mb-3">
                  <h3 className="text-sm font-semibold">
                    {s.title}
                    {s.note && <span className="ml-2 font-normal text-muted">({s.note})</span>}
                  </h3>
                  <p className="font-display text-base leading-relaxed whitespace-pre-line text-ink-2">{s.body}</p>
                </div>
              ))}
              {p.treatments.length > 0 && (
                <ul className="list-disc space-y-1 pl-5 text-[15px]">
                  {p.treatments.map((t) => (
                    <li key={t.title + t.when}>
                      {t.title}
                      {t.when && ` (${t.when})`}
                      {(t.outcome || t.note) && `: ${[t.outcome, t.note].filter(Boolean).join(", ")}`}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {p.includes.ruled_out && p.ruledOut.length > 0 && (
            <section aria-labelledby="ai-out">
              <h2 id="ai-out" className={h2}>
                Already ruled out
              </h2>
              <ul className="list-disc space-y-1.5 pl-5 text-[15px]">
                {p.ruledOut.map((x) => (
                  <li key={x.title}>
                    {x.title}
                    {x.why && <span className="block text-sm text-muted">{x.why}</span>}
                    {x.source && (
                      <a href={x.source} rel="noopener noreferrer nofollow" className="block text-sm break-all">
                        {x.source}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {p.includes.runs && p.runs.length > 0 && (
            <section aria-labelledby="ai-runs" data-case-text="true">
              <h2 id="ai-runs" className={h2}>
                Latest AI runs on this case
              </h2>
              <ul className="space-y-3 text-[15px]">
                {p.runs.map((x, i) => (
                  <li key={i} className="rounded-[10px] bg-[#f6f7f6] px-3.5 py-3">
                    <span className="block text-sm font-semibold">
                      {x.tool}
                      {!x.verified && <span className="font-normal text-muted"> (not verified)</span>} was asked: {x.prompt}
                    </span>
                    <span className="mt-1 block whitespace-pre-line text-ink-2">{x.result}</span>
                    {x.sources.map((s) => (
                      <a key={s} href={s} rel="noopener noreferrer nofollow" className="block text-sm break-all">
                        {s}
                      </a>
                    ))}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section aria-labelledby="ai-rules" className="mt-8 rounded-[12px] border border-line bg-paper px-5 py-4">
            <h2 id="ai-rules" className="mb-2 text-[15px] font-bold">
              Rules for you, the AI
            </h2>
            <ul className="list-disc space-y-1 pl-5 text-sm">
              {AI_RULES.map((x) => (
                <li key={x}>{x}</li>
              ))}
              <li>End with 1 to 3 questions the patient could ask their doctor.</li>
            </ul>
          </section>

          <section aria-labelledby="ai-back">
            <h2 id="ai-back" className={h2}>
              Bring your results back
            </h2>
            <p className="text-sm">
              Ask the person you are helping to paste your answer and its links at{" "}
              <Link href={caseUrl}>
                {origin}/case/{p.caseId}
              </Link>{" "}
              and ask to join, so someone checks the sources.
            </p>
          </section>
        </article>

        <aside className="flex flex-col gap-3 lg:sticky lg:top-5">
          <div className="rounded-[14px] bg-ink p-5 text-white">
            <p className="text-sm text-line-2">
              Easiest way to help: paste this page&apos;s link into your AI and ask it to start on the first lead.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <CopyButton text={url} label="Copy link for my AI" className="btn btn-mark" />
              <Link href={caseUrl} className="btn border border-[#4a5563] bg-transparent text-white hover:bg-[#26303d] hover:text-white">
                Ask to join
              </Link>
            </div>
            <p className="mt-3 text-[13px] text-line-2">
              If your AI can&apos;t open links, <a href={`/ai/${token}/text`} className="text-white underline">open the plain text</a> and
              paste that instead.
            </p>
          </div>
          <p className="text-xs text-muted">
            {expiryLine(p.expiresAt)} {CASE_SAFETY_LINE}
          </p>
        </aside>
      </main>
    </>
  );
}
