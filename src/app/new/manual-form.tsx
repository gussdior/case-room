import { createCase } from "@/app/case-actions";
import { ActionForm, SubmitButton, inputClass, labelClass } from "@/components/forms";
import { AGE_RANGE_LABEL, AGE_RANGES } from "@/lib/types";

/** The original way to start a case: write the summary yourself, no documents. */
export function ManualForm() {
  return (
    <ActionForm action={createCase} resetOnSuccess={false} className="sheet flex flex-col gap-5 px-5 py-8 sm:px-10">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="goal" className={labelClass}>
          What is the goal of this case?
        </label>
        <input
          id="goal"
          name="goal"
          required
          minLength={10}
          maxLength={200}
          aria-describedby="goal-help"
          placeholder="Find the next options now that the first pill stopped working"
          className={inputClass}
        />
        <p id="goal-help" className="text-[13px] text-muted">
          Write it as a plain sentence. It becomes the case title, so helpers know what you need.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="cancer_type" className={labelClass}>
            Cancer type (optional)
          </label>
          <input id="cancer_type" name="cancer_type" maxLength={60} placeholder="Like: Lung cancer" className={inputClass} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="cancer_stage" className={labelClass}>
            Stage (optional)
          </label>
          <input id="cancer_stage" name="cancer_stage" maxLength={40} placeholder="Like: Stage IV" className={inputClass} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="age_range" className={labelClass}>
            Age range (optional)
          </label>
          <select id="age_range" name="age_range" defaultValue="" className={inputClass}>
            <option value="">Not shared</option>
            {AGE_RANGES.map((a) => (
              <option key={a} value={a}>
                {AGE_RANGE_LABEL[a]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="current_treatment" className={labelClass}>
            Current treatment (optional)
          </label>
          <input
            id="current_treatment"
            name="current_treatment"
            maxLength={80}
            placeholder="Like: waiting on biopsy results"
            className={inputClass}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="summary" className={labelClass}>
          Case summary in plain words
        </label>
        <textarea
          id="summary"
          name="summary"
          rows={7}
          maxLength={4000}
          placeholder="Age, type and stage of cancer, key test results (like mutations), treatments so far and how they went, what is happening now."
          className={`${inputClass} resize-y`}
        />
        <p className="rounded-[10px] border border-dashed border-mark-edge bg-mark-tint p-3 text-[13px] leading-relaxed text-mark-text">
          Do not include names, ID or insurance numbers, addresses, phone numbers, dates of birth, or the hospital and
          doctor names. Approved volunteers will read this.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="visit" className={labelClass}>
          Next doctor visit (optional)
        </label>
        <input id="visit" name="visit" type="date" className={`${inputClass} max-w-56`} />
      </div>

      <fieldset className="flex flex-col gap-2 rounded-[12px] bg-paper p-4">
        <legend className="sr-only">Consent and privacy</legend>
        <label className="flex items-start gap-2.5 text-sm leading-snug">
          <input type="checkbox" name="consent" required className="mt-1 h-4 w-4 accent-brand" />
          <span>
            The patient (or their legal representative) agreed to share this case with approved volunteers.
          </span>
        </label>
        <label className="flex items-start gap-2.5 text-sm leading-snug">
          <input type="checkbox" name="no_ids" required className="mt-1 h-4 w-4 accent-brand" />
          <span>The summary has no names, ID numbers, addresses or dates of birth.</span>
        </label>
      </fieldset>

      <SubmitButton variant="mark" className="self-start">Create case</SubmitButton>
      <p className="text-[13px] text-muted">
        Right after you create it, the AI suggests leads and drafts the brief, marked as an AI draft until a person checks it.
      </p>
    </ActionForm>
  );
}
