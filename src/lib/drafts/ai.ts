import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { createWithTool } from "@/lib/ai/call-tool";
import { AGE_RANGES, EXPERTISE_ORDER, type AgeRange, type Expertise } from "@/lib/types";
import { scrubDeep, type ScrubHit } from "./scrub";
import {
  FACT_FIELDS,
  ID_TYPES,
  OUTCOMES,
  TASK_SECTIONS,
  type Citation,
  type DocFound,
  type DraftAnswers,
  type DraftQuestion,
  type DraftSection,
  type DraftTreatment,
  type Fact,
  type IdType,
  type SuggestedTask,
  type TextKey,
} from "./types";

const MODEL = "claude-sonnet-5-5";

const str = { type: "string" } as const;
const int = { type: "integer" } as const;
const obj = (properties: Record<string, unknown>) => ({
  type: "object" as const,
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
});
const arr = (items: unknown) => ({ type: "array" as const, items });

const TREATMENT_SCHEMA = obj({
  title: { ...str, description: "Plain name, e.g. 'Osimertinib (daily pill)' or 'Radiation to the brain'" },
  started: { ...str, description: "YYYY-MM or empty" },
  ended: { ...str, description: "YYYY-MM or empty if ongoing or unknown" },
  outcome: { type: "string", enum: [...OUTCOMES] },
  note: { ...str, description: "Short, e.g. 'worked for 26 months'. No advice." },
});

const READ_TOOL: Anthropic.Tool = {
  name: "record_document",
  description: "Record what one medical document says, with every identifier replaced by [hidden].",
  strict: true,
  input_schema: obj({
    readable: { type: "boolean" },
    unreadable_reason: { ...str, description: "If not readable: a short, kind reason and how to fix it. Else empty." },
    document_label: { ...str, description: "Plain type and month, e.g. 'Pathology report, March 2023'. No names." },
    pages: int,
    chips: arr({ ...str, description: "Up to 4 very short findings for a label, e.g. 'EGFR exon 19 deletion'" }),
    facts: arr(
      obj({
        field: { type: "string", enum: [...FACT_FIELDS] },
        value: { ...str, description: "Plain words, short" },
        page: int,
        quote: { ...str, description: "The exact short line it came from, max 25 words, identifiers as [hidden]" },
      }),
    ),
    treatments: arr(TREATMENT_SCHEMA),
    identifiers: arr(
      obj({
        type: { type: "string", enum: [...ID_TYPES] },
        count: int,
      }),
    ),
  }) as Anthropic.Tool.InputSchema,
};

const READ_SYSTEM = `You read one medical document for a family starting a Case Room case, where volunteers prepare questions for the patient's own doctor.

Privacy rules (most important):
- Replace every person name (patient, family, doctors, nurses), birth date, address, phone, email, record, account, accession, insurance or any ID number, and every hospital, clinic or lab name with [hidden], in every value and quote you write.
- Never copy an identifier anywhere. In "identifiers", only count how many of each type you saw.
- Dates of tests, scans and treatments are fine to keep as month and year.

What to record:
- Facts that matter for the case: cancer type, stage, when it was found, gene or marker results, treatments with dates and how they went, the latest scan, the current situation, a next visit if mentioned.
- Each fact with its page number and a short exact quote.
- Write plain words a family can read. Do not interpret beyond what the document says, do not predict, and never give medical advice.
- If the document is blurry, cut off, empty or not medical, set readable to false and say why and how to fix it in one short sentence.`;

export type ReadResult = { readable: boolean; reason: string; label: string; pages: number | null; found: DocFound };

function clampText(v: unknown, n: number): string {
  return typeof v === "string" ? v.trim().slice(0, n) : "";
}
function month(v: unknown): string {
  const s = clampText(v, 7);
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(s) ? s : "";
}
function cleanTreatments(list: unknown): DraftTreatment[] {
  if (!Array.isArray(list)) return [];
  return list
    .slice(0, 20)
    .map((t: Record<string, unknown>) => ({
      title: clampText(t?.title, 160),
      started: month(t?.started),
      ended: month(t?.ended),
      outcome: (OUTCOMES as readonly string[]).includes(t?.outcome as string) ? (t.outcome as DraftTreatment["outcome"]) : "unknown",
      note: clampText(t?.note, 160),
    }))
    .filter((t) => t.title);
}

export async function readDocument(
  file: { bytes: Buffer; mime: string; filename: string },
): Promise<ReadResult & { hits: ScrubHit[] }> {
  const client = new Anthropic();
  const data = file.bytes.toString("base64");
  const block: Anthropic.ContentBlockParam =
    file.mime === "application/pdf"
      ? { type: "document", source: { type: "base64", media_type: "application/pdf", data } }
      : {
          type: "image",
          source: { type: "base64", media_type: file.mime as "image/jpeg" | "image/png" | "image/webp", data },
        };

  const msg = await createWithTool(client, {
    model: MODEL,
    max_tokens: 4000,
    system: READ_SYSTEM,
    tools: [READ_TOOL],
    messages: [{ role: "user", content: [block, { type: "text", text: "Record this document." }] }],
  });
  const use = msg.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
  if (!use) throw new Error("The AI didn't return a result.");
  const raw = use.input as Record<string, unknown>;

  const identifiers: Partial<Record<IdType, number>> = {};
  for (const i of Array.isArray(raw.identifiers) ? raw.identifiers : []) {
    const t = (i as { type?: string }).type as IdType;
    const c = Math.max(0, Math.min(999, Number((i as { count?: number }).count) || 0));
    if ((ID_TYPES as readonly string[]).includes(t) && c > 0) identifiers[t] = (identifiers[t] ?? 0) + c;
  }

  const facts: Fact[] = (Array.isArray(raw.facts) ? raw.facts : []).slice(0, 40).map((f: Record<string, unknown>) => ({
    field: (FACT_FIELDS as readonly string[]).includes(f?.field as string) ? (f.field as Fact["field"]) : "other",
    value: clampText(f?.value, 200),
    page: Number.isInteger(f?.page) && (f.page as number) > 0 ? (f.page as number) : null,
    quote: clampText(f?.quote, 240),
  }));

  const hits: ScrubHit[] = [];
  const cleaned = scrubDeep(
    {
      label: clampText(raw.document_label, 120) || file.filename.replace(/\.[a-z0-9]+$/i, "").slice(0, 120),
      reason: clampText(raw.unreadable_reason, 280),
      chips: (Array.isArray(raw.chips) ? raw.chips : []).slice(0, 4).map((c) => clampText(c, 40)).filter(Boolean),
      facts: facts.filter((f) => f.value),
      treatments: cleanTreatments(raw.treatments),
    },
    hits,
  );
  // Anything the backup scrub caught counts as hidden too.
  if (hits.length) identifiers.other_id = (identifiers.other_id ?? 0) + hits.length;

  return {
    readable: raw.readable !== false,
    reason: cleaned.reason,
    label: cleaned.label,
    pages: Number.isInteger(raw.pages) && (raw.pages as number) > 0 ? (raw.pages as number) : null,
    found: {
      label: cleaned.label,
      chips: cleaned.chips,
      facts: cleaned.facts,
      treatments: cleaned.treatments,
      identifiers,
    },
    hits,
  };
}

const SECTION_SCHEMA = obj({
  text: { ...str, description: "Plain words, 1 to 4 short sentences. Mark each fact with [n] matching a citation." },
  citations: arr(
    obj({
      n: int,
      doc: { ...int, description: "Index of the document in the list you were given" },
      fact: { ...int, description: "Index of the fact inside that document" },
    }),
  ),
});

const COMPOSE_TOOL: Anthropic.Tool = {
  name: "write_draft",
  description: "Write the first draft of the case from the documents' facts.",
  strict: true,
  input_schema: obj({
    cancer_type: { ...str, description: "Short, e.g. 'Lung cancer'. Max 60 characters." },
    stage: { ...str, description: "Short, e.g. 'Stage IV', only if a document says it, else empty" },
    goal: {
      ...str,
      description:
        "The goal of the case as one plain sentence under 140 characters, from what the family wants to know, e.g. 'Find the next options now that the first pill stopped working'. No names.",
    },
    age_range: { type: "string", enum: [...AGE_RANGES, "unknown"], description: "Only if a document states the age, else unknown" },
    current_treatment: { ...str, description: "What the patient is on or waiting for now, under 80 characters, else empty" },
    visit_date: { ...str, description: "YYYY-MM-DD of the next doctor visit if a document says it, else empty" },
    plain: SECTION_SCHEMA,
    treatments_text: SECTION_SCHEMA,
    now: SECTION_SCHEMA,
    wants: { ...str, description: "What the family wants to know, cleaned up from their words, 1 or 2 sentences" },
    questions: arr(
      obj({
        section: { type: "string", enum: ["plain", "treatments", "now"] },
        span: { ...str, description: "The exact sentence in that section's text that you are unsure about" },
        question: { ...str, description: "A yes or no question for the family" },
        if_yes: { ...str, description: "Sentence that replaces the span if they answer yes" },
        if_no: { ...str, description: "Sentence that replaces the span if they answer no" },
        if_unsure: { ...str, description: "Sentence that replaces the span if they are not sure" },
      }),
    ),
    treatments: arr(TREATMENT_SCHEMA),
    tasks: arr(
      obj({
        title: { ...str, description: "Starts with a verb, under 90 characters" },
        why: { ...str, description: "One sentence on why it matters for this case" },
        expertise: { type: "string", enum: [...EXPERTISE_ORDER] },
        section: { type: "string", enum: [...TASK_SECTIONS] },
        minutes: int,
        done: arr({ ...str, description: "What done looks like, short" }),
      }),
    ),
  }) as Anthropic.Tool.InputSchema,
};

const COMPOSE_SYSTEM = `You write the first draft of a Case Room case from facts already pulled out of the family's medical documents. Volunteers will use it to prepare questions for the patient's own doctor.

Rules:
- Use only the facts you are given and the family's own words. Never invent a fact, date, result or treatment.
- Plain words a family member can read. Short sentences. No jargon without a plain explanation.
- Every fact in a section gets a citation [n] pointing to the document and fact it came from.
- Never give treatment advice, never say what the patient should do, never predict outcomes.
- Keep every [hidden] as it is. Never add names, birth dates, ID numbers, addresses or hospital and doctor names.
- When documents disagree or something important is missing (for example whether a new biopsy was sent for gene testing), write the sentence you are unsure about and add a question for the family. At most 4 questions.
- Treatments: one entry per treatment, in time order, with month and year when known.
- In sentences you write, give dates the way people say them, like "November 2026" or "November 19, 2026". Only fields that ask for YYYY-MM or YYYY-MM-DD use that form.
- Call the material "the documents" or "the case notes". Never say "pack".
- Tasks: 4 to 7 small, concrete tasks volunteers can do in under 2 hours, each for one kind of expertise:
  doctor_nurse (explain results, check the summary), researcher (trials, papers), bioinformatics (gene reports),
  insurance_legal (coverage, costs, financial help), no_medical (organize questions, call trial sites).
  Always include one task for a doctor or nurse to check the summary against the documents, and one for turning
  checked findings into questions for the doctor. Sections: plain, now, options, access, questions.`;

type ComposeDoc = { label: string; facts: Fact[]; treatments: DraftTreatment[] };

export type ComposeResult = {
  cancerType: string;
  stage: string;
  goal: string;
  ageRange: AgeRange | null;
  currentTreatment: string;
  visitDate: string | null;
  sections: Record<TextKey, DraftSection>;
  treatments: DraftTreatment[];
  tasks: SuggestedTask[];
};

export async function composeDraft(docs: ComposeDoc[], answers: DraftAnswers): Promise<ComposeResult> {
  const client = new Anthropic();
  const material = docs
    .map(
      (d, i) =>
        `Document ${i}: ${d.label}\n` +
        d.facts.map((f, j) => `  fact ${j} [${f.field}] ${f.value} (page ${f.page ?? "?"}): "${f.quote}"`).join("\n") +
        (d.treatments.length
          ? `\n  treatments: ${d.treatments
              .map((t) => `${t.title} ${t.started || "?"} to ${t.ended || "?"} ${t.outcome} ${t.note}`)
              .join("; ")}`
          : ""),
    )
    .join("\n\n");
  const who = { myself: "the patient themself", family: "a family member", caregiver: "a caregiver" }[
    answers.relationship ?? "family"
  ];

  const msg = await createWithTool(client, {
    model: MODEL,
    max_tokens: 6000,
    system: COMPOSE_SYSTEM,
    tools: [COMPOSE_TOOL],
    messages: [
      {
        role: "user",
        content: `The case is being started by ${who}.\nWhat the family wants to know, in their words: ${
          answers.wants_to_know?.trim() || "Not given."
        }\n\nFacts from their documents:\n\n${material || "No readable documents."}`,
      },
    ],
  });
  const use = msg.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
  if (!use) throw new Error("The AI didn't return a draft.");
  const raw = use.input as Record<string, unknown>;

  const section = (v: unknown): DraftSection => {
    const s = (v ?? {}) as { text?: unknown; citations?: unknown };
    const cites: Citation[] = [];
    for (const c of Array.isArray(s.citations) ? s.citations : []) {
      const { n, doc, fact } = c as { n: number; doc: number; fact: number };
      const d = docs[doc];
      const f = d?.facts[fact];
      if (!Number.isInteger(n) || !d) continue;
      cites.push({ n, doc: d.label, page: f?.page ?? null, quote: f?.quote ?? "" });
    }
    return { text: clampText(s.text, 2000), citations: cites.slice(0, 20), questions: [] };
  };

  const sections: Record<TextKey, DraftSection> = {
    plain: section(raw.plain),
    treatments: section(raw.treatments_text),
    now: section(raw.now),
    wants: { text: clampText(raw.wants, 1000) || answers.wants_to_know?.trim() || "", citations: [], questions: [] },
  };
  let qn = 0;
  for (const q of Array.isArray(raw.questions) ? raw.questions.slice(0, 4) : []) {
    const r = q as Record<string, unknown>;
    const key = r.section as TextKey;
    const span = clampText(r.span, 400);
    if (!sections[key] || !span || !sections[key].text.includes(span)) continue;
    const item: DraftQuestion = {
      id: `q${++qn}`,
      span,
      question: clampText(r.question, 200),
      ifYes: clampText(r.if_yes, 400),
      ifNo: clampText(r.if_no, 400),
      ifUnsure: clampText(r.if_unsure, 400),
    };
    if (item.question) sections[key].questions.push(item);
  }

  const tasks: SuggestedTask[] = (Array.isArray(raw.tasks) ? raw.tasks : []).slice(0, 8).map((t, i) => {
    const r = t as Record<string, unknown>;
    return {
      id: `t${i + 1}`,
      title: clampText(r.title, 200),
      why: clampText(r.why, 400),
      expertise: (EXPERTISE_ORDER as readonly string[]).includes(r.expertise as string)
        ? (r.expertise as Expertise)
        : "no_medical",
      section: (TASK_SECTIONS as readonly string[]).includes(r.section as string)
        ? (r.section as SuggestedTask["section"])
        : "options",
      minutes: Math.min(240, Math.max(10, Number(r.minutes) || 45)),
      done: (Array.isArray(r.done) ? r.done : []).slice(0, 5).map((d) => clampText(d, 200)).filter(Boolean),
      picked: true,
    };
  });

  const visit = clampText(raw.visit_date, 10);
  const result: ComposeResult = {
    cancerType: clampText(raw.cancer_type, 60),
    stage: clampText(raw.stage, 40),
    goal: clampText(raw.goal, 200),
    ageRange: (AGE_RANGES as readonly string[]).includes(raw.age_range as string) ? (raw.age_range as AgeRange) : null,
    currentTreatment: clampText(raw.current_treatment, 80),
    visitDate: /^\d{4}-\d{2}-\d{2}$/.test(visit) ? visit : null,
    sections,
    treatments: cleanTreatments(raw.treatments),
    tasks: tasks.filter((t) => t.title),
  };
  return scrubDeep(result);
}

