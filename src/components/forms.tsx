"use client";

import { useActionState, useEffect, useRef, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { btn } from "./ui";

export type ActionResult = { error?: string; ok?: string } | undefined;
export type FormAction = (state: ActionResult, form: FormData) => Promise<ActionResult>;

export function SubmitButton({
  children,
  variant = "primary",
  className = "",
  name,
  value,
}: {
  children: ReactNode;
  variant?: keyof typeof btn;
  className?: string;
  name?: string;
  value?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" name={name} value={value} disabled={pending} className={`${btn[variant]} disabled:opacity-60 ${className}`}>
      {pending ? "Working…" : children}
    </button>
  );
}

export function FormMessage({ state }: { state: ActionResult }) {
  if (state?.error)
    return (
      <p role="alert" className="text-sm font-semibold text-bad">
        {state.error}
      </p>
    );
  if (state?.ok)
    return (
      <p role="status" className="text-sm text-ok">
        {state.ok}
      </p>
    );
  return null;
}

/** A form wired to a server action, showing its error or success message. Resets on success. */
export function ActionForm({
  action,
  children,
  className = "",
  resetOnSuccess = true,
}: {
  action: FormAction;
  children: ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
}) {
  const [state, formAction] = useActionState(action, undefined);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (resetOnSuccess && state && !state.error) ref.current?.reset();
  }, [state, resetOnSuccess]);
  return (
    <form ref={ref} action={formAction} className={className}>
      {children}
      <FormMessage state={state} />
    </form>
  );
}

/** One button that runs one server action. */
export function ActionButton({
  action,
  children,
  variant = "secondary",
  className = "",
}: {
  action: FormAction;
  children: ReactNode;
  variant?: keyof typeof btn;
  className?: string;
}) {
  const [state, formAction] = useActionState(action, undefined);
  return (
    <form action={formAction} className="inline-flex flex-col gap-1">
      <SubmitButton variant={variant} className={className}>
        {children}
      </SubmitButton>
      {state?.error && (
        <span role="alert" className="max-w-64 text-xs font-semibold text-bad">
          {state.error}
        </span>
      )}
    </form>
  );
}

export const inputClass = "w-full rounded-[10px] border border-line-2 bg-white px-3 py-2.5 text-sm";
export const labelClass = "text-[13px] font-semibold";
