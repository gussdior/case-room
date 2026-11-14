// A last line of defense after the AI hides identifiers: catches the patterns that are easy to spot
// (emails, phone numbers, ID and record numbers, birth dates, street addresses, titled names).
// It runs on every string the AI returns, before anything is saved.

export const HIDDEN = "[hidden]";

type Rule = { kind: string; re: RegExp; keep?: number };

const MONTH = "(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\\.?";
const DATE = `(?:\\d{1,4}[\\/.\\-]\\d{1,2}[\\/.\\-]\\d{1,4}|${MONTH}\\s+\\d{1,2},?\\s+\\d{2,4}|\\d{1,2}\\s+${MONTH}\\s+\\d{2,4})`;

const RULES: Rule[] = [
  { kind: "email", re: /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/gi },
  { kind: "ssn", re: /\b\d{3}-\d{2}-\d{4}\b/g },
  { kind: "phone", re: /(?:\+?\d{1,2}[\s.-]?)?\(?\b\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}\b/g },
  {
    kind: "birth date",
    re: new RegExp(`\\b(DOB|D\\.O\\.B\\.?|date of birth|birth ?date|born(?: on)?)(\\s*[:\\-]?\\s*)${DATE}`, "gi"),
    keep: 2,
  },
  {
    kind: "ID number",
    re: /\b(MRN|medical record(?: number)?|record(?: number| no\.?| #)?|patient id|acct|account(?: number| no\.?)?|accession(?: number| no\.?)?|member id|policy(?: number| no\.?)?|group(?: number| no\.?)?|insurance id|subscriber id|ID)(\s*[:#]?\s*(?:no\.?|number|#)?\s*[:#]?\s*)(?=[A-Z0-9-]*\d)[A-Z0-9][A-Z0-9-]{3,}\b/gi,
    keep: 2,
  },
  {
    kind: "address",
    re: /\b\d{1,6}\s+(?:[NSEW]\.?\s+)?(?:[A-Z0-9][a-zA-Z0-9'-]*\s+){1,4}(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Court|Ct|Way|Place|Pl|Terrace|Ter|Circle|Cir|Parkway|Pkwy|Highway|Hwy)\b\.?(?:,?\s*(?:Apt|Unit|Suite|Ste|#)\s*[\w-]+)?/g,
  },
  { kind: "name", re: /\b(?:Mr|Mrs|Ms|Miss|Mx|Dr|Prof)\.?\s+[A-Z][a-zA-Z'-]+(?:\s+[A-Z][a-zA-Z'-]+)?/g },
  { kind: "name", re: /\b(?:[Pp]atient|PATIENT|[Nn]ame|NAME|Pt|PT)\s*:\s*[A-Z][a-zA-Z'-]+(?:,?\s+[A-Z][a-zA-Z'-]+){0,2}/g },
  { kind: "ID number", re: /\b\d{7,}\b/g },
];

export type ScrubHit = { kind: string };

/** Returns the text with identifiers replaced, and what was replaced (kinds only). */
export function scrub(text: string): { text: string; hits: ScrubHit[] } {
  const hits: ScrubHit[] = [];
  let out = text;
  for (const r of RULES) {
    out = out.replace(r.re, (...m: string[]) => {
      hits.push({ kind: r.kind });
      return r.keep ? `${m[1]}${m[r.keep]}${HIDDEN}` : HIDDEN;
    });
  }
  // Collapse "[hidden] [hidden]" runs.
  out = out.replace(/\[hidden\](?:[\s,]+\[hidden\])+/g, HIDDEN);
  return { text: out, hits };
}

/** Deep scrub of any JSON value: every string inside gets cleaned. */
export function scrubDeep<T>(value: T, hits: ScrubHit[] = []): T {
  if (typeof value === "string") {
    const r = scrub(value);
    hits.push(...r.hits);
    return r.text as T;
  }
  if (Array.isArray(value)) return value.map((v) => scrubDeep(v, hits)) as T;
  if (value && typeof value === "object") {
    const o: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) o[k] = scrubDeep(v, hits);
    return o as T;
  }
  return value;
}

const LINK = /https?:\/\/[^\s<>"'\])]+/gi;

/** Like scrub, but links stay exactly as they are, so PubMed and trial numbers inside URLs survive. */
export function scrubKeepLinks(text: string): { text: string; hits: ScrubHit[] } {
  const hits: ScrubHit[] = [];
  let out = "";
  let last = 0;
  for (const m of text.matchAll(LINK)) {
    const r = scrub(text.slice(last, m.index));
    hits.push(...r.hits);
    out += r.text + m[0];
    last = (m.index ?? 0) + m[0].length;
  }
  const r = scrub(text.slice(last));
  hits.push(...r.hits);
  return { text: out + r.text, hits };
}
