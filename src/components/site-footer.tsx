import Link from "next/link";

const CONTACT = process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim();

export function SiteFooter() {
  return (
    <footer className="mt-10 border-t border-line">
      <div className="mx-auto flex max-w-[1360px] flex-wrap items-center gap-x-6 gap-y-3 px-4 py-7 text-sm text-muted sm:px-8 lg:px-12">
        <span>Case Room</span>
        <Link href="/privacy" className="footer-link">
          Privacy
        </Link>
        <Link href="/terms" className="footer-link">
          Terms
        </Link>
        {CONTACT ? (
          <a href={`mailto:${CONTACT}`} className="footer-link">
            Contact: {CONTACT}
          </a>
        ) : (
          <Link href="/terms#contact" className="footer-link">
            Contact
          </Link>
        )}
        <span className="sm:ml-auto">Questions for the patient&apos;s doctor. Never treatment advice.</span>
      </div>
    </footer>
  );
}
