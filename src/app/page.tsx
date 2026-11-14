import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import { Chevron, btn } from "@/components/ui";
import { getViewer } from "@/lib/auth";
import { loadListedCasesForMe } from "@/lib/db-profile";
import { daysUntil } from "@/lib/time";
import { EXPERTISE_LABEL } from "@/lib/types";

const STEPS = [
  { title: "The family sets one goal", body: "AI turns it into a brief for the doctor, with clear gaps." },
  { title: "Each gap is a small task", body: "Doctors, researchers, data people and people with no medical background each see what is theirs." },
  { title: "Nothing counts until checked", body: "Every claim needs a source. A second person checks it before it enters the brief." },
  { title: "The family brings questions", body: "The result is questions and options for the patient's own doctor. Never treatment advice." },
];

export default async function Home() {
  const viewer = await getViewer();
  const listed = viewer ? await loadListedCasesForMe() : [];

  return (
    <>
      <AppHeader />
      <main className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col px-4 py-14 sm:px-8 lg:px-12">
        {listed.length > 0 && viewer && (
          <section aria-labelledby="for-you" className="mb-14">
            <h2 id="for-you" className="font-display text-[28px] font-medium">
              Cases that need your profession
            </h2>
            <p className="mt-1 text-sm text-muted">
              These cases have open tasks for a {EXPERTISE_LABEL[viewer.expertise].toLowerCase()}. Open one to ask to join.
            </p>
            <ul className="mt-4 flex flex-col gap-2">
              {listed.map((c) => {
                const d = daysUntil(c.visitDate);
                return (
                  <li key={c.caseId}>
                    <Link href={`/case/${c.caseId}`} className="row-link flex-wrap">
                      <span className="min-w-0 flex-[1_1_300px]">
                        <span className="block font-display text-lg">{c.goal}</span>
                        <span className="block text-[13px] text-muted">
                          {[c.cancerType, `${c.openTasks} open task${c.openTasks === 1 ? "" : "s"} for you`, d !== null && d >= 0 ? `doctor visit in ${d} days` : null]
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

        <section className="grid items-center gap-12 lg:grid-cols-[1.1fr_1fr]">
          <div>
            <h1 className="font-display text-[44px] leading-[1.05] font-medium tracking-[-0.02em] sm:text-[60px]">
              Strangers with different skills, working on one cancer case.
            </h1>
            <p className="mt-5 max-w-[560px] text-lg leading-relaxed text-muted">
              Case Room turns &ldquo;how can I help?&rdquo; into one specific task, with an AI helper next to it. Everyone sees what is
              done, what is in progress and what is stuck.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/new" className={btn.mark}>
                Start a case
              </Link>
              <Link href="/case/sample" className={btn.secondary}>
                See a sample case
              </Link>
            </div>
          </div>

          <figure aria-label="A piece of a brief" className="sheet rotate-[0.6deg] px-7 py-8 sm:px-9">
            <p className="text-[13px] text-muted">The brief for the doctor</p>
            <h2 className="mt-1 font-display text-[22px] font-medium">Options to ask about</h2>
            <p className="mt-3 font-serif text-lg leading-relaxed text-ink-2">
              We know the standard next treatments.{" "}
              <span className="hl" data-sweep="true" style={{ animationDelay: "400ms" }}>
                We still need every open trial that takes people after this drug, checked against her entry rules.
              </span>{" "}
              <span className="hl" data-sweep="true" style={{ animationDelay: "800ms" }}>
                A doctor should check which options fit her scan.
              </span>
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded-full bg-brand-soft px-2.5 py-0.5 font-semibold text-brand">Researcher</span>
              <span className="rounded-full bg-bad-soft px-2.5 py-0.5 font-semibold text-bad">Doctor or nurse</span>
              <span className="ml-auto text-muted">Checked by 2 people before it counts</span>
            </div>
          </figure>
        </section>

        <section aria-label="How it works" className="mt-20">
          <h2 className="font-display text-[28px] font-medium">How a case works</h2>
          <ol className="mt-6 grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s, i) => (
              <li key={s.title} className="border-t-2 border-ink pt-4">
                <span className="font-display text-[22px] text-muted">{i + 1}</span>
                <h3 className="mt-1 text-base font-semibold">{s.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{s.body}</p>
              </li>
            ))}
          </ol>
        </section>
      </main>
    </>
  );
}
