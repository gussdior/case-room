"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { turnOnPreview } from "@/app/share-actions";
import { SHARE_ROLES, shareTextFor, type ShareRoleSlug } from "@/lib/share-text";

type Props = {
  caseId: string;
  /** The role the case needs most right now. The sharer can pick another. */
  suggested: ShareRoleSlug;
  /** Changes when the card changes, so link previews refresh. */
  version: string;
  previewOn: boolean;
  /** Only the case creator can make the public page visible. */
  canTurnOn: boolean;
  /** Button classes. The header uses the yellow button; an open seat uses a small quiet one. */
  buttonClass?: string;
  /** Read by screen readers when several Share buttons are on the page. */
  buttonLabel?: string;
};

const ICON = "flex h-7 w-7 flex-none items-center justify-center rounded-[7px] bg-ink text-xs font-bold text-white";

/** One Share button: opens a post on X, Reddit or WhatsApp with the case link in it, or copies the link.
 *  The link preview card is made from the case, with no names. */
export function ShareMenu({ caseId, suggested, version, previewOn, canTurnOn, buttonClass = "btn btn-mark", buttonLabel }: Props) {
  const router = useRouter();
  const menuId = useId();
  const wrap = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<ShareRoleSlug>(suggested);
  const text = shareTextFor(role);
  const [turnedOn, setTurnedOn] = useState(false);
  const on = previewOn || turnedOn;
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", key);
    };
  }, [open]);

  // Move focus into the menu when it opens, and between items with the arrow keys.
  useEffect(() => {
    if (open) wrap.current?.querySelector<HTMLElement>("[data-item]")?.focus();
  }, [open, on]);
  const arrows = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const items = Array.from(wrap.current?.querySelectorAll<HTMLElement>("[data-item]") ?? []);
    if (!items.length) return;
    e.preventDefault();
    const i = items.indexOf(document.activeElement as HTMLElement);
    items[(i + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length].focus();
  };

  // The menu only renders after a click, so the browser address is always there.
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const url = `${origin}/case/${caseId}/for/${role}?v=${version}`;
  const enc = encodeURIComponent;
  const links = [
    { label: "Share on X", icon: "X", href: `https://x.com/intent/post?text=${enc(text)}&url=${enc(url)}` },
    { label: "Share on Reddit", icon: "r", href: `https://www.reddit.com/submit?url=${enc(url)}&title=${enc(text)}` },
    { label: "Share on WhatsApp", icon: "w", href: `https://wa.me/?text=${enc(`${text} ${url}`)}` },
  ];
  const item =
    "flex min-h-11 w-full items-center gap-2.5 rounded-[9px] px-3 text-left text-sm font-semibold text-ink no-underline transition-colors hover:bg-[#f0f2f0] hover:text-ink focus-visible:bg-[#f0f2f0]";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setError("Couldn't copy. Select the address bar and copy it from there.");
    }
  };

  return (
    <div ref={wrap} className="relative">
      <button
        ref={button}
        type="button"
        className={buttonClass}
        aria-label={buttonLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((o) => !o)}
      >
        Share
      </button>
      {open && (
        <div
          id={menuId}
          onKeyDown={arrows}
          className="share-menu absolute top-[calc(100%+8px)] right-0 z-30 w-[280px] rounded-[14px] border border-line bg-white p-2 shadow-[0_18px_40px_-24px_rgba(23,32,43,0.55)]"
        >
          {on ? (
            <div role="menu" aria-label="Share this case" className="flex flex-col">
              <div className="px-3 pt-1 pb-2">
                <label htmlFor={`${menuId}-role`} className="mb-1 block text-xs font-semibold text-muted">
                  Who are you looking for?
                </label>
                <select
                  id={`${menuId}-role`}
                  value={role}
                  onChange={(e) => setRole(e.target.value as ShareRoleSlug)}
                  className="min-h-11 w-full rounded-[10px] border border-line-2 bg-white px-2.5 text-sm font-semibold text-ink"
                >
                  {SHARE_ROLES.map((r) => (
                    <option key={r.slug} value={r.slug}>
                      {r.label}
                      {r.slug === suggested && r.slug !== "anyone" ? " (needed most)" : ""}
                    </option>
                  ))}
                </select>
                <p className="mt-1.5 text-xs leading-snug text-muted">{text}</p>
              </div>
              {links.map((l) => (
                <a key={l.label} data-item role="menuitem" href={l.href} target="_blank" rel="noopener noreferrer" className={item} onClick={() => setOpen(false)}>
                  <span aria-hidden="true" className={ICON}>
                    {l.icon}
                  </span>
                  {l.label}
                </a>
              ))}
              <button data-item role="menuitem" type="button" className={item} onClick={copy}>
                <span aria-hidden="true" className={ICON}>
                  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" />
                    <path d="M10.5 3.5v-1h-8v8h1" />
                  </svg>
                </span>
                <span aria-live="polite">{copied ? "Copied" : "Copy link"}</span>
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-3 p-2">
              <p className="text-sm leading-normal">
                Sharing makes this case&apos;s public page visible. It shows the goal, cancer type and stage, who is needed and how many
                people are helping. No names.
              </p>
              {canTurnOn ? (
                <button
                  data-item
                  type="button"
                  className="btn btn-mark"
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      setError(null);
                      const r = await turnOnPreview(caseId);
                      if (r?.error) setError(r.error);
                      else {
                        setTurnedOn(true);
                        router.refresh();
                      }
                    })
                  }
                >
                  {pending ? "Turning on" : "Turn on and share"}
                </button>
              ) : (
                <p className="text-sm font-semibold">Ask the case creator to turn on sharing.</p>
              )}
            </div>
          )}
          {error && (
            <p role="alert" className="px-3 pt-1 text-xs text-bad">
              {error}
            </p>
          )}
          <p className="mt-1 border-t border-line px-3 pt-2.5 pb-1 text-xs leading-snug text-muted">
            Never pay anyone who offers help. Real helpers never ask for money.
          </p>
        </div>
      )}
    </div>
  );
}
