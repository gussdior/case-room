"use client";

import { useActionState, useState } from "react";
import { saveProfile } from "@/app/auth-actions";
import { FormMessage, SubmitButton, inputClass, labelClass } from "@/components/forms";
import type { Viewer } from "@/lib/auth";
import { EXPERTISE_ORDER, type Expertise } from "@/lib/types";

const PROFESSION: Record<Expertise, { label: string; hint: string }> = {
  doctor_nurse: { label: "Doctor or nurse", hint: "Can check medical work. Needs a proof link." },
  researcher: { label: "Researcher or scientist", hint: "Trials, papers and evidence." },
  bioinformatics: { label: "Bioinformatics or data", hint: "Gene reports and data tools." },
  insurance_legal: { label: "Insurance or legal", hint: "Coverage, appeals and access." },
  no_medical: { label: "No medical background", hint: "Calls, notes, organizing. Very useful." },
};

export const AREAS = [
  "Lung cancer",
  "Breast cancer",
  "Blood cancers",
  "Colorectal cancer",
  "Prostate cancer",
  "Brain tumors",
  "Pediatric cancers",
  "Rare cancers",
  "Clinical trials",
  "Genetic testing",
  "Insurance appeals",
  "Patient support",
];

const ZONES = [
  ["America/New_York", "US Eastern"],
  ["America/Chicago", "US Central"],
  ["America/Denver", "US Mountain"],
  ["America/Los_Angeles", "US Pacific"],
  ["America/Anchorage", "US Alaska"],
  ["Pacific/Honolulu", "US Hawaii"],
  ["America/Sao_Paulo", "Brazil"],
  ["Europe/London", "UK and Ireland"],
  ["Europe/Paris", "Central Europe"],
  ["Europe/Istanbul", "Turkey"],
  ["Asia/Kolkata", "India"],
  ["Asia/Singapore", "Singapore"],
  ["Asia/Tokyo", "Japan and Korea"],
  ["Australia/Sydney", "Australia East"],
];

export type ProfileExtras = {
  roleTitle: string | null;
  years: number | null;
  timeZone: string | null;
  areas: string[];
  alertsOn: boolean;
  alertFrequency: "instant" | "weekly";
};

export function ProfileForm({ next, viewer, extras }: { next: string; viewer: Viewer | null; extras: ProfileExtras | null }) {
  const [state, action] = useActionState(saveProfile, undefined);
  const [pick, setPick] = useState<Expertise | undefined>(viewer?.expertise);
  const [alerts, setAlerts] = useState(extras?.alertsOn ?? false);
  const zones = extras?.timeZone && !ZONES.some(([z]) => z === extras.timeZone) ? [[extras.timeZone, extras.timeZone], ...ZONES] : ZONES;

  return (
    <form action={action} className="sheet flex flex-col gap-7 px-5 py-8 sm:px-10 sm:py-10">
      <input type="hidden" name="next" value={next} />
      <input type="hidden" name="areas_present" value="1" />
      <input type="hidden" name="alerts_present" value="1" />

      <div className="flex flex-col gap-1.5">
        <label htmlFor="name" className={labelClass}>
          Name others will see
        </label>
        <input id="name" name="name" required maxLength={60} defaultValue={viewer?.name} autoComplete="name" className={inputClass} />
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className={`${labelClass} mb-2`}>Your profession</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {EXPERTISE_ORDER.map((e) => (
            <label
              key={e}
              className={`flex min-h-16 cursor-pointer items-start gap-3 rounded-[12px] border px-4 py-3 transition-[border-color,background-color,box-shadow] duration-150 has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-brand ${
                pick === e ? "border-ink bg-ink text-white" : "border-line bg-white hover:border-brand-line hover:bg-brand-tint"
              }`}
            >
              <input
                type="radio"
                name="expertise"
                value={e}
                required
                defaultChecked={viewer?.expertise === e}
                onChange={() => setPick(e)}
                className="sr-only"
              />
              <span
                aria-hidden="true"
                className={`mt-1 grid h-4 w-4 flex-none place-items-center rounded-full border-2 ${pick === e ? "border-mark" : "border-line-2"}`}
              >
                {pick === e && <span className="h-1.5 w-1.5 rounded-full bg-mark" />}
              </span>
              <span>
                <span className="block text-[15px] font-semibold">{PROFESSION[e].label}</span>
                <span className={`block text-[13px] ${pick === e ? "text-[#c9cfd8]" : "text-muted"}`}>{PROFESSION[e].hint}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="proof" className={labelClass}>
          A link that shows who you are
        </label>
        <input id="proof" name="proof" type="url" placeholder="https://" defaultValue={viewer?.proofUrl ?? ""} className={inputClass} />
        <span className="text-[13px] text-muted">
          LinkedIn, a hospital or university page, or a license lookup.
          {pick === "doctor_nurse" && <strong className="text-ink"> Doctors and nurses need one to join a case.</strong>}
        </span>
      </div>

      <details className="group rounded-[12px] border border-line" open={!!extras?.roleTitle || (extras?.areas.length ?? 0) > 0 || alerts}>
        <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 rounded-[12px] px-4 transition-colors hover:bg-paper">
          <span>
            <span className="block text-[15px] font-semibold">Optional: role, areas you know, case alerts</span>
            <span className="block text-[13px] text-muted">Helps creators trust you and lets us tell you when a case needs you.</span>
          </span>
          <svg aria-hidden="true" width="14" height="14" viewBox="0 0 12 12" className="flex-none transition-transform duration-200 group-open:rotate-180">
            <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" />
          </svg>
        </summary>
        <div className="flex flex-col gap-6 border-t border-line px-4 py-5">
          <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="headline" className={labelClass}>
                One line about you
              </label>
              <input
                id="headline"
                name="headline"
                maxLength={120}
                placeholder="e.g. Oncology nurse at a cancer center"
                defaultValue={viewer?.headline}
                className={inputClass}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="years" className={labelClass}>
                Years
              </label>
              <input id="years" name="years" type="number" min={0} max={70} defaultValue={extras?.years ?? ""} className={inputClass} />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="role_title" className={labelClass}>
                Exact role
              </label>
              <input
                id="role_title"
                name="role_title"
                maxLength={80}
                placeholder="e.g. Thoracic oncology nurse"
                defaultValue={extras?.roleTitle ?? ""}
                className={inputClass}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="time_zone" className={labelClass}>
                Time zone
              </label>
              <select id="time_zone" name="time_zone" defaultValue={extras?.timeZone ?? ""} className={inputClass}>
                <option value="">Choose your time zone</option>
                {zones.map(([z, l]) => (
                  <option key={z} value={z}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <fieldset>
            <legend className={`${labelClass} mb-2`}>Areas you know best</legend>
            <div className="flex flex-wrap gap-2">
              {AREAS.map((a) => (
                <label key={a} className="chip min-h-11 gap-2 has-[:checked]:border-ink has-[:checked]:bg-ink has-[:checked]:text-white has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-brand">
                  <input type="checkbox" name="areas" value={a} defaultChecked={extras?.areas.includes(a)} className="sr-only" />
                  {a}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="rounded-[12px] bg-paper p-4">
            <label className="flex min-h-11 cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                name="alerts_on"
                checked={alerts}
                onChange={(e) => setAlerts(e.target.checked)}
                className="peer sr-only"
              />
              <span
                aria-hidden="true"
                className={`relative h-6 w-11 flex-none rounded-full transition-colors peer-focus-visible:outline-3 peer-focus-visible:outline-brand ${alerts ? "bg-ok" : "bg-line-2"}`}
              >
                <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${alerts ? "translate-x-5" : ""}`} />
              </span>
              <span>
                <span className="block text-[15px] font-semibold">Email me when a listed case needs my profession</span>
                <span className="block text-[13px] text-muted">Goal and skills needed only, never patient details.</span>
              </span>
            </label>
            <div className={`mt-3 flex flex-wrap gap-2 pl-14 ${alerts ? "" : "hidden"}`}>
              {(["weekly", "instant"] as const).map((f) => (
                <label key={f} className="chip min-h-11 has-[:checked]:border-ink has-[:checked]:bg-ink has-[:checked]:text-white">
                  <input type="radio" name="alert_frequency" value={f} defaultChecked={(extras?.alertFrequency ?? "weekly") === f} className="sr-only" />
                  {f === "weekly" ? "Weekly summary" : "Right away"}
                </label>
              ))}
            </div>
          </div>
        </div>
      </details>

      <div className="flex flex-wrap items-center gap-4">
        <SubmitButton variant="mark">Save and continue</SubmitButton>
        <span className="text-[13px] text-muted">Only people on a case with you can see your profile.</span>
      </div>
      <FormMessage state={state} />
    </form>
  );
}
