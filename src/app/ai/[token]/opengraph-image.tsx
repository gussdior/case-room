import { SAMPLE_AI_TOKEN } from "@/lib/ai-link";
import { caseCard, cardFirstLine, OG_ALT, OG_SIZE, visitChip, type CardChip } from "@/lib/og-card";
import { SAMPLE_CASE, SAMPLE_LEADS } from "@/lib/sample-case";
import { createClient } from "@/lib/supabase/server";

export const alt = OG_ALT;
export const size = OG_SIZE;
export const contentType = "image/png";

const NEEDS: Record<string, string> = {
  everyone: "Needs helpers.",
  researcher: "Needs a researcher.",
  doctor_nurse: "Needs a doctor or nurse.",
  bioinformatics: "Needs bioinformatics help.",
  insurance_legal: "Needs insurance or legal help.",
};
const ROLE_CHIP: Record<string, string> = {
  researcher: "Researcher",
  doctor_nurse: "Doctor or nurse",
  bioinformatics: "Bioinformatics",
  insurance_legal: "Insurance or legal",
};

/** The card shown when an AI link is pasted into a chat app or a post. Labels and counts only. */
export default async function Image({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  let card: { role?: string; cancer_type?: string | null; cancer_stage?: string | null; open_leads?: number; visit_days?: number | null } | null = null;
  if (token === SAMPLE_AI_TOKEN) {
    card = {
      role: "researcher",
      cancer_type: SAMPLE_CASE.cancerType,
      cancer_stage: SAMPLE_CASE.cancerStage,
      open_leads: SAMPLE_LEADS.filter((l) => l.status !== "ruled_out").length,
      visit_days: SAMPLE_CASE.visitInDays,
    };
  } else if (/^[a-f0-9]{64}$/.test(token)) {
    const supabase = await createClient();
    const { data } = await supabase.rpc("ai_link_card", { p_token: token });
    card = (data as typeof card) ?? null;
  }
  if (!card) return caseCard({ first: "Volunteers and AI,", second: "working on one cancer case.", chips: [] });
  const role = card.role ?? "everyone";
  const chips: CardChip[] = [];
  if (ROLE_CHIP[role]) chips.push({ text: ROLE_CHIP[role], brand: true });
  if (card.open_leads) chips.push({ text: `${card.open_leads} open lead${card.open_leads === 1 ? "" : "s"}` });
  const visit = visitChip(card.visit_days);
  if (visit) chips.push({ text: visit });
  return caseCard({ first: cardFirstLine(card.cancer_type, card.cancer_stage), second: NEEDS[role] ?? NEEDS.everyone, chips });
}
