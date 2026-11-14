import "server-only";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "./config";

/** Server only client that bypasses row level security. Only exists when SUPABASE_SERVICE_ROLE_KEY is set.
 *  Used for writes the user must not be able to fake, like "this answer came from the built in AI". */
export function serviceClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return null;
  return createClient(SUPABASE_URL, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
