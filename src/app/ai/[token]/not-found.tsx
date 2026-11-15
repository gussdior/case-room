import Link from "next/link";
import { AppHeader } from "@/components/app-header";

export default function AiLinkGone() {
  return (
    <>
      <AppHeader />
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-start gap-4 px-6 py-16">
        <h1 className="font-display text-[34px] leading-tight font-medium">This link is no longer active</h1>
        <p className="text-base text-muted">
          It expired or the family turned it off. Ask the person who shared it for a new one, or look at the cases that are
          open for helpers.
        </p>
        <Link href="/cases/open" className="btn btn-mark">
          Browse cases
        </Link>
      </main>
    </>
  );
}
