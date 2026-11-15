import Link from "next/link";
import type { ReactNode } from "react";
import { signOut } from "@/app/auth-actions";
import { getViewer } from "@/lib/auth";
import { Logo } from "./logo";

export async function AppHeader({ children, right }: { children?: ReactNode; right?: ReactNode }) {
  const viewer = await getViewer();
  return (
    <header className="border-b border-line bg-paper">
      <div className="mx-auto flex max-w-[1360px] flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2.5 sm:px-8 lg:px-12">
        <Logo />
        {children}
        <div className="ml-auto flex flex-wrap items-center gap-1">
          {right}
          <Link href="/cases/open" className="nav-link">
            Browse cases
          </Link>
          {viewer ? (
            <>
              <Link href="/cases" className="nav-link">
                My cases
              </Link>
              <Link href={`/profile/${viewer.id}`} className="nav-link" aria-label={`Your profile, ${viewer.name}`}>
                <span
                  aria-hidden="true"
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-soft text-[13px] font-bold text-brand"
                >
                  {viewer.name.replace("Dr. ", "").charAt(0).toUpperCase()}
                </span>
                <span className="hidden sm:inline">{viewer.name}</span>
              </Link>
              <form action={signOut}>
                <button type="submit" className="btn btn-ghost px-3">
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <Link href="/login" className="btn btn-secondary">
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
