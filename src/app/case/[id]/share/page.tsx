import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { FindHelpers, type HelperPlace } from "@/components/find-helpers";
import { fillLink } from "@/lib/ai/outreach";
import { getRoom } from "@/lib/data";
import { SAMPLE_OUTREACH } from "@/lib/sample-case";
import { createClient } from "@/lib/supabase/server";
import type { Expertise } from "@/lib/types";

export const metadata = { title: "Find your helpers | Case Room" };

async function origin() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

/** Find your helpers: where to post and ready posts. The case creator only. */
export default async function SharePage({ params, searchParams }: PageProps<"/case/[id]/share">) {
  const { id } = await params;
  const sp = await searchParams;
  const loaded = await getRoom(id);
  if (!loaded) notFound();
  if (loaded.teaser) redirect(`/case/${id}`);
  const room = loaded.room;
  const demo = room.viewer === null;
  const link = `${await origin()}/case/${room.id}`;
  const fresh = sp.new === "docs" ? "docs" : sp.new === "manual" ? "manual" : null;

  if (!demo && room.viewer?.role !== "creator") {
    return (
      <div className="max-w-[640px] rounded-[14px] border border-line bg-white p-6">
        <h1 className="font-display text-[28px] font-medium">Only the person who started this case can share it</h1>
        <p className="mt-2 text-sm text-muted">Ask them for the link. Everyone who joins goes through &quot;Ask to join&quot;.</p>
        <Link href={`/case/${room.id}`} className="btn btn-secondary mt-4">
          Back to the case
        </Link>
      </div>
    );
  }

  let places: HelperPlace[];
  let stats = { posted: 0, asked: 0 };
  if (demo) {
    places = SAMPLE_OUTREACH.map((p) => ({ ...p, post: fillLink(p.post, link) }));
    stats = { posted: places.filter((p) => p.posted).length, asked: 0 };
  } else {
    const supabase = await createClient();
    const [{ data }, { data: s }] = await Promise.all([
      supabase
        .from("case_outreach")
        .select("id, place, kind, skill, why, community, post, posted")
        .eq("case_id", room.id)
        .eq("archived", false)
        .order("created_at"),
      supabase.rpc("outreach_stats", { c: room.id }),
    ]);
    places = (data ?? []).map((p) => ({ ...p, skill: (p.skill as Expertise | null) ?? null, post: fillLink(p.post, link) }));
    const st = (s ?? {}) as { posted?: number; asked?: number };
    stats = { posted: st.posted ?? 0, asked: st.asked ?? 0 };
  }

  return (
    <FindHelpers
      caseId={room.id}
      demo={demo}
      places={places}
      link={link}
      previewOn={demo || !!room.publicPreview}
      fresh={fresh}
      stats={stats}
    />
  );
}
