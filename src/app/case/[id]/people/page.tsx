import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { decideRequest, removeMember } from "@/app/case-actions";
import { DemoButton } from "@/components/demo-button";
import { ActionButton } from "@/components/forms";
import { Avatar, Badge, Card, PersonLink } from "@/components/ui";
import { approvedMembers, getRoom, leaderboard, memberById, pendingRequests } from "@/lib/data";
import { QuestionsInbox } from "@/components/case-questions";
import { loadTeamQuestions } from "@/lib/db-questions";
import { SAMPLE_VISITOR_QUESTIONS } from "@/lib/sample-case";
import { createClient } from "@/lib/supabase/server";
import { timeAgo } from "@/lib/time";
import { EXPERTISE_LABEL, type CaseRoom } from "@/lib/types";

async function loadReports(room: CaseRoom) {
  if (!room.viewer?.isAdmin) return [];
  const supabase = await createClient();
  const ids = room.messages.map((m) => m.id);
  if (ids.length === 0) return [];
  const { data } = await supabase
    .from("reports")
    .select("id, message_id, reason, status, created_at")
    .in("message_id", ids)
    .eq("status", "open")
    .order("created_at", { ascending: false });
  return (data ?? []).map((r) => ({ ...r, message: room.messages.find((m) => m.id === r.message_id) }));
}

export default async function PeoplePage({ params }: PageProps<"/case/[id]/people">) {
  const { id } = await params;
  const loaded = await getRoom(id);
  if (!loaded) notFound();
  if (loaded.teaser) redirect(`/case/${id}`);
  const room = loaded.room;
  const demo = room.viewer === null;
  if (!demo && !room.viewer?.isAdmin) redirect(`/case/${id}`);
  const isCreator = room.viewer?.role === "creator";

  const pending = pendingRequests(room);
  const approved = approvedMembers(room);
  const stats = new Map(leaderboard(room).map((r) => [r.member.id, r]));
  const [reports, questions] = await Promise.all([
    loadReports(room),
    demo ? Promise.resolve(SAMPLE_VISITOR_QUESTIONS) : loadTeamQuestions(room.id),
  ]);

  return (
    <div className="mx-auto flex max-w-[1136px] flex-col gap-5">
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-[1_1_360px] flex-col gap-1.5">
          <nav aria-label="Breadcrumb" className="text-sm text-muted">
            <Link href={`/case/${room.id}`} className="text-muted no-underline hover:text-ink">
              The case
            </Link>
          </nav>
          <h1 className="font-display text-[38px] leading-tight font-medium tracking-[-0.01em]">People on this case</h1>
          <p className="text-sm text-muted">
            Only the case creator and co-approver see this page. Nobody joins or sees case details until approved.
          </p>
        </div>
        <Badge tone="ok">{demo || isCreator ? "Viewing as the case creator" : "Viewing as co-approver"}</Badge>
      </div>

      <div className="flex flex-wrap items-start gap-5">
        <div className="flex min-w-0 flex-[3_1_480px] flex-col gap-5">
          <Card label="Join requests" className="flex flex-col gap-4">
            <div className="flex items-baseline gap-2.5">
              <h2 className="font-display text-xl font-medium">Waiting for your answer</h2>
              {pending.length > 0 && (
                <span className="rounded-full bg-mark px-2 py-0.5 text-[13px] font-semibold text-ink">{pending.length}</span>
              )}
            </div>
            {pending.length === 0 && <p className="text-sm text-muted">No requests right now.</p>}
            {pending.map((m) => (
              <article
                key={m.id}
                className={`flex flex-col gap-2.5 rounded-[14px] border p-4 ${m.aiFlag ? "border-bad-line" : "border-line"}`}
              >
                <div className="flex flex-wrap items-center gap-2.5">
                  <Avatar person={m} size={40} />
                  <div className="flex-[1_1_200px]">
                    <PersonLink person={m} className="font-semibold" />
                    <div className="text-[13px] text-muted">
                      {[m.headline, EXPERTISE_LABEL[m.expertise], m.hoursPerWeek ? `${m.hoursPerWeek} hours a week` : null, `Asked ${m.requestedAt}`]
                        .filter(Boolean)
                        .join(". ")}
                    </div>
                  </div>
                  {demo ? (
                    m.proofChecked ? (
                      <Badge tone="neutral">Link provided, not verified</Badge>
                    ) : (
                      <Badge tone="bad">No link given</Badge>
                    )
                  ) : m.proofUrl ? (
                    <a href={m.proofUrl} target="_blank" rel="noopener noreferrer nofollow" className="text-xs font-semibold">
                      Open their proof link
                    </a>
                  ) : (
                    <Badge tone="warn">No proof link</Badge>
                  )}
                </div>
                {m.requestNote && <p className="whitespace-pre-line text-sm leading-normal">&ldquo;{m.requestNote}&rdquo;</p>}
                {m.aiNote && (
                  <div className={`rounded-lg px-2.5 py-2 text-xs leading-snug ${m.aiFlag ? "bg-mark-soft text-mark-text" : "bg-paper text-muted"}`}>
                    AI note: {m.aiNote}
                  </div>
                )}
                {!demo && m.expertise === "doctor_nurse" && (
                  <p className="text-xs text-muted">
                    Says they&apos;re a doctor or nurse. Open their link and check it before approving. Their checks carry the
                    most weight.
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  {demo ? (
                    <>
                      <DemoButton variant={m.aiFlag ? "secondary" : "primary"}>Approve</DemoButton>
                      <DemoButton variant={m.aiFlag ? "danger" : "secondary"}>Decline</DemoButton>
                      <DemoButton>Ask a question first</DemoButton>
                    </>
                  ) : (
                    <>
                      <ActionButton action={decideRequest.bind(null, room.id, m.id, true)} variant="primary">
                        Approve
                      </ActionButton>
                      <ActionButton action={decideRequest.bind(null, room.id, m.id, false)}>Decline</ActionButton>
                    </>
                  )}
                </div>
              </article>
            ))}
          </Card>

          <QuestionsInbox caseId={room.id} questions={questions} canManage demo={demo} />
          {demo && (
            <p className="-mt-2 text-sm text-muted">
              <Link href={`/case/${room.id}?preview=1`}>See the sample public preview</Link>, where visitors ask these questions.
            </p>
          )}

          {!demo && reports.length > 0 && (
            <Card label="Reported messages" className="flex flex-col gap-3 border-2 border-bad-line">
              <h2 className="font-display text-xl font-medium">Reported messages</h2>
              {reports.map((r) => {
                const author = memberById(room, r.message?.authorId);
                return (
                  <div key={r.id} className="flex flex-col gap-1.5 rounded-xl bg-bad-tint p-3 text-sm">
                    <span className="text-xs text-bad">
                      Reported {timeAgo(r.created_at)}: {r.reason}
                    </span>
                    <span>
                      <strong>{author?.name ?? "Unknown"}:</strong> {r.message?.body}
                    </span>
                    {author && author.role !== "creator" && (
                      <ActionButton action={removeMember.bind(null, room.id, author.id)}>Remove {author.name} from the case</ActionButton>
                    )}
                  </div>
                );
              })}
            </Card>
          )}

          <Card label="Approved people" className="flex flex-col">
            <h2 className="mb-2 font-display text-xl font-medium">Approved ({approved.length})</h2>
            {approved.map((m) => {
              const s = stats.get(m.id);
              const working = room.tasks.filter((t) => t.ownerId === m.id && (t.status === "taken" || t.status === "stuck")).length;
              return (
                <div key={m.id} className="flex flex-wrap items-center gap-2.5 border-t border-line py-2.5 text-sm">
                  <span className="flex-[1_1_220px]">
                    <PersonLink person={m} className="font-semibold" />
                    {m.role === "creator" && <span className="text-muted"> (creator)</span>}
                    {m.role === "co_approver" && <span className="text-muted"> (co-approver)</span>}
                    {m.headline && <span className="block text-xs text-muted">{m.headline}</span>}
                  </span>
                  <span className="text-xs text-muted">
                    {s?.tasksChecked ?? 0} checked{working ? `, ${working} in progress` : ""}
                  </span>
                  {m.role !== "creator" &&
                    m.id !== room.viewer?.id &&
                    (demo ? <DemoButton>Remove</DemoButton> : <ActionButton action={removeMember.bind(null, room.id, m.id)}>Remove</ActionButton>)}
                </div>
              );
            })}
          </Card>
        </div>

        <div className="flex min-w-0 flex-[2_1_300px] flex-col gap-5">
          <section aria-label="Declining" className="rounded-[14px] bg-line px-5 py-4 text-xs leading-relaxed text-ink-2">
            <strong className="text-ink">When you decline:</strong> the person sees a polite note with no reason given, and
            can&apos;t request again for this case. Removing someone keeps their checked work in the brief and opens their
            unfinished work for others.
          </section>
        </div>
      </div>
    </div>
  );
}
