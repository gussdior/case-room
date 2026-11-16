import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { setCoApprover, updateCaseSettings } from "@/app/case-actions";
import { deleteCase } from "@/app/delete-actions";
import { DeleteZone } from "@/components/delete-zone";
import { ActionForm, SubmitButton, inputClass, labelClass } from "@/components/forms";
import { ListingFields } from "@/components/listing-fields";
import { Card } from "@/components/ui";
import { approvedMembers, getRoom, memberById } from "@/lib/data";
import { AGE_RANGE_LABEL, AGE_RANGES } from "@/lib/types";

export const metadata = { title: "Case settings" };

export default async function SettingsPage({ params }: PageProps<"/case/[id]/settings">) {
  const { id } = await params;
  const loaded = await getRoom(id);
  if (!loaded) notFound();
  if (loaded.teaser) redirect(`/case/${id}`);
  const room = loaded.room;
  const demo = room.viewer === null;
  if (!demo && !room.viewer?.isAdmin) redirect(`/case/${id}`);
  const isCreator = room.viewer?.role === "creator";
  const coApprover = memberById(room, room.coApproverId);
  const volunteers = approvedMembers(room).filter((m) => m.role !== "creator");

  return (
    <div className="mx-auto flex max-w-[720px] flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <nav aria-label="Breadcrumb" className="text-sm text-muted">
          <Link href={`/case/${room.id}`} className="text-muted no-underline hover:text-ink">
            The case
          </Link>
        </nav>
        <h1 className="font-display text-[38px] leading-tight font-medium tracking-[-0.01em]">Case settings</h1>
        <p className="text-sm text-muted">
          Only the case creator and co-approver see this page.{" "}
          <Link href={`/case/${room.id}/people`} className="font-semibold">
            People on this case
          </Link>
        </p>
      </div>
      {demo ? (
        <Card label="Who can join" className="flex flex-col gap-3">
          <h2 className="font-display text-xl font-medium">Who can join</h2>
          <p className="text-sm text-muted">This is a sample. On your own case you can change the goal, the visit date and who can join here.</p>
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
              Goal of this case
            </label>
            <input id="s-goal" name="goal" required minLength={10} maxLength={200} defaultValue={room.goal} aria-describedby="s-goal-help" className={inputClass} />
            <p id="s-goal-help" className="-mt-1 text-[13px] text-muted">
              This is the case title. Write it as a plain sentence, like &ldquo;Find the next options now that the first pill stopped
              working.&rdquo;
            </p>
            <input type="hidden" name="facts_present" value="1" />
            <label htmlFor="s-age" className={labelClass}>
              Age range (optional)
            </label>
            <select id="s-age" name="age_range" defaultValue={room.ageRange ?? ""} className={inputClass}>
              <option value="">Not shared</option>
              {AGE_RANGES.map((a) => (
                <option key={a} value={a}>
                  {AGE_RANGE_LABEL[a]}
                </option>
              ))}
            </select>
            <label htmlFor="s-current" className={labelClass}>
              Current treatment (optional)
            </label>
            <input
              id="s-current"
              name="current_treatment"
              maxLength={80}
              defaultValue={room.currentTreatment ?? ""}
              placeholder="Like: osimertinib, or waiting on biopsy results"
              className={inputClass}
            />
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
            This deletes the case for everyone: the brief, ideas, AI answers, what was tried, messages and any uploaded
            documents. It is removed within 30 days, including backups. This can&apos;t be undone.
          </p>
        </DeleteZone>
      )}
    </div>
  );
}
