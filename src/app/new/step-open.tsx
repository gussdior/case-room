"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Draft, DraftDoc } from "@/lib/drafts/types";
import { publishDraft } from "./draft-actions";

export function StepOpen({ draft, docs }: { draft: Draft; docs: DraftDoc[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const tasks = draft.suggestedTasks.filter((t) => t.picked);
  const goal = (draft.sections.wants?.text || draft.answers.wants_to_know || "").trim();

  const rows: [string, string][] = [
    ["Goal", goal || "Find the best next options to discuss with the oncologist"],
    ["Cancer", draft.cancerType || "Not set"],
    [
      "Next visit",
      draft.visitDate
        ? new Date(`${draft.visitDate}T12:00:00`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
        : "Not booked yet",
    ],
    ["Treatments", `${draft.treatments.length} added to "What we tried"`],
    ["Tasks", `${tasks.length} ready for volunteers`],
    [
      "Your files",
      docs.length === 0 ? "Deleted" : draft.keepFiles ? "Kept private to you" : "Deleted when the case opens",
    ],
  ];

  return (
    <div className="flex max-w-[760px] flex-col gap-6">
      <div>
        <h1 className="font-display text-[34px] leading-[1.1] font-medium tracking-[-0.015em] sm:text-[40px]">Open the case</h1>
        <p className="mt-3 max-w-[620px] text-base text-muted">
          Once it&apos;s open, you decide who joins. Volunteers ask to join, and you approve or decline each person.
        </p>
      </div>

      <dl className="sheet grid gap-0 px-5 py-4 sm:px-8">
        {rows.map(([k, v]) => (
          <div key={k} className="grid grid-cols-[120px_minmax(0,1fr)] gap-4 border-b border-line py-3 last:border-b-0">
            <dt className="text-[13px] text-muted">{k}</dt>
            <dd className="font-serif text-[17px] text-ink-2">{v}</dd>
          </div>
        ))}
      </dl>

      <p className="rounded-[12px] bg-brand-soft px-4 py-3 text-sm text-ink">
        The brief starts with your confirmed text, marked &ldquo;From the family&apos;s documents, needs a check&rdquo; until a
        doctor or nurse checks it.
      </p>

      {error && (
        <p role="alert" className="text-sm font-semibold text-bad">
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={busy}
          className="btn btn-mark"
          onClick={async () => {
            setBusy(true);
            setError("");
            const r = await publishDraft(draft.id);
            if (r.ok) router.push(`/case/${r.caseId}?new=1`);
            else {
              setError(r.error);
              setBusy(false);
            }
          }}
        >
          {busy ? "Opening…" : "Open the case"}
        </button>
        <p className="text-[13px] text-muted">Only people you approve can see it.</p>
      </div>
    </div>
  );
}
