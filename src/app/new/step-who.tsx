"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import type { Draft, Relationship } from "@/lib/drafts/types";
import { saveWho } from "./draft-actions";

const WHO: { value: Relationship; label: string; hint: string }[] = [
  { value: "myself", label: "For myself", hint: "I'm the patient" },
  { value: "family", label: "For a family member", hint: "Parent, partner, child, sibling" },
  { value: "caregiver", label: "As a caregiver", hint: "I help look after the patient" },
];

export function StepWho({ draft, onSaved }: { draft: Draft | null; onSaved: (d: Draft) => void }) {
  const a = draft?.answers ?? {};
  const [who, setWho] = useState<Relationship>(a.relationship ?? "family");
  const [wants, setWants] = useState(a.wants_to_know ?? "");
  const [consent, setConsent] = useState(Boolean(a.consent));
  const [noIds, setNoIds] = useState(Boolean(a.no_ids));
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    start(async () => {
      const r = await saveWho({ draftId: draft?.id, relationship: who, consent, noIds, wantsToKnow: wants });
      if (r.ok) onSaved(r.draft);
      else setError(r.error);
    });
  };

  return (
    <form onSubmit={submit} className="flex max-w-[760px] flex-col gap-7">
      <div>
        <h1 className="font-display text-[34px] leading-[1.1] font-medium tracking-[-0.015em] sm:text-[40px]">Start a case</h1>
        <p className="mt-3 max-w-[620px] text-base text-muted">
          Next you&apos;ll add medical documents, and the AI writes the first draft for you. You check every word before
          anyone else sees it.
        </p>
      </div>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-3 text-[15px] font-semibold">Who is the case for?</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {WHO.map((w) => (
            <label
              key={w.value}
              className={`flex min-h-11 cursor-pointer flex-col gap-0.5 rounded-[12px] border bg-white px-4 py-3 transition-[border-color,box-shadow,transform] hover:-translate-y-px hover:border-brand-line has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-brand ${
                who === w.value ? "border-ink shadow-[inset_0_0_0_1px_var(--color-ink)]" : "border-line"
              }`}
            >
              <input
                type="radio"
                name="who"
                value={w.value}
                checked={who === w.value}
                onChange={() => setWho(w.value)}
                className="sr-only"
              />
              <span className="font-semibold">{w.label}</span>
              <span className="text-[13px] text-muted">{w.hint}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="wants" className="text-[15px] font-semibold">
          What does the family want to know?
        </label>
        <p id="wants-hint" className="text-[13px] text-muted">
          In your own words. For example: what the options are now that the pill stopped working, and which trials she
          could join.
        </p>
        <textarea
          id="wants"
          aria-describedby="wants-hint"
          rows={3}
          maxLength={1000}
          value={wants}
          onChange={(e) => setWants(e.target.value)}
          className="field resize-y"
        />
      </div>

      <fieldset className="flex flex-col gap-2.5 rounded-[12px] bg-white p-4 ring-1 ring-line">
        <legend className="sr-only">Consent and privacy</legend>
        <label className="flex cursor-pointer items-start gap-3 text-sm leading-snug">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            className="mt-0.5 h-5 w-5 flex-none accent-ink"
          />
          <span>The patient (or their legal representative) agreed to share this case with volunteers I approve.</span>
        </label>
        <label className="flex cursor-pointer items-start gap-3 text-sm leading-snug">
          <input
            type="checkbox"
            checked={noIds}
            onChange={(e) => setNoIds(e.target.checked)}
            className="mt-0.5 h-5 w-5 flex-none accent-ink"
          />
          <span>
            I won&apos;t share names, birth dates, ID numbers or addresses. The AI hides the ones in the documents, and I
            check before anything opens.
          </span>
        </label>
      </fieldset>

      {error && (
        <p role="alert" className="text-sm font-semibold text-bad">
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" disabled={pending} className="btn btn-mark">
          {pending ? "Saving…" : "Next: add documents"}
        </button>
        <Link href="/new?manual=1" className="text-sm">
          Skip documents and write it myself
        </Link>
      </div>
    </form>
  );
}
