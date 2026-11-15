"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { askQuestion, setQuestionPublic, type QuestionResult } from "@/app/question-actions";
import { FormMessage, SubmitButton } from "./forms";

const MAX = 500;
const key = (caseId: string) => `caseroom-ask-${caseId}`;

function readDraft(caseId: string): string {
  try {
    return window.localStorage.getItem(key(caseId)) ?? "";
  } catch {
    return "";
  }
}
function writeDraft(caseId: string, text: string) {
  try {
    if (text) window.localStorage.setItem(key(caseId), text);
    else window.localStorage.removeItem(key(caseId));
  } catch {
    // Storage can be off; the visitor just retypes.
  }
}

/** "Ask the team a question" on the public preview. Signed out visitors sign in first; their text is kept. */
export function AskTeamBox({ caseId, signedIn, demo = false }: { caseId: string; signedIn: boolean; demo?: boolean }) {
  const router = useRouter();
  const [len, setLen] = useState(0);
  const [demoNote, setDemoNote] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);
  const [state, action] = useActionState<QuestionResult, FormData>(async (prev, form) => {
    const r = await askQuestion(caseId, prev, form);
    if (r?.ok) {
      writeDraft(caseId, "");
      if (area.current) area.current.value = "";
      setLen(0);
    }
    return r;
  }, undefined);

  // Bring back what a visitor typed before signing in.
  useEffect(() => {
    const saved = readDraft(caseId);
    if (saved && area.current && !area.current.value) {
      area.current.value = saved;
      if (signedIn && window.location.hash === "#ask") area.current.focus();
    }
  }, [caseId, signedIn]);

  const help = "Don't include names or medical records. Never offer or ask for money.";

  return (
    <section id="ask" aria-labelledby="ask-title" className="panel mt-6 flex flex-col gap-2.5 p-5 transition-shadow focus-within:border-brand focus-within:shadow-[0_0_0_3px_#d9def5]">
      <h2 id="ask-title" className="text-[15px] font-bold">
        Ask the team a question
      </h2>
      <p className="text-sm text-muted">Not sure yet? Ask the people working on this case. They reply here.</p>
      <form
        action={action}
        onSubmit={(e) => {
          if (demo) {
            e.preventDefault();
            setDemoNote(true);
            return;
          }
          if (!signedIn) {
            e.preventDefault();
            writeDraft(caseId, (area.current?.value ?? "").trim());
            router.push(`/login?next=${encodeURIComponent(`/case/${caseId}#ask`)}`);
          }
        }}
        className="flex flex-col gap-2.5"
      >
        <label htmlFor="ask-body" className="sr-only">
          Your question
        </label>
        <textarea
          ref={area}
          id="ask-body"
          name="body"
          required
          minLength={3}
          maxLength={MAX}
          rows={3}
          onChange={(e) => {
            setLen(e.target.value.length);
            if (signedIn) writeDraft(caseId, e.target.value);
          }}
          placeholder="For example: what kind of help do you need most?"
          className="field min-h-[84px] resize-y"
        />
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <SubmitButton variant="secondary">{signedIn || demo ? "Send question" : "Sign in to send"}</SubmitButton>
          <span className="text-xs text-muted">{help}</span>
          <span className="ml-auto text-xs text-muted" aria-live="polite">
            {len > MAX - 80 ? `${MAX - len} characters left` : ""}
          </span>
        </div>
        <FormMessage state={state} />
        {demoNote && (
          <p role="status" className="text-xs text-subtle">
            Sample case: this works once sign in is connected.
          </p>
        )}
      </form>
    </section>
  );
}

/** "Show on the public page" checkbox for the creator and co-approver. */
export function PublicToggle({
  caseId,
  questionId,
  initial,
  disabled,
  demo = false,
}: {
  caseId: string;
  questionId: string;
  initial: boolean;
  disabled?: boolean;
  demo?: boolean;
}) {
  const [on, setOn] = useState(initial);
  const [msg, setMsg] = useState<QuestionResult>(undefined);
  const [pending, start] = useTransition();
  return (
    <span className="ml-auto inline-flex flex-col items-end gap-1">
      <label className={`inline-flex min-h-11 cursor-pointer items-center gap-2 text-[13px] font-semibold ${disabled ? "opacity-50" : ""}`}>
        <input
          type="checkbox"
          className="h-[18px] w-[18px] accent-ink"
          checked={on}
          disabled={disabled || pending}
          onChange={(e) => {
            const next = e.target.checked;
            setOn(next);
            if (demo) {
              setMsg({ ok: "Sample case: this works once sign in is connected." });
              return;
            }
            start(async () => {
              const r = await setQuestionPublic(caseId, questionId, next);
              if (r?.error) setOn(!next);
              setMsg(r);
            });
          }}
        />
        Show on the public page
      </label>
      {msg?.error && (
        <span role="alert" className="text-xs font-semibold text-bad">
          {msg.error}
        </span>
      )}
      {msg?.ok && (
        <span role="status" className="text-xs text-muted">
          {msg.ok}
        </span>
      )}
    </span>
  );
}
