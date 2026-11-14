import Link from "next/link";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { requireViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { UUID_RE, timeAgo } from "@/lib/time";
import { loadDraft, loadOpenDrafts } from "@/lib/drafts/db";
import { ManualForm } from "./manual-form";
import { Wizard } from "./wizard";

export const metadata = { title: "Start a case | Case Room" };

export default async function NewCasePage({ searchParams }: PageProps<"/new">) {
  const sp = await searchParams;
  const draftId = typeof sp.draft === "string" ? sp.draft : "";
  const manual = sp.manual === "1";
  const viewer = await requireViewer(draftId ? `/new?draft=${draftId}` : "/new");

  if (manual) {
    return (
      <>
        <AppHeader />
        <main className="mx-auto flex w-full max-w-[760px] flex-1 flex-col gap-5 px-4 py-12 sm:px-8">
          <Link href="/new" className="self-start text-sm">
            Start from documents instead
          </Link>
          <h1 className="font-display text-[40px] leading-tight font-medium tracking-[-0.01em]">Write the case yourself</h1>
          <p className="text-sm leading-relaxed text-muted">
            You&apos;ll be the case creator: you decide who joins. Volunteers work on small tasks that build one brief of
            questions and options for the patient&apos;s own doctor. The app never tells anyone what treatment to take.
          </p>
          <ManualForm />
        </main>
      </>
    );
  }

  const supabase = await createClient();
  if (draftId) {
    if (!UUID_RE.test(draftId)) redirect("/new");
    const loaded = await loadDraft(supabase, draftId);
    if (!loaded) {
      return (
        <>
          <AppHeader />
          <main className="mx-auto flex w-full max-w-[640px] flex-1 flex-col gap-4 px-4 py-16 sm:px-8">
            <h1 className="font-display text-4xl font-medium">This draft isn&apos;t here</h1>
            <p className="text-muted">It may have been deleted, or it belongs to someone else.</p>
            <Link href="/new" className="btn btn-mark self-start">
              Start a new case
            </Link>
          </main>
        </>
      );
    }
    if (loaded.draft.caseId) redirect(`/case/${loaded.draft.caseId}`);
    return (
      <>
        <AppHeader />
        <Wizard userId={viewer.id} initialDraft={loaded.draft} initialDocs={loaded.docs} />
      </>
    );
  }

  const open = await loadOpenDrafts(supabase);
  return (
    <>
      <AppHeader />
      {open.length > 0 && (
        <div className="mx-auto w-full max-w-[1360px] px-4 pt-6 sm:px-8 lg:px-12">
          <div className="flex flex-wrap items-center gap-3 rounded-[12px] border border-mark-edge/50 bg-mark-tint px-4 py-3 text-sm">
            <strong>You have an unfinished case.</strong>
            {open.map((d) => (
              <Link key={d.id} href={`/new?draft=${d.id}`} className="btn btn-secondary min-h-9 px-3 text-[13px]">
                Continue (saved {timeAgo(d.updated_at)})
              </Link>
            ))}
          </div>
        </div>
      )}
      <Wizard userId={viewer.id} initialDraft={null} initialDocs={[]} />
    </>
  );
}
