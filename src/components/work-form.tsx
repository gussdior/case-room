"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { onAddToWork } from "./ai-helper";
import { FormMessage, type ActionResult, type FormAction } from "./forms";

type Check = { url: string; ok: boolean; note: string };

const toList = (s: string) =>
  s
    .split(/\s+/)
    .map((x) => x.trim())
    .filter(Boolean);

/** Write up the work, check every source, then submit for a second person to check. */
const demoAction: FormAction = async () => ({ error: "Sample case: submitting works on real cases once you sign in." });

export function WorkForm({ action, updating, demo }: { action?: FormAction; updating: boolean; demo?: boolean }) {
  const [state, formAction, pending] = useActionState<ActionResult, FormData>(action ?? demoAction, undefined);
  const [body, setBody] = useState("");
  const [sources, setSources] = useState("");
  const [aiAssisted, setAiAssisted] = useState(false);
  const [checks, setChecks] = useState<Check[] | null>(null);
  const [checking, setChecking] = useState(false);
  const [checkedFor, setCheckedFor] = useState("");
  const [flash, setFlash] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(
    () =>
      onAddToWork(({ text, sources: urls }) => {
        setBody((b) => (b.trim() ? `${b.trim()}\n\n${text}` : text));
        setSources((s) => {
          const have = new Set(toList(s));
          const add = urls.filter((u) => !have.has(u));
          return [...toList(s), ...add].join("\n");
        });
        setAiAssisted(true);
        setFlash(true);
        setTimeout(() => setFlash(false), 900);
      }),
    [],
  );

  // Clear the form after a successful submit (adjusting state during render, not in an effect).
  const [seen, setSeen] = useState(state);
  if (state !== seen) {
    setSeen(state);
    if (state?.ok) {
      setBody("");
      setSources("");
      setAiAssisted(false);
      setChecks(null);
    }
  }

  const list = toList(sources);
  const upToDate = checks !== null && checkedFor === list.join("\n");
  const bad = upToDate ? (checks ?? []).filter((c) => !c.ok) : [];
  const ready = upToDate && bad.length === 0 && list.length > 0 && body.trim().length >= 20;

  async function runCheck() {
    if (list.length === 0) return;
    setChecking(true);
    try {
      if (demo) {
        setChecks(list.map((url) => ({ url, ok: true, note: "Sample case: not really checked." })));
      } else {
        const res = await fetch("/api/ai/check-sources", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ urls: list }),
        });
        const data = (await res.json()) as { results?: Check[]; error?: string };
        setChecks(data.results ?? list.map((url) => ({ url, ok: false, note: data.error ?? "Couldn't check this link." })));
      }
      setCheckedFor(list.join("\n"));
    } catch {
      setChecks(list.map((url) => ({ url, ok: false, note: "Couldn't check this link. Try again." })));
      setCheckedFor(list.join("\n"));
    } finally {
      setChecking(false);
    }
  }

  const removeSource = (url: string) => {
    const next = list.filter((u) => u !== url).join("\n");
    setSources(next);
  };

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-4">
      <div>
        <label htmlFor="work-body" className="text-sm font-semibold">
          {updating ? "Your updated write up" : "What you found"}
        </label>
        <p className="text-[13px] text-muted">Plain words a family member can read. Someone else checks it before it joins the brief.</p>
      </div>
      <textarea
        id="work-body"
        name="body"
        rows={8}
        required
        minLength={20}
        maxLength={10000}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Start writing, or use Add to my work in the AI panel."
        className={`field resize-y font-serif text-lg leading-relaxed transition-[background-color,border-color,box-shadow] ${flash ? "bg-mark-tint" : ""}`}
      />
      {aiAssisted && (
        <label className="flex min-h-11 items-center gap-2.5 self-start rounded-full bg-brand-soft px-3.5 text-[13px] font-semibold text-brand">
          <input type="checkbox" name="ai_assisted" checked readOnly className="accent-brand" />
          AI assisted. Checkers will see this tag.
        </label>
      )}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="work-sources" className="text-sm font-semibold">
          Sources, one link per line
        </label>
        <textarea
          id="work-sources"
          name="sources"
          rows={3}
          required
          value={sources}
          onChange={(e) => setSources(e.target.value)}
          placeholder="https://clinicaltrials.gov/study/NCT..."
          className="field resize-y text-sm"
        />
      </div>

      {upToDate && checks && checks.length > 0 && (
        <ul className="flex flex-col gap-2" aria-label="Source check">
          {checks.map((c) => (
            <li
              key={c.url}
              className={`flex flex-wrap items-center gap-3 rounded-[10px] border px-3 py-2.5 text-sm ${
                c.ok ? "border-line" : "shake border-bad-line bg-bad-tint"
              }`}
            >
              <span
                aria-hidden="true"
                className={`grid h-5 w-5 flex-none place-items-center rounded-full text-xs font-bold ${
                  c.ok ? "bg-ok-soft text-ok" : "bg-bad-soft text-bad"
                }`}
              >
                {c.ok ? "✓" : "!"}
              </span>
              <span className="min-w-0 flex-1 truncate">{c.url.replace(/^https?:\/\//, "")}</span>
              <span className={`text-[13px] ${c.ok ? "text-ok" : "font-semibold text-bad"}`}>{c.note}</span>
              {!c.ok && (
                <button type="button" onClick={() => removeSource(c.url)} className="btn btn-ghost min-h-9 px-2.5 text-[13px]">
                  Remove link
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-3 border-t border-line pt-5">
        {ready ? (
          <button type="submit" className="btn btn-primary" disabled={pending}>
            {pending ? "Submitting" : "Submit for a check"}
          </button>
        ) : (
          <button type="button" className="btn btn-primary" onClick={runCheck} disabled={checking || list.length === 0 || body.trim().length < 20}>
            {checking ? "Checking sources" : "Check sources"}
          </button>
        )}
        <p className="min-w-[200px] flex-1 text-[13px] text-muted">
          {bad.length > 0
            ? `Fix or remove ${bad.length === 1 ? "the flagged link" : `the ${bad.length} flagged links`} first. Then check again.`
            : ready
              ? "Sources look good. A person who didn't write this checks it next."
              : "We check every link first: closed trials and broken pages get flagged."}
        </p>
      </div>
      <FormMessage state={state} />
    </form>
  );
}
