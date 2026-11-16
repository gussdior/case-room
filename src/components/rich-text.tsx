import type { ReactNode } from "react";
import { safeHref } from "@/lib/safe-href";

/** A small safe renderer for AI text: paragraphs, lists, bold, italics and http links. No raw HTML ever. */

const INLINE =
  /\*\*([^*\n]+?)\*\*|__([^_\n]+?)__|\*([^*\s][^*\n]*?)\*|(?<![A-Za-z0-9])_([^_\s][^_\n]*?)_(?![A-Za-z0-9])|`([^`\n]+?)`|\[([^\]\n]+?)\]\((https?:\/\/[^\s)]+)\)|\[(https?:\/\/[^\]\s]+)\]/g;

const linkClass = "underline decoration-brand-line underline-offset-2 hover:decoration-brand";
const citeClass =
  "rounded-[5px] bg-brand-soft px-1.5 py-px font-sans text-[11px] font-bold no-underline transition-colors hover:bg-brand hover:text-white";

type Ctx = { num: (url: string) => number; titles?: Record<string, string> };

function inline(text: string, ctx: Ctx, depth = 0): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let k = 0;
  for (const m of text.matchAll(INLINE)) {
    const at = m.index ?? 0;
    if (at > last) out.push(text.slice(last, at));
    const key = `${depth}-${k++}`;
    if (m[1] !== undefined || m[2] !== undefined) out.push(<strong key={key}>{inline(m[1] ?? m[2], ctx, depth + 1)}</strong>);
    else if (m[3] !== undefined || m[4] !== undefined) out.push(<em key={key}>{inline(m[3] ?? m[4], ctx, depth + 1)}</em>);
    else if (m[5] !== undefined) out.push(m[5]);
    else if (m[6] !== undefined)
      out.push(
        <a key={key} href={safeHref(m[7])} target="_blank" rel="noopener noreferrer nofollow" className={linkClass}>
          {m[6]}
        </a>,
      );
    else if (m[8] !== undefined)
      out.push(
        <sup key={key}>
          <a href={safeHref(m[8])} target="_blank" rel="noopener noreferrer nofollow" title={ctx.titles?.[m[8]] ?? m[8]} className={citeClass}>
            {ctx.num(m[8])}
          </a>
        </sup>,
      );
    last = at + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  // Markers left open (a cut off answer, or one still streaming) are dropped, never shown.
  return out.map((p) => (typeof p === "string" ? p.replace(/\*\*|__|`/g, "") : p));
}

type Block = { kind: "p"; lines: string[] } | { kind: "ul" | "ol"; items: string[] } | { kind: "h"; text: string };

const UL = /^\s*[-*•]\s+(.*)$/;
const OL = /^\s*\d{1,2}[.)]\s+(.*)$/;
const H = /^\s*#{1,6}\s+(.*)$/;

function blocks(text: string): Block[] {
  const out: Block[] = [];
  let cur: Block | null = null;
  for (const raw of text.replace(/\r/g, "").split("\n")) {
    const line = raw.trimEnd();
    if (!line.trim() || /^\s*([-*_])\1{2,}\s*$/.test(line)) {
      cur = null;
      continue;
    }
    const h = line.match(H);
    const ul = line.match(UL);
    const ol = line.match(OL);
    if (h) {
      out.push({ kind: "h", text: h[1].replace(/\*\*/g, "") });
      cur = null;
    } else if (ul || ol) {
      const kind = ul ? "ul" : "ol";
      const item = (ul ?? ol)![1];
      if (cur && cur.kind === kind) cur.items.push(item);
      else out.push((cur = { kind, items: [item] }));
    } else if (cur && cur.kind !== "p" && /^\s{2,}\S/.test(raw)) {
      cur.items[cur.items.length - 1] += ` ${line.trim()}`;
    } else if (cur && cur.kind === "p") cur.lines.push(line.replace(/^\s*>\s?/, ""));
    else out.push((cur = { kind: "p", lines: [line.replace(/^\s*>\s?/, "")] }));
  }
  return out;
}

/** Plain words from AI text, for places that can only hold a string. */
export function plainText(text: string): string {
  return text
    .replace(/\[([^\]\n]+?)\]\((https?:\/\/[^\s)]+)\)/g, "$1")
    .replace(/\*\*|__|`/g, "")
    .replace(/^\s*#{1,6}\s+/gm, "")
    .replace(/(^|[\s(])\*([^*\s][^*\n]*?)\*/g, "$1$2");
}

export function RichText({
  text,
  titles,
  className = "",
  tail,
}: {
  text: string;
  /** Titles for [url] citations, shown on hover. */
  titles?: Record<string, string>;
  className?: string;
  /** Sits right after the last word, like the typing caret. */
  tail?: ReactNode;
}) {
  const order: string[] = [];
  const ctx: Ctx = {
    titles,
    num: (url) => {
      let i = order.indexOf(url);
      if (i === -1) i = order.push(url) - 1;
      return i + 1;
    },
  };
  const bs = blocks(text);
  const lastIdx = bs.length - 1;
  return (
    <div className={`flex flex-col gap-2.5 break-words ${className}`}>
      {bs.map((b, i) => {
        const end = i === lastIdx ? tail : null;
        if (b.kind === "h")
          return (
            <p key={i} className="font-semibold text-ink">
              {inline(b.text, ctx)}
              {end}
            </p>
          );
        if (b.kind === "p")
          return (
            <p key={i}>
              {b.lines.map((l, n) => (
                <span key={n}>
                  {n > 0 && <br />}
                  {inline(l, ctx)}
                </span>
              ))}
              {end}
            </p>
          );
        const items = b.items.map((it, n) => (
          <li key={n}>
            {inline(it, ctx)}
            {n === b.items.length - 1 && end}
          </li>
        ));
        return b.kind === "ul" ? (
          <ul key={i} className="flex list-disc flex-col gap-1 pl-5">
            {items}
          </ul>
        ) : (
          <ol key={i} className="flex list-decimal flex-col gap-1 pl-5">
            {items}
          </ol>
        );
      })}
      {bs.length === 0 && tail}
    </div>
  );
}
