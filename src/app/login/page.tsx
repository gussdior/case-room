import { redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { getUserId, safeNext } from "@/lib/auth";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in | Case Room" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  const next = safeNext(sp.next);
  if (await getUserId()) redirect(next);

  return (
    <>
      <AppHeader />
      <main className="mx-auto flex w-full max-w-[480px] flex-1 flex-col gap-5 px-4 py-16">
        <h1 className="font-display text-[40px] leading-tight font-medium tracking-[-0.01em]">Sign in</h1>
        <p className="text-sm leading-relaxed text-muted">
          No password. We email you a link. New here? The same link creates your account.
        </p>
        {sp.error === "link" && (
          <p role="alert" className="rounded-[10px] bg-bad-soft p-3 text-sm text-bad">
            That link expired or was already used. Send a new one.
          </p>
        )}
        <div className="sheet px-6 py-7 sm:px-8">
          <LoginForm next={next} />
        </div>
      </main>
    </>
  );
}
