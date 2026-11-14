"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/** Case admins ask the AI for 3 to 5 ideas to investigate. */
export function SuggestLeadsButton({
  caseId,
  demo,
  primary,
  autoStart,
}: {
  caseId: string;
  demo: boolean;
  primary?: boolean;
  /** Right after a case opens: ask once without a click. */
  autoStart?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok?: string; error?: string } | null>(null);
  async function go() {
    setMsg(null);
    if (demo) return setMsg({ error: "This is a sample case. On a real case the AI suggests leads from the case." });
    setBusy(true);
    try {
      const res = await fetch(`/api/case/${caseId}/suggest-leads`, { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as { added?: number; error?: string };
      if (!res.ok) setMsg({ error: data.error ?? "The AI didn't answer. Try again." });
      else {
        setMsg({ ok: data.added ? `Added ${data.added} ${data.added === 1 ? "lead" : "leads"}.` : "No new ideas this time." });
        router.refresh();
      }
    } catch {
      setMsg({ error: "Lost the connection. Try again." });
    } finally {
      setBusy(false);
    }
  }
  const started = useRef(false);
  useEffect(() => {
    if (!autoStart || demo || started.current) return;
    started.current = true;
    void go();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart, demo]);
  return (
    <div className="flex flex-col items-start gap-1.5">
      <button type="button" onClick={go} disabled={busy} className={primary ? "btn btn-mark" : "btn btn-secondary"}>
        {busy ? "The AI is reading the case" : "Suggest leads with AI"}
      </button>
      {msg && (
        <span role={msg.error ? "alert" : "status"} className={`text-xs font-semibold ${msg.error ? "text-bad" : "text-ok"}`}>
          {msg.error ?? msg.ok}
        </span>
      )}
    </div>
  );
}
