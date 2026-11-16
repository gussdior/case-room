import { redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { getUserId, getViewer, safeNext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ProfileForm, type ProfileExtras } from "./profile-form";

export const metadata = { title: "Your profile | Case Room" };

export default async function OnboardingPage({ searchParams }: PageProps<"/onboarding">) {
  const sp = await searchParams;
  const next = safeNext(sp.next);
  const id = await getUserId();
  if (!id) redirect(`/login?next=${encodeURIComponent(`/onboarding?next=${encodeURIComponent(next)}`)}`);
  const viewer = await getViewer();

  let extras: ProfileExtras | null = null;
  if (viewer) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("profiles")
      .select("role_title, years_experience, time_zone, areas, alerts_on, alert_frequency")
      .eq("id", id)
      .maybeSingle();
    if (data)
      extras = {
        roleTitle: data.role_title,
        years: data.years_experience,
        timeZone: data.time_zone,
        areas: data.areas ?? [],
        alertsOn: !!data.alerts_on,
        alertFrequency: data.alert_frequency === "instant" ? "instant" : "weekly",
      };
  }

  return (
    <>
      <AppHeader />
      <main className="mx-auto flex w-full max-w-[760px] flex-1 flex-col gap-6 px-4 py-12 sm:px-8">
        <div>
          <h1 className="font-display text-[40px] leading-tight font-medium tracking-[-0.01em]">
            {viewer ? "Your profile" : "How can you help?"}
          </h1>
          <p className="mt-2 text-muted">
            {viewer
              ? "Your profession decides which ideas are highlighted for you and which work you can check."
              : "Three quick things. You can add more later."}
          </p>
        </div>
        <ProfileForm next={next} viewer={viewer} extras={extras} />
      </main>
    </>
  );
}
