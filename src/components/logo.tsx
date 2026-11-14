import Link from "next/link";

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2.5 text-ink no-underline hover:text-ink">
      <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true">
        <rect x="3" y="3" width="22" height="22" rx="6" fill="none" stroke="#1f5fad" strokeWidth="2.5" />
        <path d="M9 14h10M14 9v10" stroke="#1f5fad" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
      <span className="font-display text-xl font-bold">Case Room</span>
    </Link>
  );
}
