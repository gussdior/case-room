"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getUserId } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { serviceClient } from "@/lib/supabase/service";
import { UUID_RE } from "@/lib/time";

type Result = { ok?: string; error?: string } | undefined;

const NOT_READY = "Deleting isn't switched on yet. The site owner needs to finish a database update first.";

function missingFunction(error: { code?: string; message?: string }) {
  return error.code === "PGRST202" || /could not find the function/i.test(error.message ?? "");
}

/** Removes uploaded files from the person's own folder, trying each batch twice.
 *  Uses the server key when set, otherwise the user's own session. Returns how many files could not be removed. */
async function removeFiles(userId: string, paths: string[]): Promise<number> {
  // Only files inside the acting person's own folder, whatever a database row says.
  const list = paths.filter((p) => typeof p === "string" && p.startsWith(`${userId}/`) && !p.includes(".."));
  if (list.length === 0) return 0;
  const client = serviceClient() ?? (await createClient());
  let failed = 0;
  for (let i = 0; i < list.length; i += 100) {
    const batch = list.slice(i, i + 100);
    let { error } = await client.storage.from("case-docs").remove(batch);
    if (error) ({ error } = await client.storage.from("case-docs").remove(batch));
    if (error) {
      failed += batch.length;
      console.error("Could not remove some case files after two tries", { userId, count: batch.length, message: error.message });
    }
  }
  return failed;
}

function confirmed(form: FormData) {
  return String(form.get("confirm") ?? "").trim() === "DELETE";
}

export async function deleteCase(caseId: string, _: Result, form: FormData): Promise<Result> {
  const userId = await getUserId();
  if (!userId) return { error: "Your sign in expired. Sign in again." };
  if (!UUID_RE.test(caseId)) return { error: "That link is broken." };
  if (!confirmed(form)) return { error: "Type DELETE to confirm." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("delete_case", { c: caseId });
  if (error) {
    if (missingFunction(error)) return { error: NOT_READY };
    if (error.message?.includes("Only the case creator")) return { error: "Only the case creator can delete this case." };
    return { error: "Couldn't delete the case. Try again." };
  }
  const failed = await removeFiles(userId, (data as string[] | null) ?? []);
  revalidatePath("/cases");
  revalidatePath("/");
  redirect(failed ? "/cases?deleted=case&files=pending" : "/cases?deleted=case");
}

export async function deleteAccount(_: Result, form: FormData): Promise<Result> {
  const userId = await getUserId();
  if (!userId) return { error: "Your sign in expired. Sign in again." };
  if (!confirmed(form)) return { error: "Type DELETE to confirm." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("delete_my_account");
  if (error) {
    if (missingFunction(error)) return { error: NOT_READY };
    return { error: "Couldn't delete your account. Try again." };
  }
  const paths = ((data as { paths?: string[] } | null)?.paths ?? []) as string[];
  const failed = await removeFiles(userId, paths);
  // Without the server key the account is closed and emptied, but the sign in record stays. See README.
  const admin = serviceClient();
  if (admin) {
    const { error: authError } = await admin.auth.admin.deleteUser(userId, true);
    if (authError) console.error("Could not remove the sign in record", authError.message);
  }
  await supabase.auth.signOut();
  revalidatePath("/");
  redirect(failed ? "/?account=deleted&files=pending" : "/?account=deleted");
}
