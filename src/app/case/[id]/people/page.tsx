import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { deleteCase } from "@/app/delete-actions";
import { DeleteZone } from "@/components/delete-zone";
import { ListingFields } from "@/components/listing-fields";
import { decideRequest, removeMember, setCoApprover, updateCaseSettings } from "@/app/case-actions";
import { DemoButton } from "@/components/demo-button";
import { ActionButton, ActionForm, SubmitButton, inputClass, labelClass } from "@/components/forms";
import { Avatar, Badge, Card, PersonLink } from "@/components/ui";
import { approvedMembers, getRoom, leaderboard, memberById, pendingRequests } from "@/lib/data";
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
  const coApprover = memberById(room, room.coApproverId);
  const reports = await loadReports(room);
  const volunteers = approved.filter((m) => m.role !== "creator");

  return (
    <div className="mx-auto flex max-w-[1136px] flex-col gap-5">
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-[1_1_360px] flex-col gap-1.5">
          <nav aria-label="Breadcrumb" className="text-sm text-muted">
            <Link href={`/case/${room.id}`} className="text-muted no-underline hover:text-ink">Leads</Link>
          </nav>
          <h1 className="font-display text-[38px] leading-tight font-medium tracking-[-0.01em]">People on this case</h1>
          <p className="text-sm text-muted">
            Only the case creator and co-approver see this page. Nobody joins or sees case details until approved.{" "}
            <Link href={`/case/${room.id}/leaderboard`} className="font-semibold">
              See the leaderboard
            </Link>
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

          <Card label="Approved volunteers" className="flex flex-col">
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
          {demo ? (
            <Card label="Who can join" className="flex flex-col gap-3">
              <h2 className="font-display text-xl font-medium">Who can join</h2>
              <p className="text-sm">
                <strong>I approve each person</strong> (recommended) or <strong>Invite only</strong>.
              </p>
              <div className="text-[13px] text-muted">
                Co-approver: <strong>{coApprover?.name ?? "none"}</strong>
              </div>
            </Card>
          ) : (
            <Card label="Case settings" className="flex flex-col gap-3">
              <h2 className="font-display text-xl font-medium">Case settings</h2>
              <ActionForm action={updateCaseSettings.bind(null, room.id)} className="flex flex-col gap-3" resetOnSuccess={false}>
                <label htmlFor="s-goal" className={labelClass}>
                  Goal
                </label>
                <input id="s-goal" name="goal" required maxLength={200} defaultValue={room.goal} className={inputClass} />
                <label htmlFor="s-summary" className={labelClass}>
                  Case summary (no names or ID numbers)
                </label>
                <textarea id="s-summary" name="summary" rows={5} maxLength={4000} defaultValue={room.summary} className={`${inputClass} resize-y`} />
                <label htmlFor="s-visit" className={labelClass}>
                  Next doctor visit
                </label>
                <input id="s-visit" name="visit" type="date" defaultValue={room.visitDate ?? ""} className={inputClass} />
                <fieldset className="flex flex-col gap-1">
                  <legend className={`${labelClass} mb-1`}>Who can join</legend>
                  <label className="flex min-h-11 items-center gap-2.5 text-sm">
                    <input type="radio" name="join_mode" value="approve" defaultChecked={room.joinMode === "approve"} />I approve
                    each person (recommended)
                  </label>
                  <label className="flex min-h-11 items-center gap-2.5 text-sm">
                    <input type="radio" name="join_mode" value="invite_only" defaultChecked={room.joinMode === "invite_only"} />
                    Closed: no new requests
                  </label>
                </fieldset>
                {isCreator && (
                  <ListingFields
                    listed={!!room.listed}
                    cancerType={room.cancerType ?? null}
                    cancerStage={room.cancerStage ?? null}
                    publicGoal={room.publicGoal ?? null}
                    publicPreview={!!room.publicPreview}
                    previewShowVisit={room.previewShowVisit !== false}
                  />
                )}
                <SubmitButton className="self-start">Save settings</SubmitButton>
              </ActionForm>
            </Card>
          )}

          {!demo && isCreator && (
            <Card label="Co-approver" className="flex flex-col gap-3">
              <h2 className="font-display text-xl font-medium">Co-approver</h2>
              <p className="text-sm text-muted">A trusted volunteer who can approve requests and manage the case with you.</p>
              <ActionForm action={setCoApprover.bind(null, room.id)} className="flex flex-col gap-2" resetOnSuccess={false}>
                <label htmlFor="co" className={labelClass}>
                  Co-approver
                </label>
                <select id="co" name="user" defaultValue={room.coApproverId ?? ""} className={inputClass}>
                  <option value="">None</option>
                  {volunteers.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
                <SubmitButton variant="secondary" className="self-start">
                  Save
                </SubmitButton>
              </ActionForm>
            </Card>
          )}

          {!demo && isCreator && (
            <DeleteZone title="Delete this case" button="Delete this case" action={deleteCase.bind(null, room.id)}>
              <p>
                This deletes the case for everyone: the brief, leads, AI runs, what was tried, messages and any uploaded
                documents. It is removed within 30 days, including backups. This can&apos;t be undone.
              </p>
            </DeleteZone>
          )}

          <section aria-label="Declining" className="rounded-[14px] bg-line px-5 py-4 text-xs leading-relaxed text-ink-2">
            <strong className="text-ink">When you decline:</strong> the person sees a polite note with no reason given, and
            can&apos;t request again for this case. Removing someone keeps their checked work in the brief and opens their
            unfinished tasks for others.
          </section>
        </div>
      </div>
    </div>
  );
}
