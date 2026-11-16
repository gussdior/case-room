"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/** The case creator asks the AI to read the case and suggest ideas to check. */
export function SuggestIdeas({
  caseId,
  demo,
  primary,
  autoStart,
}: {
  caseId: string;
  demo: boolean;
  primary?: boolean;
  /** Right after a case opens: start once without a click. */
  autoStart?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok?: string; error?: string } | null>(null);

  async function go() {
    if (busy) return;
    setMsg(null);
    if (demo) return setMsg({ error: "This is a sample case. On a real case the AI reads the case and suggests ideas." });
    setBusy(true);
    try {
      const res = await fetch(`/api/case/${caseId}/setup-ai`, { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) setMsg({ error: data.error ?? "The AI didn't answer. Try again in a minute." });
      else setMsg({ ok: "Done." });
      router.refresh();
    } catch {
      setMsg({ error: "Lost the connection. Try again in a minute." });
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
        {busy ? "The AI is reading the case" : "Suggest ideas with AI"}
      </button>
      {msg && (
        <span role={msg.error ? "alert" : "status"} className={`text-xs font-semibold ${msg.error ? "text-bad" : "text-ok"}`}>
          {msg.error ?? msg.ok}
        </span>
      )}
    </div>
  );
}
