"use client";

import { Fragment, useState, useTransition, type ReactNode } from "react";
import { ExpertiseBadge } from "@/components/ui";
import {
  DRAFT_KEYS,
  DRAFT_TITLES,
  type Citation,
  type Draft,
  type DraftKey,
  type DraftQuestion,
  type DraftSection,
  type TextKey,
} from "@/lib/drafts/types";
import { answerQuestion, confirmPart, saveSectionText, saveVisit, toggleTask } from "./draft-actions";

type Result = { ok: true; draft: Draft } | { ok: false; error: string };

const OUTCOME_TEXT: Record<string, string> = {
  worked: "Worked",
  stopped_working: "Stopped working",
  side_effects: "Side effects",
  waiting: "Waiting on results",
  unknown: "",
};

function monthName(ym: string) {
  if (!/^\d{4}-\d{2}$/.test(ym)) return "";
  return new Date(`${ym}-15T12:00:00`).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

/** A numbered citation. Hover or focus shows the document, page and the exact line. */
function CiteMark({ n, c }: { n: string; c?: Citation }) {
  if (!c)
    return (
      <sup className="text-[11px] text-subtle" aria-hidden="true">
        {n}
      </sup>
    );
  return (
    <span className="group relative inline-block align-[2px]">
      <button
        type="button"
        aria-label={`Source ${n}: ${c.doc}${c.page ? `, page ${c.page}` : ""}`}
        className="rounded-[5px] bg-brand-soft px-1.5 py-px font-sans text-[11px] font-bold text-brand transition-colors hover:bg-brand hover:text-white focus-visible:bg-brand focus-visible:text-white"
      >
        {n}
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-[calc(100%+8px)] left-1/2 z-10 w-64 -translate-x-1/2 translate-y-1 rounded-[10px] bg-ink p-3 text-left font-sans text-xs leading-snug text-white opacity-0 shadow-lg transition-[opacity,transform] duration-150 group-focus-within:translate-y-0 group-focus-within:opacity-100 group-hover:translate-y-0 group-hover:opacity-100"
      >
        <b className="mb-1 block text-[11px] font-semibold text-[#c9cfd8]">
          {c.doc}
          {c.page ? `, page ${c.page}` : ""}
        </b>
        {c.quote ? <>&ldquo;{c.quote}&rdquo;</> : "Open the document to see the line."}
      </span>
    </span>
  );
}

function withCites(text: string, cites: Citation[], keyBase: string) {
  return text.split(/(\[\d+\])/g).map((part, i) => {
    const m = part.match(/^\[(\d+)\]$/);
    if (!m) return <Fragment key={`${keyBase}-${i}`}>{part}</Fragment>;
    return <CiteMark key={`${keyBase}-${i}`} n={m[1]} c={cites.find((c) => c.n === Number(m[1]))} />;
  });
}

/** Section text with citations, and the sentences the AI is unsure about highlighted. */
function Body({ sec }: { sec: DraftSection }) {
  let parts: { text: string; unsure: boolean }[] = [{ text: sec.text, unsure: false }];
  for (const q of sec.questions) {
    parts = parts.flatMap((p) => {
      if (p.unsure || !p.text.includes(q.span)) return [p];
      const [a, ...rest] = p.text.split(q.span);
      return [
        { text: a, unsure: false },
        { text: q.span, unsure: true },
        { text: rest.join(q.span), unsure: false },
      ];
    });
  }
  return (
    <p className="mt-2 max-w-[66ch] whitespace-pre-line font-serif text-lg leading-[1.65] text-ink-2">
      {parts.map((p, i) =>
        p.unsure ? (
          <mark key={i} className="hl bg-transparent text-inherit" data-on="true">
            {withCites(p.text, sec.citations, `u${i}`)}
          </mark>
        ) : (
          <Fragment key={i}>{withCites(p.text, sec.citations, `t${i}`)}</Fragment>
        ),
      )}
    </p>
  );
}

function Ask({ q, onAnswer, busy }: { q: DraftQuestion; onAnswer: (a: "yes" | "no" | "unsure") => void; busy: boolean }) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2.5 rounded-[10px] border border-[#f0de94] bg-mark-tint px-3.5 py-3 text-sm">
      <b className="flex-[1_1_260px] font-semibold">{q.question}</b>
      <div className="flex gap-1.5" role="group" aria-label={q.question}>
        {(
          [
            ["yes", "Yes"],
            ["no", "No"],
            ["unsure", "Not sure"],
          ] as const
        ).map(([v, label]) => (
          <button
            key={v}
            type="button"
            disabled={busy}
            onClick={() => onAnswer(v)}
            className="min-h-9 rounded-full border border-[#d9c66a] bg-white px-3.5 text-[13px] font-semibold transition-[background-color,transform] hover:bg-[#fff3bf] active:scale-[0.97] disabled:opacity-50"
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function StepDraft({
  draft,
  setDraft,
  onNext,
  onBack,
}: {
  draft: Draft;
  setDraft: (d: Draft) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const [editing, setEditing] = useState<TextKey | null>(null);
  const [text, setText] = useState("");
  const [visit, setVisit] = useState(draft.visitDate ?? "");
  const [error, setError] = useState<{ key: string; msg: string } | null>(null);
  const [busyKey, setBusyKey] = useState("");
  const [, start] = useTransition();

  const run = (key: string, fn: () => Promise<Result>, after?: () => void) => {
    setBusyKey(key);
    setError(null);
    start(async () => {
      const r = await fn();
      setBusyKey("");
      if (r.ok) {
        setDraft(r.draft);
        after?.();
      } else setError({ key, msg: r.error });
    });
  };

  const done = DRAFT_KEYS.filter((k) => draft.confirmations[k]).length;
  const all = done === DRAFT_KEYS.length;

  const head = (key: DraftKey, actions: ReactNode) => (
    <div className="flex flex-wrap items-center gap-2.5">
      <h2 className="font-display text-[21px] font-medium">{DRAFT_TITLES[key]}</h2>
      <div className="ml-auto flex gap-1.5">
        {draft.confirmations[key] ? (
          <>
            <span className="pop-in inline-flex items-center rounded-full bg-ok-soft px-2.5 py-0.5 text-xs font-semibold text-ok">
              Confirmed
            </span>
            <button
              type="button"
              onClick={() => run(key, () => confirmPart(draft.id, key, false))}
              className="text-xs text-muted underline-offset-4 hover:text-ink hover:underline"
            >
              Undo
            </button>
          </>
        ) : (
          actions
        )}
      </div>
    </div>
  );

  const textSection = (key: TextKey) => {
    const sec: DraftSection = draft.sections[key] ?? { text: "", citations: [], questions: [] };
    const isEditing = editing === key;
    const busy = busyKey === key;
    return (
      <section key={key} aria-label={DRAFT_TITLES[key]} className="border-b border-line py-5 last:border-b-0">
        {head(
          key,
          !isEditing && (
            <>
              <button
                type="button"
                className="btn btn-secondary min-h-9 px-3 text-[13px]"
                onClick={() => {
                  setEditing(key);
                  setText(sec.text);
                }}
              >
                Edit
              </button>
              <button
                type="button"
                disabled={busy || sec.questions.length > 0}
                title={sec.questions.length ? "Answer the question below first" : undefined}
                className="btn btn-mark min-h-9 px-3 text-[13px]"
                onClick={() => run(key, () => confirmPart(draft.id, key, true))}
              >
                Looks right
              </button>
            </>
          ),
        )}
        {isEditing ? (
          <div className="mt-3 flex flex-col gap-2">
            <textarea
              aria-label={`Edit ${DRAFT_TITLES[key]}`}
              rows={Math.min(10, Math.max(3, Math.ceil(text.length / 80)))}
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="field resize-y font-serif text-[17px] leading-relaxed"
            />
            <p className="text-xs text-muted">
              Keep the numbers in brackets, like [1], so each fact still links to its document. Don&apos;t add names or ID
              numbers.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={busy}
                className="btn btn-primary min-h-9 px-3 text-[13px]"
                onClick={() => run(key, () => saveSectionText(draft.id, key, text), () => setEditing(null))}
              >
                {busy ? "Saving…" : "Save"}
              </button>
              <button type="button" className="btn btn-ghost min-h-9 px-3 text-[13px]" onClick={() => setEditing(null)}>
                Cancel
              </button>
            </div>
          </div>
        ) : sec.text ? (
          <Body sec={sec} />
        ) : (
          <p className="mt-2 font-serif text-lg text-subtle">The documents didn&apos;t say. Click Edit to add a sentence.</p>
        )}
        {!isEditing &&
          sec.questions.map((q) => (
            <Ask key={q.id} q={q} busy={busy} onAnswer={(a) => run(key, () => answerQuestion(draft.id, key, q.id, a))} />
          ))}
        {error?.key === key && (
          <p role="alert" className="mt-2 text-sm font-semibold text-bad">
            {error.msg}
          </p>
        )}
      </section>
    );
  };

  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_360px] xl:gap-10">
      <div className="flex min-w-0 flex-col gap-6">
        <div>
          <h1 className="font-display text-[34px] leading-[1.1] font-medium tracking-[-0.015em] sm:text-[40px]">
            Check what the AI wrote
          </h1>
          <p className="mt-3 max-w-[640px] text-base text-muted">
            Hover or tap a number to see the exact line it came from. Fix anything that&apos;s wrong, then confirm each part.
          </p>
        </div>

        <article className="sheet px-5 py-7 sm:px-10 sm:py-9">
          <div className="mb-1.5 flex items-center gap-3.5 border-b border-line pb-4 text-sm">
            <b aria-live="polite">
              {done} of {DRAFT_KEYS.length} confirmed
            </b>
            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#e4e7e4]" aria-hidden="true">
              <i
                className="block h-full rounded-full bg-ok transition-[width] duration-500 ease-out"
                style={{ width: `${(done / DRAFT_KEYS.length) * 100}%` }}
              />
            </span>
          </div>

          {textSection("plain")}
          {textSection("treatments")}
          {textSection("now")}

          <section aria-label={DRAFT_TITLES.visit} className="border-b border-line py-5">
            {head(
              "visit",
              <>
                <button
                  type="button"
                  disabled={busyKey === "visit"}
                  className="btn btn-secondary min-h-9 px-3 text-[13px]"
                  onClick={() => {
                    setVisit("");
                    run("visit", () => saveVisit(draft.id, null));
                  }}
                >
                  No visit booked yet
                </button>
                <button
                  type="button"
                  disabled={busyKey === "visit" || !visit}
                  className="btn btn-mark min-h-9 px-3 text-[13px]"
                  onClick={() => run("visit", () => saveVisit(draft.id, visit))}
                >
                  Save
                </button>
              </>,
            )}
            <p className="mt-2 font-serif text-lg text-ink-2">
              {draft.confirmations.visit
                ? draft.visitDate
                  ? new Date(`${draft.visitDate}T12:00:00`).toLocaleDateString("en-US", {
                      weekday: "long",
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })
                  : "No visit booked yet."
                : draft.visitDate
                  ? "The documents mention this date. Check it's right."
                  : "Not in the documents. Adding it helps volunteers plan."}
            </p>
            {!draft.confirmations.visit && (
              <div className="mt-2.5 flex flex-wrap items-center gap-2.5">
                <input
                  type="date"
                  aria-label="Next doctor visit"
                  value={visit}
                  onChange={(e) => setVisit(e.target.value)}
                  className="field max-w-52"
                />
                <span className="text-[13px] text-muted">Only the date is shared</span>
              </div>
            )}
            {error?.key === "visit" && (
              <p role="alert" className="mt-2 text-sm font-semibold text-bad">
                {error.msg}
              </p>
            )}
          </section>

          {textSection("wants")}
        </article>

        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className="btn btn-mark" disabled={!all} onClick={onNext}>
            Next: privacy check
          </button>
          <button type="button" className="btn btn-ghost" onClick={onBack}>
            Back to documents
          </button>
          <p className="text-[13px] text-muted">{all ? "Every part is confirmed." : "Confirm all 5 parts to continue."}</p>
        </div>
      </div>

      <aside className="flex flex-col gap-5 xl:sticky xl:top-6 xl:self-start">
        <section aria-labelledby="tl-h" className="panel p-5">
          <h2 id="tl-h" className="text-[15px] font-bold">
            Added to &ldquo;What we tried&rdquo;
          </h2>
          <p className="mt-1 mb-3.5 text-[13px] text-muted">Built from the documents. You can edit it after the case opens.</p>
          {draft.treatments.length === 0 ? (
            <p className="text-sm text-subtle">No treatments found in the documents.</p>
          ) : (
            <ol className="relative pl-[22px] before:absolute before:top-1.5 before:bottom-1.5 before:left-[5px] before:w-0.5 before:bg-[#d5dad5]">
              {draft.treatments.map((t, i) => (
                <li
                  key={t.title + i}
                  className={`relative pb-3 text-sm before:absolute before:top-[5px] before:-left-[21px] before:h-2.5 before:w-2.5 before:rounded-full before:border-2 before:bg-white ${
                    t.outcome === "stopped_working" ? "before:border-bad" : t.outcome === "waiting" ? "before:border-brand" : "before:border-ok"
                  }`}
                >
                  {t.title}
                  {OUTCOME_TEXT[t.outcome] ? <span className="text-muted">, {OUTCOME_TEXT[t.outcome].toLowerCase()}</span> : null}
                  <small className="block text-xs text-muted">
                    {[monthName(t.started), monthName(t.ended)].filter(Boolean).join(" to ") || "Date not given"}
                    {t.note ? `. ${t.note}` : ""}
                  </small>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section aria-labelledby="tasks-h" className="panel p-5">
          <h2 id="tasks-h" className="text-[15px] font-bold">
            Tasks the AI suggests
          </h2>
          <p className="mt-1 mb-2 text-[13px] text-muted">
            Untick any you don&apos;t want. Volunteers with the right background see them first.
          </p>
          {draft.suggestedTasks.length === 0 ? (
            <p className="text-sm text-subtle">No tasks suggested. You can add tasks after the case opens.</p>
          ) : (
            <ul className="flex flex-col">
              {draft.suggestedTasks.map((t) => (
                <li key={t.id}>
                  <label className="-mx-2.5 flex cursor-pointer items-start gap-3 rounded-[10px] p-2.5 transition-colors hover:bg-paper">
                    <input
                      type="checkbox"
                      checked={t.picked}
                      onChange={(e) => {
                        const picked = e.target.checked;
                        setDraft({
                          ...draft,
                          suggestedTasks: draft.suggestedTasks.map((x) => (x.id === t.id ? { ...x, picked } : x)),
                        });
                        run(`task-${t.id}`, () => toggleTask(draft.id, t.id, picked));
                      }}
                      className="mt-0.5 h-5 w-5 flex-none accent-ink"
                    />
                    <span className="flex flex-col gap-1">
                      <b className="text-sm font-semibold">{t.title}</b>
                      <ExpertiseBadge expertise={t.expertise} />
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </section>
      </aside>
    </div>
  );
}
