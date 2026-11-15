"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function CaseNav({
  caseId,
  pendingCount,
  questionCount = 0,
  showPeople,
}: {
  caseId: string;
  pendingCount: number;
  questionCount?: number;
  showPeople: boolean;
}) {
  const pathname = usePathname();
  const base = `/case/${caseId}`;
  // People: admins manage members there; everyone else sees the team and its contributions on the leaderboard.
  const peopleHref = showPeople ? `${base}/people` : `${base}/leaderboard`;
  const links = [
    { href: base, label: "Leads", exact: true, also: [`${base}/lead/`] },
    { href: `${base}/runs`, label: "AI runs" },
    { href: `${base}/tried`, label: "What we tried" },
    { href: `${base}/doctor`, label: "For the doctor", also: [`${base}/task/`] },
    { href: peopleHref, label: "People", badge: peopleBadge(showPeople ? pendingCount : 0, questionCount), also: [`${base}/people`, `${base}/leaderboard`] },
  ] as { href: string; label: string; exact?: boolean; anchor?: boolean; badge?: string; also?: string[] }[];
  return (
    <nav aria-label="Case" className="flex flex-wrap gap-1">
      {links.map((l) => {
        const active =
          !l.anchor &&
          ((l.exact ? pathname === l.href : pathname.startsWith(l.href)) || (l.also ?? []).some((a) => pathname.startsWith(a)));
        return (
          <Link
            key={l.label}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className="nav-link"
          >
            {l.label}
            {l.badge ? (
              <span className="flex h-5 items-center justify-center rounded-full bg-mark px-2 text-[11px] font-semibold whitespace-nowrap text-ink">
                {l.badge}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}

/** "3 waiting to join", "2 new questions", or both together. */
function peopleBadge(waiting: number, questions: number): string | undefined {
  const q = `${questions} new ${questions === 1 ? "question" : "questions"}`;
  if (waiting && questions) return `${waiting} waiting, ${q}`;
  if (waiting) return `${waiting} waiting to join`;
  if (questions) return q;
  return undefined;
}
