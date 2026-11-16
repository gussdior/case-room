"use client";

import Link from "next/link";
import { useState } from "react";
import { checkFinding, deleteFinding, updateFinding } from "@/app/tried-actions";
import { FINDING_KIND_LABEL, FINDING_STATUS_LABEL, type Finding, type FindingStatus } from "@/lib/types";
import { DemoButton } from "./demo-button";
import { ActionButton, ActionForm, SubmitButton, inputClass, labelClass } from "./forms";

export type FindingView = Finding & { foundByName: string; checkedByName: string | null; mine: boolean; canEdit: boolean };

const EDGE: Record<FindingStatus, string> = { may_fit: "border-l-ok", ruled_out: "border-l-[#b9bfb9]", waiting: "border-l-[#e0b43a]" };
const TAG: Record<FindingStatus, string> = {
  may_fit: "bg-ok-soft text-ok",
  ruled_out: "bg-[#eef0ee] text-muted",
  waiting: "bg-[#fff4d6] text-[#8a5a00]",
};

const when = (v: string | null) => {
  if (!v) return "";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v; // sample data is already words
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (days < 1) return "today";
  if (days === 1) return "yesterday";
  if (days < 14) return `${days} days ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

const host = (u: string) => {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return "Source";
  }
};

export function FindingsLog({ caseId, findings, demo }: { caseId: string; findings: FindingView[]; demo: boolean }) {
  const [filter, setFilter] = useState<FindingStatus | "all" | "unchecked">("all");
  const count = (s: FindingStatus) => findings.filter((f) => f.status === s).length;
  const unchecked = findings.filter((f) => !f.checkedBy).length;
  const shown = findings.filter((f) =>
    filter === "all" ? true : filter === "unchecked" ? !f.checkedBy : f.status === filter,
  );
  const chips: { id: typeof filter; label: string; n: number }[] = [
    { id: "all", label: "All", n: findings.length },
    { id: "may_fit", label: FINDING_STATUS_LABEL.may_fit, n: count("may_fit") },
    { id: "ruled_out", label: FINDING_STATUS_LABEL.ruled_out, n: count("ruled_out") },
    { id: "waiting", label: FINDING_STATUS_LABEL.waiting, n: count("waiting") },
    ...(unchecked ? [{ id: "unchecked" as const, label: "Needs a check", n: unchecked }] : []),
  ];

  return (
    <div>
      <dl className="mb-6 flex flex-wrap gap-x-8 gap-y-3 border-b border-line pb-5">
        {[
          [findings.length, "things looked into", "text-ink"],
          [count("may_fit"), "may fit the patient", "text-ok"],
          [count("ruled_out"), "ruled out", "text-muted"],
          [count("waiting"), "waiting on results", "text-[#8a5a00]"],
        ].map(([n, l, c]) => (
          <div key={l as string}>
            <dd className={`font-display text-[34px] leading-none font-medium ${c}`}>{n}</dd>
            <dt className="mt-1 text-[13px] text-muted">{l}</dt>
          </div>
        ))}
      </dl>

      <div role="group" aria-label="Filter findings" className="mb-4 flex flex-wrap gap-1.5">
        {chips.map((c) => (
          <button key={c.id} type="button" className="chip gap-1.5" aria-pressed={filter === c.id} onClick={() => setFilter(c.id)}>
            {c.label}
            <span className="font-medium opacity-70">{c.n}</span>
          </button>
        ))}
      </div>

      {shown.length === 0 && (
        <p className="rounded-[10px] border border-dashed border-line-2 px-4 py-6 text-center text-sm text-muted">
          Nothing here with this filter.
        </p>
      )}

      <ul className="flex flex-col gap-2.5">
        {shown.map((f) => (
          <li key={f.id} className="fade-in">
            <details
              className={`group rounded-[10px] border border-l-4 border-line bg-white transition-[box-shadow,transform] duration-150 hover:-translate-y-px hover:shadow-[0_8px_20px_-14px_rgba(23,32,43,.45)] ${EDGE[f.status]}`}
            >
              <summary className="flex min-h-14 cursor-pointer list-none flex-wrap items-center gap-x-3.5 gap-y-1 rounded-[10px] px-4 py-3 [&::-webkit-details-marker]:hidden">
                <span className={`min-w-[118px] flex-none rounded-full px-2.5 py-0.5 text-center text-xs font-semibold ${TAG[f.status]}`}>
                  {FINDING_STATUS_LABEL[f.status]}
                </span>
                <span className="min-w-0 flex-[1_1_220px]">
                  <span className={`block text-[15px] font-semibold ${f.status === "ruled_out" ? "text-muted" : ""}`}>{f.title}</span>
                  <span className="block text-[13px] text-muted">
                    {FINDING_KIND_LABEL[f.kind]}
                    {f.checkedBy ? `, checked ${when(f.checkedAt)}` : ", logged " + when(f.createdAt)}
                  </span>
                </span>
                {!f.checkedBy && (
                  <span className="rounded-full bg-mark px-2.5 py-0.5 text-xs font-semibold text-ink">Needs a check</span>
                )}
                <span
                  aria-hidden="true"
                  className="grid h-7 w-7 flex-none place-items-center rounded-full bg-soft text-muted transition-transform duration-200 group-open:rotate-90"
                >
                  <svg width="12" height="12" viewBox="0 0 12 12">
                    <path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" />
                  </svg>
                </span>
              </summary>
              <div className="fade-in px-4 pb-4 sm:pl-[148px]">
                <p className="mb-2.5 max-w-[62ch] font-serif text-[17px] leading-relaxed whitespace-pre-line text-ink-2">{f.summary}</p>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
                  <span>Found by {f.foundByName}</span>
                  {f.checkedByName ? (
                    <span className="font-semibold text-ok">Checked by {f.checkedByName}</span>
                  ) : (
                    <span className="font-semibold text-mark-text">Not checked yet, so it doesn&apos;t count</span>
                  )}
                  {f.sources.map((s) => (
                    <a
                      key={s}
                      href={s}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="border-b border-brand-line no-underline hover:border-brand"
                    >
                      {host(s)}
                    </a>
                  ))}
                  {f.taskId && f.taskTitle && (
                    <Link href={`/case/${caseId}/task/${f.taskId}`} className="border-b border-brand-line no-underline hover:border-brand">
                      From task: {f.taskTitle.length > 48 ? `${f.taskTitle.slice(0, 45)}...` : f.taskTitle}
                    </Link>
                  )}
                </div>

                <div className="mt-3 flex flex-wrap items-start gap-2">
                  {!f.checkedBy &&
                    (demo ? (
                      <DemoButton variant="mark">Check it</DemoButton>
                    ) : f.mine ? (
                      <span className="text-[13px] text-muted">Someone else on the case needs to check this.</span>
                    ) : (
                      <ActionButton action={checkFinding.bind(null, caseId, f.id)} variant="mark">
                        I opened the source, it&apos;s right
                      </ActionButton>
                    ))}
                  {!demo && f.canEdit && (
                    <>
                      <details className="w-full">
                        <summary className="btn btn-secondary w-fit list-none">Edit</summary>
                        <ActionForm action={updateFinding.bind(null, caseId, f.id)} resetOnSuccess={false} className="mt-3 flex flex-col gap-3">
                          <fieldset className="flex flex-wrap gap-1.5">
                            <legend className={`${labelClass} mb-1.5`}>Status</legend>
                            {(["may_fit", "ruled_out", "waiting"] as const).map((s) => (
                              <label key={s} className="chip min-h-11 has-[:checked]:border-ink has-[:checked]:bg-ink has-[:checked]:text-white">
                                <input type="radio" name="status" value={s} defaultChecked={f.status === s} className="sr-only" />
                                {FINDING_STATUS_LABEL[s]}
                              </label>
                            ))}
                          </fieldset>
                          <label htmlFor={`fs-${f.id}`} className={labelClass}>
                            What you found
                          </label>
                          <textarea id={`fs-${f.id}`} name="summary" rows={3} defaultValue={f.summary} maxLength={2000} className={`${inputClass} resize-y`} />
                          <label htmlFor={`fl-${f.id}`} className={labelClass}>
                            Sources, one per line
                          </label>
                          <textarea id={`fl-${f.id}`} name="sources" rows={2} defaultValue={f.sources.join("\n")} className={`${inputClass} resize-y text-sm`} />
                          <p className="text-[13px] text-muted">Any change clears the check, so someone looks again.</p>
                          <SubmitButton className="self-start">Save changes</SubmitButton>
                        </ActionForm>
                      </details>
                      <ActionButton action={deleteFinding.bind(null, caseId, f.id)} variant="ghost">
                        Remove
                      </ActionButton>
                    </>
                  )}
                </div>
              </div>
            </details>
          </li>
        ))}
      </ul>
    </div>
  );
}
