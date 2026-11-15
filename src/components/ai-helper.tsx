"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { postMessage } from "@/app/case-actions";
import { onReusePrompt } from "./run-actions";
import { safeHref } from "@/lib/safe-href";
import type { Source } from "@/lib/types";

export type AiTurn = {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources: Source[];
  mine?: boolean;
  /** Saved without the server check, so it may not really be from the built in AI. */
  unverified?: boolean;
};

const ADD_EVENT = "caseroom:add-to-work";
export type AddToWorkDetail = { text: string; sources: string[] };

/** Lets the AI panel drop text into the work form on the same page. */
export function addToWork(detail: AddToWorkDetail) {
  window.dispatchEvent(new CustomEvent<AddToWorkDetail>(ADD_EVENT, { detail }));
}
export function onAddToWork(fn: (d: AddToWorkDetail) => void) {
  const h = (e: Event) => fn((e as CustomEvent<AddToWorkDetail>).detail);
  window.addEventListener(ADD_EVENT, h);
  return () => window.removeEventListener(ADD_EVENT, h);
}

const CITE = /\[(https?:\/\/[^\]\s]+)\]/g;

/** Plain text with [url] citations turned into numbered source links. */
function Answer({ text, sources, streaming }: { text: string; sources: Source[]; streaming?: boolean }) {
  const order: string[] = [];
  const num = (url: string) => {
    let i = order.indexOf(url);
    if (i === -1) i = order.push(url) - 1;
    return i + 1;
  };
  const clean = text.replace(/\*\*(.+?)\*\*/g, "$1");
  const parts: ReactNode[] = [];
  let last = 0;
  for (const m of clean.matchAll(CITE)) {
    parts.push(clean.slice(last, m.index));
    const url = m[1];
    const src = sources.find((s) => s.url === url);
    parts.push(
      <sup key={`${m.index}-${url}`}>
        <a
          href={safeHref(url)}
          target="_blank"
          rel="noopener noreferrer nofollow"
          title={src?.title ?? url}
          className="rounded-[5px] bg-brand-soft px-1.5 py-px font-sans text-[11px] font-bold no-underline transition-colors hover:bg-brand hover:text-white"
        >
          {num(url)}
        </a>
      </sup>,
    );
    last = (m.index ?? 0) + m[0].length;
  }
  parts.push(clean.slice(last));
  return (
    <div className="font-serif text-[17px] leading-relaxed whitespace-pre-line text-ink-2">
      {parts}
      {streaming && <span className="caret" aria-hidden="true" />}
    </div>
  );
}

function SourceChips({ sources }: { sources: Source[] }) {
  if (sources.length === 0) return null;
  return (
    <ul className="mt-3 flex flex-col gap-1.5" aria-label="Sources">
      {sources.map((s) => (
        <li key={s.url}>
          <a
            href={safeHref(s.url)}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="flex items-center gap-2 rounded-[10px] border border-line px-3 py-2 text-[13px] text-ink no-underline transition-colors hover:border-brand-line hover:bg-brand-tint hover:text-ink"
          >
            <span
              className={`rounded-full px-2 py-px text-[11px] font-semibold whitespace-nowrap ${
                s.kind === "preprint" ? "bg-mark-soft text-mark-text" : s.kind === "trial" ? "bg-ok-soft text-ok" : "bg-brand-soft text-brand"
              }`}
            >
              {s.kind === "preprint" ? "Preprint, not peer reviewed" : s.kind === "trial" ? "Trial" : s.kind === "paper" ? "Paper" : "Link"}
            </span>
            <span className="min-w-0 flex-1 truncate">{s.title || s.url}</span>
          </a>
        </li>
      ))}
    </ul>
  );
}

const urls = (sources: Source[]) => sources.map((s) => s.url);

/** The question from an answer worth bringing to the doctor, if it has one. */
function questionIn(text: string): string | null {
  const q = text
    .replace(CITE, "")
    .split(/(?<=[.?!])\s+|\n/)
    .map((s) => s.trim().replace(/^[-*\d.)\s"]+|"$/g, ""))
    .find((s) => s.endsWith("?") && s.length > 12);
  return q ?? null;
}

export function AiHelper({
  caseId,
  taskId,
  leadId,
  taskTitle,
  demo,
  canWrite,
  initial,
  prefill,
}: {
  caseId: string;
  /** Start with this question in the box and the cursor in it. */
  prefill?: string;
  /** Either a task or a lead. */
  taskId?: string;
  leadId?: string;
  taskTitle: string;
  demo: boolean;
  /** Owner or helper: can drop answers into the work form. */
  canWrite: boolean;
  initial: AiTurn[];
}) {
  const onLead = !taskId && !!leadId;
  const router = useRouter();
  const [turns, setTurns] = useState<AiTurn[]>(initial);
  const [q, setQ] = useState(prefill ?? "");
  useEffect(() => {
    if (!prefill) return;
    const el = document.getElementById("ai-q") as HTMLInputElement | HTMLTextAreaElement | null;
    el?.focus();
    el?.setSelectionRange?.(prefill.length, prefill.length);
  }, [prefill]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(
    () =>
      onReusePrompt((p) => {
        setQ(p);
        requestAnimationFrame(() => document.getElementById("ai-q")?.focus());
      }),
    [],
  );

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  const short = taskTitle.length > 70 ? taskTitle.slice(0, 67) + "..." : taskTitle;
  const starters = onLead
    ? [
        "What would make this idea worth asking her doctor about?",
        "Find trials, papers or preprints on this idea that fit her case",
        "Has the team already ruled out anything like this?",
      ]
    : [
        `What should I look at first for "${short}"?`,
        "Find open trials or recent papers that match this case",
        "Turn what we know so far into questions for the doctor",
      ];

  async function ask(question: string) {
    const text = question.trim();
    if (!text || busy) return;
    setNotice(null);
    if (demo) {
      setNotice("This is a sample case. The AI helper works on real cases once you sign in.");
      return;
    }
    const userTurn: AiTurn = { id: `u-${Date.now()}`, role: "user", content: text, sources: [], mine: true };
    const aiId = `a-${Date.now()}`;
    setTurns((t) => [...t, userTurn, { id: aiId, role: "assistant", content: "", sources: [] }]);
    setQ("");
    setBusy(true);
    setStatus("Reading the case");
    const patch = (fn: (a: AiTurn) => AiTurn) => setTurns((t) => t.map((x) => (x.id === aiId ? fn(x) : x)));
    try {
      const res = await fetch("/api/ai/task", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(onLead ? { leadId, question: text } : { taskId, question: text }),
      });
      if (!res.ok || !res.body) {
        const err = (await res.json().catch(() => null)) as { error?: string } | null;
        setTurns((t) => t.filter((x) => x.id !== aiId));
        setNotice(
          res.status === 503
            ? "The AI helper isn't switched on yet. The site owner still needs to add the AI key."
            : (err?.error ?? "The AI helper didn't answer. Try again in a minute."),
        );
        return;
      }
      let saved = false;
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let cut: number;
        while ((cut = buf.indexOf("\n\n")) !== -1) {
          const chunk = buf.slice(0, cut);
          buf = buf.slice(cut + 2);
          const ev = chunk.match(/^event: (.+)$/m)?.[1];
          const raw = chunk.match(/^data: (.*)$/m)?.[1];
          if (!ev || !raw) continue;
          const data = JSON.parse(raw) as { text?: string; sources?: Source[]; error?: string };
          if (ev === "text") {
            setStatus(null);
            patch((a) => ({ ...a, content: a.content + (data.text ?? "") }));
          } else if (ev === "status") setStatus(data.text ?? null);
          else if (ev === "sources") patch((a) => ({ ...a, sources: data.sources ?? [] }));
          else if (ev === "error") setNotice(data.error ?? "Something went wrong.");
          else if (ev === "run" && onLead) saved = true;
        }
      }
      if (saved) router.refresh();
    } catch {
      setNotice("Lost the connection to the AI helper. Try again.");
    } finally {
      setBusy(false);
      setStatus(null);
      setTurns((t) => t.filter((x) => !(x.id === aiId && !x.content)));
      requestAnimationFrame(() => endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
    }
  }

  async function post(body: string, toTask: boolean, sources: Source[], done: string) {
    if (demo) {
      setNotice("This is a sample case. Sharing works on real cases once you sign in.");
      return;
    }
    const fd = new FormData();
    fd.set("body", body.slice(0, 4000));
    if (sources[0]) fd.set("source", sources[0].url);
    const r = await postMessage(caseId, toTask && taskId ? taskId : null, undefined, fd);
    if (r?.error) setNotice(r.error);
    else setToast(done);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-1.5 text-xs text-muted">
        {["Knows this case summary", "Searches ClinicalTrials.gov", "Searches PubMed", "Searches preprints"].map((k) => (
          <span key={k} className="rounded-full bg-paper px-2.5 py-1">
            {k}
          </span>
        ))}
      </div>

      {turns.length === 0 && (
        <div className="flex flex-col gap-2">
          {starters.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => ask(s)}
              disabled={busy}
              className="flex min-h-11 items-center gap-2.5 rounded-[10px] border border-line bg-white px-3.5 py-2.5 text-left text-sm font-medium text-ink transition-[border-color,background-color,transform] duration-150 hover:translate-x-0.5 hover:border-brand-line hover:bg-brand-tint active:scale-[0.99]"
            >
              <i aria-hidden="true" className="h-1.5 w-1.5 flex-none rounded-full bg-mark shadow-[0_0_0_3px_var(--color-mark-soft)]" />
              {s}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-4" aria-live="polite">
        {turns.map((t, i) =>
          t.role === "user" ? (
            <div key={t.id} className="fade-in ml-auto w-fit max-w-[85%] rounded-[14px_14px_4px_14px] bg-ink px-3.5 py-2.5 text-sm text-white">
              {t.content}
            </div>
          ) : (
            <div key={t.id} className="fade-in">
              {t.unverified && (
                <p className="mb-1 text-xs font-semibold text-muted">Not verified: saved without the server check</p>
              )}
              <Answer text={t.content} sources={t.sources} streaming={busy && i === turns.length - 1} />
              <SourceChips sources={t.sources} />
              {!(busy && i === turns.length - 1) && t.content && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {canWrite && !onLead && (
                    <button
                      type="button"
                      className="btn btn-mark"
                      onClick={() => {
                        addToWork({ text: t.content.replace(CITE, "").replace(/\*\*/g, "").trim(), sources: urls(t.sources) });
                        setToast("Added to your work. It's tagged AI assisted.");
                      }}
                    >
                      Add to my work
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      const prev = turns[i - 1]?.content ?? "";
                      const question = questionIn(t.content) ?? prev;
                      post(`Question for the doctor: ${question}`, false, t.sources, "Posted to the case for the questions list.");
                    }}
                  >
                    Add question for the doctor
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() =>
                      post(
                        `From the AI helper${onLead ? ` on "${short}"` : ""}:\n${t.content.replace(CITE, "").trim()}`,
                        !onLead,
                        t.sources,
                        onLead ? "Shared in the case discussion." : "Shared in the task discussion.",
                      )
                    }
                  >
                    Share in discussion
                  </button>
                </div>
              )}
            </div>
          ),
        )}
        {status && (
          <p role="status" className="flex items-center gap-2 text-[13px] text-muted">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-ok" aria-hidden="true" />
            {status}
          </p>
        )}
        <div ref={endRef} />
      </div>

      {notice && (
        <p role="alert" className="fade-in rounded-[10px] border border-mark-edge bg-mark-tint px-3.5 py-2.5 text-sm text-mark-text">
          {notice}
        </p>
      )}
      {toast && (
        <p role="status" className="fade-in rounded-[10px] bg-ok-soft px-3.5 py-2.5 text-sm font-semibold text-ok">
          {toast}
        </p>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(q);
        }}
        className="flex items-center gap-2 rounded-xl border border-line-2 py-1.5 pr-1.5 pl-3.5 transition-[border-color,box-shadow] focus-within:border-brand focus-within:shadow-[0_0_0_3px_#d9def5]"
      >
        <label htmlFor="ai-q" className="sr-only">
          {onLead ? "Ask AI about this lead" : "Ask AI about this task"}
        </label>
        <input
          id="ai-q"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          maxLength={4000}
          placeholder={onLead ? "Ask about this lead" : "Ask about this task"}
          className="min-h-10 flex-1 bg-transparent text-[15px] outline-none"
          autoComplete="off"
        />
        <button type="submit" className="btn btn-primary" disabled={busy || q.trim().length < 2}>
          {busy ? "Working" : "Ask"}
        </button>
      </form>
      <p className="text-[13px] text-muted">
        The AI helps you research. It does not give treatment advice, and every answer shows its sources.{" "}
        {onLead ? "Answers are saved as AI runs everyone on the case can see." : "Everyone on the case can read this chat."} Never type names or ID
        numbers.
      </p>
    </div>
  );
}
