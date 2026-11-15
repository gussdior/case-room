import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import { InviteLink } from "@/components/invite-link";
import { Badge, EXPERTISE_TONE, ExpertiseBadge, btn } from "@/components/ui";
import { requireViewer } from "@/lib/auth";
import { loadMyCases } from "@/lib/db-case";
import { loadVolunteerProfile } from "@/lib/db-profile";
import { EXPERTISE_LABEL, type TaskStatus } from "@/lib/types";

export const metadata = { title: "Volunteer profile | Case Room" };

const TASK_STATE: Record<TaskStatus, { label: string; tone: "brand" | "warn" | "ok" | "bad" | "neutral" }> = {
  open: { label: "Open", tone: "neutral" },
  taken: { label: "In progress", tone: "brand" },
  stuck: { label: "Stuck", tone: "bad" },
  submitted: { label: "Waiting for a check", tone: "warn" },
  checked: { label: "Checked", tone: "ok" },
};

const month = (iso: string) => {
  const d = new Date(iso.length <= 7 ? `${iso}-01T12:00:00Z` : iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
};
const ago = (iso: string) => {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (Number.isNaN(days)) return "";
  if (days < 1) return "today";
  if (days < 14) return `${days} day${days === 1 ? "" : "s"} ago`;
  return month(iso);
};
const zoneName = (tz: string | null) => {
  if (!tz) return null;
  try {
    return (
      new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "long" }).formatToParts(new Date()).find((p) => p.type === "timeZoneName")
        ?.value ?? tz
    );
  } catch {
    return tz;
  }
};

export default async function ProfilePage({ params }: PageProps<"/profile/[id]">) {
  const { id } = await params;
  await requireViewer(`/profile/${id}`);
  const p = await loadVolunteerProfile(id);

  if (!p) {
    return (
      <>
        <AppHeader />
        <main className="mx-auto flex w-full max-w-[640px] flex-1 flex-col gap-4 px-4 py-20 sm:px-8">
          <h1 className="font-display text-[34px] leading-tight font-medium">This profile isn&apos;t visible to you</h1>
          <p className="text-muted">
            You can see a volunteer&apos;s profile when you&apos;re on a case together, or when they ask to join your case. The link may
            also be wrong.
          </p>
          <Link href="/cases" className={`${btn.secondary} self-start`}>
            Go to my cases
          </Link>
        </main>
      </>
    );
  }

  const myCases = p.isMe ? [] : (await loadMyCases()).filter((c) => (c.role === "creator" || c.role === "co_approver") && c.status === "approved");
  const facts = [p.roleTitle, p.yearsExperience !== null ? `${p.yearsExperience} year${p.yearsExperience === 1 ? "" : "s"}` : null]
    .filter(Boolean)
    .join(", ");
  const zone = zoneName(p.timeZone);

  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-[1136px] flex-1 px-4 pt-10 pb-16 sm:px-8">
        <header className="flex flex-wrap items-start gap-x-6 gap-y-4">
          <div
            aria-hidden="true"
            className={`grid h-20 w-20 flex-none place-items-center rounded-full font-display text-[34px] font-medium ${EXPERTISE_TONE[p.expertise]}`}
          >
            {p.name.replace("Dr. ", "").charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-[1_1_420px]">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="font-display text-[38px] leading-tight font-medium tracking-[-0.01em]">{p.name}</h1>
              {p.hasProof && <Badge tone="neutral">Link provided, not verified</Badge>}
            </div>
            <p className="mt-1 text-muted">
              {[p.headline, facts].filter(Boolean).join(". ")}
              {(p.headline || facts) && " "}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <ExpertiseBadge expertise={p.expertise} />
              {p.areas.map((a) => (
                <Badge key={a}>{a}</Badge>
              ))}
            </div>
            <p className="mt-3 text-[13px] text-muted">
              Volunteering since {month(p.joinedAt)}
              {zone ? `. ${zone}.` : "."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {p.isMe ? (
              <Link href={`/onboarding?next=/profile/${p.id}`} className={btn.secondary}>
                Edit my profile
              </Link>
            ) : myCases.length > 0 ? (
              <details className="relative">
                <summary className={`${btn.mark} list-none`}>Invite to my case</summary>
                <div className="panel absolute right-0 z-20 mt-2 flex w-[340px] flex-col gap-3 p-4 shadow-[0_18px_40px_-20px_rgba(23,32,43,.4)]">
                  <p className="text-[13px] text-muted">Send {p.name} the link. They ask to join and you approve, as usual.</p>
                  {myCases.map((c) => (
                    <div key={c.id} className="flex flex-col gap-1.5">
                      <span className="text-sm font-semibold">{c.goal}</span>
                      <InviteLink caseId={c.id} />
                    </div>
                  ))}
                </div>
              </details>
            ) : null}
          </div>
        </header>

        <section aria-label="Impact" className="mt-10 grid gap-px overflow-hidden rounded-[14px] border border-line bg-line sm:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div className="bg-ink p-6 text-white">
            <strong className="block font-display text-[44px] leading-none font-medium">{p.familiesHelped}</strong>
            <span className="mt-2 block text-[15px]">famil{p.familiesHelped === 1 ? "y" : "ies"} helped</span>
            <span className="mt-1 block text-[13px] text-[#c9cfd8]">
              {p.briefsFinished} brief{p.briefsFinished === 1 ? "" : "s"} finished before a doctor visit
            </span>
          </div>
          {[
            [p.tasksChecked, "pieces of work checked"],
            [p.checksDone, "reviews of others' work"],
            [p.points, "points"],
          ].map(([n, l]) => (
            <div key={l} className="bg-sheet p-6">
              <strong className="block font-display text-[32px] leading-none font-medium">{n}</strong>
              <span className="mt-2 block text-sm text-muted">{l}</span>
            </div>
          ))}
        </section>

        <div className="mt-10 grid items-start gap-10 lg:grid-cols-2">
          <section aria-labelledby="now">
            <h2 id="now" className="font-display text-2xl font-medium">
              Working on right now
            </h2>
            {p.currentTasks.length === 0 ? (
              <p className="mt-3 text-sm text-muted">Nothing in progress right now.</p>
            ) : (
              <ul className="mt-3 flex flex-col gap-2">
                {p.currentTasks.map((t) => (
                  <li key={t.taskId}>
                    <Link href={`/case/${t.caseId}/task/${t.taskId}`} className="row-link flex-wrap">
                      <span className="min-w-0 flex-[1_1_220px]">
                        <span className="block text-[15px] font-semibold">{t.title}</span>
                        <span className="block text-xs text-muted">{EXPERTISE_LABEL[t.expertise]} task</span>
                      </span>
                      <Badge tone={TASK_STATE[t.status].tone}>{TASK_STATE[t.status].label}</Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            )}

            <h2 className="mt-10 font-display text-2xl font-medium">Recent checked work</h2>
            {p.recentCheckedWork.length === 0 ? (
              <p className="mt-3 text-sm text-muted">No checked work yet.</p>
            ) : (
              <ul className="mt-3 flex flex-col divide-y divide-line">
                {p.recentCheckedWork.map((w, i) => (
                  <li key={i} className="flex flex-wrap items-baseline gap-x-3 py-3">
                    {w.taskId && w.caseId ? (
                      <Link href={`/case/${w.caseId}/task/${w.taskId}`} className="font-semibold text-ink no-underline hover:text-brand hover:underline">
                        {w.title}
                      </Link>
                    ) : (
                      <span className="font-semibold">{w.title}</span>
                    )}
                    <span className="text-[13px] text-muted">Checked {ago(w.checkedAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="helped">
            <h2 id="helped" className="font-display text-2xl font-medium">
              Cases helped
            </h2>
            {p.casesHelped.length === 0 ? (
              <p className="mt-3 text-sm text-muted">No cases yet.</p>
            ) : (
              <ul className="mt-3 flex flex-col gap-2">
                {p.casesHelped.map((c, i) => (
                  <li key={i} className="flex flex-wrap items-center gap-3 rounded-[10px] border border-line bg-sheet px-4 py-3.5">
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">{c.cancerType}</span>
                      <span className="block text-[13px] text-muted">
                        {month(c.fromMonth) === month(c.toMonth) ? month(c.fromMonth) : `${month(c.fromMonth)} to ${month(c.toMonth)}`}
                      </span>
                    </span>
                    {c.briefFinished ? <Badge tone="ok">Brief finished</Badge> : <Badge tone="brand">Active</Badge>}
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-[13px] text-muted">Cases show only the cancer type and dates. Patient details stay inside each case.</p>

            {p.isMe && (
              <div className="mt-8 rounded-[12px] bg-sheet p-4 text-sm">
                <strong>Case alerts:</strong>{" "}
                {p.alertsOn ? `on, ${p.alertFrequency === "instant" ? "right away" : "weekly summary"}.` : "off."}{" "}
                <Link href={`/onboarding?next=/profile/${p.id}`}>Change</Link>
              </div>
            )}
          </section>
        </div>

        <p className="mt-12 border-t border-line pt-5 text-[13px] text-muted">
          <strong className="text-ink">Who sees this:</strong> people on a case with {p.isMe ? "you" : p.name}, and case creators
          reviewing a join request. It is not public on the web.
        </p>
      </main>
    </>
  );
}
