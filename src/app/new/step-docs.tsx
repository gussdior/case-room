"use client";

import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { browserClient } from "@/lib/supabase/browser";
import {
  ACCEPTED_MIME,
  FACT_LABEL,
  ID_LABEL,
  MAX_BYTES,
  MAX_FILES,
  type Draft,
  type DraftDoc,
  type FactField,
  type IdType,
} from "@/lib/drafts/types";
import { deleteMyFiles, deleteOneFile } from "./draft-actions";

const KINDS = ["Pathology report", "Scan reports", "Gene test results", "Doctor's notes", "Lab results", "Medication list"];
const RAIL_FIELDS: FactField[] = [
  "cancer_type",
  "stage",
  "biomarker",
  "diagnosis_date",
  "treatment",
  "latest_scan",
  "current_status",
  "next_visit",
];
const READ_AT_ONCE = 3;

type Local = { key: string; name: string; error?: string; uploading: boolean };

function mimeOf(f: File): string {
  if (f.type) return f.type === "image/jpg" ? "image/jpeg" : f.type;
  const ext = f.name.split(".").pop()?.toLowerCase();
  return ext === "pdf" ? "application/pdf" : ext === "heic" ? "image/heic" : ext === "heif" ? "image/heif" : "";
}

/** Photos get resized to what the AI needs, which also keeps uploads fast. HEIC turns into JPEG where the browser can. */
async function prepare(file: File): Promise<{ blob: Blob; mime: string; name: string }> {
  const mime = mimeOf(file);
  if (!mime.startsWith("image/")) return { blob: file, mime, name: file.name };
  const big = file.size > 3_500_000;
  const heic = mime === "image/heic" || mime === "image/heif";
  if (!big && !heic) return { blob: file, mime, name: file.name };
  try {
    const url = URL.createObjectURL(file);
    const img = await new Promise<HTMLImageElement>((ok, bad) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = bad;
      i.src = url;
    });
    const scale = Math.min(1, 2400 / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(url);
    const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, "image/jpeg", 0.85));
    if (!blob) throw new Error("no blob");
    return { blob, mime: "image/jpeg", name: file.name.replace(/\.(heic|heif|png|webp|jpe?g)$/i, "") + ".jpg" };
  } catch {
    // This browser can't open the photo; upload it as it is and the reader explains what to do.
    return { blob: file, mime, name: file.name };
  }
}

function safeName(n: string) {
  return n.normalize("NFKD").replace(/[^\w.-]+/g, "_").slice(-80) || "file";
}

function DocIcon({ mime }: { mime: string }) {
  return (
    <div
      aria-hidden="true"
      className="relative grid h-12 w-10 flex-none place-items-end justify-center rounded-md border border-line bg-paper pb-1.5 text-[9px] font-bold text-muted before:absolute before:top-2 before:right-2 before:left-2 before:h-0.5 before:bg-[#d5dad5] before:shadow-[0_6px_0_#d5dad5,0_12px_0_#d5dad5]"
    >
      {mime === "application/pdf" ? "PDF" : "IMG"}
    </div>
  );
}

export function StepDocs({
  userId,
  draft,
  docs,
  setDocs,
  onComposed,
  onNext,
}: {
  userId: string;
  draft: Draft;
  docs: DraftDoc[];
  setDocs: Dispatch<SetStateAction<DraftDoc[]>>;
  onComposed: (d: Draft) => void;
  onNext: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [local, setLocal] = useState<Local[]>([]);
  const [dragging, setDragging] = useState(false);
  const [notice, setNotice] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [composing, setComposing] = useState(false);
  const [composeError, setComposeError] = useState("");
  const [aiOff, setAiOff] = useState("");
  const queue = useRef<string[]>([]);
  const active = useRef(0);

  const setDoc = (doc: DraftDoc) => setDocs((all) => all.map((d) => (d.id === doc.id ? doc : d)));

  const pump = () => {
    while (active.current < READ_AT_ONCE && queue.current.length) {
      const id = queue.current.shift()!;
      active.current++;
      setDocs((all) => all.map((d) => (d.id === id ? { ...d, status: "reading", note: null } : d)));
      setErrors((e) => ({ ...e, [id]: "" }));
      fetch(`/api/drafts/${draft.id}/read-document`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ documentId: id }),
      })
        .then(async (res) => {
          const body = (await res.json().catch(() => ({}))) as { doc?: DraftDoc; error?: string };
          if (body.doc) setDoc(body.doc);
          if (res.status === 503) {
            setAiOff(body.error ?? "The AI reader isn't switched on yet.");
            setDocs((all) => all.map((d) => (d.id === id ? { ...d, status: "uploaded" } : d)));
          } else if (!res.ok || body.error) {
            setErrors((e) => ({ ...e, [id]: body.error ?? "Couldn't read this file. Try again." }));
            if (!body.doc) setDocs((all) => all.map((d) => (d.id === id ? { ...d, status: "uploaded" } : d)));
          }
        })
        .catch(() => {
          setErrors((e) => ({ ...e, [id]: "Lost the connection. Try again." }));
          setDocs((all) => all.map((d) => (d.id === id ? { ...d, status: "uploaded" } : d)));
        })
        .finally(() => {
          active.current--;
          pump();
        });
    }
  };
  const read = (id: string) => {
    if (!queue.current.includes(id)) queue.current.push(id);
    pump();
  };

  // Pick up files that were uploaded earlier but never read (closed tab, lost connection).
  useEffect(() => {
    docs.filter((d) => d.status === "uploaded" || d.status === "reading").forEach((d) => read(d.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const add = async (files: FileList | File[]) => {
    setNotice("");
    const list = Array.from(files);
    const room = MAX_FILES - docs.length - local.filter((l) => l.uploading).length;
    if (list.length > room) setNotice(`You can add up to ${MAX_FILES} files. ${room > 0 ? `Adding the first ${room}.` : ""}`);
    const supabase = browserClient();
    await Promise.all(
      list.slice(0, Math.max(0, room)).map(async (file) => {
        const key = `${file.name}-${file.size}-${Math.random()}`;
        const fail = (error: string) =>
          setLocal((l) => l.map((x) => (x.key === key ? { ...x, error, uploading: false } : x)));
        setLocal((l) => [...l, { key, name: file.name, uploading: true }]);
        const mime = mimeOf(file);
        if (!ACCEPTED_MIME.includes(mime)) return fail("Only PDFs and photos (JPG, PNG, HEIC) work here.");
        const ready = await prepare(file);
        if (ready.blob.size > MAX_BYTES) return fail("This file is over 20 MB. Upload only the pages that matter.");
        const path = `${userId}/${draft.id}/${crypto.randomUUID()}-${safeName(ready.name)}`;
        const up = await supabase.storage.from("case-docs").upload(path, ready.blob, { contentType: ready.mime });
        if (up.error) return fail("Upload failed. Check your connection and try again.");
        const { data, error } = await supabase
          .from("case_documents")
          .insert({
            draft_id: draft.id,
            storage_path: path,
            filename: ready.name.slice(0, 200),
            mime: ready.mime,
            size_bytes: ready.blob.size,
          })
          .select("id, filename, mime, size_bytes, pages, status, note, label, found, storage_path")
          .single();
        if (error || !data) {
          await supabase.storage.from("case-docs").remove([path]);
          return fail("Couldn't save the file. Try again.");
        }
        const doc: DraftDoc = {
          id: data.id,
          filename: data.filename,
          mime: data.mime,
          sizeBytes: data.size_bytes,
          pages: data.pages,
          status: data.status,
          note: data.note,
          label: data.label,
          found: data.found ?? {},
          storagePath: data.storage_path,
        };
        setLocal((l) => l.filter((x) => x.key !== key));
        setDocs((all) => [...all, doc]);
        read(doc.id);
      }),
    );
  };

  const remove = async (doc: DraftDoc, thenPick = false) => {
    setDocs((all) => all.filter((d) => d.id !== doc.id));
    await deleteOneFile(draft.id, doc.id);
    if (thenPick) input.current?.click();
  };

  const compose = async () => {
    setComposing(true);
    setComposeError("");
    try {
      const res = await fetch(`/api/drafts/${draft.id}/compose`, { method: "POST" });
      const body = (await res.json().catch(() => ({}))) as { draft?: Draft; error?: string };
      if (body.draft) onComposed(body.draft);
      else setComposeError(body.error ?? "The AI couldn't write the draft. Try again.");
    } catch {
      setComposeError("Lost the connection. Try again.");
    } finally {
      setComposing(false);
    }
  };

  const reading = docs.some((d) => d.status === "reading" || d.status === "uploaded") || local.some((l) => l.uploading);
  const readable = docs.filter((d) => d.status === "read");

  // Right rail: the first value the AI found for each field, across all files.
  const facts = new Map<FactField, string>();
  for (const d of readable) for (const f of d.found.facts ?? []) if (!facts.has(f.field)) facts.set(f.field, f.value);
  const ids = new Map<IdType, number>();
  for (const d of docs)
    for (const [k, v] of Object.entries(d.found.identifiers ?? {})) ids.set(k as IdType, (ids.get(k as IdType) ?? 0) + (v ?? 0));
  const idTotal = [...ids.values()].reduce((a, b) => a + b, 0);

  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_360px] xl:gap-10">
      <div className="flex min-w-0 flex-col gap-6">
        <div>
          <h1 className="font-display text-[34px] leading-[1.1] font-medium tracking-[-0.015em] sm:text-[40px]">
            Add the medical documents
          </h1>
          <p className="mt-3 max-w-[620px] text-base text-muted">
            The AI reads them and writes the first draft of the case for you. You check everything before anyone else sees
            it.
          </p>
        </div>

        {aiOff && (
          <p role="alert" className="rounded-[10px] border border-mark-edge/60 bg-mark-tint px-4 py-3 text-sm text-mark-text">
            {aiOff} Your files are saved. They&apos;ll be read once it&apos;s on, or you can{" "}
            <a href="/new?manual=1">write the case yourself</a>.
          </p>
        )}

        <div
          role="button"
          tabIndex={0}
          aria-label="Add files. Drop them here or press Enter to choose."
          onClick={() => input.current?.click()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              input.current?.click();
            }
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            if (e.dataTransfer.files.length) add(e.dataTransfer.files);
          }}
          className={`dropzone group ${dragging ? "is-dragging" : ""}`}
        >
          <div className="mx-auto mb-3 grid h-[52px] w-[52px] place-items-center rounded-[14px] bg-brand-soft text-brand transition-transform duration-300 group-hover:-translate-y-[3px] group-hover:-rotate-[4deg]">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M12 16V4M6 10l6-6 6 6M4 20h16" />
            </svg>
          </div>
          <p className="font-display text-[22px] font-medium">{dragging ? "Drop to add them" : "Drop files here, or choose them"}</p>
          <p className="mt-1.5 mb-4 text-sm text-muted">PDFs or photos of paper reports. Up to {MAX_FILES} files, 20 MB each.</p>
          <span className="btn btn-mark pointer-events-none">Choose files</span>
          <div className="mt-4 flex flex-wrap justify-center gap-1.5">
            {KINDS.map((k) => (
              <span key={k} className="rounded-full bg-soft px-2.5 py-1 text-xs text-muted">
                {k}
              </span>
            ))}
          </div>
          <input
            ref={input}
            type="file"
            multiple
            accept=".pdf,.jpg,.jpeg,.png,.heic,.heif,.webp,application/pdf,image/*"
            className="sr-only"
            tabIndex={-1}
            onChange={(e) => {
              if (e.target.files?.length) add(e.target.files);
              e.target.value = "";
            }}
          />
        </div>
        {notice && (
          <p role="status" className="text-sm text-mark-text">
            {notice}
          </p>
        )}

        {(docs.length > 0 || local.length > 0) && (
          <ul className="flex flex-col gap-2.5" aria-live="polite">
            {docs.map((d) => {
              const err = errors[d.id];
              const bad = d.status === "unreadable";
              return (
                <li
                  key={d.id}
                  className={`grid grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-3.5 rounded-[12px] border bg-white px-4 py-3.5 transition-[border-color,box-shadow] hover:shadow-[0_8px_20px_-16px_rgba(23,32,43,0.5)] ${
                    bad ? "border-bad-line bg-bad-tint" : "border-line hover:border-line-2"
                  }`}
                >
                  <DocIcon mime={d.mime} />
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{d.status === "read" && d.label ? d.label : d.filename}</p>
                    {d.status === "reading" && (
                      <>
                        <p className="text-[13px] text-muted">Reading{d.pages ? `, ${d.pages} pages` : ""}</p>
                        <div className="mt-2 h-1.5 max-w-[360px] overflow-hidden rounded-full bg-[#e4e7e4]">
                          <i className="shimmer block h-full w-full rounded-full" />
                        </div>
                      </>
                    )}
                    {d.status === "uploaded" && (
                      <p className="text-[13px] text-muted">{err || d.note || (aiOff ? "Saved. Waiting for the AI reader." : "Waiting to be read")}</p>
                    )}
                    {d.status === "read" && (
                      <>
                        <p className="text-[13px] text-muted">
                          {d.pages ? `${d.pages} page${d.pages === 1 ? "" : "s"}` : "Read"}
                          {d.label && d.label !== d.filename ? <span className="sr-only">, from {d.filename}</span> : null}
                        </p>
                        {(d.found.chips ?? []).length > 0 && (
                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                            {(d.found.chips ?? []).map((c, i) => (
                              <em key={c + i} className="pop-in rounded-full bg-ok-soft px-2 py-0.5 text-xs not-italic text-ok" style={{ animationDelay: `${i * 0.1}s` }}>
                                {c}
                              </em>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                    {bad && <p className="text-[13px] text-bad">{d.note || "This file couldn't be read."}</p>}
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {d.status === "read" && <span className="text-[13px] font-semibold text-ok">Read</span>}
                    {d.status === "reading" && <span className="text-[13px] font-semibold text-brand">Reading</span>}
                    {d.status === "uploaded" && !aiOff && (
                      <button type="button" onClick={() => read(d.id)} className="text-[13px] font-semibold text-brand underline underline-offset-4">
                        Try again
                      </button>
                    )}
                    {bad && (
                      <button type="button" onClick={() => remove(d, true)} className="text-[13px] font-semibold text-brand underline underline-offset-4">
                        Replace file
                      </button>
                    )}
                    {d.status !== "reading" && (
                      <button type="button" onClick={() => remove(d)} className="text-xs text-muted hover:text-bad" aria-label={`Remove ${d.filename}`}>
                        Remove
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
            {local.map((l) => (
              <li
                key={l.key}
                className={`grid grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-3.5 rounded-[12px] border px-4 py-3.5 ${
                  l.error ? "border-bad-line bg-bad-tint" : "border-line bg-white"
                }`}
              >
                <DocIcon mime="" />
                <div className="min-w-0">
                  <p className="truncate font-semibold">{l.name}</p>
                  <p className={`text-[13px] ${l.error ? "text-bad" : "text-muted"}`}>{l.error ?? "Uploading"}</p>
                </div>
                {l.error ? (
                  <button type="button" onClick={() => setLocal((x) => x.filter((y) => y.key !== l.key))} className="text-xs text-muted">
                    Dismiss
                  </button>
                ) : (
                  <span className="text-[13px] text-muted">Uploading</span>
                )}
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-3">
            {draft.sections.plain ? (
              <>
                <button type="button" className="btn btn-mark" disabled={composing} onClick={onNext}>
                  Check the draft
                </button>
                <button type="button" className="btn btn-secondary" disabled={composing || reading || readable.length === 0} onClick={compose}>
                  {composing ? "Writing…" : "Write it again from all files"}
                </button>
              </>
            ) : (
              <button type="button" className="btn btn-mark" disabled={composing || reading || readable.length === 0} onClick={compose}>
                {composing ? "The AI is writing your draft…" : "Check the draft"}
              </button>
            )}
            <p className="text-[13px] text-muted">
              {composing
                ? "This takes about a minute."
                : reading
                  ? "Wait for every file to finish reading."
                  : readable.length === 0
                    ? "Add at least one document the AI can read."
                    : draft.sections.plain
                      ? "Writing it again replaces your edits and confirmations."
                      : "You can add more documents later. Nothing is shared yet."}
            </p>
          </div>
          {composeError && (
            <p role="alert" className="text-sm font-semibold text-bad">
              {composeError}
            </p>
          )}
        </div>
      </div>

      <aside className="flex flex-col gap-5 xl:sticky xl:top-6 xl:self-start">
        <section aria-labelledby="found-h" className="panel p-5">
          <h2 id="found-h" className="text-[15px] font-bold">
            What the AI found so far
          </h2>
          <p className="mt-1 mb-3.5 text-[13px] text-muted">Each fact links back to the page it came from.</p>
          {facts.size === 0 ? (
            <p className="text-sm text-subtle">{reading ? "Reading your files…" : "Add a document to start."}</p>
          ) : (
            <ul className="flex flex-col">
              {RAIL_FIELDS.filter((f) => facts.has(f) || f === "next_visit").map((f, i) => (
                <li
                  key={f}
                  className="slide-in flex gap-2.5 border-t border-line py-2.5 text-sm first:border-t-0"
                  style={{ animationDelay: `${i * 0.08}s` }}
                >
                  <span className="w-24 flex-none text-[13px] text-muted">{FACT_LABEL[f]}</span>
                  {facts.has(f) ? (
                    <b className="font-semibold">{facts.get(f)}</b>
                  ) : (
                    <span className="text-subtle">{f === "next_visit" ? "Not found yet. You'll add it" : ""}</span>
                  )}
                </li>
              ))}
              {reading && (
                <li className="flex gap-2.5 border-t border-line py-2.5 text-sm">
                  <span className="w-24 flex-none text-[13px] text-muted">Still reading</span>
                  <span className="text-subtle">More facts coming</span>
                </li>
              )}
            </ul>
          )}
        </section>

        <section aria-labelledby="ids-h" className="rounded-[14px] bg-ink p-5 text-white">
          <h2 id="ids-h" className="text-[15px] font-bold">
            {idTotal > 0 ? `Names and IDs found: ${idTotal}, all hidden` : "Names and IDs get hidden"}
          </h2>
          <p className="mt-1 mb-3.5 text-[13px] text-[#c9cfd8]">These never appear in the case.</p>
          {ids.size > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {[...ids.entries()].map(([k, v]) => (
                <span key={k} className="flex items-center gap-1.5 rounded-full bg-[#26303d] px-2.5 py-1 text-xs text-[#c9cfd8]">
                  {ID_LABEL[k]}
                  {v > 1 ? ` (${v})` : ""}
                  <i aria-hidden="true" className="inline-block h-2 w-10 rounded-sm bg-[#0e141b]" />
                </span>
              ))}
            </div>
          )}
          <p className="mt-3 text-[13px] text-[#c9cfd8]">Your original files stay private to you.</p>
          {docs.length > 0 && <DeleteFiles draftId={draft.id} onDone={() => setDocs([])} dark />}
        </section>
      </aside>
    </div>
  );
}

export function DeleteFiles({ draftId, onDone, dark }: { draftId: string; onDone: () => void; dark?: boolean }) {
  const [sure, setSure] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (!sure)
    return (
      <button
        type="button"
        onClick={() => setSure(true)}
        className={`mt-2 text-[13px] font-semibold underline underline-offset-4 ${dark ? "text-white" : "text-brand"}`}
      >
        Delete my files
      </button>
    );
  return (
    <div className="mt-2 flex flex-col gap-2 text-[13px]">
      <p>Delete every uploaded file? What the AI already wrote stays in the draft.</p>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            const r = await deleteMyFiles(draftId);
            setBusy(false);
            if (r.ok) onDone();
            else setError(r.error);
          }}
          className="btn btn-danger min-h-9 px-3 text-[13px]"
        >
          {busy ? "Deleting…" : "Delete files"}
        </button>
        <button type="button" onClick={() => setSure(false)} className={`btn min-h-9 px-3 text-[13px] ${dark ? "border border-[#4a5563] text-white hover:bg-[#26303d]" : "btn-secondary"}`}>
          Keep them
        </button>
      </div>
      {error && <p role="alert" className="font-semibold text-[#ffb4b4]">{error}</p>}
    </div>
  );
}
