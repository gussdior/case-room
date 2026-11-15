import Link from "next/link";
import type { Viewer } from "@/lib/auth";
import type { Teaser } from "@/lib/db-case";
import { JoinAction } from "./join-panel";
import { Badge, ExpertiseBadge } from "./ui";


/** What a shared link shows before the family approves someone. */
export function CasePreview({ teaser, viewer }: { teaser: Teaser; viewer: Viewer | null }) {
  const p = teaser.preview!;
  const facts = [p.cancerType, p.cancerStage].filter(Boolean).join(". ");
  const next = `/case/${teaser.id}`;

  return (
    <div className="mx-auto grid w-full max-w-[1100px] items-start gap-10 lg:grid-cols-[minmax(0,1fr)_360px]">
      <section aria-labelledby="pv-goal" className="min-w-0">
        <Badge tone="brand">Public preview</Badge>
        <h1 id="pv-goal" className="mt-3.5 font-display text-[34px] leading-[1.1] font-medium tracking-[-0.015em] sm:text-[46px]">
          {p.goal}
        </h1>
        {facts && <p className="mt-3 text-base text-muted">{facts}.</p>}

        <div className="my-7 flex flex-wrap gap-9 border-y border-line py-5">
          {p.visitInDays !== null && (
            <div>
              <strong className="block font-display text-[38px] leading-none font-medium">
                {p.visitInDays > 0 ? `${p.visitInDays} day${p.visitInDays === 1 ? "" : "s"}` : p.visitInDays === 0 ? "Today" : "Passed"}
              </strong>
              <span className="text-sm text-muted">until the doctor visit</span>
            </div>
          )}
          <div>
            <strong className="block font-display text-[38px] leading-none font-medium">{p.helpers}</strong>
            <span className="text-sm text-muted">{p.helpers === 1 ? "person helping" : "people helping"}</span>
          </div>
        </div>

        {p.needed.length > 0 && (
          <>
            <h2 className="mb-2.5 text-[15px] font-bold">Skills this case needs</h2>
            <ul className="flex flex-wrap gap-2" aria-label="Skills this case needs">
              {p.needed.map((e) => (
                <li key={e}>
                  <ExpertiseBadge expertise={e} />
                </li>
              ))}
            </ul>
          </>
        )}

        <div className="mt-7 rounded-[12px] bg-line/60 px-5 py-4">
          <h2 className="mb-1.5 text-[15px] font-bold">After the family approves you, you&apos;ll see</h2>
          <p className="text-sm text-muted">
            The case details, leads, AI runs, what was tried and the discussion. Everything stays private until then.
          </p>
        </div>
      </section>

      {viewer ? (
        <aside aria-label="Ask to join" className="flex flex-col gap-4 lg:sticky lg:top-5">
          <JoinAction teaser={teaser} viewer={viewer} />
        </aside>
      ) : (
        <aside aria-label="Ask to join" className="flex flex-col gap-3 rounded-[14px] bg-ink p-6 text-white lg:sticky lg:top-5">
          <p className="text-sm text-line-2">Want to help?</p>
          <h2 className="font-display text-[22px] leading-tight font-medium">Ask to join this case</h2>
          <p className="text-sm text-line-2">Say what you can do. The family reviews every request.</p>
          {p.joinMode === "invite_only" ? (
            <p className="rounded-lg bg-white/10 px-3 py-2 text-sm">This case isn&apos;t taking new requests right now.</p>
          ) : (
            <Link href={`/login?next=${encodeURIComponent(next)}`} className="btn btn-mark w-full">
              Ask to join
            </Link>
          )}
        </aside>
      )}
    </div>
  );
}

/** Shown to signed out visitors when the creator has not turned on the public preview. */
export function PrivateCase({ id }: { id: string }) {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-start gap-4 py-10">
      <h1 className="font-display text-[34px] leading-tight font-medium">This case is private</h1>
      <p className="text-base text-muted">
        Ask the person who shared it to invite you. If you already have an account, sign in to ask to join.
      </p>
      <Link href={`/login?next=${encodeURIComponent(`/case/${id}`)}`} className="btn btn-mark">
        Sign in
      </Link>
    </div>
  );
}
