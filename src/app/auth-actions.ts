"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getUserId, safeNext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { EXPERTISE_ORDER, type Expertise } from "@/lib/types";

export type FormState = { error?: string; ok?: string } | undefined;

async function siteOrigin() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

export async function sendSignInLink(_: FormState, form: FormData): Promise<FormState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const next = safeNext(form.get("next"));
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Enter a valid email address." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${await siteOrigin()}/auth/callback?next=${encodeURIComponent(next)}` },
  });
  if (error) {
    return {
      error: error.status === 429 ? "Too many emails sent. Wait a minute and try again." : "We couldn't send the link. Try again.",
    };
  }
  return { ok: email };
}

export async function verifyCode(_: FormState, form: FormData): Promise<FormState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const token = String(form.get("code") ?? "").replace(/\s/g, "");
  const next = safeNext(form.get("next"));
  if (!/^\d{6,10}$/.test(token)) return { error: "Enter the code from the email." };
  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
  if (error) return { error: "That code is wrong or expired. Send a new email." };
  redirect(next);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

function cleanUrl(raw: string): string | null | "invalid" {
  const v = raw.trim();
  if (!v) return null;
  try {
    const u = new URL(v);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : "invalid";
  } catch {
    return "invalid";
  }
}

function validTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return tz.length <= 64;
  } catch {
    return false;
  }
}

export async function saveProfile(_: FormState, form: FormData): Promise<FormState> {
  const id = await getUserId();
  if (!id) return { error: "Your sign in expired. Sign in again." };

  const name = String(form.get("name") ?? "").trim();
  const headline = String(form.get("headline") ?? "").trim();
  const expertise = String(form.get("expertise") ?? "") as Expertise;
  const proof = cleanUrl(String(form.get("proof") ?? ""));
  const next = safeNext(form.get("next"));

  if (!name || name.length > 60) return { error: "Add your name (up to 60 characters)." };
  if (headline.length > 120) return { error: "Keep the short description under 120 characters." };
  if (!EXPERTISE_ORDER.includes(expertise)) return { error: "Pick your expertise." };
  if (proof === "invalid") return { error: "The link should start with https://" };

  // Optional fields: only saved when the form has them, so older forms don't clear them.
  const extra: Record<string, unknown> = {};
  if (form.has("role_title")) {
    const role = String(form.get("role_title") ?? "").trim();
    if (role.length > 80) return { error: "Keep your role under 80 characters." };
    extra.role_title = role || null;
  }
  if (form.has("years")) {
    const raw = String(form.get("years") ?? "").trim();
    const years = raw === "" ? null : Number(raw);
    if (years !== null && (!Number.isInteger(years) || years < 0 || years > 70))
      return { error: "Years of experience should be a whole number from 0 to 70." };
    extra.years_experience = years;
  }
  if (form.has("time_zone")) {
    const tz = String(form.get("time_zone") ?? "").trim();
    if (tz && !validTimeZone(tz)) return { error: "Pick your time zone from the list." };
    extra.time_zone = tz || null;
  }
  if (form.has("areas") || form.has("areas_present")) {
    const areas = [...new Set(form.getAll("areas").map((a) => String(a).trim()).filter(Boolean))];
    if (areas.length > 12 || areas.some((a) => a.length > 40)) return { error: "Pick up to 12 areas." };
    extra.areas = areas;
  }
  if (form.has("alerts_present")) {
    extra.alerts_on = form.get("alerts_on") === "on";
    extra.alert_frequency = form.get("alert_frequency") === "instant" ? "instant" : "weekly";
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .upsert({ id, display_name: name, headline: headline || null, expertise, proof_url: proof, ...extra });
  if (error) return { error: "Couldn't save your profile. Try again." };
  redirect(next);
}
