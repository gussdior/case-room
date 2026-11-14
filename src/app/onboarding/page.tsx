import { redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { getUserId, getViewer, safeNext } from "@/lib/auth";
import { ProfileForm } from "./profile-form";

export const metadata = { title: "Your profile · Case Room" };

export default async function OnboardingPage({ searchParams }: PageProps<"/onboarding">) {
  const sp = await searchParams;
  const next = safeNext(sp.next);
  if (!(await getUserId())) redirect(`/login?next=${encodeURIComponent(`/onboarding?next=${encodeURIComponent(next)}`)}`);
  const viewer = await getViewer();

  return (
    <>
      <AppHeader />
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-5 px-4 py-12">
        <h1 className="font-display text-3xl font-bold">{viewer ? "Your profile" : "Tell us about you"}</h1>
        <p className="text-sm leading-relaxed text-muted">
          Case creators see this when you ask to join. Your expertise decides which tasks are highlighted for you and
          which work you can check.
        </p>
        <ProfileForm next={next} viewer={viewer} />
      </main>
    </>
  );
}
