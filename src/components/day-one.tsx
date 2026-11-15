"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AI_DRAFT_LABEL } from "@/lib/types";

/** What the AI did for a new case before anyone joined, or a calm way to start it. */
export function DayOneStrip({
  caseId,
  demo,
  isAdmin,
  leads,
  sections,
  autoStart,
}: {
  caseId: string;
  demo: boolean;
  isAdmin: boolean;
  /** Leads the AI suggested. */
  leads: number;
  /** Brief parts with an AI draft. */
  sections: number;
  autoStart: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const made = leads + sections > 0;

  async function run() {
    if (demo || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/case/${caseId}/setup-ai`, { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) setError(data.error ?? "The AI didn't answer. Try again in a minute.");
      router.refresh();
    } catch {
      setError("Lost the connection. Try again in a minute.");
    } finally {
      setBusy(false);
    }
  }

  const started = useRef(false);
  useEffect(() => {
    if (!autoStart || made || demo || !isAdmin || started.current) return;
    started.current = true;
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart, made, demo, isAdmin]);

  if (!made && !isAdmin) return null;

  const what = [
    leads > 0 ? `suggested ${leads} ${leads === 1 ? "lead" : "leads"}` : null,
    sections > 0 ? "wrote a first draft for the doctor" : null,
  ]
    .filter(Boolean)
    .join(" and ");

  return (
    <section
      aria-label="What the AI did first"
      aria-live="polite"
      className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-line bg-white px-[18px] py-3.5 text-sm"
    >
      {made ? (
        <>
          <b className="font-semibold">Ready in the first hour, before anyone joins</b>
          <span className="text-ink-2">AI {what}.</span>
          {sections > 0 && (
            <Link href={`/case/${caseId}/doctor`} className="font-semibold">
              Read the AI draft
            </Link>
          )}
          <span className="rounded-full bg-mark-soft px-2.5 py-0.5 text-xs font-semibold text-mark-text">{AI_DRAFT_LABEL}</span>
        </>
      ) : busy ? (
        <>
          <span aria-hidden="true" className="h-2 w-2 animate-pulse rounded-full bg-brand motion-reduce:animate-none" />
          <b className="font-semibold">The AI is reading the case</b>
          <span className="text-ink-2">It suggests leads and drafts the brief. This takes about a minute.</span>
        </>
      ) : (
        <>
          <b className="font-semibold">Let the AI set up this case</b>
          <span className="text-ink-2">It suggests leads and drafts the brief, so there is something to work on before anyone joins.</span>
          <button type="button" onClick={run} className="btn btn-secondary btn-sm">
            {error ? "Try again" : "Set up with AI"}
          </button>
          {error && (
            <span role="alert" className="text-xs font-semibold text-ink-2">
              {error}
            </span>
          )}
        </>
      )}
    </section>
  );
}
