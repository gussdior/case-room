import {
  acceptHelper,
  checkWork,
  claimTask,
  offerHelp,
  releaseTask,
  setStuck,
  submitWork,
} from "@/app/case-actions";
import { canCheck, memberById } from "@/lib/data";
import type { CaseRoom, Task } from "@/lib/types";
import { ActionButton, ActionForm, SubmitButton, inputClass, labelClass } from "./forms";
import { Card } from "./ui";

/** The main buttons in the task header, depending on who is looking and the task's state. */
export function TaskHeaderActions({ room, task }: { room: CaseRoom; task: Task }) {
  const v = room.viewer!;
  const isOwner = task.ownerId === v.id;
  const isHelper = task.helperIds.includes(v.id);
  const asked = task.requestedHelperIds.includes(v.id);
  const active = task.status === "taken" || task.status === "stuck";

  if (task.status === "open")
    return (
      <ActionButton action={claimTask.bind(null, room.id, task.id)} variant="primary">
        Take this task
      </ActionButton>
    );
  if (isOwner && active)
    return (
      <>
        <a href="#submit" className="inline-flex min-h-11 items-center justify-center rounded-[10px] bg-brand px-4 text-sm font-semibold text-white no-underline hover:text-white">
          Submit your work
        </a>
        <ActionButton action={releaseTask.bind(null, room.id, task.id)}>Hand the task back</ActionButton>
        <span className="text-xs leading-snug text-subtle">No update for 3 days and the task opens again on its own.</span>
      </>
    );
  if (isHelper && active) return <span className="text-sm text-ok">You&apos;re helping on this task.</span>;
  if (asked) return <span className="text-sm text-warn">You offered to help. Waiting for the owner.</span>;
  if (active)
    return (
      <>
        <a href="#help" className="inline-flex min-h-11 items-center justify-center rounded-[10px] bg-brand px-4 text-sm font-semibold text-white no-underline hover:text-white">
          Offer to help
        </a>
        <span className="text-xs leading-snug text-subtle">
          Want to take it over? Ask in the discussion. No update for 3 days and it opens again on its own.
        </span>
      </>
    );
  return null;
}

/** Forms below the task details: submit, stuck, offer help, add helpers, check work. */
export function TaskWorkPanels({ room, task }: { room: CaseRoom; task: Task }) {
  const v = room.viewer!;
  const isOwner = task.ownerId === v.id;
  const isHelper = task.helperIds.includes(v.id);
  const active = task.status === "taken" || task.status === "stuck";
  const canSubmit = (isOwner || isHelper) && (active || task.status === "submitted");
  const latest = task.submissions.at(-1);
  const showCheck = latest && canCheck(room, task, latest.authorId);
  const showHelp = active && !isOwner && !isHelper && !task.requestedHelperIds.includes(v.id);
  const requested = task.requestedHelperIds.map((id) => memberById(room, id)).filter((m) => m !== undefined);

  return (
    <>
      {showCheck && latest && (
        <Card label="Check this work" className="flex flex-col gap-3 border-2 border-brand">
          <h2 id="check" className="scroll-mt-6 text-base font-bold">
            Check this work
          </h2>
          <p className="text-sm text-muted">
            Open each source and confirm it supports what was written. Pass only if it&apos;s correct and safe for the
            family to bring to their doctor.
          </p>
          <ActionForm action={checkWork.bind(null, room.id, latest.id)} className="flex flex-col gap-3">
            <label className="flex min-h-11 items-center gap-2.5 text-sm">
              <input type="checkbox" name="confirmed" /> I opened the sources and they support this work
            </label>
            <label htmlFor="check-note" className={labelClass}>
              Note (required if it needs fixing)
            </label>
            <textarea id="check-note" name="note" rows={2} maxLength={2000} className={`${inputClass} resize-y`} />
            <div className="flex flex-wrap gap-2">
              <SubmitButton name="verdict" value="pass">
                Pass: add to the brief
              </SubmitButton>
              <SubmitButton name="verdict" value="needs_fix" variant="secondary">
                Needs a fix
              </SubmitButton>
            </div>
          </ActionForm>
        </Card>
      )}

      {canSubmit && (
        <Card label="Submit your work" className="flex flex-col gap-3">
          <h2 id="submit" className="scroll-mt-6 text-base font-bold">
            {task.status === "submitted" ? "Submit an updated version" : "Submit your work"}
          </h2>
          <ActionForm action={submitWork.bind(null, room.id, task.id)} className="flex flex-col gap-3">
            <label htmlFor="work-body" className={labelClass}>
              What you found
            </label>
            <textarea
              id="work-body"
              name="body"
              rows={6}
              required
              minLength={20}
              maxLength={10000}
              placeholder="Plain language. Include two sentences a family member can read."
              className={`${inputClass} resize-y`}
            />
            <label htmlFor="work-sources" className={labelClass}>
              Source links (one per line, at least one)
            </label>
            <textarea
              id="work-sources"
              name="sources"
              rows={3}
              required
              placeholder="https://pubmed.ncbi.nlm.nih.gov/..."
              className={`${inputClass} resize-y`}
            />
            <SubmitButton className="self-start">Submit for checking</SubmitButton>
          </ActionForm>
        </Card>
      )}

      {isOwner && active && (
        <Card label="Stuck" className="flex flex-col gap-3">
          <h2 className="text-base font-bold">{task.status === "stuck" ? "You marked this stuck" : "Stuck?"}</h2>
          {task.status === "stuck" ? (
            <ActionButton action={setStuck.bind(null, room.id, task.id, false)}>I&apos;m unstuck</ActionButton>
          ) : (
            <ActionForm action={setStuck.bind(null, room.id, task.id, true)} className="flex flex-col gap-2">
              <label htmlFor="stuck-reason" className={labelClass}>
                What are you stuck on? Everyone on the case will see it.
              </label>
              <input id="stuck-reason" name="reason" required minLength={5} maxLength={1000} className={inputClass} />
              <SubmitButton variant="secondary" className="self-start">
                Mark as stuck
              </SubmitButton>
            </ActionForm>
          )}
        </Card>
      )}

      {showHelp && (
        <Card label="Offer to help" className="flex flex-col gap-3">
          <h2 id="help" className="scroll-mt-6 text-base font-bold">
            Offer to help
          </h2>
          <ActionForm action={offerHelp.bind(null, room.id, task.id)} className="flex flex-col gap-2">
            <label htmlFor="help-note" className={labelClass}>
              How would you like to help? This posts in the task discussion.
            </label>
            <textarea id="help-note" name="note" rows={2} required minLength={5} maxLength={1000} className={`${inputClass} resize-y`} />
            <SubmitButton className="self-start">Send offer</SubmitButton>
          </ActionForm>
        </Card>
      )}

      {isOwner && requested.length > 0 && (
        <Card label="Help offers" className="flex flex-col gap-3">
          <h2 className="text-base font-bold">People who offered to help</h2>
          {requested.map((m) => (
            <div key={m.id} className="flex flex-wrap items-center gap-3 text-sm">
              <span className="flex-1">
                <strong>{m.name}</strong> · {m.headline}
              </span>
              <ActionButton action={acceptHelper.bind(null, room.id, task.id, m.id)} variant="primary">
                Add as helper
              </ActionButton>
            </div>
          ))}
          <p className="text-xs text-subtle">Helpers can submit work on this task with you.</p>
        </Card>
      )}
    </>
  );
}
