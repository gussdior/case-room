import "server-only";
import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_ALT = "Case Room: help with this case using your AI";

const font = (f: string) => readFile(join(process.cwd(), "assets/og", f));

export type CardChip = { text: string; brand?: boolean };

/** The link preview card: the Case Room mark, two short sentences and a few chips. Never any names. */
export async function caseCard({ first, second, chips }: { first: string; second: string; chips: CardChip[] }) {
  const [serif, serifBold, sans] = await Promise.all([
    font("newsreader-latin-500-normal.woff"),
    font("newsreader-latin-600-normal.woff"),
    font("instrument-sans-latin-600-normal.woff"),
  ]);
  const size = first.length + second.length > 62 ? 62 : 74;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#F3F5F3",
          padding: "64px 72px",
          color: "#17202B",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", fontFamily: "Newsreader", fontWeight: 600, fontSize: 38 }}>
          <div style={{ width: 26, height: 26, borderRadius: 6, background: "#FFE36E", marginRight: 16, transform: "rotate(-8deg)" }} />
          Case Room
        </div>
        <div style={{ display: "flex", flexDirection: "column", fontFamily: "Newsreader", fontWeight: 500, fontSize: size, lineHeight: 1.12, letterSpacing: "-0.02em" }}>
          <div style={{ display: "flex" }}>{first}</div>
          <div style={{ display: "flex", marginTop: 6 }}>
            <div style={{ display: "flex", padding: "0 10px", marginLeft: -10, backgroundImage: "linear-gradient(to bottom, rgba(255,227,110,0) 56%, #FFE36E 56%)" }}>{second}</div>
          </div>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", fontFamily: "Instrument Sans", fontWeight: 600, fontSize: 26 }}>
          {chips.map((c) => (
            <div
              key={c.text}
              style={{
                display: "flex",
                padding: "8px 20px",
                borderRadius: 24,
                marginRight: 14,
                background: c.brand ? "#EEF0FA" : "#E7EAE7",
                color: c.brand ? "#2B3FA0" : "#4A5563",
              }}
            >
              {c.text}
            </div>
          ))}
        </div>
      </div>
    ),
    {
      ...OG_SIZE,
      fonts: [
        { name: "Newsreader", data: serif, style: "normal", weight: 500 },
        { name: "Newsreader", data: serifBold, style: "normal", weight: 600 },
        { name: "Instrument Sans", data: sans, style: "normal", weight: 600 },
      ],
    },
  );
}

/** "Lung cancer, stage IV." from the two labels, or a plain fallback. */
export function cardFirstLine(type?: string | null, stage?: string | null): string {
  const t = type?.trim().slice(0, 40);
  const s = stage?.trim().slice(0, 24);
  if (t && s) return `${t}, ${s.charAt(0).toLowerCase()}${s.slice(1)}.`;
  if (t) return `${t}.`;
  return "One cancer case.";
}

export function visitChip(days: number | null | undefined): string | null {
  if (typeof days !== "number" || days < 0) return null;
  return days === 0 ? "Visit today" : `Visit in ${days} day${days === 1 ? "" : "s"}`;
}
