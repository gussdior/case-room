"use client";

import { useRouter } from "next/navigation";
import { useOptimistic, useState, useTransition } from "react";
import { addLead, ruleOutLead, setLeadCondition, setLeadStatus } from "@/app/lead-actions";
import { EXPERTISE_LABEL, EXPERTISE_ORDER, LEAD_KIND_LABEL, LEAD_KINDS, LEAD_STATUS_LABEL, type LeadStatus } from "@/lib/types";
import { ActionForm, SubmitButton, inputClass, labelClass } from "./forms";

export function AddLeadForm({ caseId, demo }: { caseId: string; demo: boolean }) {
  if (demo)
    return <p className="text-sm text-muted">This is a sample case. Sign in and join a real case to add leads.</p>;
  return (
    <ActionForm action={addLead.bind(null, caseId)} className="flex flex-col gap-3.5">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="ld-title" className={labelClass}>
          The idea, in a few words
        </label>
        <input id="ld-title" name="title" required minLength={3} maxLength={200} placeholder="e.g. An existing drug used in a new way" className={inputClass} />
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className={`${labelClass} mb-2`}>What kind of idea</legend>
        <div className="flex flex-wrap gap-1.5">
          {LEAD_KINDS.map((k) => (
            <label key={k} className="chip has-[:checked]:border-ink has-[:checked]:bg-ink has-[:checked]:text-white has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-brand">
              <input type="radio" name="kind" value={k} defaultChecked={k === "trial"} className="sr-only" />
              {LEAD_KIND_LABEL[k]}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="ld-idea" className={labelClass}>
          Why it might matter
        </label>
        <textarea id="ld-idea" name="idea" rows={2} maxLength={1000} placeholder="One or two sentences. No names or ID numbers." className={`${inputClass} resize-y`} />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="ld-cond" className={labelClass}>
          What would need to be true <span className="font-normal text-muted">(one per line, optional)</span>
        </label>
        <textarea id="ld-cond" name="conditions" rows={3} maxLength={2000} placeholder={"Her biopsy shows the change\nA trial site is within reach"} className={`${inputClass} resize-y`} />
      </div>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_220px]">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="ld-next" className={labelClass}>
            First step
          </label>
          <input id="ld-next" name="next_step" maxLength={300} placeholder="e.g. Search PubMed and ask a doctor to check" className={inputClass} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="ld-exp" className={labelClass}>
            Who should do it
          </label>
          <select id="ld-exp" name="next_step_expertise" defaultValue="" className={inputClass}>
            <option value="">Anyone</option>
            {EXPERTISE_ORDER.map((e) => (
              <option key={e} value={e}>
                {EXPERTISE_LABEL[e]}
              </option>
            ))}
          </select>
        </div>
      </div>
      <SubmitButton variant="mark" className="self-start">
        Add the lead
      </SubmitButton>
    </ActionForm>
  );
}

/** "What would need to be true", tickable by any member. */
export function LeadConditions({
  caseId,
  leadId,
  conditions,
  demo,
  locked,
}: {
  caseId: string;
  leadId: string;
  conditions: { text: string; checked: boolean }[];
  demo: boolean;
  locked: boolean;
}) {
  const [items, setOptimistic] = useOptimistic(conditions, (state, { i, v }: { i: number; v: boolean }) =>
    state.map((c, n) => (n === i ? { ...c, checked: v } : c)),
  );
  const [, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  if (items.length === 0)
    return <p className="text-sm text-muted">Nothing listed yet. Whoever added the lead can add what would need to be true.</p>;
  return (
    <>
      <ol className="flex flex-col gap-1">
        {items.map((c, i) => (
          <li key={i}>
            <label className={`group flex items-start gap-3 rounded-[10px] px-2.5 py-2 -mx-2.5 transition-colors ${demo || locked ? "" : "cursor-pointer hover:bg-hover"}`}>
              <input
                type="checkbox"
                checked={c.checked}
                disabled={locked}
                onChange={(e) => {
                  const v = e.target.checked;
                  setError(null);
                  if (demo) {
                    setError("This is a sample case. Sign in to tick these on a real case.");
                    return;
                  }
                  start(async () => {
                    setOptimistic({ i, v });
                    const r = await setLeadCondition(caseId, leadId, i, v);
                    if (r?.error) setError(r.error);
                  });
                }}
                className="peer sr-only"
              />
              <span
                aria-hidden="true"
                className="mt-1 grid h-[22px] w-[22px] flex-none place-items-center rounded-md border-2 border-[#b9c0b9] bg-white text-transparent transition-colors peer-checked:border-ink peer-checked:bg-ink peer-checked:text-white peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand"
              >
                <svg width="14" height="14" viewBox="0 0 16 16">
                  <path d="M4 8.5l2.5 2.5L12 5.5" stroke="currentColor" strokeWidth="2.2" fill="none" strokeLinecap="round" />
                </svg>
              </span>
              <span className="font-serif text-lg leading-relaxed text-ink-2">
                <span className="mr-1.5 font-sans text-sm text-muted">{i + 1}.</span>
                <span className={c.checked ? "" : "hl"} data-on={c.checked ? undefined : "true"}>
                  {c.text}
                </span>
                {c.checked && <span className="ml-2 rounded-full bg-ok-soft px-2 py-0.5 align-middle font-sans text-xs font-semibold text-ok">Confirmed</span>}
              </span>
            </label>
          </li>
        ))}
      </ol>
      {error && (
        <p role="alert" className="mt-2 text-sm font-semibold text-bad">
          {error}
        </p>
      )}
    </>
  );
}

const MOVES: LeadStatus[] = ["needs_someone", "exploring", "promising"];

/** Move a lead between open statuses, or rule it out with a reason and a source. */
export function LeadStatusControl({
  caseId,
  leadId,
  status,
  demo,
  isAdmin,
}: {
  caseId: string;
  leadId: string;
  status: LeadStatus;
  demo: boolean;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const out = status === "ruled_out";
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Lead status">
        {MOVES.map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={status === s}
            disabled={pending || (out && !isAdmin)}
            onClick={() => {
              setMsg(null);
              if (demo) return setMsg("This is a sample case. Sign in to change real leads.");
              start(async () => {
                const r = await setLeadStatus(caseId, leadId, s);
                if (r?.error) setMsg(r.error);
                else router.refresh();
              });
            }}
            className="chip disabled:cursor-not-allowed disabled:opacity-60"
          >
            {LEAD_STATUS_LABEL[s]}
          </button>
        ))}
      </div>
      {msg && (
        <p role="alert" className="text-sm font-semibold text-bad">
          {msg}
        </p>
      )}
      {!out && (
        <details className="group">
          <summary className="inline-flex min-h-9 cursor-pointer list-none items-center text-sm font-semibold text-bad hover:underline hover:underline-offset-4">
            Rule it out
          </summary>
          {demo ? (
            <p className="mt-2 text-sm text-muted">This is a sample case. Sign in to rule out real leads.</p>
          ) : (
            <ActionForm action={ruleOutLead.bind(null, caseId, leadId)} className="mt-3 flex flex-col gap-3" resetOnSuccess={false}>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="ro-reason" className={labelClass}>
                  Why it&apos;s ruled out
                </label>
                <textarea id="ro-reason" name="reason" rows={2} required minLength={3} maxLength={1000} className={`${inputClass} resize-y`} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="ro-source" className={labelClass}>
                  Source link
                </label>
                <input id="ro-source" name="source" type="url" required placeholder="https://" className={inputClass} />
              </div>
              <p className="text-xs text-muted">It gets logged on What we tried so nobody repeats it.</p>
              <SubmitButton variant="danger" className="self-start">
                Rule it out
              </SubmitButton>
            </ActionForm>
          )}
        </details>
      )}
    </div>
  );
}
