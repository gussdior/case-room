import { notFound } from "next/navigation";
import { CaseNav } from "@/components/case-nav";
import { Logo } from "@/components/logo";
import { getCaseRoom, pendingRequests } from "@/lib/data";

export default async function CaseLayout({ children, params }: LayoutProps<"/case/[id]">) {
  const { id } = await params;
  const room = await getCaseRoom(id);
  if (!room) notFound();

  return (
    <>
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-[1360px] flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3.5 sm:px-8">
          <Logo />
          <CaseNav caseId={room.id} pendingCount={pendingRequests(room).length} />
          {room.isSample && (
            <span className="ml-auto rounded-full bg-warn-soft px-2.5 py-1.5 text-xs font-semibold text-warn">
              Sample case, not a real person
            </span>
          )}
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1360px] flex-1 px-4 pt-6 pb-12 sm:px-8">{children}</main>
    </>
  );
}
