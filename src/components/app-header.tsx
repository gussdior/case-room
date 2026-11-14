import Link from "next/link";
import type { ReactNode } from "react";
import { signOut } from "@/app/auth-actions";
import { getViewer } from "@/lib/auth";
import { Logo } from "./logo";

export async function AppHeader({ children, right }: { children?: ReactNode; right?: ReactNode }) {
  const viewer = await getViewer();
  return (
    <header className="border-b border-line bg-white">
      <div className="mx-auto flex max-w-[1360px] flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3.5 sm:px-8">
        <Logo />
        {children}
        <div className="ml-auto flex flex-wrap items-center gap-3">
          {right}
          {viewer ? (
            <>
              <Link href="/cases" className="text-sm font-semibold no-underline">
                My cases
              </Link>
              <form action={signOut}>
                <button type="submit" className="min-h-11 rounded-lg px-3 text-sm text-muted hover:bg-soft">
                  Sign out ({viewer.name})
                </button>
              </form>
            </>
          ) : (
            <Link href="/login" className="text-sm font-semibold no-underline">
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
