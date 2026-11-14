import "server-only";

// Research tools the AI helper can call. All run on the server, read public databases only,
// time out after 10 seconds and return small result lists.

import type { Source } from "@/lib/types";
export type { Source };

const TIMEOUT_MS = 10_000;
const MAX = 8;

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { accept: "application/json", "user-agent": "CaseRoom/1.0 (research helper)" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`${new URL(url).host} answered ${res.status}`);
  return (await res.json()) as T;
}

const clip = (s: unknown, n: number) => (typeof s === "string" ? (s.length > n ? s.slice(0, n) + "…" : s) : "");
export const NCT_RE = /\bNCT\d{8}\b/i;

// ---------- ClinicalTrials.gov (API v2) ----------

type CtStudy = {
  protocolSection?: {
    identificationModule?: { nctId?: string; briefTitle?: string };
    statusModule?: { overallStatus?: string; lastUpdatePostDateStruct?: { date?: string } };
    designModule?: { phases?: string[] };
    conditionsModule?: { conditions?: string[] };
    eligibilityModule?: { eligibilityCriteria?: string; minimumAge?: string; maximumAge?: string; sex?: string };
    armsInterventionsModule?: { interventions?: { name?: string; type?: string }[] };
    contactsLocationsModule?: { locations?: { facility?: string; city?: string; state?: string; country?: string; status?: string }[] };
    descriptionModule?: { briefSummary?: string };
  };
};

function trialRow(s: CtStudy) {
  const p = s.protocolSection ?? {};
  const id = p.identificationModule?.nctId ?? "";
  return {
    nct_id: id,
    title: p.identificationModule?.briefTitle ?? "",
    status: p.statusModule?.overallStatus ?? "UNKNOWN",
    phase: (p.designModule?.phases ?? []).join(", ") || "Not given",
    conditions: (p.conditionsModule?.conditions ?? []).slice(0, 5),
    url: `https://clinicaltrials.gov/study/${id}`,
  };
}

export async function searchTrials(args: { query: string; condition?: string; recruiting_only?: boolean; location?: string }) {
  const q = new URLSearchParams({ pageSize: String(MAX), format: "json" });
  if (args.query) q.set("query.term", args.query);
  if (args.condition) q.set("query.cond", args.condition);
  if (args.location) q.set("query.locn", args.location);
  if (args.recruiting_only !== false) q.set("filter.overallStatus", "RECRUITING|NOT_YET_RECRUITING");
  const data = await getJson<{ studies?: CtStudy[] }>(`https://clinicaltrials.gov/api/v2/studies?${q}`);
  return (data.studies ?? []).map(trialRow);
}

export async function getTrial(nctId: string) {
  const id = nctId.toUpperCase().match(NCT_RE)?.[0];
  if (!id) throw new Error("Give a trial id like NCT01234567");
  const s = await getJson<CtStudy>(`https://clinicaltrials.gov/api/v2/studies/${id}?format=json`);
  const p = s.protocolSection ?? {};
  return {
    ...trialRow(s),
    last_updated: p.statusModule?.lastUpdatePostDateStruct?.date ?? null,
    summary: clip(p.descriptionModule?.briefSummary, 800),
    interventions: (p.armsInterventionsModule?.interventions ?? []).slice(0, 8).map((i) => `${i.type ?? ""} ${i.name ?? ""}`.trim()),
    eligibility: clip(p.eligibilityModule?.eligibilityCriteria, 3500),
    ages: [p.eligibilityModule?.minimumAge, p.eligibilityModule?.maximumAge].filter(Boolean).join(" to ") || null,
    sites: (p.contactsLocationsModule?.locations ?? []).slice(0, 10).map((l) =>
      [l.facility, l.city, l.state, l.country, l.status].filter(Boolean).join(", "),
    ),
  };
}

// ---------- PubMed (NCBI E-utilities) ----------

export async function searchPubmed(args: { query: string; since_year?: number }) {
  const term = args.since_year ? `(${args.query}) AND ${args.since_year}:3000[dp]` : args.query;
  const base = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";
  const search = await getJson<{ esearchresult?: { idlist?: string[] } }>(
    `${base}/esearch.fcgi?db=pubmed&retmode=json&sort=relevance&retmax=${MAX}&term=${encodeURIComponent(term)}`,
  );
  const ids = search.esearchresult?.idlist ?? [];
  if (ids.length === 0) return [];
  const sum = await getJson<{ result?: Record<string, { title?: string; fulljournalname?: string; source?: string; pubdate?: string; pubtype?: string[] }> }>(
    `${base}/esummary.fcgi?db=pubmed&retmode=json&id=${ids.join(",")}`,
  );
  return ids.map((id) => {
    const r = sum.result?.[id] ?? {};
    return {
      pmid: id,
      title: r.title ?? "",
      journal: r.fulljournalname ?? r.source ?? "",
      year: (r.pubdate ?? "").slice(0, 4),
      types: (r.pubtype ?? []).slice(0, 3),
      url: `https://pubmed.ncbi.nlm.nih.gov/${id}/`,
    };
  });
}

// ---------- bioRxiv / medRxiv (preprints, not peer reviewed) ----------

export async function searchBiorxiv(args: { query: string; server?: "biorxiv" | "medrxiv"; category?: string; days?: number }) {
  const server = args.server === "medrxiv" ? "medrxiv" : "biorxiv";
  const days = Math.min(Math.max(args.days ?? 90, 7), 365);
  const to = new Date();
  const from = new Date(to.getTime() - days * 86_400_000);
  const d = (x: Date) => x.toISOString().slice(0, 10);
  const cat = args.category ? `?category=${encodeURIComponent(args.category.toLowerCase().replace(/\s+/g, "_"))}` : "";
  const words = args.query.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
  const out: { doi: string; title: string; date: string; category: string; url: string; peer_reviewed: false }[] = [];
  // The API has no keyword search: read up to 3 pages of recent preprints and match the words.
  for (let cursor = 0; cursor < 300 && out.length < MAX; cursor += 100) {
    const data = await getJson<{ collection?: { doi: string; title: string; abstract?: string; date: string; category: string }[] }>(
      `https://api.biorxiv.org/details/${server}/${d(from)}/${d(to)}/${cursor}${cat}`,
    );
    const rows = data.collection ?? [];
    for (const r of rows) {
      const hay = `${r.title} ${r.abstract ?? ""}`.toLowerCase();
      if (words.length === 0 || words.every((w) => hay.includes(w)))
        out.push({ doi: r.doi, title: r.title, date: r.date, category: r.category, url: `https://doi.org/${r.doi}`, peer_reviewed: false });
      if (out.length >= MAX) break;
    }
    if (rows.length < 100) break;
  }
  return out;
}

// ---------- Tool definitions for the model ----------

export const TOOL_DEFS = [
  {
    name: "search_trials",
    description:
      "Search ClinicalTrials.gov for trials. Returns NCT id, title, status, phase, conditions, link. Recruiting trials only unless recruiting_only is false.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Keywords, e.g. 'EGFR exon 19 osimertinib resistance'" },
        condition: { type: "string", description: "Condition, e.g. 'non-small cell lung cancer'" },
        location: { type: "string", description: "Optional country, state or city" },
        recruiting_only: { type: "boolean" },
      },
      required: ["query"],
    },
  },
  {
    name: "get_trial",
    description: "Get one trial's details by NCT id: status, phase, interventions, entry rules (eligibility) and sites.",
    input_schema: { type: "object" as const, properties: { nct_id: { type: "string" } }, required: ["nct_id"] },
  },
  {
    name: "search_pubmed",
    description: "Search PubMed for peer reviewed papers. Returns PMID, title, journal, year, link.",
    input_schema: {
      type: "object" as const,
      properties: { query: { type: "string" }, since_year: { type: "integer" } },
      required: ["query"],
    },
  },
  {
    name: "search_biorxiv",
    description:
      "Find recent bioRxiv or medRxiv preprints whose title or abstract contains all the words. Preprints are NOT peer reviewed. Use short queries of 1 to 3 words.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: { type: "string" },
        server: { type: "string", enum: ["biorxiv", "medrxiv"] },
        category: { type: "string", description: "e.g. cancer_biology (bioRxiv) or oncology (medRxiv)" },
        days: { type: "integer", description: "How far back, 7 to 365. Default 90." },
      },
      required: ["query"],
    },
  },
];

export const TOOL_LABEL: Record<string, string> = {
  search_trials: "Searching ClinicalTrials.gov",
  get_trial: "Reading a trial's entry rules",
  search_pubmed: "Searching PubMed",
  search_biorxiv: "Searching preprints",
};

/** Runs a tool and returns both the text for the model and the sources it found. */
export async function runTool(name: string, input: Record<string, unknown>): Promise<{ result: unknown; sources: Source[] }> {
  switch (name) {
    case "search_trials": {
      const rows = await searchTrials(input as Parameters<typeof searchTrials>[0]);
      return { result: rows, sources: rows.map((r) => ({ url: r.url, title: `${r.nct_id}: ${r.title}`, kind: "trial", peerReviewed: false, note: r.status })) };
    }
    case "get_trial": {
      const t = await getTrial(String(input.nct_id ?? ""));
      return { result: t, sources: [{ url: t.url, title: `${t.nct_id}: ${t.title}`, kind: "trial", peerReviewed: false, note: t.status }] };
    }
    case "search_pubmed": {
      const rows = await searchPubmed(input as Parameters<typeof searchPubmed>[0]);
      return { result: rows, sources: rows.map((r) => ({ url: r.url, title: r.title, kind: "paper", peerReviewed: true, note: [r.journal, r.year].filter(Boolean).join(", ") })) };
    }
    case "search_biorxiv": {
      const rows = await searchBiorxiv(input as Parameters<typeof searchBiorxiv>[0]);
      return { result: rows, sources: rows.map((r) => ({ url: r.url, title: r.title, kind: "preprint", peerReviewed: false, note: "Preprint, not peer reviewed" })) };
    }
    default:
      throw new Error(`Unknown tool ${name}`);
  }
}
