import Link from "next/link";

/** For the creator: opens Find your helpers, with ready posts and the case link. */
export function ShareCaseButton({ caseId }: { caseId: string; publicPreview?: boolean; demo?: boolean }) {
  return (
    <Link href={`/case/${caseId}/share`} className="btn btn-secondary">
      Share this case
    </Link>
  );
}
