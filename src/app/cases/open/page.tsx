import type { Metadata } from "next";
import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import { PublicCaseCard } from "@/components/public-case-card";
import { btn } from "@/components/ui";
import { SAMPLE_PUBLIC_CASE, loadPublicCases } from "@/lib/public-cases";
import { EXPERTISE_LABEL, EXPERTISE_ORDER, type Expertise } from "@/lib/types";

export const metadata: Metadata = {
  title: "Ongoing cases | Case Room",
  description: "Cancer cases where volunteers and AI are looking for options today. Families chose to list them. No names or IDs.",
};

function href(type: string | null, need: string | null) {
  const q = new URLSearchParams();
  if (type) q.set("type", type);
  if (need) q.set("need", need);
  const s = q.toString();
  return s ? `/cases/open?${s}` : "/cases/open";
}

export default async function OpenCasesPage({ searchParams }: PageProps<"/cases/open">) {
  const sp = await searchParams;
  const type = typeof sp.type === "string" ? sp.type : null;
  const needRaw = typeof sp.need === "string" ? sp.need : null;
  const need = needRaw && (EXPERTISE_ORDER as string[]).includes(needRaw) ? (needRaw as Expertise) : null;

  const all = await loadPublicCases(60);
  const types = [...new Set(all.map((c) => c.cancerType))].sort();
  const needs = EXPERTISE_ORDER.filter((e) => all.some((c) => c.needed.includes(e)));
  const shown = all.filter((c) => (!type || c.cancerType === type) && (!need || c.needed.includes(need)));

  return (
    <>
      <AppHeader>
        <nav aria-label="Main" className="flex gap-1">
          <Link href="/cases/open" className="nav-link" aria-current="page">
            Ongoing cases
          </Link>
          <Link href="/#how" className="nav-link">
            How it works
          </Link>
        </nav>
      </AppHeader>
      <main className="mx-auto flex w-full max-w-[1360px] flex-1 flex-col px-4 pt-10 pb-20 sm:px-8 lg:px-12">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-[1_1_420px]">
            <h1 className="font-display text-[40px] leading-tight font-medium tracking-[-0.015em] sm:text-[48px]">Ongoing cases</h1>
            <p className="mt-2 max-w-[620px] text-[17px] text-muted">
              Pick a case, ask to join, and bring the AI you already use. The family approves each person.
            </p>
          </div>
          <Link href="/new" className={btn.secondary}>
            Start a case for someone
          </Link>
        </div>

        {all.length > 0 && (
          <div className="mt-7 flex flex-col gap-3">
            {types.length > 1 && (
              <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter by cancer type">
                <span className="mr-1.5 text-[13px] text-muted">Cancer type</span>
                <Link href={href(null, need)} className="chip" aria-current={!type ? "true" : undefined}>
                  All
                </Link>
                {types.map((t) => (
                  <Link key={t} href={href(t, need)} className="chip" aria-current={type === t ? "true" : undefined}>
                    {t}
                  </Link>
                ))}
              </div>
            )}
            {needs.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter by who is needed">
                <span className="mr-1.5 text-[13px] text-muted">Needs</span>
                <Link href={href(type, null)} className="chip" aria-current={!need ? "true" : undefined}>
                  Anyone
                </Link>
                {needs.map((e) => (
                  <Link key={e} href={href(type, e)} className="chip" aria-current={need === e ? "true" : undefined}>
                    {EXPERTISE_LABEL[e]}
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {shown.length > 0 ? (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((c) => (
              <PublicCaseCard key={c.id} c={c} />
            ))}
          </div>
        ) : all.length > 0 ? (
          <div className="mt-6 rounded-[14px] border border-dashed border-line-2 p-6">
            <p className="text-[15px]">No cases match these filters right now.</p>
            <Link href="/cases/open" className={`${btn.secondary} mt-3`}>
              Show all cases
            </Link>
          </div>
        ) : (
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <PublicCaseCard c={SAMPLE_PUBLIC_CASE} sample />
            <div className="flex flex-col justify-center gap-3 rounded-[14px] border border-dashed border-line-2 p-6">
              <h2 className="font-display text-[22px] font-medium">The first real cases are opening soon.</h2>
              <p className="text-[15px] text-muted">
                Families list a case when they are ready for help. Set up your profile, turn on case alerts there, and we&apos;ll tell
                you when one needs your skills.
              </p>
              <div className="flex flex-wrap gap-2.5">
                <Link href="/onboarding" className={btn.mark}>
                  Get case alerts
                </Link>
                <Link href="/new" className={btn.secondary}>
                  Start a case for someone
                </Link>
              </div>
            </div>
          </div>
        )}
        <p className="mt-4 text-[13px] text-muted">Only cases the family chose to list. No names, photos or ID numbers, ever.</p>
      </main>
    </>
  );
}
