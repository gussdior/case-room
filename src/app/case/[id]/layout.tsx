import { notFound } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { CaseNav } from "@/components/case-nav";
import { ShareMenu } from "@/components/share-menu";
import { getRoom, pendingRequests } from "@/lib/data";
import { SAMPLE_VISITOR_QUESTIONS } from "@/lib/sample-case";
import { loadShareCard } from "@/lib/share-card";
import { cardVersion, suggestedRole } from "@/lib/share-text";
import { createClient } from "@/lib/supabase/server";

/** Unanswered visitor questions, for the nav. Any approved member can read them. */
async function unansweredQuestions(caseId: string, demo: boolean): Promise<number> {
  if (demo) return SAMPLE_VISITOR_QUESTIONS.filter((q) => !q.reply).length;
  const supabase = await createClient();
  const { count } = await supabase
    .from("case_questions")
    .select("id", { count: "exact", head: true })
    .eq("case_id", caseId)
    .is("reply", null);
  return count ?? 0;
}
import { CASE_SAFETY_LINE } from "@/lib/types";

export default async function CaseLayout({ children, params }: LayoutProps<"/case/[id]">) {
  const { id } = await params;
  const loaded = await getRoom(id);
  if (!loaded) notFound();
  const room = loaded.room;
  const showPeople = room ? room.viewer === null || room.viewer.isAdmin : false;
  const questionCount = room ? await unansweredQuestions(room.id, room.viewer === null) : 0;
  // Sharing is for the creator and co-approvers. The sample case shows it to everyone.
  const demo = room?.viewer === null;
  const canShare = !!room && (demo || !!room.viewer?.isAdmin);
  const card = canShare && room ? await loadShareCard(room.id) : null;

  return (
    <>
      <AppHeader
        right={
          <>
            {(room?.isSample || demo) && (
              <span className="rounded-full bg-mark-soft px-3 py-1.5 text-xs font-semibold text-mark-text">
                Sample case, not a real person
              </span>
            )}
            {canShare && room && (
              <ShareMenu
                caseId={room.id}
                suggested={suggestedRole(card?.needed ?? [])}
                version={cardVersion([card?.cancerType, card?.cancerStage, ...(card?.needed ?? []), "/", ...(card?.seats ?? [])])}
                previewOn={demo || !!room.publicPreview}
                canTurnOn={room.viewer?.role === "creator"}
              />
            )}
          </>
        }
      >
        {room && (
          <CaseNav
            caseId={room.id}
            pendingCount={showPeople ? pendingRequests(room).length : 0}
            questionCount={questionCount}
            showPeople={showPeople}
          />
        )}
      </AppHeader>
      <main className="mx-auto w-full max-w-[1360px] flex-1 px-4 pt-6 pb-16 sm:px-8 lg:px-12">
        <p className="mb-5 text-[13px] text-muted">{CASE_SAFETY_LINE}</p>
        {children}
      </main>
    </>
  );
}
