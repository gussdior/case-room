import { createCase } from "@/app/case-actions";
import { AppHeader } from "@/components/app-header";
import { ActionForm, SubmitButton, inputClass, labelClass } from "@/components/forms";
import { requireViewer } from "@/lib/auth";

export const metadata = { title: "Start a case | Case Room" };

export default async function NewCasePage() {
  await requireViewer("/new");
  return (
    <>
      <AppHeader />
      <main className="mx-auto flex w-full max-w-[760px] flex-1 flex-col gap-5 px-4 py-12 sm:px-8">
        <h1 className="font-display text-[40px] leading-tight font-medium tracking-[-0.01em]">Start a case</h1>
        <p className="text-sm leading-relaxed text-muted">
          You&apos;ll be the case creator: you decide who joins. Volunteers work on small tasks that build one brief of
          questions and options for the patient&apos;s own doctor. The app never tells anyone what treatment to take.
        </p>

        <ActionForm action={createCase} resetOnSuccess={false} className="sheet flex flex-col gap-5 px-5 py-8 sm:px-10">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="goal" className={labelClass}>
              Goal, in one line
            </label>
            <input
              id="goal"
              name="goal"
              required
              maxLength={200}
              defaultValue="Find the best next treatment options to discuss with the oncologist"
              className={inputClass}
            />
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
            We add starter tasks for every part of the brief. You and volunteers can add more.
          </p>
        </ActionForm>
      </main>
    </>
  );
}
