import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import { btn } from "@/components/ui";

const STEPS = [
  { title: "One goal per case", body: "The family sets the goal. AI turns it into a brief with clear gaps." },
  { title: "Gaps for every skill", body: "Doctors, researchers, coders and people with no medical background each see what is theirs." },
  { title: "Nothing counts until checked", body: "Every claim needs a source. A second person or the AI checks it before it enters the brief." },
  { title: "Questions, not advice", body: "The result is a brief of questions and options for the patient's own doctor." },
];

export default async function Home() {
  return (
    <>
      <AppHeader />
      <main className="mx-auto flex w-full max-w-[1136px] flex-1 flex-col gap-10 px-4 py-12 sm:px-8">
        <section className="flex max-w-3xl flex-col gap-5">
          <h1 className="font-display text-4xl leading-tight font-bold sm:text-5xl">
            Strangers with different skills, working on one cancer case.
          </h1>
          <p className="text-lg leading-relaxed text-muted">
            Case Room turns &ldquo;how can I help?&rdquo; into a specific task. Everyone sees what is done, what is in
            progress and what is stuck.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/new" className={btn.primary}>
              Start a case
            </Link>
            <Link href="/case/sample" className={btn.secondary}>
              See a sample case
            </Link>
          </div>
        </section>
        <section aria-label="How it works" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s) => (
            <div key={s.title} className="rounded-2xl border border-line bg-white p-5">
              <h2 className="mb-2 font-display text-lg font-bold">{s.title}</h2>
              <p className="text-sm leading-relaxed text-muted">{s.body}</p>
            </div>
          ))}
        </section>
      </main>
    </>
  );
}
