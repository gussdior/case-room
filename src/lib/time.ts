export function timeAgo(iso: string, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d} day${d === 1 ? "" : "s"} ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function daysUntil(date: string | null, now = new Date()): number | null {
  if (!date) return null;
  const target = new Date(`${date}T12:00:00`);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** "2026-11-19" as "November 19, 2026". Anything else comes back unchanged. */
export function friendlyDate(date: string | null | undefined): string {
  if (!date) return "";
  const m = String(date).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return String(date);
  return new Date(`${m[1]}-${m[2]}-${m[3]}T12:00:00`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

/** "2026-11" or "2026-11-19" as "November 2026". */
export function friendlyMonth(date: string | null | undefined): string {
  if (!date) return "";
  const m = String(date).match(/^(\d{4})-(\d{2})/);
  if (!m) return String(date);
  return new Date(`${m[1]}-${m[2]}-15T12:00:00`).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

/** A date with how far away it is: "November 19, 2026 (in 3 days)". */
export function dateWithDistance(date: string | null | undefined, now = new Date()): string {
  if (!date) return "";
  const d = daysUntil(String(date).slice(0, 10), now);
  const rel =
    d === null || Number.isNaN(d)
      ? ""
      : d === 0
        ? "today"
        : d === 1
          ? "tomorrow"
          : d > 1
            ? `in ${d} days`
            : d === -1
              ? "yesterday"
              : `${-d} days ago`;
  return rel ? `${friendlyDate(date)} (${rel})` : friendlyDate(date);
}

/** Rules every AI prompt shares about wording. */
export const AI_WORDING_RULES = `- Call the material you were given "the case notes". Never say "pack" or "case pack".
- Write dates the way people say them, like "November 19, 2026" or "in 3 days". Never write dates as 2026-11-19.`;
