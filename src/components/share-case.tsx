"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

/** For the creator: the public preview link to share. Ready to post messages come later. */
export function ShareCaseButton({ caseId, publicPreview, demo }: { caseId: string; publicPreview: boolean; demo: boolean }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [url, setUrl] = useState(`/case/${caseId}`);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onClick = (e: MouseEvent) => box.current && !box.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  return (
    <div ref={box} className="relative">
      <button type="button" className="btn btn-secondary" aria-expanded={open} aria-controls="share-panel" onClick={() => {
          setUrl(`${window.location.origin}/case/${caseId}`);
          setOpen((o) => !o);
        }}>
        Share this case
      </button>
      {open && (
        <div
          id="share-panel"
          role="dialog"
          aria-label="Share this case"
          className="absolute right-0 z-30 mt-2 w-[min(92vw,380px)] rounded-[14px] border border-line bg-white p-5 shadow-[0_18px_40px_-20px_rgba(23,32,43,0.45)] motion-safe:animate-[fade-in_.15s_ease]"
        >
          <p className="font-semibold">Link to this case</p>
          <div className="mt-2 flex gap-2">
            <input readOnly value={url} aria-label="Case link" className="min-h-11 min-w-0 flex-1 rounded-[10px] border border-line-2 bg-paper px-3 text-sm" />
            <button
              type="button"
              className="btn btn-mark btn-sm"
              onClick={async () => {
                if (demo) return;
                try {
                  await navigator.clipboard.writeText(url);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                } catch {
                  setCopied(false);
                }
              }}
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <p className="mt-3 text-[13px] text-muted">
            {publicPreview ? (
              "People without an account see the public preview and can ask to join. You review every request."
            ) : (
              <>
                The public preview is off, so people need an account and an invite to see anything.{" "}
                <Link href={`/case/${caseId}/people#settings`}>Turn it on in Case settings</Link>.
              </>
            )}
          </p>
          <p className="mt-3 rounded-[10px] bg-paper px-3 py-2.5 text-[13px] text-ink-2">
            Coming soon: ready to post messages for patient groups, science communities and places to reach doctors.
          </p>
        </div>
      )}
    </div>
  );
}
