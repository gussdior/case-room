import { loadPreview } from "@/lib/db-case";
import { caseCard, cardFirstLine, OG_SIZE, visitChip, type CardChip } from "@/lib/og-card";
import { SAMPLE_CASE } from "@/lib/sample-case";
import { EXPERTISE_LABEL, type Expertise } from "@/lib/types";

export const alt = "Case Room: a cancer case that needs helpers";
export const size = OG_SIZE;
export const contentType = "image/png";

const NEEDS: Partial<Record<Expertise, string>> = {
  researcher: "Needs a researcher.",
  doctor_nurse: "Needs a doctor or nurse.",
  bioinformatics: "Needs bioinformatics help.",
  insurance_legal: "Needs insurance or legal help.",
};

/** The card for a shared case link. Only what the public preview already shows; a plain card when the preview is off. */
export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p =
    id === SAMPLE_CASE.id
      ? { cancerType: SAMPLE_CASE.cancerType ?? null, cancerStage: SAMPLE_CASE.cancerStage ?? null, visitInDays: SAMPLE_CASE.visitInDays, needed: ["researcher"] as Expertise[], helpers: 6 }
      : await loadPreview(id);
  if (!p) return caseCard({ first: "Volunteers and AI,", second: "working on one cancer case.", chips: [] });
  const first = p.needed.find((e) => NEEDS[e]);
  const chips: CardChip[] = p.needed.filter((e) => e !== "no_medical").slice(0, 2).map((e) => ({ text: EXPERTISE_LABEL[e], brand: true }));
  if (p.helpers > 0) chips.push({ text: `${p.helpers} helping` });
  const visit = visitChip(p.visitInDays);
  if (visit) chips.push({ text: visit });
  return caseCard({ first: cardFirstLine(p.cancerType, p.cancerStage), second: (first && NEEDS[first]) || "Needs helpers.", chips });
}
