"use client";

import { useActionState } from "react";
import { sendSignInLink } from "@/app/auth-actions";
import { FormMessage, SubmitButton, inputClass, labelClass } from "@/components/forms";

export function LoginForm({ next }: { next: string }) {
  const [state, action] = useActionState(sendSignInLink, undefined);

  if (state?.ok) {
    return (
      <div role="status" className="flex flex-col gap-2 rounded-xl bg-ok-soft p-4 text-sm text-ok">
        <strong>Check your email.</strong>
        <span>
          We sent a sign in link to {state.ok}. Open it on this device. It works once and expires in an hour.
        </span>
      </div>
    );
  }
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="next" value={next} />
      <label htmlFor="email" className={labelClass}>
        Email
      </label>
      <input id="email" name="email" type="email" autoComplete="email" required className={inputClass} />
      <SubmitButton>Email me a sign in link</SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}
