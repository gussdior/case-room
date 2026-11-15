/** Only http and https links are rendered. Anything else (javascript:, data:) becomes a dead link. */
export function safeHref(url: string | undefined | null): string {
  if (!url) return "#";
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:" ? u.href : "#";
  } catch {
    return "#";
  }
}
