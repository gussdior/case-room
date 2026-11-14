import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import { Badge, btn } from "@/components/ui";
import { requireViewer } from "@/lib/auth";
import { loadMyCases } from "@/lib/db-case";
import { EXPERTISE_LABEL } from "@/lib/types";

export const metadata = { title: "My cases · Case Room" };

const ROLE: Record<string, string> = {
  creator: "Creator",
  co_approver: "Co-approver",
  volunteer: "Volunteer",
  family: "Family",
};

export default async function CasesPage() {
  const viewer = await requireViewer("/cases");
  const cases = await loadMyCases();

  return (
    <>
      <AppHeader />
      <main className="mx-auto flex w-full max-w-[1000px] flex-1 flex-col gap-6 px-4 py-10 sm:px-8">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex flex-1 flex-col gap-1">
            <h1 className="font-display text-3xl font-bold">My cases</h1>
            <p className="text-sm text-muted">
              Signed in as {viewer.name} · {EXPERTISE_LABEL[viewer.expertise]} ·{" "}
              <Link href="/onboarding?next=/cases">Edit profile</Link>
            </p>
          </div>
          <Link href="/new" className={btn.primary}>
            Start a case
          </Link>
        </div>

        {cases.length === 0 ? (
          <div className="flex flex-col gap-3 rounded-2xl border border-line bg-white p-6 text-sm">
            <p>
              You&apos;re not on any case yet. If someone shared a case link with you, open it to ask to join. Or start a
              case for someone you care for.
            </p>
            <Link href="/case/sample">See how a case works (sample)</Link>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {cases.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/case/${c.id}`}
                  className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-white p-5 text-ink no-underline hover:border-brand hover:text-ink"
                >
                  <span className="flex-[1_1_300px] font-display text-lg font-bold">{c.goal}</span>
                  {c.status === "pending" ? <Badge tone="warn">Request pending</Badge> : <Badge tone="brand">{ROLE[c.role]}</Badge>}
                  {c.visitInDays !== null && c.visitInDays >= 0 && (
                    <span className="text-xs text-subtle">
                      Visit {c.visitInDays === 0 ? "today" : `in ${c.visitInDays} day${c.visitInDays === 1 ? "" : "s"}`}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
