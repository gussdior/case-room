// Public values: the project address and its publishable key are sent to every browser by design.
// Access is protected by the database's row level security, not by keeping these secret.
// Set the environment variables to point the app at a different Supabase project.
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://vxcqypfigklnnomshtlc.supabase.co";
export const SUPABASE_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_gyea-YiwmNqUThW3qCoXAg_0aE9Rld5";
