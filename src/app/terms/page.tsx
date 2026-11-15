import { H2, LegalPage } from "@/components/legal";

export const metadata = { title: "Terms | Case Room" };

const CONTACT = process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim();

export default function TermsPage() {
  return (
    <LegalPage title="Terms">
      <H2 review>Not medical advice</H2>
      <p>
        Case Room helps people research and prepare questions for a patient&apos;s own doctor. Nothing here is medical
        advice, a diagnosis or a treatment plan. Using Case Room does not create a doctor and patient relationship with
        anyone. Always decide on care with the patient&apos;s own doctors.
      </p>
      <H2 review>Volunteers</H2>
      <p>
        Volunteers help for free and are not acting as the patient&apos;s doctors, even if they are doctors or nurses
        elsewhere. Nobody may charge money, ask for payment or ask for donations through Case Room. If anyone asks you for
        money, tell us.
      </p>
      <H2 review>What you post</H2>
      <p>
        You are responsible for what you write, upload and share. Only start a case with the patient&apos;s permission, or
        as their legal representative. Never post a patient&apos;s name, ID numbers, photos or anything else that
        identifies them.
      </p>
      <H2>Keeping it safe</H2>
      <p>
        We can remove content or close accounts that break these terms, put people at risk, or share private details.
      </p>
      <H2 review>No guarantees</H2>
      <p>
        Case Room is provided as is. We work hard to keep it accurate and available, but we can&apos;t promise that
        anything found here is correct or complete. To the extent the law allows, we are not liable for decisions made
        using it.
      </p>
      <H2>Age</H2>
      <p>You must be 18 or older to use Case Room.</p>
      <H2 review>Governing law</H2>
      <p>These terms are governed by the laws of [state], United States.</p>
      <H2 id="contact">Contact</H2>
      <p>
        {CONTACT ? (
          <>
            Questions or concerns: <a href={`mailto:${CONTACT}`}>{CONTACT}</a>.
          </>
        ) : (
          "Contact details are coming soon."
        )}
      </p>
    </LegalPage>
  );
}
