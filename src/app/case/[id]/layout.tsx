import { notFound } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { CaseNav } from "@/components/case-nav";
import { getRoom, pendingRequests } from "@/lib/data";
import { CASE_SAFETY_LINE } from "@/lib/types";

export default async function CaseLayout({ children, params }: LayoutProps<"/case/[id]">) {
  const { id } = await params;
  const loaded = await getRoom(id);
  if (!loaded) notFound();
  const room = loaded.room;
  const showPeople = room ? room.viewer === null || room.viewer.isAdmin : false;

  return (
    <>
      <AppHeader
        right={
          room?.isSample || room?.viewer === null ? (
            <span className="rounded-full bg-mark-soft px-3 py-1.5 text-xs font-semibold text-mark-text">
              Sample case, not a real person
            </span>
          ) : null
        }
      >
        {room && (
          <CaseNav caseId={room.id} pendingCount={showPeople ? pendingRequests(room).length : 0} showPeople={showPeople} />
        )}
      </AppHeader>
      <main className="mx-auto w-full max-w-[1360px] flex-1 px-4 pt-6 pb-16 sm:px-8 lg:px-12">
        <p className="mb-5 text-[13px] text-muted">{CASE_SAFETY_LINE}</p>
        {children}
      </main>
    </>
  );
}
