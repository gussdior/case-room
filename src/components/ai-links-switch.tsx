"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setAiLinksAllowed } from "@/app/share-actions";

/** The creator's switch: whether people on the case may create links that any AI can read. */
export function AiLinksSwitch({ caseId, allowed }: { caseId: string; allowed: boolean }) {
  const [on, setOn] = useState(allowed);
  const [msg, setMsg] = useState<{ ok?: string; error?: string } | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor="ai-links-allowed" className="flex min-h-11 cursor-pointer items-start gap-3 text-[15px]">
        <input
          id="ai-links-allowed"
          type="checkbox"
          className="mt-1 h-5 w-5 flex-none accent-ink"
          checked={on}
          disabled={pending}
          onChange={(e) => {
            const next = e.target.checked;
            setOn(next);
            setMsg(null);
            start(async () => {
              const r = await setAiLinksAllowed(caseId, next);
              if (r?.error) {
                setOn(!next);
                setMsg({ error: r.error });
              } else setMsg({ ok: r?.ok });
              router.refresh();
            });
          }}
        />
        <span>
          <span className="block font-semibold">Allow AI links for this case</span>
          <span className="block text-sm text-muted">
            People on the case can create a link that shows chosen case text, with no names or documents, to any AI. Turning
            this off stops every existing link.
          </span>
        </span>
      </label>
      <p aria-live="polite" className={`text-[13px] ${msg?.error ? "text-bad" : "text-ok"}`}>
        {msg?.error ?? msg?.ok ?? ""}
      </p>
    </div>
  );
}
