import type { Expertise, LeadKind } from "./types";

export type AiToolInfo = {
  id: string;
  name: string;
  /** What it does, in plain words. */
  does: string;
  suits: Expertise[];
  /** Lead kinds it helps with. Empty means every kind. */
  kinds: LeadKind[];
  note?: string;
  /** Official homepage, only for well known public tools. */
  url?: string;
  builtIn?: boolean;
  icon: string;
  tone: string;
};

export const AI_TOOLS: AiToolInfo[] = [
  {
    id: "case_room_ai",
    name: "Case Room AI",
    does: "Searches trials, papers and preprints with this case in mind",
    suits: ["doctor_nurse", "researcher", "bioinformatics", "insurance_legal", "no_medical"],
    kinds: [],
    builtIn: true,
    icon: "CR",
    tone: "bg-brand-soft text-brand",
  },
  {
    id: "any_chat_ai",
    name: "Any chat AI",
    does: "Copy the case pack, ask your own AI, then paste the answer back to get its sources checked",
    suits: ["doctor_nurse", "researcher", "bioinformatics", "insurance_legal", "no_medical"],
    kinds: [],
    icon: "AI",
    tone: "bg-bad-soft text-bad",
  },
  {
    id: "clinicaltrials",
    name: "ClinicalTrials.gov",
    does: "The official list of trials, with who can join and where. Check status and entry rules here",
    suits: ["researcher", "doctor_nurse", "no_medical"],
    kinds: ["trial", "vaccine_or_personalized"],
    url: "https://clinicaltrials.gov",
    icon: "CT",
    tone: "bg-ok-soft text-ok",
  },
  {
    id: "pubmed",
    name: "PubMed",
    does: "Peer reviewed medical papers. Good for what has been tried and how it went",
    suits: ["researcher", "doctor_nurse"],
    kinds: ["drug_repurposing", "trial", "test_or_diagnostic", "vaccine_or_personalized"],
    url: "https://pubmed.ncbi.nlm.nih.gov",
    icon: "P",
    tone: "bg-brand-soft text-brand",
  },
  {
    id: "oncokb",
    name: "OncoKB",
    does: "What each tumor gene change means and which drugs target it",
    suits: ["bioinformatics", "researcher", "doctor_nurse"],
    kinds: ["drug_repurposing", "trial", "test_or_diagnostic"],
    url: "https://www.oncokb.org",
    icon: "G",
    tone: "bg-[#e5f3f5] text-[#0e5c66]",
  },
  {
    id: "cbioportal",
    name: "cBioPortal",
    does: "Large tumor data sets. See how common a gene change is and what goes with it",
    suits: ["bioinformatics", "researcher"],
    kinds: ["drug_repurposing", "vaccine_or_personalized", "test_or_diagnostic"],
    url: "https://www.cbioportal.org",
    icon: "C",
    tone: "bg-[#e5f3f5] text-[#0e5c66]",
  },
  {
    id: "clinvar",
    name: "ClinVar",
    does: "Public reports on whether a gene change is known to matter",
    suits: ["bioinformatics"],
    kinds: ["test_or_diagnostic", "vaccine_or_personalized"],
    url: "https://www.ncbi.nlm.nih.gov/clinvar",
    icon: "CV",
    tone: "bg-[#e5f3f5] text-[#0e5c66]",
  },
  {
    id: "pvactools",
    name: "Vaccine target tools",
    does: "Rank tumor mutations as possible vaccine targets, for example pVACtools",
    suits: ["bioinformatics"],
    kinds: ["vaccine_or_personalized"],
    note: "Research use only",
    url: "https://pvactools.readthedocs.io",
    icon: "V",
    tone: "bg-[#f1ecf8] text-[#5b3a8c]",
  },
  {
    id: "coverage",
    name: "Insurance and trial cost rules",
    does: "Ask a chat AI to explain what a plan type usually covers for trials and travel, then check with the plan",
    suits: ["insurance_legal", "no_medical"],
    kinds: ["support_or_access", "trial"],
    icon: "$",
    tone: "bg-[#f1ecf8] text-[#5b3a8c]",
  },
];

/** Tools that fit the open leads of a case. Built in and any chat AI always come first. */
export function toolsForCase(kinds: LeadKind[], limit = 5): AiToolInfo[] {
  const set = new Set(kinds);
  const always = AI_TOOLS.filter((t) => t.kinds.length === 0);
  const matched = AI_TOOLS.filter((t) => t.kinds.length > 0 && t.kinds.some((k) => set.has(k)));
  const rest = AI_TOOLS.filter((t) => t.kinds.length > 0 && !matched.includes(t));
  return [...always, ...matched, ...(set.size === 0 ? rest : [])].slice(0, limit);
}
