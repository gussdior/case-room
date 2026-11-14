"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function CaseNav({
  caseId,
  pendingCount,
  showPeople,
}: {
  caseId: string;
  pendingCount: number;
  showPeople: boolean;
}) {
  const pathname = usePathname();
  const base = `/case/${caseId}`;
  const links = [
    { href: base, label: "Brief", exact: true },
    { href: `${base}#discussion`, label: "Discussion", exact: true, anchor: true },
    ...(showPeople ? [{ href: `${base}/people`, label: "People", badge: pendingCount }] : []),
    { href: `${base}/leaderboard`, label: "Leaderboard" },
  ] as { href: string; label: string; exact?: boolean; anchor?: boolean; badge?: number }[];
  return (
    <nav aria-label="Case" className="flex flex-wrap gap-1">
      {links.map((l) => {
        const active = !l.anchor && (l.exact ? pathname === l.href : pathname.startsWith(l.href));
        return (
          <Link
            key={l.label}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={`flex min-h-11 items-center gap-2 rounded-lg px-3.5 text-sm no-underline ${
              active ? "bg-brand-soft font-semibold text-brand" : "text-muted hover:bg-soft hover:text-ink"
            }`}
          >
            {l.label}
            {l.badge ? (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-bad px-1.5 text-[11px] font-bold text-white">
                {l.badge}
                <span className="sr-only"> waiting</span>
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
