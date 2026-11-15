import type { ReactNode } from "react";
import Link from "next/link";
import { EXPERTISE_LABEL, type Expertise, type Person } from "@/lib/types";

const TONES = {
  neutral: "bg-soft text-muted",
  brand: "bg-brand-soft text-brand",
  solid: "bg-ink text-white",
  ok: "bg-ok-soft text-ok",
  warn: "bg-mark-soft text-mark-text",
  bad: "bg-bad-soft text-bad",
  mark: "bg-mark text-ink",
} as const;

const PILL = "inline-flex items-center self-start whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold";

export function Badge({ tone = "neutral", children }: { tone?: keyof typeof TONES; children: ReactNode }) {
  return <span className={`${PILL} ${TONES[tone]}`}>{children}</span>;
}

export const EXPERTISE_TONE: Record<Expertise, string> = {
  doctor_nurse: "bg-bad-soft text-bad",
  researcher: "bg-brand-soft text-brand",
  bioinformatics: "bg-[#e5f3f5] text-[#0e5c66]",
  insurance_legal: "bg-[#f1ecf8] text-[#5b3a8c]",
  no_medical: "bg-soft text-muted",
};

export function ExpertiseBadge({ expertise }: { expertise: Expertise }) {
  return <span className={`${PILL} ${EXPERTISE_TONE[expertise]}`}>{EXPERTISE_LABEL[expertise]}</span>;
}

export function Avatar({ person, ai, size = 36 }: { person?: Person; ai?: boolean; size?: number }) {
  const style = { width: size, height: size, fontSize: Math.max(11, Math.round(size / 2.8)) };
  if (ai || !person) {
    return (
      <div aria-hidden="true" style={style} className="flex flex-none items-center justify-center rounded-[10px] bg-ink font-bold text-mark">
        AI
      </div>
    );
  }
  return (
    <div
      aria-hidden="true"
      style={style}
      className={`flex flex-none items-center justify-center rounded-full font-bold ${EXPERTISE_TONE[person.expertise]}`}
    >
      {person.name.replace("Dr. ", "").charAt(0).toUpperCase()}
    </div>
  );
}

/** A person's name that opens their profile, when we have a real id. */
export function PersonLink({ person, className = "" }: { person: Person; className?: string }) {
  const real = /^[0-9a-f-]{36}$/i.test(person.id);
  if (!real) return <span className={className}>{person.name}</span>;
  return (
    <Link
      href={`/profile/${person.id}`}
      className={`text-ink no-underline decoration-brand-line underline-offset-4 hover:text-brand hover:underline ${className}`}
    >
      {person.name}
    </Link>
  );
}

export function Card({ children, className = "", label, id }: { children: ReactNode; className?: string; label?: string; id?: string }) {
  return (
    <section id={id} aria-label={label} className={`panel p-5 sm:p-6 ${className}`}>
      {children}
    </section>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="font-display text-2xl font-medium">{children}</h2>;
}

export function Chevron() {
  return (
    <span className="go" aria-hidden="true">
      <svg width="12" height="12" viewBox="0 0 12 12">
        <path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" />
      </svg>
    </span>
  );
}

export const btn = {
  primary: "btn btn-primary",
  mark: "btn btn-mark",
  secondary: "btn btn-secondary",
  danger: "btn btn-danger",
  ghost: "btn btn-ghost",
};
