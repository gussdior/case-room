"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { claimTask } from "@/app/case-actions";
import { EXPERTISE_LABEL, EXPERTISE_ORDER, type Expertise, type Member, type Section, type Task } from "@/lib/types";
import { DemoButton } from "./demo-button";
import { ActionButton } from "./forms";
import { Chevron, EXPERTISE_TONE, btn } from "./ui";

type Props = {
  caseId: string;
  demo: boolean;
  viewerId?: string;
  viewerExpertise?: Expertise;
  sections: Section[];
  tasks: Task[];
  members: Member[];
  messageCounts: Record<string, number>;
  questions: string[];
};

const STATE = {
  checked: "bg-ok-soft text-ok",
  draft: "bg-brand-soft text-brand",
  empty: "bg-mark-soft text-mark-text",
} as const;

export function Brief({
  caseId,
  demo,
  viewerId,
  viewerExpertise,
  sections,
  tasks,
  members,
  messageCounts,
  questions,
}: Props) {
  const [mine, setMine] = useState<Expertise | "all">(viewerExpertise ?? "researcher");
  // The first highlight sweeps in once; after that, switching chips just fades.
  const [touched, setTouched] = useState(false);
  const name = (id?: string) => members.find((m) => m.id === id)?.name ?? "Someone";
  const fits = (e: Expertise) => mine === "all" || mine === e;
  const canDoCheck = (e: Expertise) => fits(e) || mine === "doctor_nurse";
  const gapCount = (e: Expertise) =>
    tasks.filter((t) => t.expertise === e && t.status === "open").length +
    tasks.filter((t) => t.status === "submitted" && (e === t.expertise || e === "doctor_nurse")).length;
  const taskHref = (id: string, anchor = "") => `/case/${caseId}/task/${id}${anchor}`;
  let sweepIndex = 0;
  const hl = (on: boolean) => {
    const delay = on && !touched ? sweepIndex++ * 180 : 0;
    return {
      className: "hl",
      "data-on": on ? "true" : "false",
      "data-sweep": on && !touched ? "true" : "false",
      style: delay ? { animationDelay: `${delay}ms` } : undefined,
    };
  };

  const pick = (e: Expertise | "all") => {
    setTouched(true);
    setMine(e);
  };

  return (
    <article aria-label="The brief for the doctor" className="sheet px-5 py-8 sm:px-12 sm:py-11">
      <header className="mb-6 flex flex-wrap items-baseline gap-3 border-b border-line pb-5">
        <h2 className="font-display text-[26px] font-medium">The brief for the doctor</h2>
        <span className="ml-auto text-[13px] text-muted">Only checked work counts. Questions, not medical advice.</span>
      </header>

      <div role="group" aria-label="Highlight what needs" className="mb-7 flex flex-wrap items-center gap-1.5">
        <span className="mr-1.5 text-[13px] text-muted">Highlight what needs</span>
        {EXPERTISE_ORDER.map((e) => (
          <button key={e} type="button" aria-pressed={mine === e} onClick={() => pick(e)} className="chip">
            {EXPERTISE_LABEL[e]}
            <span className={`ml-1.5 tabular-nums ${mine === e ? "text-mark" : "text-subtle"}`}>{gapCount(e)}</span>
          </button>
        ))}
        <button type="button" aria-pressed={mine === "all"} onClick={() => pick("all")} className="chip">
          Everyone
        </button>
      </div>

      {sections.map((s, i) => {
        const own = tasks.filter((t) => t.sectionId === s.id);
        const checked = own.filter((t) => t.status === "checked");
        const submitted = own.filter((t) => t.status === "submitted");
        const work = own.filter((t) => t.status !== "checked" && t.status !== "submitted");
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

            {demo && s.body ? (
              <p className="max-w-[68ch] font-serif text-lg leading-relaxed text-ink-2">{s.body}</p>
            ) : (
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
                      <Link href={taskHref(t.id)} className="border-b border-brand-line no-underline hover:border-brand">
                        {sub.sources.length} source{sub.sources.length === 1 ? "" : "s"}
                      </Link>
                    </div>
                  </div>
                );
              })
            )}

            {(submitted.length > 0 || work.length > 0) && (
              <div className="mt-1 flex flex-col gap-2">
                {submitted.map((t) => {
                  const sub = t.submissions.at(-1);
                  const eligible =
                    canDoCheck(t.expertise) &&
                    (demo ||
                      (viewerId !== sub?.authorId &&
                        viewerId !== t.ownerId &&
                        !t.helperIds.includes(viewerId ?? "") &&
                        !(sub?.fixRequests?.length ?? 0)));
                  return (
                    <Row
                      key={t.id}
                      expertise={t.expertise}
                      title={<span {...hl(eligible)}>Check: {t.title}</span>}
                      href={taskHref(t.id, "#check")}
                      meta={`By ${name(sub?.authorId)}, waiting for a second check`}
                      count={messageCounts[t.id] ?? 0}
                      action={
                        eligible ? (
                          demo ? (
                            <DemoButton variant="mark">I&apos;ll check it</DemoButton>
                          ) : (
                            <Link href={taskHref(t.id, "#check")} className={btn.mark}>
                              I&apos;ll check it
                            </Link>
                          )
                        ) : null
                      }
                    />
                  );
                })}

                {work.map((t) => {
                  if (t.status === "open") {
                    const forYou = fits(t.expertise);
                    return (
                      <Row
                        key={t.id}
                        expertise={t.expertise}
                        title={<span {...hl(forYou)}>{t.title}</span>}
                        href={taskHref(t.id)}
                        meta={`Open, ${t.minutes} min`}
                        count={messageCounts[t.id] ?? 0}
                        action={
                          demo ? (
                            <DemoButton variant={forYou ? "mark" : "secondary"}>Take it</DemoButton>
                          ) : (
                            <ActionButton action={claimTask.bind(null, caseId, t.id)} variant={forYou ? "mark" : "secondary"}>
                              Take it
                            </ActionButton>
                          )
                        }
                      />
                    );
                  }
                  const stuck = t.status === "stuck";
                  const isMine = viewerId && t.ownerId === viewerId;
                  const helpers = t.helperIds.length ? `, with ${t.helperIds.map(name).join(", ")}` : "";
                  return (
                    <Row
                      key={t.id}
                      expertise={t.expertise}
                      stuck={stuck}
                      title={t.title}
                      href={taskHref(t.id, isMine ? "" : "#help")}
                      meta={
                        stuck
                          ? `Stuck: ${t.stuckReason ?? "needs help"}`
                          : `${isMine ? "Taken by you" : `Taken by ${name(t.ownerId)}`}${helpers}${t.progressNote ? `. ${t.progressNote}` : ""}`
                      }
                      count={messageCounts[t.id] ?? 0}
                    />
                  );
                })}
              </div>
            )}

            {s.position === 5 && questions.length > 0 && (
              <ol className="flex max-w-[68ch] list-decimal flex-col gap-1.5 pl-5 font-serif text-lg leading-relaxed text-ink-2">
                {questions.map((q) => (
                  <li key={q}>{q}</li>
                ))}
              </ol>
            )}
          </section>
        );
      })}

      <div className="pt-4">
        {demo ? (
          <DemoButton>Suggest a missing gap</DemoButton>
        ) : (
          <a href="#add-gap" className={btn.secondary}>
            Suggest a missing gap
          </a>
        )}
      </div>
    </article>
  );
}

/** A task in the brief. The whole row opens the task; the action button sits above the link. */
function Row({
  expertise,
  title,
  href,
  meta,
  count,
  action,
  stuck,
}: {
  expertise: Expertise;
  title: ReactNode;
  href: string;
  meta: string;
  count: number;
  action?: ReactNode;
  stuck?: boolean;
}) {
  return (
    <div className={`row-link relative flex-wrap ${stuck ? "border-bad-line bg-bad-tint" : ""}`}>
      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${EXPERTISE_TONE[expertise]}`}>
        {EXPERTISE_LABEL[expertise]}
      </span>
      <div className="flex min-w-0 flex-[1_1_240px] flex-col">
        <Link href={href} className="text-[15px] leading-snug font-semibold text-ink no-underline after:absolute after:inset-0 after:rounded-[10px] hover:text-ink">
          {title}
        </Link>
        <span className={`text-xs ${stuck ? "font-semibold text-bad" : "text-muted"}`}>
          {meta}
          {count > 0 ? `. ${count} message${count === 1 ? "" : "s"}` : ""}
        </span>
      </div>
      {action ? <div className="relative z-10">{action}</div> : <Chevron />}
    </div>
  );
}
