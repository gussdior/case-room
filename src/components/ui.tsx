import type { ReactNode } from "react";
import { EXPERTISE_LABEL, type Expertise, type Person } from "@/lib/types";

const TONES = {
  neutral: "bg-soft text-muted",
  brand: "bg-brand-soft text-brand",
  solid: "bg-brand text-white",
  ok: "bg-ok-soft text-ok",
  warn: "bg-warn-soft text-warn",
  bad: "bg-bad-soft text-bad",
} as const;

export function Badge({ tone = "neutral", children }: { tone?: keyof typeof TONES; children: ReactNode }) {
  return (
    <span className={`inline-block self-start rounded-md px-2 py-0.5 text-[11px] font-semibold ${TONES[tone]}`}>
      {children}
    </span>
  );
}

const EXPERTISE_TONE: Record<Expertise, string> = {
  doctor_nurse: "bg-bad-soft text-bad",
  researcher: "bg-brand-soft text-brand",
  bioinformatics: "bg-[#e5f3f5] text-[#0e5c66]",
  insurance_legal: "bg-[#f1ecf8] text-[#5b3a8c]",
  no_medical: "bg-soft text-muted",
};

export function ExpertiseBadge({ expertise }: { expertise: Expertise }) {
  return (
    <span className={`inline-block self-start rounded-md px-2 py-0.5 text-[11px] font-semibold ${EXPERTISE_TONE[expertise]}`}>
      {EXPERTISE_LABEL[expertise]}
    </span>
  );
}

export function Avatar({ person, ai, size = 36 }: { person?: Person; ai?: boolean; size?: number }) {
  const style = { width: size, height: size };
  if (ai || !person) {
    return (
      <div aria-hidden="true" style={style} className="flex flex-none items-center justify-center rounded-lg bg-ink text-xs font-bold text-white">
        AI
      </div>
    );
  }
  return (
    <div aria-hidden="true" style={style} className={`flex flex-none items-center justify-center rounded-full text-sm font-bold ${EXPERTISE_TONE[person.expertise]}`}>
      {person.name.replace("Dr. ", "").charAt(0)}
    </div>
  );
}

export function Card({ children, className = "", label }: { children: ReactNode; className?: string; label?: string }) {
  return (
    <section aria-label={label} className={`rounded-2xl border border-line bg-white p-5 sm:p-6 ${className}`}>
      {children}
    </section>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="font-display text-xl font-bold">{children}</h2>;
}

export const btn = {
  primary:
    "inline-flex min-h-11 items-center justify-center rounded-[10px] bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-dark hover:text-white",
  secondary:
    "inline-flex min-h-11 items-center justify-center rounded-[10px] border border-line-2 bg-white px-4 text-sm font-semibold text-ink hover:bg-soft hover:text-ink",
  danger:
    "inline-flex min-h-11 items-center justify-center rounded-[10px] bg-bad px-4 text-sm font-semibold text-white",
};
