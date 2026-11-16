"use client";

import { useState } from "react";
import { RichText } from "./rich-text";

const LIMIT = 700;

/** A saved AI answer. Long ones start short with a button to read the rest. */
export function LongAnswer({ text, open = false, className = "" }: { text: string; open?: boolean; className?: string }) {
  const [all, setAll] = useState(open);
  const long = text.length > LIMIT;
  const cut = text.slice(0, LIMIT);
  const shown = !long || all ? text : `${cut.slice(0, Math.max(cut.lastIndexOf(" "), 200)).trimEnd()}...`;
  return (
    <div>
      <RichText text={shown} className={className} />
      {long && (
        <button type="button" className="btn btn-ghost btn-sm mt-1 -ml-2" aria-expanded={all} onClick={() => setAll((x) => !x)}>
          {all ? "Show less" : "Read the full answer"}
        </button>
      )}
    </div>
  );
}
