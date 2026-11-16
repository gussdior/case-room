import Link from "next/link";
import type { Member, Section, Task } from "@/lib/types";

type Props = {
  caseId: string;
  demo: boolean;
  sections: Section[];
  tasks: Task[];
  members: Member[];
  questions: string[];
};

const STATE = {
  checked: "bg-ok-soft text-ok",
  draft: "bg-brand-soft text-brand",
  empty: "bg-mark-soft text-mark-text",
} as const;

/** The brief the family brings to the doctor. Only checked work shows here. */
export function Brief({ caseId, demo, sections, tasks, members, questions }: Props) {
  const name = (id?: string) => members.find((m) => m.id === id)?.name ?? "Someone";

  return (
    <article aria-label="The brief for the doctor" className="sheet px-5 py-8 sm:px-12 sm:py-11">
      <header className="mb-2 flex flex-wrap items-baseline gap-3 border-b border-line pb-5">
        <h2 className="font-display text-[26px] font-medium">The brief for the doctor</h2>
        <span className="ml-auto text-[13px] text-muted">
          Medical claims go in only after a second person checks them. Questions, not medical advice.
        </span>
      </header>

      {sections.map((s, i) => {
        const checked = tasks.filter((t) => t.sectionId === s.id && t.status === "checked");
        const showBody = !!s.body && (demo || !!s.sourceNote);
        const showChecked = !(demo && s.body) && checked.some((t) => t.submissions.length > 0);
        const showQuestions = s.position === 5 && questions.length > 0;
        return (
          <section
            key={s.id}
            aria-labelledby={`sec-${s.id}`}
            className={`flex flex-col gap-3 py-6 ${i < sections.length - 1 ? "border-b border-line" : ""}`}
          >
            <div className="flex flex-wrap items-baseline gap-3">
              <h3 id={`sec-${s.id}`} className="font-display text-[22px] font-medium">
                {s.title}
              </h3>
              <span className={`ml-auto rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${STATE[s.status]}`}>
                {s.statusNote}
              </span>
            </div>

            {showBody && (
              <div className="flex flex-col gap-1.5">
                <p className="max-w-[68ch] whitespace-pre-line font-serif text-lg leading-relaxed text-ink-2">{s.body}</p>
                {s.sourceNote && (
                  <span className="self-start rounded-full bg-mark-soft px-2.5 py-0.5 text-xs font-semibold text-mark-text">
                    {s.sourceNote}
                  </span>
                )}
              </div>
            )}

            {showChecked &&
              checked.map((t) => {
                const sub = t.submissions.find((x) => (x.checkedBy?.length ?? 0) > 0) ?? t.submissions.at(-1);
                if (!sub) return null;
                const by = (sub.checkedBy ?? []).map((c) => (c === "ai" ? "AI" : name(c)));
                return (
                  <div key={t.id} className="flex flex-col gap-1.5">
                    <p className="max-w-[68ch] whitespace-pre-line font-serif text-lg leading-relaxed text-ink-2">{sub.body}</p>
                    <div className="flex flex-wrap gap-x-4 text-xs">
                      <span className="font-semibold text-ok">
                        Written by {name(sub.authorId)}, checked by {by.join(" and ")}
                      </span>
                      <Link href={`/case/${caseId}/task/${t.id}`} className="border-b border-brand-line no-underline hover:border-brand">
                        {sub.sources.length} source{sub.sources.length === 1 ? "" : "s"}
                      </Link>
                    </div>
                  </div>
                );
              })}

            {showQuestions && (
              <ol className="flex max-w-[68ch] list-decimal flex-col gap-1.5 pl-5 font-serif text-lg leading-relaxed text-ink-2">
                {questions.map((q) => (
                  <li key={q}>{q}</li>
                ))}
              </ol>
            )}

            {!showBody && !showChecked && !showQuestions && (
              <p className="text-sm text-muted">
                Nothing checked yet. <Link href={`/case/${caseId}`}>See the ideas on The case.</Link>
              </p>
            )}
          </section>
        );
      })}
    </article>
  );
}
