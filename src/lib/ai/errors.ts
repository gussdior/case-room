// Turns an AI provider failure into a plain message for the user and a log line for us.
// Never logs or returns the key.
export function aiErrorMessage(err: unknown, where: string): string {
  const e = err as { status?: number; message?: string; name?: string; error?: { error?: { type?: string; message?: string } } };
  const status = typeof e?.status === "number" ? e.status : 0;
  const detail = String(e?.error?.error?.message ?? e?.message ?? "").slice(0, 300);
  console.error(`[ai] ${where} failed`, { status, name: e?.name, type: e?.error?.error?.type, detail });
  const low = detail.toLowerCase();
  if (status === 401) return "The AI key isn't valid. The site owner needs to replace it.";
  if (low.includes("credit balance") || low.includes("billing")) return "The AI account has no credit. The site owner needs to add credit.";
  if (status === 403) return "The AI key doesn't have permission for this. The site owner needs to check it.";
  if (status === 404) return "This AI model isn't available for the site's key. The site owner needs to check it.";
  if (status === 429) return "The AI is busy right now. Try again in a minute.";
  if (status === 529 || status >= 500) return "The AI service is overloaded. Try again in a minute.";
  if (e?.name === "APIConnectionTimeoutError" || low.includes("timed out") || low.includes("timeout")) return "The AI took too long. Try again.";
  if (status === 400) return "The AI couldn't read this request. We logged it and will fix it.";
  return "The AI didn't answer. Try again in a minute.";
}
