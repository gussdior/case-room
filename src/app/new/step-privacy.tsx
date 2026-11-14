"use client";

import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { ID_LABEL, type Draft, type DraftDoc, type IdType } from "@/lib/drafts/types";
import { hideFound, savePrivacy, scanPrivacy } from "./draft-actions";
import { DeleteFiles } from "./step-docs";

type ScanItem = { part: string; kinds: string[] };

export function StepPrivacy({
  draft,
  docs,
  setDraft,
  setDocs,
  onNext,
}: {
  draft: Draft;
  docs: DraftDoc[];
  setDraft: (d: Draft) => void;
  setDocs: Dispatch<SetStateAction<DraftDoc[]>>;
  onNext: () => void;
}) {
  const [scan, setScan] = useState<ScanItem[] | null>(null);
  const [scanError, setScanError] = useState("");
  const [sure, setSure] = useState(draft.privacyOk);
  const [keep, setKeep] = useState(draft.keepFiles);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let live = true;
    scanPrivacy(draft.id).then((r) => {
      if (!live) return;
      if (r.ok) setScan(r.items);
      else setScanError(r.error);
    });
    return () => {
      live = false;
    };
  }, [draft.id]);

  const ids = Object.entries(draft.identifiers ?? {}).filter(([, v]) => (v ?? 0) > 0) as [IdType, number][];
  const total = ids.reduce((a, [, v]) => a + v, 0);

  return (
    <div className="flex max-w-[760px] flex-col gap-6">
      <div>
        <h1 className="font-display text-[34px] leading-[1.1] font-medium tracking-[-0.015em] sm:text-[40px]">Privacy check</h1>
        <p className="mt-3 max-w-[620px] text-base text-muted">
          One last look before volunteers can read the case. Only people you approve will ever see it.
        </p>
      </div>

      <section aria-labelledby="hidden-h" className="rounded-[14px] bg-ink p-5 text-white sm:p-6">
        <h2 id="hidden-h" className="text-[15px] font-bold">
          {total > 0 ? `The AI hid ${total} names and IDs from your documents` : "No names or IDs were found in your documents"}
        </h2>
        {ids.length > 0 && (
          <ul className="mt-3 grid gap-x-6 gap-y-1.5 text-sm text-[#c9cfd8] sm:grid-cols-2">
            {ids.map(([k, v]) => (
              <li key={k} className="flex items-center gap-2">
                <i aria-hidden="true" className="inline-block h-2 w-10 rounded-sm bg-[#0e141b] ring-1 ring-[#26303d]" />
                {ID_LABEL[k]}: {v}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="scan-h" className="panel p-5 sm:p-6" aria-live="polite">
        <h2 id="scan-h" className="text-[15px] font-bold">
          Final scan of the draft
        </h2>
        {scanError ? (
          <p role="alert" className="mt-2 text-sm font-semibold text-bad">
            {scanError}
          </p>
        ) : scan === null ? (
          <p className="mt-2 text-sm text-muted">Checking every word that will be shared…</p>
        ) : scan.length === 0 ? (
          <p className="mt-2 flex items-center gap-2 text-sm text-ok">
            <span aria-hidden="true" className="pop-in grid h-5 w-5 place-items-center rounded-full bg-ok-soft text-xs font-bold">
              ✓
            </span>
            Nothing that looks like a name, birth date, phone, email, address or ID number.
          </p>
        ) : (
          <div className="mt-3 flex flex-col gap-3">
            <ul className="flex flex-col gap-1.5 text-sm">
              {scan.map((s) => (
                <li key={s.part} className="rounded-[10px] border border-bad-line bg-bad-tint px-3 py-2">
                  <b>{s.part}</b>: looks like a {s.kinds.join(" and a ")}
                </li>
              ))}
            </ul>
            <button
              type="button"
              disabled={busy}
              className="btn btn-primary self-start"
              onClick={async () => {
                setBusy(true);
                const r = await hideFound(draft.id);
                if (r.ok) {
                  setDraft(r.draft);
                  const again = await scanPrivacy(draft.id);
                  if (again.ok) setScan(again.items);
                } else setError(r.error);
                setBusy(false);
              }}
            >
              {busy ? "Hiding…" : "Hide them"}
            </button>
          </div>
        )}
      </section>

      <fieldset className="panel flex flex-col gap-3 p-5 sm:p-6">
        <legend className="sr-only">Your original files</legend>
        <p className="text-[15px] font-bold">Your original files</p>
        {docs.length === 0 ? (
          <p className="text-sm text-muted">Already deleted. Only the draft text is kept.</p>
        ) : (
          <>
            <label className="flex cursor-pointer items-start gap-3 text-sm">
              <input type="radio" name="keep" checked={keep} onChange={() => setKeep(true)} className="mt-0.5 h-5 w-5 accent-ink" />
              <span>
                <b className="font-semibold">Keep them private to me.</b> Nobody else can open them. Delete them any time.
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-3 text-sm">
              <input type="radio" name="keep" checked={!keep} onChange={() => setKeep(false)} className="mt-0.5 h-5 w-5 accent-ink" />
              <span>
                <b className="font-semibold">Delete them when the case opens.</b> The case keeps the text you confirmed.
              </span>
            </label>
            <DeleteFiles draftId={draft.id} onDone={() => setDocs([])} />
          </>
        )}
      </fieldset>

      <label className="flex cursor-pointer items-start gap-3 rounded-[12px] border border-line bg-white p-4 text-[15px] font-semibold transition-colors hover:border-line-2">
        <input
          type="checkbox"
          checked={sure}
          onChange={(e) => setSure(e.target.checked)}
          className="mt-0.5 h-5 w-5 flex-none accent-ink"
        />
        There are no names, birth dates or ID numbers in this case.
      </label>

      {error && (
        <p role="alert" className="text-sm font-semibold text-bad">
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="btn btn-mark"
          disabled={!sure || busy || scan === null || scan.length > 0}
          onClick={async () => {
            setBusy(true);
            setError("");
            const r = await savePrivacy(draft.id, true, docs.length === 0 ? true : keep);
            setBusy(false);
            if (r.ok) {
              setDraft(r.draft);
              onNext();
            } else setError(r.error);
          }}
        >
          Next: open the case
        </button>
        <p className="text-[13px] text-muted">
          {scan && scan.length > 0 ? "Hide what the scan found first." : !sure ? "Tick the box to continue." : "Nothing is shared yet."}
        </p>
      </div>
    </div>
  );
}
