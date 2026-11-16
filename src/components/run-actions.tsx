"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { postMessage } from "@/app/case-actions";
import { bumpReuse } from "@/app/lead-actions";

const REUSE_EVENT = "caseroom:reuse-prompt";

/** Puts a prompt into the Ask AI box on the same page. */
export function reusePrompt(prompt: string) {
  window.dispatchEvent(new CustomEvent<string>(REUSE_EVENT, { detail: prompt }));
}
export function onReusePrompt(fn: (prompt: string) => void) {
  const h = (e: Event) => fn((e as CustomEvent<string>).detail);
  window.addEventListener(REUSE_EVENT, h);
  return () => window.removeEventListener(REUSE_EVENT, h);
}

/** The first question in a run's answer, for the doctor list. */
function questionIn(text: string): string | null {
  return (
    text
      .replace(/\[(https?:\/\/[^\]\s]+)\]/g, "")
      .split(/(?<=[.?!])\s+|\n/)
      .map((s) => s.trim().replace(/^[-*\d.)\s"]+|"$/g, ""))
      .find((s) => s.endsWith("?") && s.length > 12) ?? null
  );
}

const linkBtn =
  "inline-flex min-h-8 items-center rounded-md px-1 text-[13px] font-semibold text-brand transition-colors hover:text-brand-dark hover:underline hover:underline-offset-4 disabled:opacity-50";

export function RunActions({
  caseId,
  runId,
  prompt,
  result,
  firstSource,
  onLead,
  demo,
  own,
  reuseCount,
}: {
  caseId: string;
  runId: string;
  prompt: string;
  result: string;
  firstSource?: string;
  onLead: boolean;
  demo: boolean;
  own: boolean;
  reuseCount: number;
}) {
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  async function reuse() {
    if (onLead) {
      reusePrompt(prompt);
      document.getElementById("ai")?.scrollIntoView({ behavior: "smooth", block: "start" });
      setToast("Prompt added to the Ask box.");
    } else {
      try {
        await navigator.clipboard.writeText(prompt);
        setToast("Prompt copied. Paste it into your AI.");
      } catch {
        setToast("Couldn't copy. Select the prompt and copy it by hand.");
      }
    }
    if (!demo && !own) void bumpReuse(caseId, runId);
  }

  async function toDoctor() {
    if (demo) {
      setToast("This is a sample case. Sign in to work on a real one.");
      return;
    }
    setBusy(true);
    const fd = new FormData();
    fd.set("body", `Question for the doctor: ${questionIn(result) ?? prompt}`.slice(0, 4000));
    if (firstSource) fd.set("source", firstSource);
    const r = await postMessage(caseId, null, undefined, fd);
    setBusy(false);
    setToast(r?.error ?? "Posted to the case for the doctor's questions list.");
  }

  return (
    <>
      <button type="button" onClick={reuse} className={linkBtn}>
        Reuse prompt{reuseCount > 0 ? ` (${reuseCount})` : ""}
      </button>
      {onLead ? null : demo ? (
        <button type="button" className={linkBtn} onClick={() => setToast("This is a sample case. Sign in to work on a real one.")}>
          Save to what we tried
        </button>
      ) : (
        <Link href={`/case/${caseId}/tried?run=${runId}#log`} className={`${linkBtn} no-underline`}>
          Save to what we tried
        </Link>
      )}
      <button type="button" onClick={toDoctor} disabled={busy} className={linkBtn}>
        Add question for the doctor
      </button>
      {toast && (
        <span role="status" className="fade-in text-xs font-semibold text-ok">
          {toast}
        </span>
      )}
    </>
  );
}
