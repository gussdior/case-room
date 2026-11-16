"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { inputClass, labelClass } from "@/components/forms";
import type { Draft, DraftDoc } from "@/lib/drafts/types";
import { AGE_RANGE_LABEL, AGE_RANGES } from "@/lib/types";
import { publishDraft, saveOpenDetails } from "./draft-actions";

export function StepOpen({ draft, docs }: { draft: Draft; docs: DraftDoc[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const tasks = draft.suggestedTasks.filter((t) => t.picked);
  const suggestion = (draft.answers.suggested_goal ?? "").trim();
  const [goal, setGoal] = useState(draft.answers.goal ?? "");
  const [age, setAge] = useState(draft.answers.age_range ?? "");
  const [current, setCurrent] = useState(draft.answers.current_treatment ?? "");
  const [stage, setStage] = useState(draft.answers.cancer_stage ?? "");
  const goalOk = goal.trim().length >= 10;

  const rows: [string, string][] = [
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

      <section aria-labelledby="goal-h" className="sheet flex flex-col gap-4 px-5 py-6 sm:px-8">
        <div className="flex flex-col gap-1.5">
          <label id="goal-h" htmlFor="goal" className={labelClass}>
            What is the goal of this case?
          </label>
          <input
            id="goal"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            required
            minLength={10}
            maxLength={200}
            aria-describedby="goal-help"
            placeholder="Find the next options now that the first pill stopped working"
            className={inputClass}
          />
          <p id="goal-help" className="text-[13px] text-muted">
            Write it as a plain sentence. It becomes the case title, so helpers know what you need.
          </p>
          {suggestion && suggestion !== goal.trim() && (
            <div className="flex flex-wrap items-center gap-2 rounded-[10px] bg-brand-tint px-3 py-2.5 text-sm">
              <span className="text-muted">Suggested from your documents:</span>
              <span className="font-serif text-[16px] text-ink">&ldquo;{suggestion}&rdquo;</span>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setGoal(suggestion)}>
                Use this
              </button>
            </div>
          )}
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="stage" className={labelClass}>
              Stage (optional)
            </label>
            <input id="stage" value={stage} onChange={(e) => setStage(e.target.value)} maxLength={40} className={inputClass} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="age" className={labelClass}>
              Age range (optional)
            </label>
            <select id="age" value={age} onChange={(e) => setAge(e.target.value)} className={inputClass}>
              <option value="">Not shared</option>
              {AGE_RANGES.map((a) => (
                <option key={a} value={a}>
                  {AGE_RANGE_LABEL[a]}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="current" className={labelClass}>
              Current treatment (optional)
            </label>
            <input id="current" value={current} onChange={(e) => setCurrent(e.target.value)} maxLength={80} className={inputClass} />
          </div>
        </div>
        <p className="text-[13px] text-muted">
          These show under the title. The AI filled what it found in your documents. Check them.
        </p>
      </section>

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
        doctor or nurse checks it. Right after it opens, the AI suggests leads to look into.
      </p>

      {error && (
        <p role="alert" className="text-sm font-semibold text-bad">
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={busy || !goalOk}
          className="btn btn-mark"
          onClick={async () => {
            setBusy(true);
            setError("");
            const saved = await saveOpenDetails(draft.id, { goal, ageRange: age, currentTreatment: current, stage });
            if (!saved.ok) {
              setError(saved.error);
              setBusy(false);
              return;
            }
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
        <p className="text-[13px] text-muted">
          {goalOk ? "Only people you approve can see it." : "Write the goal first."}
        </p>
      </div>
    </div>
  );
}
