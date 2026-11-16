import { redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { getUserId, safeNext } from "@/lib/auth";
import { signInWithGoogle } from "@/app/auth-actions";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/supabase/config";
import { LoginForm } from "./login-form";

/** True once Google sign in is switched on in Supabase, so the button never shows broken. */
async function googleEnabled(): Promise<boolean> {
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/settings`, {
      headers: { apikey: SUPABASE_PUBLISHABLE_KEY },
      next: { revalidate: 60 },
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { external?: { google?: boolean } };
    return !!data.external?.google;
  } catch {
    return false;
  }
}

export const metadata = { title: "Sign in | Case Room" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  const next = safeNext(sp.next);
  if (await getUserId()) redirect(next);
  const google = await googleEnabled();

  return (
    <>
      <AppHeader />
      <main className="mx-auto flex w-full max-w-[480px] flex-1 flex-col gap-5 px-4 py-16">
        <h1 className="font-display text-[40px] leading-tight font-medium tracking-[-0.01em]">Sign in</h1>
        <p className="text-sm leading-relaxed text-muted">
          {google
            ? "No password. Use your Google account, or get a link by email. New here? Either one creates your account."
            : "No password. We email you a link. New here? The same link creates your account."}
        </p>
        {sp.error === "link" && (
          <p role="alert" className="rounded-[10px] bg-bad-soft p-3 text-sm text-bad">
            That link expired or was already used. Send a new one.
          </p>
        )}
        {sp.error === "google" && (
          <p role="alert" className="rounded-[10px] bg-bad-soft p-3 text-sm text-bad">
            Google sign in didn&apos;t work. Try again, or use the email link.
          </p>
        )}
        <div className="sheet px-6 py-7 sm:px-8">
          {google && (
            <>
              <form action={signInWithGoogle}>
                <input type="hidden" name="next" value={next} />
                <button type="submit" className="btn btn-secondary w-full gap-2.5">
                  <svg aria-hidden="true" width="18" height="18" viewBox="0 0 48 48">
                    <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.2C12.4 13.6 17.7 9.5 24 9.5z" />
                    <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 7l7.2 5.6c4.2-3.9 7.1-9.6 7.1-17.1z" />
                    <path fill="#FBBC05" d="M10.5 28.6c-.5-1.4-.8-3-.8-4.600s.3-3.200.8-4.600l-7.900-6.200C.9 16.500 0 20.100 0 24s.9 7.500 2.600 10.800l7.900-6.200z" />
                    <path fill="#34A853" d="M24 48c6.5 0 11.900-2.100 15.900-5.800l-7.200-5.600c-2.200 1.500-5 2.400-8.700 2.400-6.300 0-11.600-4.100-13.500-9.900l-7.900 6.200C6.500 42.600 14.600 48 24 48z" />
                  </svg>
                  Continue with Google
                </button>
              </form>
              <div className="my-5 flex items-center gap-3 text-xs text-muted">
                <span className="h-px flex-1 bg-line" />
                or
                <span className="h-px flex-1 bg-line" />
              </div>
            </>
          )}
          <LoginForm next={next} />
        </div>
      </main>
    </>
  );
}
