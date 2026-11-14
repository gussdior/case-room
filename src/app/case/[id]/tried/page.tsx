import { notFound, redirect } from "next/navigation";
import { deleteTreatment } from "@/app/tried-actions";
import { FindingsLog, type FindingView } from "@/components/findings-log";
import { ActionButton } from "@/components/forms";
import { AddTreatmentForm, LogFindingForm } from "@/components/tried-forms";
import { getRoom, memberById } from "@/lib/data";
import { loadTried } from "@/lib/db-tried";
import { OUTCOME_LABEL, type Treatment, type TreatmentOutcome } from "@/lib/types";

export const metadata = { title: "What we tried | Case Room" };

const DOT: Record<TreatmentOutcome, string> = {
  worked: "border-ok bg-white",
  stopped_working: "border-bad bg-white",
  side_effects: "border-bad bg-white",
  waiting: "border-brand bg-brand animate-[ring_2.4s_ease-out_3]",
  unknown: "border-line-2 bg-white",
};
const RESULT: Record<TreatmentOutcome, string> = {
  worked: "bg-ok-soft text-ok",
  stopped_working: "bg-bad-soft text-bad",
  side_effects: "bg-bad-soft text-bad",
  waiting: "bg-brand-soft text-brand",
  unknown: "",
};

const monthName = (d: string) =>
  new Date(`${d.slice(0, 7)}-01T12:00:00Z`).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });

function span(t: Treatment): string {
  if (!t.startedOn) return "Date not added";
  if (!t.endedOn) return monthName(t.startedOn);
  const a = new Date(`${t.startedOn.slice(0, 7)}-01T12:00:00Z`);
  const b = new Date(`${t.endedOn.slice(0, 7)}-01T12:00:00Z`);
  const months = (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + b.getUTCMonth() - a.getUTCMonth();
  return `${monthName(t.startedOn)} to ${monthName(t.endedOn)}${months > 0 ? `, ${months} month${months === 1 ? "" : "s"}` : ""}`;
}

export default async function TriedPage({ params, searchParams }: PageProps<"/case/[id]/tried">) {
  const { id } = await params;
  const sp = await searchParams;
  const loaded = await getRoom(id);
  if (!loaded) notFound();
  if (loaded.teaser) redirect(`/case/${id}`);
  const room = loaded.room;
  const demo = room.viewer === null;
  const v = room.viewer;
  const canEditTreatments = demo || (!!v && (v.role === "creator" || v.role === "co_approver" || v.role === "family"));
  const { treatments, findings } = await loadTried(room.id);

  const name = (pid: string | null) =>
    pid === null ? null : pid === "ai" ? "the AI" : pid === v?.id ? "you" : (memberById(room, pid)?.name ?? "a former member");
  const views: FindingView[] = findings.map((f) => ({
    ...f,
    foundByName: name(f.foundBy) ?? "someone",
    checkedByName: name(f.checkedBy),
    mine: !!v && f.foundBy === v.id,
    canEdit: !!v && (f.foundBy === v.id || v.isAdmin),
  }));
  const taskId = typeof sp.task === "string" ? sp.task : undefined;
  const fromTask = taskId ? room.tasks.find((t) => t.id === taskId) : undefined;
  const openLog = sp.log === "1" || !!fromTask;

  return (
    <div className="flex flex-col">
      <header className="flex flex-wrap items-end gap-x-10 gap-y-4">
        <div className="min-w-0 flex-[1_1_520px]">
          <h1 className="font-display text-[38px] leading-[1.1] font-medium tracking-[-0.015em] sm:text-[44px]">What we tried</h1>
          <p className="mt-3 max-w-[640px] text-base text-muted">
            Her treatments so far, and everything the team has looked into. Check here before you start, so nobody repeats work.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canEditTreatments && (
            <a href="#add-treatment" className="btn btn-secondary">
              Add a treatment
            </a>
          )}
          <a href="#log" className="btn btn-mark">
            Log a finding
          </a>
        </div>
      </header>

      <div className="mt-8 grid items-start gap-10 lg:grid-cols-[400px_minmax(0,1fr)]">
        <section aria-labelledby="treatments">
          <h2 id="treatments" className="font-display text-[26px] font-medium">
            Her treatments so far
          </h2>
          <p className="mt-1 mb-5 text-sm text-muted">Added by the family or the case creator.</p>

          {treatments.length === 0 ? (
            <div className="rounded-[12px] border border-dashed border-line-2 px-5 py-6 text-sm text-muted">
              <p className="font-semibold text-ink">No treatments added yet.</p>
              <p className="mt-1">
                {canEditTreatments
                  ? "Start with the diagnosis, then each treatment and how it went. Volunteers use this so they don't suggest something she already had."
                  : "The family or case creator adds these. Ask in the discussion if you need them."}
              </p>
            </div>
          ) : (
            <ol className="relative pl-[26px] before:absolute before:top-2 before:bottom-2 before:left-[7px] before:w-0.5 before:bg-[#d5dad5]">
              {treatments.map((t) => (
                <li key={t.id} className="group relative pb-6">
                  <span aria-hidden="true" className={`absolute top-1.5 -left-6 h-3 w-3 rounded-full border-[3px] ${DOT[t.outcome]}`} />
                  <div className="text-xs text-muted">{span(t)}</div>
                  <h3 className="mt-0.5 font-display text-[19px] leading-snug font-medium">{t.title}</h3>
                  {t.details && <p className="mt-1 text-sm text-ink-2">{t.details}</p>}
                  {t.outcome !== "unknown" && (
                    <span className={`mt-1.5 inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${RESULT[t.outcome]}`}>
                      {t.outcomeNote || OUTCOME_LABEL[t.outcome]}
                    </span>
                  )}
                  {!demo && canEditTreatments && (
                    <div className="mt-1 opacity-100 transition-opacity sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
                      <ActionButton action={deleteTreatment.bind(null, room.id, t.id)} variant="ghost" className="min-h-9 px-2.5 text-[13px]">
                        Remove
                      </ActionButton>
                    </div>
                  )}
                </li>
              ))}
            </ol>
          )}

          {canEditTreatments && (
            <details id="add-treatment" className="panel group mt-2 scroll-mt-6">
              <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between px-4 font-semibold transition-colors hover:bg-paper [&::-webkit-details-marker]:hidden">
                Add a treatment or test
                <span aria-hidden="true" className="text-xl leading-none text-muted transition-transform group-open:rotate-45">
                  +
                </span>
              </summary>
              <div className="border-t border-line p-4">
                <AddTreatmentForm caseId={room.id} demo={demo} />
              </div>
            </details>
          )}
          <p className="mt-4 rounded-[10px] bg-hover px-3.5 py-3 text-[13px] text-muted">
            Not shown here: names, dates of birth or hospital IDs. The family only adds what they&apos;re comfortable sharing.
          </p>
        </section>

        <section aria-labelledby="findings" className="sheet px-5 py-8 sm:px-11 sm:py-9">
          <h2 id="findings" className="font-display text-[26px] font-medium">
            What the team checked
          </h2>
          <p className="mt-1 mb-5 text-sm text-muted">Every finding has a source. It counts once a second person checks it.</p>

          {views.length === 0 ? (
            <div className="mb-6 rounded-[12px] border border-dashed border-line-2 px-5 py-8 text-center">
              <p className="font-display text-xl">Nothing logged yet</p>
              <p className="mx-auto mt-1 max-w-[46ch] text-sm text-muted">
                Looked into a trial, paper or idea, even one that didn&apos;t fit? Log it so nobody spends an hour on it again.
              </p>
            </div>
          ) : (
            <FindingsLog caseId={room.id} findings={views} demo={demo} />
          )}

          <details id="log" open={openLog} className="group mt-6 scroll-mt-6 rounded-[12px] border border-line">
            <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between rounded-[12px] px-4 font-semibold transition-colors hover:bg-paper [&::-webkit-details-marker]:hidden">
              {fromTask ? `Log a finding from "${fromTask.title.length > 50 ? fromTask.title.slice(0, 47) + "..." : fromTask.title}"` : "Log a finding"}
              <span aria-hidden="true" className="text-xl leading-none text-muted transition-transform group-open:rotate-45">
                +
              </span>
            </summary>
            <div className="border-t border-line p-4">
              <LogFindingForm caseId={room.id} taskId={fromTask?.id} demo={demo} />
            </div>
          </details>

          <p className="mt-6 flex items-center gap-3 rounded-[10px] bg-brand-soft px-4 py-3.5 text-sm">
            <i aria-hidden="true" className="h-2 w-2 flex-none rounded-full bg-brand" />
            The AI helper reads this page. When someone asks about something already ruled out, it says so and gives the reason.
          </p>
        </section>
      </div>
    </div>
  );
}
