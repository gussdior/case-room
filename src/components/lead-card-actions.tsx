"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { takeLead } from "@/app/lead-actions";

/** Buttons on a lead card: take a lead that needs someone, or ask the AI about any lead. */
export function LeadCardActions({
  caseId,
  leadId,
  canTake,
  demo,
  signedIn,
}: {
  caseId: string;
  leadId: string;
  canTake: boolean;
  demo: boolean;
  signedIn: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok?: string; error?: string } | null>(null);
  const askHref = `/case/${caseId}/lead/${leadId}?ask=1#ai`;
  return (
    <div className="relative z-10 col-span-2 flex flex-wrap items-center gap-2">
      {canTake && (
        <button
          type="button"
          className="btn btn-mark btn-sm"
          disabled={pending}
          onClick={() => {
            setMsg(null);
            if (demo) return setMsg({ error: "This is a sample case. On a real case this puts you on the lead." });
            if (!signedIn) return router.push(`/login?next=${encodeURIComponent(`/case/${caseId}`)}`);
            start(async () => {
              const r = await takeLead(caseId, leadId);
              setMsg(r ?? null);
              if (r?.ok) router.refresh();
            });
          }}
        >
          {pending ? "Taking it" : "Take this lead"}
        </button>
      )}
      <Link href={askHref} className="btn btn-secondary btn-sm">
        Ask AI about this
      </Link>
      {msg && (
        <span role={msg.error ? "alert" : "status"} className={`text-xs font-semibold ${msg.error ? "text-bad" : "text-ok"}`}>
          {msg.error ?? msg.ok}
        </span>
      )}
    </div>
  );
}
