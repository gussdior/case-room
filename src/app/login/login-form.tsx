"use client";

import { useActionState } from "react";
import { sendSignInLink, verifyCode } from "@/app/auth-actions";
import { FormMessage, SubmitButton, inputClass, labelClass } from "@/components/forms";

export function LoginForm({ next }: { next: string }) {
  const [state, action] = useActionState(sendSignInLink, undefined);
  const [codeState, codeAction] = useActionState(verifyCode, undefined);

  if (state?.ok) {
    return (
      <div className="flex flex-col gap-4">
        <div role="status" className="flex flex-col gap-2 rounded-[12px] bg-ok-soft p-4 text-sm text-ok">
          <strong>Check your email.</strong>
          <span>
            We sent a sign in link to {state.ok}. Tap the link, or type the code from the email below. Check your spam
            folder if it doesn&apos;t arrive in a minute.
          </span>
        </div>
        <form action={codeAction} className="flex flex-col gap-3">
          <input type="hidden" name="email" value={state.ok} />
          <input type="hidden" name="next" value={next} />
          <label htmlFor="code" className={labelClass}>
            Code from the email
          </label>
          <input
            id="code"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={10}
            className={`${inputClass} max-w-48 tracking-widest`}
          />
          <SubmitButton variant="secondary" className="self-start">
            Sign in with code
          </SubmitButton>
          <FormMessage state={codeState} />
        </form>
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
      <SubmitButton variant="mark">Email me a sign in link</SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}
