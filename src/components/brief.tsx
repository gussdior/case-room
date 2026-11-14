"use client";

import Link from "next/link";
import { useState } from "react";
import { EXPERTISE_LABEL, EXPERTISE_ORDER, type Expertise, type Member, type Section, type Task } from "@/lib/types";
import { DemoButton } from "./demo-button";
import { Badge } from "./ui";

type Props = {
  caseId: string;
  sections: Section[];
  tasks: Task[];
  members: Member[];
  messageCounts: Record<string, number>;
  questions: string[];
};

const SECTION_TONE = { checked: "text-ok", draft: "text-warn", empty: "text-subtle" } as const;

export function Brief({ caseId, sections, tasks, members, messageCounts, questions }: Props) {
  const [mine, setMine] = useState<Expertise>("doctor_nurse");
  const name = (id?: string) => members.find((m) => m.id === id)?.name ?? "Someone";
  const gapCount = (e: Expertise) => tasks.filter((t) => t.expertise === e && t.status === "open").length
    + tasks.filter((t) => t.expertise === e && t.status === "submitted").length;

  return (
    <div className="flex flex-col gap-5">
      <div role="group" aria-label="Highlight gaps for" className="flex flex-wrap items-center gap-2">
        <span className="mr-1 text-[13px] font-semibold text-muted">Highlight gaps for</span>
        {EXPERTISE_ORDER.map((e) => {
          const on = e === mine;
          return (
            <button
              key={e}
              type="button"
              aria-pressed={on}
              onClick={() => setMine(e)}
              className={`min-h-11 rounded-full px-4 text-[13px] ${
                on ? "border-2 border-brand bg-brand font-semibold text-white" : "border border-line-2 bg-white font-medium text-ink"
              }`}
            >
              {EXPERTISE_LABEL[e]} · {gapCount(e)}
            </button>
          );
        })}
      </div>

      <article aria-label="Doctor visit brief" className="flex flex-col gap-6 rounded-md bg-white px-5 py-8 shadow-sm sm:px-11 sm:py-9">
        <header className="flex flex-col gap-1 border-b-2 border-ink pb-3.5">
          <span className="text-xs font-bold uppercase tracking-widest text-subtle">
            The brief we are building · for the oncologist visit
          </span>
          <h2 className="font-display text-2xl font-bold sm:text-[26px]">Next treatment options: questions to discuss</h2>
        </header>

        {sections.map((s) => {
          const sectionTasks = tasks.filter((t) => t.sectionId === s.id);
          const submitted = sectionTasks.filter((t) => t.status === "submitted");
          const work = sectionTasks.filter((t) => t.status !== "checked" && t.status !== "submitted");
          return (
            <div key={s.id} className="flex flex-col gap-2.5">
              <div className="flex flex-wrap items-center gap-2.5">
                <h3 className="text-[17px] font-bold">
                  {s.position}. {s.title}
                </h3>
                <span className={`text-xs font-semibold ${SECTION_TONE[s.status]}`}>{s.statusNote}</span>
              </div>

              {s.body && <p className="text-[15px] leading-relaxed text-ink-2">{s.body}</p>}

              {submitted.map((t) => {
                const sub = t.submissions[t.submissions.length - 1];
                const forYou = t.expertise === mine;
                return (
                  <div key={t.id} className="flex flex-col gap-2.5">
                    <p className="rounded-lg bg-warn-tint px-3 py-2.5 text-[15px] leading-relaxed text-ink-2">
                      {sub.body}{" "}
                      <span className="text-xs text-warn-text">
                        {name(sub.authorId)} · {sub.sources.length} sources
                        {sub.aiCheck && sub.aiCheck.matched < sub.aiCheck.claims
                          ? ` · AI: ${sub.aiCheck.claims - sub.aiCheck.matched} claim needs a link`
                          : ""}
                      </span>
                    </p>
                    <GapRow
                      highlight={forYou}
                      text={<><strong>Gap:</strong> a second {EXPERTISE_LABEL[t.expertise].toLowerCase()} must check this · 20 min</>}
                      href={`/case/${caseId}/task/${t.id}`}
                      count={messageCounts[t.id] ?? 0}
                      action="I'll check it"
                    />
                  </div>
                );
              })}

              {work.map((t) => {
                const forYou = t.expertise === mine && t.status === "open";
                if (t.status === "open") {
                  return (
                    <GapRow
                      key={t.id}
                      highlight={forYou}
                      text={
                        <>
                          <strong>Gap:</strong> {t.title.charAt(0).toLowerCase() + t.title.slice(1)}
                          {!forYou && <span className="text-subtle"> · {EXPERTISE_LABEL[t.expertise]}</span>}
                          {" "}· {t.minutes} min
                        </>
                      }
                      href={`/case/${caseId}/task/${t.id}`}
                      count={messageCounts[t.id] ?? 0}
                      action="Take it"
                    />
                  );
                }
                const stuck = t.status === "stuck";
                return (
                  <div
                    key={t.id}
                    className={`flex flex-wrap items-center gap-3 rounded-[10px] px-3.5 py-3 ${
                      stuck ? "border border-bad-line bg-bad-tint" : "border border-line"
                    }`}
                  >
                    <div className="flex min-w-0 flex-[1_1_280px] flex-col gap-1">
                      <span className="text-sm">
                        <strong>Taken by {name(t.ownerId)}:</strong> {t.title}
                        {stuck ? (
                          <span className="font-semibold text-bad"> · stuck, {t.stuckReason}</span>
                        ) : t.progressNote ? (
                          <span className="text-subtle"> · {t.progressNote}</span>
                        ) : null}
                      </span>
                      <Link href={`/case/${caseId}/task/${t.id}`} className="text-xs">
                        {threadLabel(messageCounts[t.id] ?? 0)}
                        {t.helperIds.length > 0 && ` · ${t.helperIds.map(name).join(", ")} helping`}
                        {t.requestedHelperIds.length > 0 && ` · ${t.requestedHelperIds.map(name).join(", ")} asked to join`}
                      </Link>
                    </div>
                    <DemoButton>Offer to help</DemoButton>
                  </div>
                );
              })}

              {s.position === 5 && (
                <>
                  <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-[15px] leading-normal text-ink-2">
                    {questions.map((q) => (
                      <li key={q}>{q}</li>
                    ))}
                  </ol>
                  <DemoButton className="self-start">Suggest a gap the AI missed</DemoButton>
                </>
              )}
            </div>
          );
        })}
      </article>
    </div>
  );
}

function threadLabel(n: number) {
  if (n === 0) return "No messages yet · open task";
  return `${n} message${n === 1 ? "" : "s"} in task thread`;
}

function GapRow({
  highlight,
  text,
  href,
  count,
  action,
}: {
  highlight: boolean;
  text: React.ReactNode;
  href: string;
  count: number;
  action: string;
}) {
  return (
    <div
      className={`flex flex-wrap items-center gap-3 rounded-[10px] border-2 border-dashed px-3.5 py-3 ${
        highlight ? "border-brand bg-brand-tint" : "border-line-2"
      }`}
    >
      <div className="flex min-w-0 flex-[1_1_280px] flex-col gap-1">
        {highlight && <Badge tone="solid">For you</Badge>}
        <span className="text-sm">{text}</span>
        <Link href={href} className="text-xs">
          {threadLabel(count)}
        </Link>
      </div>
      <DemoButton variant={highlight ? "primary" : "secondary"}>{action}</DemoButton>
    </div>
  );
}
