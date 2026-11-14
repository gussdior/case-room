"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DRAFT_KEYS, type Draft, type DraftDoc } from "@/lib/drafts/types";
import { StepWho } from "./step-who";
import { StepDocs } from "./step-docs";
import { StepDraft } from "./step-draft";
import { StepPrivacy } from "./step-privacy";
import { StepOpen } from "./step-open";

const STEPS = ["Who it's for", "Add documents", "Check the draft", "Privacy check", "Open the case"];

/** How far this draft has got: the furthest step the person can open. */
function reach(d: Draft | null, docs: DraftDoc[]): number {
  if (!d) return 1;
  if (!d.sections.plain || docs.length === 0) return 2;
  if (!DRAFT_KEYS.every((k) => d.confirmations[k])) return 3;
  if (!d.privacyOk) return 4;
  return 5;
}

export function Wizard({
  userId,
  initialDraft,
  initialDocs,
}: {
  userId: string;
  initialDraft: Draft | null;
  initialDocs: DraftDoc[];
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft | null>(initialDraft);
  const [docs, setDocs] = useState<DraftDoc[]>(initialDocs);
  const furthest = reach(draft, docs);
  const [step, setStep] = useState(furthest);
  const go = (n: number) => {
    setStep(n);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="mx-auto grid w-full max-w-[1360px] gap-8 px-4 pt-8 pb-16 sm:px-8 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-10 lg:px-12 lg:pt-10">
      <nav aria-label={`Start a case, step ${step} of 5`} className="lg:sticky lg:top-6 lg:self-start">
        <p className="mb-3 text-[13px] text-muted">
          {draft ? "Private draft. Only you can see it." : "Nothing is shared until the last step."}
        </p>
        <ol className="flex flex-wrap gap-1 lg:flex-col">
          {STEPS.map((label, i) => {
            const n = i + 1;
            const done = n < furthest || (n === furthest && n < step);
            const now = n === step;
            const open = n <= furthest;
            return (
              <li key={label}>
                <button
                  type="button"
                  disabled={!open}
                  aria-current={now ? "step" : undefined}
                  onClick={() => go(n)}
                  className={`flex min-h-11 w-full items-center gap-3 rounded-[10px] border px-3 text-left text-sm transition-colors ${
                    now
                      ? "border-line bg-white font-semibold text-ink"
                      : open
                        ? "border-transparent text-muted hover:bg-hover hover:text-ink"
                        : "cursor-default border-transparent text-subtle"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`flex h-[26px] w-[26px] flex-none items-center justify-center rounded-full text-xs font-bold transition-colors ${
                      now ? "bg-ink text-white" : done || (open && n < step) ? "bg-ok text-white" : "bg-[#e4e7e4] text-muted"
                    }`}
                  >
                    {n}
                  </span>
                  <span className={now ? "" : "hidden sm:inline"}>{label}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      <div key={step} className="fade-in min-w-0">
        {step === 1 && (
          <StepWho
            draft={draft}
            onSaved={(d) => {
              setDraft(d);
              if (!draft) router.replace(`/new?draft=${d.id}`, { scroll: false });
              go(2);
            }}
          />
        )}
        {step === 2 && draft && (
          <StepDocs
            userId={userId}
            draft={draft}
            docs={docs}
            setDocs={setDocs}
            onComposed={(d) => {
              setDraft(d);
              go(3);
            }}
            onNext={() => go(3)}
          />
        )}
        {step === 3 && draft && (
          <StepDraft draft={draft} setDraft={setDraft} onNext={() => go(4)} onBack={() => go(2)} />
        )}
        {step === 4 && draft && (
          <StepPrivacy draft={draft} docs={docs} setDraft={setDraft} setDocs={setDocs} onNext={() => go(5)} />
        )}
        {step === 5 && draft && <StepOpen draft={draft} docs={docs} />}
      </div>
    </div>
  );
}
