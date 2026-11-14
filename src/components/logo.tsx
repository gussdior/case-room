import Link from "next/link";

export function Logo() {
  return (
    <Link href="/" className="group flex min-h-11 items-center gap-2.5 text-ink no-underline hover:text-ink">
      <span
        aria-hidden="true"
        className="block h-3.5 w-3.5 -rotate-[8deg] rounded-[3px] bg-mark transition-transform duration-300 group-hover:rotate-[8deg]"
      />
      <span className="font-display text-[22px] font-semibold tracking-[-0.01em]">Case Room</span>
    </Link>
  );
}
