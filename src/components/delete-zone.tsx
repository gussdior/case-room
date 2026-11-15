"use client";

import { useState, type ReactNode } from "react";
import { ActionForm, SubmitButton, inputClass, labelClass, type FormAction } from "./forms";

/** A delete button that opens a confirm step where the person types DELETE. */
export function DeleteZone({
  title,
  button,
  action,
  children,
}: {
  title: string;
  button: string;
  action: FormAction;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <section aria-label={title} className="flex flex-col gap-3 rounded-[14px] border border-bad-line bg-bad-tint p-5">
      <h2 className="font-display text-xl font-medium">{title}</h2>
      <div className="text-sm text-ink-2">{children}</div>
      {!open ? (
        <button type="button" onClick={() => setOpen(true)} className="btn btn-secondary self-start">
          {button}
        </button>
      ) : (
        <ActionForm action={action} className="fade-in flex flex-col gap-2" resetOnSuccess={false}>
          <label htmlFor="confirm-delete" className={labelClass}>
            Type DELETE to confirm
          </label>
          <input
            id="confirm-delete"
            name="confirm"
            autoComplete="off"
            required
            pattern="DELETE"
            className={`${inputClass} max-w-60`}
          />
          <div className="flex flex-wrap gap-2">
            <SubmitButton variant="danger">{button}</SubmitButton>
            <button type="button" onClick={() => setOpen(false)} className="btn btn-ghost">
              Cancel
            </button>
          </div>
        </ActionForm>
      )}
    </section>
  );
}
