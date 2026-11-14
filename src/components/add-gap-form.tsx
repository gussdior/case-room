import { addTask } from "@/app/case-actions";
import { EXPERTISE_LABEL, EXPERTISE_ORDER, type Section } from "@/lib/types";
import { ActionForm, SubmitButton, inputClass, labelClass } from "./forms";

export function AddGapForm({ caseId, sections }: { caseId: string; sections: Section[] }) {
  return (
    <ActionForm action={addTask.bind(null, caseId)} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="gap-title" className={labelClass}>
          The task, in a few words
        </label>
        <input id="gap-title" name="title" required minLength={5} maxLength={200} className={inputClass} />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="gap-section" className={labelClass}>
            Part of the brief
          </label>
          <select id="gap-section" name="section" required className={inputClass}>
            {sections.map((s) => (
              <option key={s.id} value={s.id}>
                {s.position}. {s.title}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="gap-expertise" className={labelClass}>
            Who it&apos;s for
          </label>
          <select id="gap-expertise" name="expertise" required className={inputClass}>
            {EXPERTISE_ORDER.map((e) => (
              <option key={e} value={e}>
                {EXPERTISE_LABEL[e]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="gap-minutes" className={labelClass}>
            Minutes
          </label>
          <input id="gap-minutes" name="minutes" type="number" min={10} max={120} defaultValue={45} className={inputClass} />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="gap-why" className={labelClass}>
          Why it matters
        </label>
        <input id="gap-why" name="why" maxLength={1000} className={inputClass} />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="gap-done" className={labelClass}>
          What done looks like (one per line)
        </label>
        <textarea id="gap-done" name="done" rows={3} maxLength={2000} className={`${inputClass} resize-y`} />
      </div>
      <SubmitButton className="self-start">Add gap</SubmitButton>
    </ActionForm>
  );
}
