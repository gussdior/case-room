"use client";

import { useState } from "react";

/** Copies text and says so. Falls back to a hint when the browser blocks the clipboard. */
export function CopyButton({
  text,
  label,
  className = "btn btn-sm btn-secondary",
  disabled,
  onCopied,
}: {
  text: string;
  label: string;
  className?: string;
  disabled?: boolean;
  onCopied?: () => void;
}) {
  const [done, setDone] = useState<"ok" | "fail" | null>(null);
  return (
    <button
      type="button"
      disabled={disabled}
      className={className}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone("ok");
          onCopied?.();
        } catch {
          setDone("fail");
        }
        setTimeout(() => setDone(null), 2500);
      }}
    >
      <span aria-live="polite">{done === "ok" ? "Copied" : done === "fail" ? "Copy failed, select the text" : label}</span>
    </button>
  );
}
