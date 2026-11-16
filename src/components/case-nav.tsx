"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Two places per case: the case itself, and what goes to the doctor. */
export function CaseNav({ caseId }: { caseId: string }) {
  const pathname = usePathname();
  const base = `/case/${caseId}`;
  const onDoctor = pathname.startsWith(`${base}/doctor`);
  const links = [
    { href: base, label: "The case", active: !onDoctor },
    { href: `${base}/doctor`, label: "For the doctor", active: onDoctor },
  ];
  return (
    <nav aria-label="Case" className="flex flex-wrap gap-1">
      {links.map((l) => (
        <Link key={l.label} href={l.href} aria-current={l.active ? "page" : undefined} className="nav-link">
          {l.label}
        </Link>
      ))}
    </nav>
  );
}

/** The quiet safety line at the top of case pages. The case page shows it inside the goal instead. */
export function SafetyLine({ caseId, text }: { caseId: string; text: string }) {
  const pathname = usePathname();
  const base = `/case/${caseId}`;
  if (pathname === base || pathname.startsWith(`${base}/for/`)) return null;
  return <p className="mb-5 text-[13px] text-muted">{text}</p>;
}
