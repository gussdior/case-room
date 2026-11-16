import { notFound } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import Link from "next/link";
import { CaseNav, SafetyLine } from "@/components/case-nav";
import { ShareMenu } from "@/components/share-menu";
import { getRoom } from "@/lib/data";
import { loadShareCard } from "@/lib/share-card";
import { cardVersion, suggestedRole } from "@/lib/share-text";

import { CASE_SAFETY_LINE } from "@/lib/types";

export default async function CaseLayout({ children, params }: LayoutProps<"/case/[id]">) {
  const { id } = await params;
  const loaded = await getRoom(id);
  if (!loaded) notFound();
  const room = loaded.room;
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
            {canShare && room && (
              <Link
                href={`/case/${room.id}/settings`}
                aria-label="Case settings"
                title="Case settings"
                className="grid h-11 w-11 flex-none place-items-center rounded-[10px] border border-line-2 bg-white text-muted no-underline transition-colors hover:bg-hover hover:text-ink"
              >
                <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.8 1.2V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-2.9-1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 3 14a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.2-2.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.7 1.7 0 0 0 10 3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1A1.7 1.7 0 0 0 21 10a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
                </svg>
              </Link>
            )}
          </>
        }
      >
        {room && <CaseNav caseId={room.id} />}
      </AppHeader>
      <main className="mx-auto w-full max-w-[1360px] flex-1 px-4 pt-6 pb-16 sm:px-8 lg:px-12">
        {room ? <SafetyLine caseId={room.id} text={CASE_SAFETY_LINE} /> : <p className="mb-5 text-[13px] text-muted">{CASE_SAFETY_LINE}</p>}
        {children}
      </main>
    </>
  );
}
