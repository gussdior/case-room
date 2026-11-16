import Link from "next/link";
import { EXPERTISE_TONE } from "@/components/ui";
import type { PublicCase } from "@/lib/public-cases";
import { EXPERTISE_LABEL, type Expertise } from "@/lib/types";

// Profession circles, never real people: one letter per profession on the case.
const PROFESSION_LETTER: Record<Expertise, string> = {
  doctor_nurse: "D",
  researcher: "R",
  bioinformatics: "B",
  insurance_legal: "I",
  no_medical: "V",
};

const NEED_TEXT: Record<Expertise, string> = {
  doctor_nurse: "Needs a doctor or nurse",
  researcher: "Needs a researcher",
  bioinformatics: "Needs someone in bioinformatics",
  insurance_legal: "Needs someone who knows insurance",
  no_medical: "Needs a volunteer",
};

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

export function PublicCaseCard({ c, sample = false }: { c: PublicCase; sample?: boolean }) {
  const href = sample ? "/case/sample" : `/case/${c.id}`;
  const chips = [
    c.promising > 0 && { text: plural(c.promising, "promising idea", "promising ideas"), tone: "bg-ok-soft text-ok" },
    c.exploring > 0 && { text: `${c.exploring} being checked`, tone: "bg-brand-soft text-brand" },
    c.needsSomeone > 0 && { text: `${c.needsSomeone} needs someone`, tone: "bg-mark-soft text-mark-text" },
    c.ruledOut > 0 && { text: `${c.ruledOut} ruled out`, tone: "bg-soft text-muted" },
  ].filter(Boolean) as { text: string; tone: string }[];

  return (
    <Link href={href} className="case-card" aria-label={`${c.cancerType}: ${c.goal}. ${sample ? "Open the sample case" : "Ask to join"}`}>
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[13px] text-muted">
        {sample && <span className="rounded-full bg-mark px-2 py-0.5 text-xs font-semibold text-ink">Sample case</span>}
        <span>{c.cancerType}</span>
        {c.cancerStage && <span>{c.cancerStage}</span>}
      </div>
      <h3 className="font-display text-[22px] leading-tight font-medium">{c.goal}</h3>
      {chips.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {chips.map((ch) => (
            <span key={ch.text} className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${ch.tone}`}>
              {ch.text}
            </span>
          ))}
        </div>
      ) : (
        <p className="text-[13px] text-muted">Just started. No ideas yet.</p>
      )}
      {c.needed.length > 0 && (
        <div className="rounded-[10px] border border-dashed border-mark-edge bg-mark-tint px-3 py-2.5 text-[13px] text-mark-text">
          {NEED_TEXT[c.needed[0]]}
          {c.needed.length > 1 && ` and ${c.needed.length - 1} more`}
        </div>
      )}
      <div className="mt-auto flex items-center gap-2.5 pt-1 text-[13px] text-muted">
        {c.professions.length > 0 && (
          <span className="flex" aria-label={`Professions helping: ${c.professions.map((p) => EXPERTISE_LABEL[p]).join(", ")}`}>
            {c.professions.map((p, i) => (
              <span
                key={p}
                aria-hidden="true"
                title={EXPERTISE_LABEL[p]}
                className={`flex h-7 w-7 items-center justify-center rounded-full border-2 border-white text-[11px] font-bold ${EXPERTISE_TONE[p]} ${i > 0 ? "-ml-2" : ""}`}
              >
                {PROFESSION_LETTER[p]}
              </span>
            ))}
          </span>
        )}
        <span>{c.helpers > 0 ? `${c.helpers} helping` : "Be the first to help"}</span>
        <span className="join-link ml-auto font-semibold text-brand">{sample ? "See the sample case" : "Ask to join"}</span>
      </div>
    </Link>
  );
}
