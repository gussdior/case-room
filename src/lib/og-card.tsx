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

export type Seat = { letter: string; label: string; bg: string; fg: string };

/** Card A, "the empty seat": the ask on the left, the team around one case on the right with one seat open. Never any names. */
export async function seatCard({
  before,
  role,
  after,
  footer,
  seats,
}: {
  before: string;
  role: string;
  after: string;
  footer: string;
  seats: Seat[];
}) {
  const [serif, serifBold, sans] = await Promise.all([
    font("newsreader-latin-500-normal.woff"),
    font("newsreader-latin-600-normal.woff"),
    font("instrument-sans-latin-600-normal.woff"),
  ]);
  const words: { w: string; hl: boolean; lastHl: boolean }[] = [];
  const roleWords = role.split(" ");
  before.split(" ").forEach((w) => words.push({ w, hl: false, lastHl: false }));
  roleWords.forEach((w, i) => words.push({ w, hl: true, lastHl: i === roleWords.length - 1 }));
  after.split(" ").forEach((w) => words.push({ w, hl: false, lastHl: false }));
  const total = `${before} ${role} ${after}`.length;
  const fontSize = total > 78 ? 52 : total > 66 ? 57 : 62;
  const gap = Math.round(fontSize * 0.26);

  // Seats sit around the table; the open seat is always bottom right.
  const cx = 290;
  const cy = 300;
  const r = 208;
  const d = 116;
  const n = seats.length + 1;
  const at = (deg: number) => ({ x: cx + r * Math.cos((deg * Math.PI) / 180), y: cy + r * Math.sin((deg * Math.PI) / 180) });
  const placed = seats.map((seat, i) => ({ seat, ...at(45 + ((i + 1) * 360) / n) }));
  const open = at(45);
  const seatBox = (x: number, y: number) => ({
    position: "absolute" as const,
    left: x - 110,
    top: y - d / 2,
    width: 220,
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
  });
  const label = { display: "flex", marginTop: 8, fontFamily: "Instrument Sans", fontWeight: 600, fontSize: 20, color: "#4A5563" };

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#F3F5F3", color: "#17202B" }}>
        <div style={{ width: 640, height: "100%", display: "flex", flexDirection: "column", padding: "52px 0 50px 60px" }}>
          <div style={{ display: "flex", alignItems: "center", fontFamily: "Newsreader", fontWeight: 600, fontSize: 32 }}>
            <div style={{ width: 22, height: 22, borderRadius: 5, background: "#FFE36E", marginRight: 14, transform: "rotate(-8deg)" }} />
            Case Room
          </div>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              marginTop: "auto",
              fontFamily: "Newsreader",
              fontWeight: 500,
              fontSize,
              lineHeight: 1.14,
              letterSpacing: "-0.015em",
            }}
          >
            {words.map((x, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  paddingRight: x.hl && !x.lastHl ? gap : 0,
                  marginRight: x.hl && !x.lastHl ? 0 : gap,
                  ...(x.hl ? { backgroundImage: "linear-gradient(to bottom, rgba(255,227,110,0) 58%, #FFE36E 58%)" } : {}),
                }}
              >
                {x.w}
              </div>
            ))}
          </div>
          <div style={{ display: "flex", marginTop: 20, fontFamily: "Instrument Sans", fontWeight: 600, fontSize: 25, color: "#4A5563" }}>{footer}</div>
        </div>
        <div style={{ width: 560, height: "100%", display: "flex", position: "relative" }}>
          <div
            style={{
              position: "absolute",
              left: cx - 124,
              top: cy - 124,
              width: 248,
              height: 248,
              borderRadius: 124,
              background: "#FFFFFF",
              border: "2px solid #E1E5E1",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: "Newsreader",
              fontWeight: 500,
              fontSize: 27,
              lineHeight: 1.25,
            }}
          >
            <div style={{ display: "flex" }}>One case.</div>
            <div style={{ display: "flex" }}>One seat open.</div>
          </div>
          {placed.map(({ seat, x, y }, i) => (
            <div key={i} style={seatBox(x, y)}>
              <div
                style={{
                  width: d,
                  height: d,
                  borderRadius: d / 2,
                  background: seat.bg,
                  color: seat.fg,
                  border: "5px solid #FFFFFF",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: "Instrument Sans",
                  fontWeight: 600,
                  fontSize: 40,
                }}
              >
                {seat.letter}
              </div>
              <div style={label}>{seat.label}</div>
            </div>
          ))}
          <div style={seatBox(open.x, open.y)}>
            <div
              style={{
                width: d,
                height: d,
                borderRadius: d / 2,
                background: "#FFFBEA",
                color: "#6B5300",
                border: "5px dashed #D9BC3B",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: "Instrument Sans",
                fontWeight: 600,
                fontSize: 44,
              }}
            >
              ?
            </div>
            <div style={{ ...label, color: "#6B5300" }}>This seat is yours</div>
          </div>
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
