import Link from "next/link";
import type { ReactNode } from "react";
import { signOut } from "@/app/auth-actions";
import { getViewer } from "@/lib/auth";
import { Logo } from "./logo";
import { MobileMenu, type MenuLink } from "./mobile-menu";

/**
 * Desktop: one row with everything. Phone: logo, the main action and one menu button,
 * with the page's own tabs (children) on a slim second row.
 */
export async function AppHeader({
  children,
  right,
  menuLinks = [],
}: {
  children?: ReactNode;
  right?: ReactNode;
  /** Extra rows for the phone menu, such as case settings. */
  menuLinks?: MenuLink[];
}) {
  const viewer = await getViewer();
  const links: MenuLink[] = [
    ...(viewer ? [{ href: "/cases", label: "My cases" }] : []),
    { href: "/cases/open", label: "Browse cases" },
    ...menuLinks,
  ];
  return (
    <header className="border-b border-line bg-paper">
      <div className="mx-auto flex max-w-[1360px] flex-wrap items-center gap-x-3 px-4 sm:gap-x-6 sm:gap-y-2 sm:px-8 sm:py-2.5 lg:px-12">
        <div className="flex h-14 items-center sm:h-auto">
          <Logo />
        </div>
        {children && <div className="order-last -mb-px w-full sm:order-none sm:mb-0 sm:w-auto">{children}</div>}
        <div className="ml-auto flex items-center gap-2 sm:flex-wrap sm:gap-1">
          {right}
          <Link href="/cases/open" className="nav-link hidden sm:flex">
            Browse cases
          </Link>
          {viewer ? (
            <>
              <Link href="/cases" className="nav-link hidden sm:flex">
                My cases
              </Link>
              <Link href={`/profile/${viewer.id}`} className="nav-link hidden sm:flex" aria-label={`Your profile, ${viewer.name}`}>
                <span
                  aria-hidden="true"
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-soft text-[13px] font-bold text-brand"
                >
                  {viewer.name.replace("Dr. ", "").charAt(0).toUpperCase()}
                </span>
                <span>{viewer.name}</span>
              </Link>
              <form action={signOut} className="hidden sm:block">
                <button type="submit" className="btn btn-ghost px-3">
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <Link href="/login" className={`btn btn-secondary ${right ? "hidden sm:inline-flex" : ""}`}>
              Sign in
            </Link>
          )}
          <MobileMenu viewer={viewer ? { id: viewer.id, name: viewer.name } : null} links={links} />
        </div>
      </div>
    </header>
  );
}
