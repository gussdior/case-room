import type { ReactNode } from "react";
import { AppHeader } from "./app-header";

export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <>
      <AppHeader />
      <main className="w-full flex-1">
        <article className="legal mx-auto max-w-[760px] px-6 pt-14 pb-10">
          <h1 className="font-display text-[40px] leading-tight font-medium tracking-[-0.015em] sm:text-[48px]">{title}</h1>
          <p className="mt-2 mb-7 font-display text-sm text-muted">Last updated November 2026</p>
          <div role="note" className="mb-7 rounded-[10px] bg-mark-soft px-3.5 py-3 text-sm text-mark-text">
            Draft. Parts marked &quot;Lawyer review&quot; will be checked before launch.
          </div>
          {children}
        </article>
      </main>
    </>
  );
}

export function H2({ children, review, id }: { children: ReactNode; review?: boolean; id?: string }) {
  return (
    <h2 id={id} className="mt-8 mb-2 scroll-mt-6 font-display text-[26px] font-medium">
      {children}
      {review && (
        <span className="ml-2 inline-block rounded-[10px] bg-bad-soft px-2 py-0.5 align-[4px] font-sans text-[11px] font-semibold text-bad">
          Lawyer review
        </span>
      )}
    </h2>
  );
}

/** Marks one sentence for the lawyer, in the same style as the heading tags. */
export function LawyerTag() {
  return (
    <span className="mr-2 inline-block rounded-[10px] bg-bad-soft px-2 py-0.5 align-[2px] font-sans text-[11px] font-semibold text-bad">
      Lawyer review
    </span>
  );
}
