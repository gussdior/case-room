"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { setPosted, turnOnPreview } from "@/app/share-actions";
import { EXPERTISE_TONE } from "@/components/ui";
import { EXPERTISE_LABEL, type Expertise } from "@/lib/types";

export type HelperPlace = {
  id: string;
  place: string;
  kind: string;
  skill: Expertise | null;
  why: string;
  community: boolean;
  post: string;
  posted: boolean;
};

const STEPS = ["Who it's for", "Add documents", "Check the draft", "Privacy check", "Open the case", "Find your helpers"];

async function copy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function CopyButton({ text, label, primary, disabled }: { text: string; label: string; primary?: boolean; disabled?: boolean }) {
  const [done, setDone] = useState<"ok" | "fail" | null>(null);
  return (
    <button
      type="button"
      disabled={disabled}
      className={`btn btn-sm ${primary ? "btn-mark" : "btn-secondary"}`}
      onClick={async () => {
        setDone((await copy(text)) ? "ok" : "fail");
        setTimeout(() => setDone(null), 2000);
      }}
    >
      <span aria-live="polite">{done === "ok" ? "Copied" : done === "fail" ? "Copy failed, select the text" : label}</span>
    </button>
  );
}

function PlaceCard({ p, caseId, link, demo }: { p: HelperPlace; caseId: string; link: string; demo: boolean }) {
  const [posted, setPostedState] = useState(p.posted);
  const [pending, start] = useTransition();
  const router = useRouter();
  const people = p.kind === "people_you_know";
  const id = `posted-${p.id}`;
  return (
    <article className="rounded-[14px] border border-line bg-white px-[22px] py-5 transition-[border-color,box-shadow] duration-150 hover:border-line-2 hover:shadow-[0_10px_24px_-18px_rgba(23,32,43,0.5)]">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <h2 className="font-display text-[21px] font-medium">{p.place}</h2>
        {p.skill && (
          <span className={`ml-auto rounded-full px-2.5 py-0.5 text-xs font-semibold ${EXPERTISE_TONE[p.skill]}`}>
            Asks for: {EXPERTISE_LABEL[p.skill].toLowerCase()}
          </span>
        )}
      </div>
      {p.why && <p className="mt-1 mb-3 text-sm text-muted">{p.why}</p>}
      <p className="rounded-[10px] border-l-[3px] border-mark bg-[#f6f7f6] px-4 py-3.5 font-display text-base leading-relaxed whitespace-pre-line text-ink-2">
        {p.post}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2.5">
        <CopyButton text={p.post} label={people ? "Copy message" : "Copy post"} primary />
        {!people && <CopyButton text={link} label="Copy link only" />}
        <label htmlFor={id} className="ml-auto inline-flex min-h-11 cursor-pointer items-center gap-2 text-[13px] font-semibold">
          <input
            id={id}
            type="checkbox"
            className="h-[18px] w-[18px] accent-ink"
            checked={posted}
            disabled={pending}
            onChange={(e) => {
              const next = e.target.checked;
              setPostedState(next);
              if (demo) return;
              start(async () => {
                const r = await setPosted(caseId, p.id, next);
                if (r?.error) setPostedState(!next);
                router.refresh();
              });
            }}
          />
          {people ? "I sent it" : "I posted here"}
        </label>
      </div>
      {p.community && (
        <p className="mt-2.5 rounded-[10px] bg-brand-soft px-3 py-2.5 text-[13px] text-brand-dark">
          Many Reddit groups remove posts that lead with a link. Read the group rules first. If links aren&apos;t allowed, post
          without it and share the link in a comment when someone asks.
        </p>
      )}
    </article>
  );
}

export function FindHelpers({
  caseId,
  demo,
  places,
  link,
  previewOn,
  fresh,
  stats,
}: {
  caseId: string;
  demo: boolean;
  places: HelperPlace[];
  link: string;
  previewOn: boolean;
  /** Set right after the case opens: "docs" for the documents flow, "manual" for write it myself. */
  fresh: "docs" | "manual" | null;
  stats: { posted: number; asked: number };
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewPending, startPreview] = useTransition();

  async function write() {
    if (demo || busy) return;
    setError(null);
    try {
      if (fresh) {
        // Day one: leads first, so the posts can ask for the skills the leads need.
        setBusy("Setting up your case with AI");
        await fetch(`/api/case/${caseId}/setup-ai`, { method: "POST" }).catch(() => null);
      }
      setBusy("Writing your posts");
      const res = await fetch(`/api/case/${caseId}/outreach`, { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) setError(data.error ?? "The AI didn't answer. Try again in a minute.");
      router.refresh();
    } catch {
      setError("Lost the connection. Try again in a minute.");
    } finally {
      setBusy(null);
    }
  }

  const started = useRef(false);
  useEffect(() => {
    if (!fresh || demo || places.length > 0 || !previewOn || started.current) return;
    started.current = true;
    void write();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fresh, demo, places.length, previewOn]);

  return (
    <div className={`grid gap-8 lg:gap-10 ${fresh === "docs" ? "lg:grid-cols-[220px_minmax(0,1fr)_360px]" : "lg:grid-cols-[minmax(0,1fr)_360px]"}`}>
      {fresh === "docs" && (
        <nav aria-label="Start a case, step 6 of 6" className="lg:sticky lg:top-6 lg:self-start">
          <ol className="flex flex-wrap gap-1 lg:flex-col">
            {STEPS.map((label, i) => {
              const now = i === STEPS.length - 1;
              return (
                <li
                  key={label}
                  aria-current={now ? "step" : undefined}
                  className={`flex min-h-11 items-center gap-3 rounded-[10px] border px-3 text-sm ${
                    now ? "border-line bg-white font-semibold text-ink" : "border-transparent text-muted"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`flex h-[26px] w-[26px] flex-none items-center justify-center rounded-full text-xs font-bold ${
                      now ? "bg-ink text-white" : "bg-ok text-white"
                    }`}
                  >
                    {i + 1}
                  </span>
                  <span className={now ? "" : "hidden sm:inline"}>{label}</span>
                </li>
              );
            })}
          </ol>
        </nav>
      )}

      <section aria-labelledby="helpers-h" className="min-w-0">
        <h1 id="helpers-h" className="font-display text-[34px] leading-[1.1] font-medium tracking-[-0.015em] sm:text-[40px]">
          Find your helpers
        </h1>
        <p className="mt-2.5 mb-6 max-w-[640px] text-base text-muted">
          Where to find people with the skills your case needs, with posts ready to copy. Each one tells the story first and
          asks for one skill.
        </p>

        {!previewOn && !demo ? (
          <div className="rounded-[14px] border border-line bg-white p-6">
            <h2 className="font-display text-[22px] font-medium">Turn on the public preview first</h2>
            <p className="mt-1.5 max-w-[560px] text-sm text-muted">
              Your posts link to the case. With the preview on, people who click see the goal, cancer type and stage, the
              skills needed and how many people are helping, and can ask to join. Nothing else is shown.
            </p>
            <button
              type="button"
              className="btn btn-mark mt-4"
              disabled={previewPending}
              onClick={() =>
                startPreview(async () => {
                  const r = await turnOnPreview(caseId);
                  if (r?.error) setError(r.error);
                  router.refresh();
                })
              }
            >
              {previewPending ? "Turning it on" : "Turn on the public preview"}
            </button>
            <p className="mt-3 text-[13px] text-muted">
              You can hide the visit date or turn the preview off any time in{" "}
              <Link href={`/case/${caseId}/people#settings`}>Case settings</Link>.
            </p>
          </div>
        ) : places.length === 0 ? (
          <div aria-live="polite" className="rounded-[14px] border border-line bg-white p-6">
            {busy ? (
              <p className="flex items-center gap-3 text-sm font-semibold">
                <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-brand motion-safe:animate-pulse" />
                {busy}. This takes about a minute.
              </p>
            ) : (
              <>
                <h2 className="font-display text-[22px] font-medium">Get posts written for you</h2>
                <p className="mt-1.5 text-sm text-muted">The AI picks places that fit your case and writes a post for each, with no names.</p>
                <button type="button" className="btn btn-mark mt-4" onClick={() => void write()} disabled={demo}>
                  Write my posts
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3.5">
            {places.map((p) => (
              <PlaceCard key={p.id} p={p} caseId={caseId} link={link} demo={demo} />
            ))}
            <div className="flex flex-wrap items-center gap-3 text-[13px] text-muted">
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => void write()} disabled={demo || !!busy}>
                {busy ? `${busy}` : "Write new posts"}
              </button>
              <span>New posts replace these. Your posted ticks start over.</span>
            </div>
          </div>
        )}
        {error && (
          <p role="alert" className="mt-4 rounded-[10px] bg-bad-tint px-3.5 py-2.5 text-sm text-bad">
            {error}
          </p>
        )}

        <div className="mt-7 flex flex-wrap items-center gap-3.5">
          <Link href={fresh ? `/case/${caseId}?new=1` : `/case/${caseId}`} className="btn btn-mark">
            Go to my case
          </Link>
          <p className="text-[13px] text-muted">You can come back to this any time with &quot;Share this case&quot;.</p>
        </div>
      </section>

      <aside className="flex flex-col gap-5 lg:sticky lg:top-6 lg:self-start">
        <section aria-labelledby="safe-h" className="rounded-[14px] border border-bad-line bg-bad-tint px-5 py-[18px]">
          <h2 id="safe-h" className="mb-2 text-[15px] font-bold text-bad">
            Stay safe
          </h2>
          <ul className="list-disc space-y-1.5 pl-[18px] text-sm">
            <li>Never pay anyone who offers to help.</li>
            <li>Never send medical records outside Case Room.</li>
            <li>Send every helper through &quot;Ask to join&quot; so you can review them.</li>
            <li>Posting from your own account can identify the patient even without a name. Ask them first.</li>
          </ul>
        </section>
        <section aria-labelledby="track-h" className="rounded-[14px] border border-line bg-white px-5 py-[18px]">
          <h2 id="track-h" className="mb-1 text-[15px] font-bold">
            Your outreach
          </h2>
          <div className="flex items-center justify-between border-b border-line py-2 text-sm">
            <span>Places posted</span>
            <strong className="font-display text-[30px] font-medium">{stats.posted}</strong>
          </div>
          <div className="flex items-center justify-between py-2 text-sm">
            <span>People asked to join</span>
            <strong className="font-display text-[30px] font-medium">{stats.asked}</strong>
          </div>
          <p className="mt-1 text-[13px] text-muted">Counted from your first post. Review each request on the People page.</p>
        </section>
      </aside>
    </div>
  );
}
