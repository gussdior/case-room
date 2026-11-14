"use client";

import { addTreatment, logFinding } from "@/app/tried-actions";
import { FINDING_KIND_LABEL, FINDING_STATUS_LABEL, OUTCOME_LABEL, type FindingKind, type TreatmentOutcome } from "@/lib/types";
import { DemoButton } from "./demo-button";
import { ActionForm, SubmitButton, inputClass, labelClass } from "./forms";

const pill = "chip min-h-11 has-[:checked]:border-ink has-[:checked]:bg-ink has-[:checked]:text-white has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-brand";

export function LogFindingForm({ caseId, taskId, demo, idPrefix = "lf" }: { caseId: string; taskId?: string; demo?: boolean; idPrefix?: string }) {
  const fields = (
    <>
      {taskId && <input type="hidden" name="task_id" value={taskId} />}
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${idPrefix}-title`} className={labelClass}>
          What did you look into?
        </label>
        <input id={`${idPrefix}-title`} name="title" required minLength={3} maxLength={200} placeholder="e.g. Trial of a MET pill plus osimertinib" className={inputClass} />
      </div>
      <fieldset className="flex flex-col gap-1.5">
        <legend className={`${labelClass} mb-1.5`}>Does it fit her?</legend>
        <div className="flex flex-wrap gap-1.5">
          {(["may_fit", "ruled_out", "waiting"] as const).map((s) => (
            <label key={s} className={pill}>
              <input type="radio" name="status" value={s} required className="sr-only" />
              {FINDING_STATUS_LABEL[s]}
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className="flex flex-col gap-1.5">
        <legend className={`${labelClass} mb-1.5`}>What kind</legend>
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(FINDING_KIND_LABEL) as FindingKind[]).map((k) => (
            <label key={k} className={pill}>
              <input type="radio" name="kind" value={k} defaultChecked={k === "trial"} className="sr-only" />
              {FINDING_KIND_LABEL[k]}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${idPrefix}-summary`} className={labelClass}>
          Why, in plain words
        </label>
        <textarea
          id={`${idPrefix}-summary`}
          name="summary"
          rows={3}
          required
          maxLength={2000}
          placeholder="e.g. Closed to new patients in August. Or: fits if the biopsy shows MET."
          className={`${inputClass} resize-y`}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${idPrefix}-sources`} className={labelClass}>
          Source links, one per line
        </label>
        <textarea id={`${idPrefix}-sources`} name="sources" rows={2} required placeholder="https://" className={`${inputClass} resize-y text-sm`} />
      </div>
    </>
  );
  if (demo)
    return (
      <div className="flex flex-col gap-4">
        {fields}
        <DemoButton variant="mark">Log it</DemoButton>
      </div>
    );
  return (
    <ActionForm action={logFinding.bind(null, caseId)} className="flex flex-col gap-4">
      {fields}
      <SubmitButton variant="mark" className="self-start">
        Log it
      </SubmitButton>
    </ActionForm>
  );
}

export function AddTreatmentForm({ caseId, demo }: { caseId: string; demo?: boolean }) {
  const fields = (
    <>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="tr-title" className={labelClass}>
          Treatment, test or event
        </label>
        <input id="tr-title" name="title" required minLength={2} maxLength={160} placeholder="e.g. Osimertinib (daily pill)" className={inputClass} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="tr-start" className={labelClass}>
            Started
          </label>
          <input id="tr-start" name="started_on" type="month" className={inputClass} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="tr-end" className={labelClass}>
            Ended (leave empty if ongoing)
          </label>
          <input id="tr-end" name="ended_on" type="month" className={inputClass} />
        </div>
      </div>
      <fieldset className="flex flex-col gap-1.5">
        <legend className={`${labelClass} mb-1.5`}>How did it go?</legend>
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(OUTCOME_LABEL) as TreatmentOutcome[]).map((o) => (
            <label key={o} className={pill}>
              <input type="radio" name="outcome" value={o} defaultChecked={o === "unknown"} className="sr-only" />
              {o === "unknown" ? "Not sure" : OUTCOME_LABEL[o]}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="tr-note" className={labelClass}>
          Short result (optional)
        </label>
        <input id="tr-note" name="outcome_note" maxLength={160} placeholder="e.g. Worked for 22 months" className={inputClass} />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="tr-details" className={labelClass}>
          Details (optional)
        </label>
        <textarea id="tr-details" name="details" rows={2} maxLength={1000} placeholder="What it did, side effects. No names or hospital IDs." className={`${inputClass} resize-y`} />
      </div>
    </>
  );
  if (demo)
    return (
      <div className="flex flex-col gap-4">
        {fields}
        <DemoButton variant="mark">Add to timeline</DemoButton>
      </div>
    );
  return (
    <ActionForm action={addTreatment.bind(null, caseId)} className="flex flex-col gap-4">
      {fields}
      <SubmitButton variant="mark" className="self-start">
        Add to timeline
      </SubmitButton>
    </ActionForm>
  );
}
