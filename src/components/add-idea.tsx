"use client";

import { useId, useState } from "react";
import { addLead } from "@/app/lead-actions";
import { ActionForm, SubmitButton, inputClass, labelClass } from "./forms";

/** "Add an idea": a title and one optional line. Nothing else. */
export function AddIdea({ caseId, demo, primary }: { caseId: string; demo: boolean; primary?: boolean }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <div className={open ? "w-full" : ""}>
      {!open && (
        <button type="button" className={primary ? "btn btn-mark" : "btn btn-secondary"} aria-expanded={false} onClick={() => setOpen(true)}>
          Add an idea
        </button>
      )}
      {open && (
        <div className="panel fade-in mt-1 p-5">
          {demo ? (
            <p className="text-sm text-muted">This is a sample case. On a real case you can add anything worth checking.</p>
          ) : (
            <ActionForm action={addLead.bind(null, caseId)} className="flex flex-col gap-3">
              <input type="hidden" name="kind" value="other" />
              <div className="flex flex-col gap-1.5">
                <label htmlFor={`${id}-t`} className={labelClass}>
                  What should the team check?
                </label>
                <input
                  id={`${id}-t`}
                  name="title"
                  required
                  minLength={3}
                  maxLength={200}
                  autoFocus
                  placeholder="Like: Could an existing drug be used in a new way?"
                  className={inputClass}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor={`${id}-n`} className={labelClass}>
                  First step <span className="font-normal text-muted">(optional)</span>
                </label>
                <input id={`${id}-n`} name="next_step" maxLength={300} placeholder="Like: Search recent papers" className={inputClass} />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <SubmitButton variant="mark">Add it</SubmitButton>
                <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>
                  Cancel
                </button>
                <span className="text-xs text-muted">No names or ID numbers.</span>
              </div>
            </ActionForm>
          )}
          {demo && (
            <button type="button" className="btn btn-ghost mt-2" onClick={() => setOpen(false)}>
              Close
            </button>
          )}
        </div>
      )}
    </div>
  );
}
