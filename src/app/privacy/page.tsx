import { H2, LegalPage } from "@/components/legal";

export const metadata = { title: "Privacy | Case Room" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy">
      <H2>What we store</H2>
      <ul>
        <li>Your account: email, the name you choose, your profession, and anything you add to your profile.</li>
        <li>Cases: what the family writes, the AI draft, leads, findings, messages and AI runs.</li>
        <li>Uploaded documents, in private storage.</li>
      </ul>
      <H2>Who can see a case</H2>
      <p>
        Only the person who created it and the people they approve. If the creator turns on the public preview, anyone
        can see the goal, cancer type and stage, skills needed and how many people are helping. Nothing else.
      </p>
      <H2>Your documents</H2>
      <p>
        Only the person who uploaded them can open them. Volunteers see the case text the family checked, with names and
        IDs removed, never the files.
      </p>
      <H2 review>AI</H2>
      <p>
        To read documents and answer questions, we send case text and files to our AI provider, Anthropic. Under its
        terms, it does not use this data to train its models.
      </p>
      <H2>We never sell your data</H2>
      <p>No ads, no data brokers, no selling or renting what you share. Ever.</p>
      <H2 review>Deleting things</H2>
      <p>
        The creator can delete a case at any time from Case settings. You can delete your account from your profile.
        Both are removed within 30 days, including backups.
      </p>
      <H2 review>Health data laws</H2>
      <p>Some US states protect health data even in free apps. This section will list your rights once reviewed.</p>
    </LegalPage>
  );
}
