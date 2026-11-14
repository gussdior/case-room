"use client";

import { useActionState } from "react";
import { saveProfile } from "@/app/auth-actions";
import { FormMessage, SubmitButton, inputClass, labelClass } from "@/components/forms";
import type { Viewer } from "@/lib/auth";
import { EXPERTISE_LABEL, EXPERTISE_ORDER } from "@/lib/types";

export function ProfileForm({ next, viewer }: { next: string; viewer: Viewer | null }) {
  const [state, action] = useActionState(saveProfile, undefined);
  return (
    <form action={action} className="flex flex-col gap-4 rounded-2xl border border-line bg-white p-6">
      <input type="hidden" name="next" value={next} />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="name" className={labelClass}>
          Name others will see
        </label>
        <input id="name" name="name" required maxLength={60} defaultValue={viewer?.name} className={inputClass} />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="headline" className={labelClass}>
          One line about you
        </label>
        <input
          id="headline"
          name="headline"
          maxLength={120}
          placeholder="e.g. Oncology nurse, 12 years"
          defaultValue={viewer?.headline}
          className={inputClass}
        />
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className={`${labelClass} mb-1.5`}>Your expertise</legend>
        {EXPERTISE_ORDER.map((e) => (
          <label key={e} className="flex min-h-11 items-center gap-2.5 rounded-lg border border-line px-3 text-sm">
            <input type="radio" name="expertise" value={e} required defaultChecked={viewer?.expertise === e} />
            {EXPERTISE_LABEL[e]}
          </label>
        ))}
      </fieldset>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="proof" className={labelClass}>
          A link that shows who you are
        </label>
        <input
          id="proof"
          name="proof"
          type="url"
          placeholder="https://"
          defaultValue={viewer?.proofUrl ?? ""}
          className={inputClass}
        />
        <span className="text-xs text-subtle">
          LinkedIn, a university or hospital page, or a license lookup. Doctors and nurses need one to join a case.
        </span>
      </div>
      <SubmitButton>Save and continue</SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}
