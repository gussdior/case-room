"use client";

import { reusePrompt } from "./run-actions";

/** A prompt that worked: click to put it in the Ask box. */
export function ReusePromptButton({ prompt, uses, here }: { prompt: string; uses: number; here: boolean }) {
  return (
    <button
      type="button"
      onClick={() => {
        reusePrompt(prompt);
        document.getElementById("ai")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }}
      className="row-link w-full text-left"
    >
      <span className="min-w-0 flex-1 text-sm font-semibold">&ldquo;{prompt}&rdquo;</span>
      <span className="flex-none text-xs text-muted">
        used {uses} {uses === 1 ? "time" : "times"}
        {here ? "" : ", other cases"}
      </span>
    </button>
  );
}
