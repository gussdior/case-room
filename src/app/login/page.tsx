import { redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { getUserId, safeNext } from "@/lib/auth";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in · Case Room" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  const next = safeNext(sp.next);
  if (await getUserId()) redirect(next);

  return (
    <>
      <AppHeader />
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-4 py-12">
        <h1 className="font-display text-3xl font-bold">Sign in</h1>
        <p className="text-sm leading-relaxed text-muted">
          No password. We email you a link. New here? The same link creates your account.
        </p>
        {sp.error === "link" && (
          <p role="alert" className="rounded-lg bg-bad-soft p-3 text-sm text-bad">
            That link expired or was already used. Send a new one.
          </p>
        )}
        <LoginForm next={next} />
      </main>
    </>
  );
}
