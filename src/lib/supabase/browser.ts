"use client";
import { createBrowserClient } from "@supabase/ssr";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./config";

let client: ReturnType<typeof createBrowserClient> | null = null;

/** Supabase client for the browser. Row level security decides what it can read and write. */
export function browserClient() {
  client ??= createBrowserClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
  return client;
}
