"use client";

import { useEffect, useState } from "react";
import { PasteRun } from "./paste-run";

const INCLUDED = ["Cancer type and stage", "Gene results", "Treatments so far", "Latest scan", "What we ruled out"];

/** "Use your own AI on this case": copy a clean case pack, or paste back what your AI found. */
export function CaseAiBar({ caseId, demo }: { caseId: string; demo: boolean }) {
  const [state, setState] = useState<"idle" | "copying" | "copied">("idle");
  const [note, setNote] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (state !== "copied") return;
    const t = setTimeout(() => setState("idle"), 2500);
    return () => clearTimeout(t);
  }, [state]);

  async function copy() {
    setNote(null);
    if (demo) {
      setNote("This is a sample case. On a real case this copies the case, without names or IDs, ready for any AI.");
      return;
    }
    setState("copying");
    try {
      const res = await fetch(`/api/case/${caseId}/pack`, { cache: "no-store" });
      if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Couldn't load the case.");
      await navigator.clipboard.writeText(await res.text());
      setState("copied");
    } catch (e) {
      setState("idle");
      setNote(e instanceof Error && e.message ? e.message : "Couldn't copy. Try again.");
    }
  }

  return (
    <section aria-label="Use your own AI on this case" className="mt-7">
      <div className="flex flex-wrap items-center gap-3.5 rounded-[14px] bg-ink px-5 py-4 text-white">
        <h2 className="font-display text-xl font-medium">Use your own AI on this case</h2>
        <ul className="flex flex-wrap gap-1.5" aria-label="What the case notes include">
          {INCLUDED.map((i) => (
            <li key={i} className="rounded-full bg-[#26303d] px-2.5 py-0.5 text-xs text-[#c9cfd8]">
              {i}
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-2 lg:ml-auto">
          <button type="button" onClick={copy} disabled={state === "copying"} className="btn btn-mark">
            {state === "copied" ? "Copied" : state === "copying" ? "Copying" : "Copy case for your AI"}
          </button>
          <button
            type="button"
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
            className="btn border border-[#4a5563] text-white hover:bg-[#26303d] hover:text-white"
          >
            {open ? "Close" : "Paste a result"}
          </button>
        </div>
        <p role="status" className="basis-full text-xs text-[#b8e6cc]">
          {note ?? (state === "copied" ? "Copied. Paste it into ChatGPT, Claude, Gemini or any AI, then ask your question." : "No names or IDs are included. Works with ChatGPT, Claude, Gemini or any AI.")}
        </p>
      </div>
      {open && (
        <div className="fade-in panel mt-3 p-5 sm:p-6">
          <h3 className="mb-1 font-display text-xl font-medium">Paste what your AI found</h3>
          <p className="mb-4 text-sm text-muted">To file it under one idea, paste it on that idea instead.</p>
          <PasteRun caseId={caseId} demo={demo} />
        </div>
      )}
    </section>
  );
}

/** Copies the case pack focused on one lead. */
export function CopyPackButton({ caseId, leadId, demo }: { caseId: string; leadId?: string; demo: boolean }) {
  const [label, setLabel] = useState("Copy case for your AI");
  async function copy() {
    if (demo) return setLabel("Sample case: sign in to copy");
    setLabel("Copying");
    try {
      const res = await fetch(`/api/case/${caseId}/pack${leadId ? `?lead=${leadId}` : ""}`, { cache: "no-store" });
      if (!res.ok) throw new Error();
      await navigator.clipboard.writeText(await res.text());
      setLabel("Copied");
    } catch {
      setLabel("Couldn't copy, try again");
    }
    setTimeout(() => setLabel("Copy case for your AI"), 2500);
  }
  return (
    <button type="button" onClick={copy} className="btn border border-[#4a5563] text-white hover:bg-[#26303d] hover:text-white">
      {label}
    </button>
  );
}
