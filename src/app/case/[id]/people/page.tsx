import Link from "next/link";
import { notFound } from "next/navigation";
import { DemoButton } from "@/components/demo-button";
import { Avatar, Badge, Card } from "@/components/ui";
import { approvedMembers, getCaseRoom, leaderboard, memberById, pendingRequests } from "@/lib/data";
import { EXPERTISE_LABEL } from "@/lib/types";

export default async function PeoplePage({ params }: PageProps<"/case/[id]/people">) {
  const { id } = await params;
  const room = await getCaseRoom(id);
  if (!room) notFound();

  const pending = pendingRequests(room);
  const approved = approvedMembers(room);
  const stats = new Map(leaderboard(room).map((r) => [r.member.id, r]));
  const coApprover = memberById(room, room.coApproverId);

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
        <Badge tone="ok">Viewing as the case creator</Badge>
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
                      {m.headline} · {EXPERTISE_LABEL[m.expertise]}
                      {m.hoursPerWeek ? ` · ${m.hoursPerWeek} h/week` : ""} · asked {m.requestedAt}
                    </div>
                  </div>
                  {m.proofChecked ? (
                    <Badge tone="ok">{m.expertise === "doctor_nurse" ? "License checked" : "Profile link checked"}</Badge>
                  ) : (
                    <Badge tone="bad">Nothing to check</Badge>
                  )}
                </div>
                <p className="text-sm leading-normal">&ldquo;{m.requestNote}&rdquo;</p>
                {m.aiNote && (
                  <div
                    className={`rounded-lg px-2.5 py-2 text-xs leading-snug ${
                      m.aiFlag ? "bg-warn-soft text-warn-text" : "bg-soft text-muted"
                    }`}
                  >
                    AI note: {m.aiNote}
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  <DemoButton variant={m.aiFlag ? "secondary" : "primary"}>Approve</DemoButton>
                  <DemoButton variant={m.aiFlag ? "danger" : "secondary"}>Decline</DemoButton>
                  <DemoButton>Ask a question first</DemoButton>
                </div>
              </article>
            ))}
          </Card>

          <Card label="Approved volunteers" className="flex flex-col">
            <h2 className="mb-2 text-lg font-bold">Approved · {approved.length}</h2>
            {approved.map((m) => {
              const s = stats.get(m.id);
              const working = room.tasks.filter(
                (t) => t.ownerId === m.id && (t.status === "taken" || t.status === "stuck"),
              ).length;
              return (
                <div key={m.id} className="flex flex-wrap items-center gap-2.5 border-t border-[#ebeef3] py-2.5 text-sm">
                  <span className="flex-[1_1_220px]">
                    <strong>{m.name}</strong> · {m.headline}
                    {m.role === "creator" && " · creator"}
                    {m.role === "co_approver" && " · co-approver"}
                  </span>
                  <span className="text-xs text-subtle">
                    {s?.tasksChecked ?? 0} checked{working ? ` · ${working} in progress` : ""}
                  </span>
                  {m.role !== "creator" && <DemoButton>Remove</DemoButton>}
                </div>
              );
            })}
          </Card>
        </div>

        <div className="flex min-w-0 flex-[2_1_300px] flex-col gap-5">
          <Card label="Who can join" className="flex flex-col gap-3">
            <h2 className="text-lg font-bold">Who can join</h2>
            <label className="flex min-h-11 items-start gap-2.5 text-sm leading-snug">
              <input type="radio" name="join" defaultChecked={room.joinMode === "approve"} className="mt-1" />
              <span>
                <strong>I approve each person</strong>
                <br />
                <span className="text-xs text-subtle">Recommended</span>
              </span>
            </label>
            <label className="flex min-h-11 items-start gap-2.5 text-sm leading-snug">
              <input type="radio" name="join" defaultChecked={room.joinMode === "invite_only"} className="mt-1" />
              <span>
                <strong>Invite only</strong>
                <br />
                <span className="text-xs text-subtle">No requests, only people I invite by link</span>
              </span>
            </label>
            <div className="text-[13px] text-muted">
              Co-approver: <strong>{coApprover?.name ?? "none"}</strong>
            </div>
          </Card>

          <section aria-label="What a volunteer sees" className="flex flex-col gap-3 rounded-2xl bg-ink px-6 py-5 text-white">
            <span className="text-xs font-bold uppercase tracking-widest text-line-2">What a volunteer sees</span>
            <h2 className="font-display text-xl font-bold">Ask to join this case</h2>
            <p className="text-[13px] leading-normal text-line-2">
              Before approval they see only the goal and which skills are needed. No case details.
            </p>
            <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-sm leading-snug">
              <li>Pick your expertise</li>
              <li>Say how you can help, in 2 sentences</li>
              <li>Add a link that shows who you are (required for doctors and nurses)</li>
              <li>Hours per week you can give</li>
              <li>Agree to the room rules</li>
            </ol>
          </section>

          <section aria-label="Declining" className="rounded-2xl bg-line px-5 py-4 text-xs leading-relaxed text-ink-2">
            <strong className="text-ink">When you decline:</strong> the person gets a polite standard note with no reason
            given, and can&apos;t request again for this case. Removing someone keeps their checked work in the brief.
          </section>
        </div>
      </div>
    </div>
  );
}
