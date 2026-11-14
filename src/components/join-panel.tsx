import Link from "next/link";
import { requestToJoin } from "@/app/case-actions";
import type { Viewer } from "@/lib/auth";
import type { Teaser } from "@/lib/db-case";
import { EXPERTISE_LABEL } from "@/lib/types";
import { ActionForm, SubmitButton, inputClass, labelClass } from "./forms";
import { Badge } from "./ui";

const RULES = [
  "Every claim needs a source link.",
  "Nothing counts until a second person checks it.",
  "No treatment advice. We prepare questions for the patient's own doctor.",
  "No asking the family for money, and no private contact with the family.",
];

export function JoinPanel({ teaser, viewer }: { teaser: Teaser; viewer: Viewer }) {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <section className="flex flex-col gap-2 rounded-[14px] bg-ink px-6 py-6 text-white">
        <span className="text-xs font-semibold uppercase tracking-widest text-line-2">Goal</span>
        <h1 className="font-display text-[34px] leading-tight font-medium">{teaser.goal}</h1>
        <p className="text-sm text-line-2">
          {teaser.volunteers} {teaser.volunteers === 1 ? "person" : "people"} on this case. Case details are shown only
          after the creator approves you.
        </p>
        {teaser.needed.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-xs text-line-2">Skills needed now:</span>
            {teaser.needed.map((e) => (
              <span key={e} className="rounded-md bg-white/15 px-2 py-0.5 text-xs font-semibold">
                {EXPERTISE_LABEL[e]}
              </span>
            ))}
          </div>
        )}
      </section>

      {teaser.myRequest === "pending" ? (
        <div role="status" className="panel p-6 text-sm">
          <Badge tone="warn">Request sent</Badge>
          <p className="mt-2">The case creator will review your request. You&apos;ll see the case here once approved.</p>
        </div>
      ) : teaser.myRequest === "declined" || teaser.myRequest === "removed" ? (
        <div className="panel p-6 text-sm text-muted">
          Thank you for offering to help. The case creator isn&apos;t adding more people to this case right now.{" "}
          <Link href="/cases">See your cases</Link>.
        </div>
      ) : teaser.joinMode === "invite_only" ? (
        <div className="panel p-6 text-sm text-muted">
          This case is invite only right now.
        </div>
      ) : (
        <ActionForm action={requestToJoin.bind(null, teaser.id)} className="flex flex-col gap-4 panel p-6" resetOnSuccess={false}>
          <h2 className="font-display text-2xl font-medium">Ask to join this case</h2>
          <p className="text-sm text-muted">
            You&apos;re joining as <strong>{viewer.name}</strong>, {EXPERTISE_LABEL[viewer.expertise].toLowerCase()}.{" "}
            <Link href={`/onboarding?next=/case/${teaser.id}`}>Edit profile</Link>
          </p>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="note" className={labelClass}>
              How can you help? (2 sentences)
            </label>
            <textarea id="note" name="note" rows={3} required minLength={10} maxLength={500} className={`${inputClass} resize-y`} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="proof" className={labelClass}>
              A link that shows who you are{viewer.expertise === "doctor_nurse" ? " (required for doctors and nurses)" : " (optional)"}
            </label>
            <input
              id="proof"
              name="proof"
              type="url"
              placeholder="https://"
              defaultValue={viewer.proofUrl ?? ""}
              required={viewer.expertise === "doctor_nurse" && !viewer.proofUrl}
              className={inputClass}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="hours" className={labelClass}>
              Hours per week you can give
            </label>
            <input id="hours" name="hours" type="number" min={1} max={80} defaultValue={2} className={`${inputClass} max-w-32`} />
          </div>
          <fieldset className="flex flex-col gap-2 rounded-xl bg-soft p-4">
            <legend className="sr-only">Room rules</legend>
            <ul className="flex list-disc flex-col gap-1 pl-5 text-sm leading-snug">
              {RULES.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
            <label className="mt-1 flex min-h-11 items-center gap-2.5 text-sm font-semibold">
              <input type="checkbox" name="rules" required /> I agree to the room rules
            </label>
          </fieldset>
          <SubmitButton>Send request</SubmitButton>
        </ActionForm>
      )}
    </div>
  );
}
