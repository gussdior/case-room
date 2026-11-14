"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import type { AiTool, SourceCheck } from "@/lib/types";

const TOOLS: { id: AiTool; label: string }[] = [
  { id: "chatgpt", label: "ChatGPT" },
  { id: "claude", label: "Claude" },
  { id: "gemini", label: "Gemini" },
  { id: "other", label: "Other" },
];

/** Paste what your own AI found. The server checks every link and cleans out names and IDs. */
export function PasteRun({
  caseId,
  leadId,
  demo,
  dark,
  onDone,
}: {
  caseId: string;
  leadId?: string;
  demo: boolean;
  dark?: boolean;
  onDone?: () => void;
}) {
  const id = useId();
  const router = useRouter();
  const [tool, setTool] = useState<AiTool>("chatgpt");
  const [other, setOther] = useState("");
  const [prompt, setPrompt] = useState("");
  const [result, setResult] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ check: SourceCheck; noLinks: boolean } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (demo) {
      setError("This is a sample case. Sign in to add runs on a real one.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/case/${caseId}/runs`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ leadId, tool, toolOther: other, prompt, result }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; check?: SourceCheck; noLinks?: boolean };
      if (!res.ok) {
        setError(data.error ?? "Couldn't save it. Try again.");
        return;
      }
      setDone({ check: data.check ?? {}, noLinks: !!data.noLinks });
      setPrompt("");
      setResult("");
      router.refresh();
      onDone?.();
    } catch {
      setError("Lost the connection. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const label = dark ? "text-sm font-semibold text-white" : "text-sm font-semibold";
  const field = "field text-ink";
  const failed = (done?.check.results ?? []).filter((r) => !r.ok);

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <fieldset className="flex flex-col gap-2">
        <legend className={`${label} mb-2`}>Which AI did you use?</legend>
        <div className="flex flex-wrap gap-1.5">
          {TOOLS.map((t) => (
            <label
              key={t.id}
              className={`chip has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-brand ${
                dark
                  ? "has-[:checked]:border-mark has-[:checked]:bg-mark has-[:checked]:text-ink"
                  : "has-[:checked]:border-ink has-[:checked]:bg-ink has-[:checked]:text-white"
              }`}
            >
              <input type="radio" name={`${id}-tool`} value={t.id} checked={tool === t.id} onChange={() => setTool(t.id)} className="sr-only" />
              {t.label}
            </label>
          ))}
        </div>
        {tool === "other" && (
          <input
            aria-label="Name of the AI or tool"
            value={other}
            onChange={(e) => setOther(e.target.value)}
            maxLength={60}
            placeholder="Which one?"
            className={field}
          />
        )}
      </fieldset>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${id}-p`} className={label}>
          Your prompt
        </label>
        <input id={`${id}-p`} value={prompt} onChange={(e) => setPrompt(e.target.value)} maxLength={4000} required minLength={2} className={field} />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${id}-r`} className={label}>
          What it said, with its links
        </label>
        <textarea
          id={`${id}-r`}
          value={result}
          onChange={(e) => setResult(e.target.value)}
          maxLength={20000}
          required
          minLength={2}
          rows={5}
          placeholder="Paste the answer and its links. No names or ID numbers."
          className={`${field} resize-y`}
        />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={busy} className="btn btn-mark">
          {busy ? "Checking links" : "Check sources and add"}
        </button>
        <span className={`text-xs ${dark ? "text-[#c9cfd8]" : "text-muted"}`}>Every link gets checked. Names and IDs are removed.</span>
      </div>
      {error && (
        <p role="alert" className="rounded-[10px] bg-bad-tint px-3 py-2 text-sm font-semibold text-bad">
          {error}
        </p>
      )}
      {done && (
        <div role="status" className="fade-in rounded-[10px] bg-ok-soft px-3 py-2.5 text-sm text-ok">
          <b>Added.</b>{" "}
          {done.noLinks
            ? "It had no links, so it shows as unsourced. Add links so others can check it."
            : `${done.check.ok ?? 0} ${done.check.ok === 1 ? "link" : "links"} opened${failed.length ? `, ${failed.length} failed` : ""}.`}
          {failed.length > 0 && (
            <ul className="mt-1.5 flex flex-col gap-1 text-bad">
              {failed.slice(0, 4).map((f) => (
                <li key={f.url} className="text-xs">
                  <span className="break-all">{f.url}</span>: {f.note}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </form>
  );
}
