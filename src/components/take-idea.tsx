"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { claimTask } from "@/app/case-actions";
import { takeLead } from "@/app/lead-actions";

/** "Take this" on an idea that needs someone. */
export function TakeIdea({ caseId, kind, id, demo }: { caseId: string; kind: "lead" | "task"; id: string; demo: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="relative z-10 flex flex-col items-end gap-1">
      <button
        type="button"
        className="btn btn-mark btn-sm"
        disabled={pending}
        onClick={() => {
          setError(null);
          if (demo) return setError("This is a sample case. On a real case this puts you on it.");
          start(async () => {
            if (kind === "lead") {
              const r = await takeLead(caseId, id);
              if (r?.error) setError(r.error);
              else router.push(`/case/${caseId}/lead/${id}`);
            } else {
              const r = await claimTask(caseId, id);
              if (r?.error) setError(r.error);
            }
          });
        }}
      >
        {pending ? "Taking it" : "Take this"}
      </button>
      {error && (
        <span role="alert" className="max-w-56 text-right text-xs font-semibold text-bad">
          {error}
        </span>
      )}
    </span>
  );
}
