"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { signOut } from "@/app/auth-actions";

export type MenuLink = { href: string; label: string };

/** Phone only: one button that opens the rest of the menu as a sheet from the bottom. */
export function MobileMenu({
  viewer,
  links,
}: {
  viewer: { id: string; name: string } | null;
  links: MenuLink[];
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  const row =
    "flex min-h-[52px] items-center border-b border-line px-1 text-base font-semibold text-ink no-underline active:bg-hover";

  return (
    <div className="sm:hidden">
      <button
        type="button"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        aria-controls="mobile-menu"
        onClick={() => setOpen((v) => !v)}
        className="grid h-11 w-11 flex-none place-items-center rounded-[10px] border border-line-2 bg-white text-ink transition-colors active:bg-hover"
      >
        <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
        </svg>
      </button>
      {open && (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="menu-fade absolute inset-0 h-full w-full cursor-default bg-ink/45"
          />
          <nav
            id="mobile-menu"
            aria-label="Menu"
            className="menu-rise absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto rounded-t-[22px] bg-white px-4 pt-2.5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-[0_-12px_40px_rgba(23,32,43,.18)]"
          >
            <div aria-hidden="true" className="mx-auto mb-3 h-1 w-10 rounded-full bg-line" />
            {viewer && (
              <Link href={`/profile/${viewer.id}`} className={`${row} gap-3 pb-2`}>
                <span
                  aria-hidden="true"
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-soft text-sm font-bold text-brand"
                >
                  {viewer.name.replace("Dr. ", "").charAt(0).toUpperCase()}
                </span>
                Your profile
              </Link>
            )}
            {links.map((l) => (
              <Link key={l.href} href={l.href} className={row}>
                {l.label}
              </Link>
            ))}
            {viewer ? (
              <form action={signOut}>
                <button type="submit" className="flex min-h-[52px] w-full items-center px-1 text-left text-base font-semibold text-bad">
                  Sign out
                </button>
              </form>
            ) : (
              <Link href="/login" className={`${row} border-b-0`}>
                Sign in
              </Link>
            )}
          </nav>
        </div>
      )}
    </div>
  );
}
