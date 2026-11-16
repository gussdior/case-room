import { caseCard, cardFirstLine, OG_SIZE, seatCard, type Seat } from "@/lib/og-card";
import { loadShareCard } from "@/lib/share-card";
import { shareLine } from "@/lib/share-text";
import type { Expertise } from "@/lib/types";

export const alt = "Case Room: looking for someone who wants to help someone going through cancer";
export const size = OG_SIZE;
export const contentType = "image/png";

const SEAT: Record<Expertise, Seat> = {
  doctor_nurse: { letter: "D", label: "Doctor or nurse", bg: "#FBEDEC", fg: "#9B2C2C" },
  researcher: { letter: "R", label: "Researcher", bg: "#EEF0FA", fg: "#2B3FA0" },
  bioinformatics: { letter: "B", label: "Bioinformatics", bg: "#E5F3F5", fg: "#0E5C66" },
  insurance_legal: { letter: "I", label: "Insurance or legal", bg: "#F1ECF8", fg: "#5B3A8C" },
  no_medical: { letter: "V", label: "Volunteer", bg: "#E7EAE7", fg: "#4A5563" },
};
const FAMILY: Seat = { letter: "F", label: "Family", bg: "#E7EAE7", fg: "#17202B" };

/** The card for a shared case link: the ask, and the team with one seat open.
 *  Only what the public page already shows; a plain card when the case is private. */
export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const card = await loadShareCard(id);
  if (!card || !card.publicPreview) return caseCard({ first: "Volunteers and AI,", second: "working on one cancer case.", chips: [] });
  const line = shareLine(card.needed);
  const facts = card.cancerType ? `${cardFirstLine(card.cancerType, card.cancerStage)} ` : "";
  const seats = card.seats.slice(0, 3).map((e) => SEAT[e] ?? SEAT.no_medical);
  return seatCard({ ...line, footer: `${facts}About 30 minutes. Free.`, seats: [...seats, FAMILY] });
}
