import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { decideRequest, removeMember, setCoApprover, updateCaseSettings } from "@/app/case-actions";
import { DemoButton } from "@/components/demo-button";
import { ActionButton, ActionForm, SubmitButton, inputClass, labelClass } from "@/components/forms";
import { Avatar, Badge, Card } from "@/components/ui";
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
          <nav aria-label="Breadcrumb" className="text-[13px] text-subtle">
            <Link href={`/case/${room.id}`}>Case room</Link> / People
          </nav>
          <h1 className="font-display text-[28px] font-bold">People on this case</h1>
          <p className="text-sm text-subtle">
            Only the case creator and co-approver see this page. Nobody joins or sees case details until approved.
          </p>
        </div>
        <Badge tone="ok">{demo || isCreator ? "Viewing as the case creator" : "Viewing as co-approver"}</Badge>
      </div>

      <div className="flex flex-wrap items-start gap-5">
        <div className="flex min-w-0 flex-[3_1_480px] flex-col gap-5">
          <Card label="Join requests" className="flex flex-col gap-4">
            <div className="flex items-baseline gap-2.5">
              <h2 className="text-lg font-bold">Waiting for your answer</h2>
              {pending.length > 0 && (
                <span className="rounded-full bg-bad px-2 py-0.5 text-[13px] font-bold text-white">{pending.length}</span>
              )}
            </div>
            {pending.length === 0 && <p className="text-sm text-subtle">No requests right now.</p>}
            {pending.map((m) => (
              <article
                key={m.id}
                className={`flex flex-col gap-2.5 rounded-[14px] border p-4 ${m.aiFlag ? "border-bad-line" : "border-line"}`}
              >
                <div className="flex flex-wrap items-center gap-2.5">
                  <Avatar person={m} size={40} />
                  <div className="flex-[1_1_200px]">
                    <div className="font-semibold">{m.name}</div>
                    <div className="text-[13px] text-subtle">
                      {m.headline ? `${m.headline} · ` : ""}
                      {EXPERTISE_LABEL[m.expertise]}
                      {m.hoursPerWeek ? ` · ${m.hoursPerWeek} h/week` : ""} · asked {m.requestedAt}
                    </div>
                  </div>
                  {demo ? (
                    m.proofChecked ? (
                      <Badge tone="ok">{m.expertise === "doctor_nurse" ? "License checked" : "Profile link checked"}</Badge>
                    ) : (
                      <Badge tone="bad">Nothing to check</Badge>
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
                  <div className={`rounded-lg px-2.5 py-2 text-xs leading-snug ${m.aiFlag ? "bg-warn-soft text-warn-text" : "bg-soft text-muted"}`}>
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
              <h2 className="text-lg font-bold">Reported messages</h2>
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
            <h2 className="mb-2 text-lg font-bold">Approved · {approved.length}</h2>
            {approved.map((m) => {
              const s = stats.get(m.id);
              const working = room.tasks.filter((t) => t.ownerId === m.id && (t.status === "taken" || t.status === "stuck")).length;
              return (
                <div key={m.id} className="flex flex-wrap items-center gap-2.5 border-t border-[#ebeef3] py-2.5 text-sm">
                  <span className="flex-[1_1_220px]">
                    <strong>{m.name}</strong>
                    {m.headline ? ` · ${m.headline}` : ""}
                    {m.role === "creator" && " · creator"}
                    {m.role === "co_approver" && " · co-approver"}
                  </span>
                  <span className="text-xs text-subtle">
                    {s?.tasksChecked ?? 0} checked{working ? ` · ${working} in progress` : ""}
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
              <h2 className="text-lg font-bold">Who can join</h2>
              <p className="text-sm">
                <strong>I approve each person</strong> (recommended) or <strong>Invite only</strong>.
              </p>
              <div className="text-[13px] text-muted">
                Co-approver: <strong>{coApprover?.name ?? "none"}</strong>
              </div>
            </Card>
          ) : (
            <Card label="Case settings" className="flex flex-col gap-3">
              <h2 className="text-lg font-bold">Case settings</h2>
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
                <SubmitButton className="self-start">Save settings</SubmitButton>
              </ActionForm>
            </Card>
          )}

          {!demo && isCreator && (
            <Card label="Co-approver" className="flex flex-col gap-3">
              <h2 className="text-lg font-bold">Co-approver</h2>
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

          <section aria-label="Declining" className="rounded-2xl bg-line px-5 py-4 text-xs leading-relaxed text-ink-2">
            <strong className="text-ink">When you decline:</strong> the person sees a polite note with no reason given, and
            can&apos;t request again for this case. Removing someone keeps their checked work in the brief and opens their
            unfinished tasks for others.
          </section>
        </div>
      </div>
    </div>
  );
}
