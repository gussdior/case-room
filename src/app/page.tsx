import type { Metadata } from "next";
import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import { PublicCaseCard } from "@/components/public-case-card";
import { Chevron, btn } from "@/components/ui";
import { getViewer } from "@/lib/auth";
import { loadListedCasesForMe } from "@/lib/db-profile";
import { SAMPLE_PUBLIC_CASE, loadPublicCases, loadPublicStats } from "@/lib/public-cases";
import { daysUntil } from "@/lib/time";
import { EXPERTISE_LABEL } from "@/lib/types";
import { FOUNDER_STORY } from "@/content/founder-story";

const HEADLINE = "Be part of the new wave. Help someone with cancer.";
const SUBTEXT =
  "AI is speeding up cancer research faster than ever. Case Room puts doctors, researchers and people who know AI on one real case, to find the options that exist today and turn them into clear questions for the patient's own doctor.";

export const metadata: Metadata = {
  title: `Case Room: ${HEADLINE}`,
  description: SUBTEXT,
  openGraph: { title: HEADLINE, description: SUBTEXT, siteName: "Case Room", type: "website" },
  twitter: { card: "summary", title: HEADLINE, description: SUBTEXT },
};

const STEPS = [
  { title: "A loved one opens the case", body: "Add their documents. AI hides names and drafts the case." },
  {
    title: "Kind people ask to join",
    body: "Everyday people with good hearts help, using the AI they already use. The family says yes.",
  },
  { title: "Every step gets checked", body: "AI checks that each source works and backs the claim. A second person checks every medical claim before it reaches the doctor." },
  { title: "The patient walks in informed", body: "Better informed than ever, with clear questions for their own doctor." },
];

const RULES = [
  { title: "Questions, never advice", body: "The patient's own doctor decides. We bring better questions." },
  { title: "Every claim has a source", body: "AI checks each link. A second person checks every medical claim before it goes in the brief." },
  { title: "Free, and private by default", body: "No money asked. Families choose what is shared and who joins." },
];

const fmt = new Intl.NumberFormat("en-US");

export default async function Home({ searchParams }: PageProps<"/">) {
  const params = await searchParams;
  const notice = params.account === "deleted";
  const filesPending = params.files === "pending";
  const viewer = await getViewer();
  const [cases, stats, matched] = await Promise.all([
    loadPublicCases(6),
    loadPublicStats(),
    viewer ? loadListedCasesForMe() : Promise.resolve([]),
  ]);
  // Numbers only show once there is a real case with real helpers. Zeros help nobody.
  const showStats = !!stats && stats.cases > 0 && stats.volunteers > 0;

  return (
    <>
      <AppHeader>
        <nav aria-label="Main" className="flex gap-1">
          <Link href="/cases/open" className="nav-link">
            Ongoing cases
          </Link>
          <Link href="/#how" className="nav-link">
            How it works
          </Link>
        </nav>
      </AppHeader>
      <main className="mx-auto flex w-full max-w-[1360px] flex-1 flex-col px-4 pb-20 sm:px-8 lg:px-12">
        {notice && (
          <p role="status" className="mt-6 rounded-[10px] bg-ok-soft px-4 py-3 text-sm text-ok">
            Your account was deleted. Thank you for helping.
          </p>
        )}
        {notice && filesPending && (
          <p role="alert" className="mt-3 rounded-[10px] bg-bad-soft px-4 py-3 text-sm text-bad">
            Some uploaded files could not be removed yet. Write to us from the contact link and we will remove them by hand.
          </p>
        )}
        <section className="grid items-center gap-10 pt-12 pb-10 sm:pt-16 lg:grid-cols-[1.1fr_0.9fr] lg:gap-14">
          <div>
            <h1 className="font-display text-[46px] leading-[1.02] font-medium tracking-[-0.025em] sm:text-[68px]">
              Be part of the new wave.{" "}
              <span className="hl" data-sweep="true" style={{ animationDelay: "300ms" }}>
                Help someone with cancer.
              </span>
            </h1>
            <p className="mt-6 max-w-[560px] text-lg leading-relaxed text-muted sm:text-[19px]">{SUBTEXT}</p>
            <div className="mt-7 flex flex-wrap gap-2.5">
              <Link href="/cases/open" className={btn.mark}>
                Help on a case
              </Link>
              <Link href="/new" className={btn.secondary}>
                Start a case for someone
              </Link>
            </div>
          </div>
          <aside aria-label="Why we built this" className="rounded-2xl bg-ink px-7 py-7 text-white sm:px-8">
            <p className="text-[13px] text-[#c9cfd8]">Why we built this</p>
            <p className="mt-2.5 font-display text-[19px] leading-[1.45] sm:text-xl">
              Two years ago, AI could not do real research. Now it reads hundreds of papers, searches every open trial and explains a
              gene report in minutes. Millions of people already use it every day, for someone they love or just out of curiosity.
              Imagine what happens when they work together. You don&apos;t need to be a doctor. If you can ask good questions and check
              sources, you can help a family walk into the doctor&apos;s office ready.
            </p>
            {FOUNDER_STORY.trim() && (
              <p className="mt-4 border-t border-white/15 pt-4 font-display text-[17px] leading-[1.5] text-[#e6e9ee]">
                {FOUNDER_STORY.trim()}
              </p>
            )}
            <Link href="/cases/open" className={`${btn.mark} mt-5`}>
              Join the wave
            </Link>
          </aside>
        </section>

        {showStats && stats && (
          <section aria-label="Live numbers" className="grid grid-cols-2 border-y border-line sm:grid-cols-4">
            {[
              [stats.cases, stats.cases === 1 ? "ongoing case" : "ongoing cases"],
              [stats.volunteers, stats.volunteers === 1 ? "volunteer helping" : "volunteers helping"],
              [stats.leadsChecked, stats.leadsChecked === 1 ? "idea checked" : "ideas checked"],
              [stats.aiRuns, stats.aiRuns === 1 ? "AI answer shared" : "AI answers shared"],
            ].map(([n, label]) => (
              <div key={label} className="py-5">
                <strong className="block font-display text-[38px] leading-none font-medium sm:text-[42px]">{fmt.format(n as number)}</strong>
                <span className="text-sm text-muted">{label}</span>
              </div>
            ))}
          </section>
        )}

        <section aria-labelledby="ongoing" className="mt-14">
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
            <h2 id="ongoing" className="font-display text-[32px] font-medium sm:text-[36px]">
              Ongoing cases
            </h2>
            {cases.length > 0 && (
              <span className="inline-flex items-center gap-2 text-[13px] font-semibold text-ok">
                <span className="live-dot" aria-hidden="true" />
                People are working on these now
              </span>
            )}
            <Link href="/cases/open" className={`${btn.secondary} ml-auto`}>
              See all cases
            </Link>
          </div>
          {cases.length > 0 ? (
            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {cases.map((c) => (
                <PublicCaseCard key={c.id} c={c} />
              ))}
            </div>
          ) : (
            <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_1fr]">
              <PublicCaseCard c={SAMPLE_PUBLIC_CASE} sample />
              <div className="flex flex-col justify-center gap-3 rounded-[14px] border border-dashed border-line-2 p-6">
                <h3 className="font-display text-[22px] font-medium">The first real cases are opening soon.</h3>
                <p className="text-[15px] text-muted">
                  Know someone going through cancer? Start a case for them. Want to help? Set up your profile, turn on case alerts
                  there, and we&apos;ll tell you when a case needs your skills.
                </p>
                <div className="flex flex-wrap gap-2.5">
                  <Link href="/new" className={btn.mark}>
                    Start a case for someone
                  </Link>
                  <Link href="/onboarding" className={btn.secondary}>
                    Get case alerts
                  </Link>
                </div>
              </div>
            </div>
          )}
          <p className="mt-3.5 text-[13px] text-muted">Only cases the family chose to list. No names, photos or ID numbers, ever.</p>
        </section>

        {viewer && matched.length > 0 && (
          <section aria-labelledby="for-you" className="mt-12">
            <h2 id="for-you" className="font-display text-[26px] font-medium">
              Cases that need your profession
            </h2>
            <p className="mt-1 text-sm text-muted">
              These cases have open work for a {EXPERTISE_LABEL[viewer.expertise].toLowerCase()}.
            </p>
            <ul className="mt-4 flex flex-col gap-2">
              {matched.map((c) => {
                const d = daysUntil(c.visitDate);
                return (
                  <li key={c.caseId}>
                    <Link href={`/case/${c.caseId}`} className="row-link flex-wrap">
                      <span className="min-w-0 flex-[1_1_300px]">
                        <span className="block font-display text-lg">{c.goal}</span>
                        <span className="block text-[13px] text-muted">
                          {[c.cancerType, `${c.openTasks} open idea${c.openTasks === 1 ? "" : "s"} for you`, d !== null && d >= 0 ? `doctor visit in ${d} days` : null]
                            .filter(Boolean)
                            .join(", ")}
                        </span>
                      </span>
                      <Chevron />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <section id="how" aria-labelledby="how-title" className="mt-16 scroll-mt-6">
          <h2 id="how-title" className="font-display text-[32px] font-medium sm:text-[36px]">
            How a case works
          </h2>
          <ol className="mt-6 grid gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s, i) => (
              <li key={s.title} className="border-t-2 border-ink pt-3.5">
                <span className="font-display text-[28px] leading-none font-medium">{i + 1}</span>
                <h3 className="mt-2 text-base font-semibold">{s.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted">{s.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section aria-label="Our rules" className="mt-12 grid gap-4 sm:grid-cols-3">
          {RULES.map((r) => (
            <div key={r.title} className="rounded-[14px] bg-hover p-5">
              <h3 className="text-[15px] font-semibold">{r.title}</h3>
              <p className="mt-1 text-sm text-muted">{r.body}</p>
            </div>
          ))}
        </section>
      </main>
    </>
  );
}
