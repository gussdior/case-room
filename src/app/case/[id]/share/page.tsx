import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { FindHelpers, type HelperPlace } from "@/components/find-helpers";
import { ShareAi, type ActiveAiLink, type AiPreviewData, type AiRoleKey } from "@/components/share-ai";
import { SAMPLE_AI_TOKEN, siteOrigin, visitLine } from "@/lib/ai-link";
import { fillLink } from "@/lib/ai/outreach";
import { getRoom, memberById } from "@/lib/data";
import { loadLeads } from "@/lib/db-leads";
import { SAMPLE_AI_LINKS, SAMPLE_LEADS, SAMPLE_OUTREACH } from "@/lib/sample-case";
import { createClient } from "@/lib/supabase/server";
import { caseFacts, type Expertise, type Lead } from "@/lib/types";

export const metadata = { title: "Share this case | Case Room" };

function left(expiresAt: string): string {
  const ms = new Date(expiresAt).getTime() - Date.now();
  const days = Math.floor(ms / 86400000);
  if (days >= 1) return `${days} day${days === 1 ? "" : "s"}`;
  const hours = Math.max(1, Math.round(ms / 3600000));
  return `${hours} hour${hours === 1 ? "" : "s"}`;
}

function previewData(goal: string, facts: string[], visitDays: number | null, showVisit: boolean, leads: Lead[]): AiPreviewData {
  return {
    goal,
    facts: facts.join(". "),
    visit: showVisit ? visitLine(visitDays) : null,
    leads: leads
      .filter((l) => l.status !== "ruled_out")
      .map((l) => ({
        title: l.title,
        expertise: l.nextStepExpertise,
        done: l.conditions
          .filter((c) => !c.checked)
          .map((c) => c.text)
          .slice(0, 2)
          .join("; "),
      })),
    ruledOut: leads.filter((l) => l.status === "ruled_out").map((l) => l.title),
  };
}

/** Share this case: with people (posts, for the creator) or with an AI (a link any AI can read, for anyone on the case). */
export default async function SharePage({ params, searchParams }: PageProps<"/case/[id]/share">) {
  const { id } = await params;
  const sp = await searchParams;
  const loaded = await getRoom(id);
  if (!loaded) notFound();
  if (loaded.teaser) redirect(`/case/${id}`);
  const room = loaded.room;
  const demo = room.viewer === null;
  const isCreator = demo || room.viewer?.role === "creator";
  const origin = await siteOrigin();
  const link = `${origin}/case/${room.id}`;
  const fresh = sp.new === "docs" ? "docs" : sp.new === "manual" ? "manual" : null;
  // People who did not start the case only get the AI tab.
  const tab: "people" | "ai" = !isCreator || sp.tab === "ai" ? "ai" : "people";

  const tabs = (
    <nav aria-label="Ways to share" className="mb-6 flex w-fit gap-1 rounded-[12px] bg-[#eef0ee] p-1">
      {isCreator && (
        <Link
          href={`/case/${room.id}/share${fresh ? `?new=${fresh}` : ""}`}
          aria-current={tab === "people" ? "page" : undefined}
          className={`inline-flex min-h-11 items-center rounded-[9px] px-4 text-sm font-semibold transition-colors duration-150 ${
            tab === "people" ? "bg-white text-ink shadow-[0_1px_3px_rgba(0,0,0,0.08)]" : "text-muted hover:text-ink"
          }`}
        >
          With people
        </Link>
      )}
      <Link
        href={`/case/${room.id}/share?tab=ai${fresh ? `&new=${fresh}` : ""}`}
        aria-current={tab === "ai" ? "page" : undefined}
        className={`inline-flex min-h-11 items-center rounded-[9px] px-4 text-sm font-semibold transition-colors duration-150 ${
          tab === "ai" ? "bg-white text-ink shadow-[0_1px_3px_rgba(0,0,0,0.08)]" : "text-muted hover:text-ink"
        }`}
      >
        With an AI
      </Link>
    </nav>
  );

  if (tab === "ai") {
    let links: ActiveAiLink[];
    let leads: Lead[];
    if (demo) {
      leads = SAMPLE_LEADS;
      links = SAMPLE_AI_LINKS;
    } else {
      const supabase = await createClient();
      const [{ data }, loadedLeads] = await Promise.all([
        supabase
          .from("case_ai_links")
          .select("id, role, created_by, expires_at, open_count")
          .eq("case_id", room.id)
          .is("revoked_at", null)
          .gt("expires_at", new Date().toISOString())
          .order("created_at", { ascending: false }),
        loadLeads(room.id),
      ]);
      leads = loadedLeads;
      const me = room.viewer!;
      links = (data ?? []).map((l) => ({
        id: l.id,
        role: l.role as AiRoleKey,
        expires: left(l.expires_at),
        by: l.created_by === me.id ? "you" : (memberById(room, l.created_by)?.name ?? "a former member"),
        opens: l.open_count ?? 0,
        canTurnOff: l.created_by === me.id || me.isAdmin,
      }));
    }
    return (
      <div>
        {tabs}
        <h1 className="font-display text-[34px] leading-[1.1] font-medium tracking-[-0.015em] sm:text-[40px]">Share this case</h1>
        <p className="mt-2.5 mb-6 max-w-[640px] text-base text-muted">
          Send it to a person, or give a link to any AI so it can read the whole case and help.
        </p>
        <ShareAi
          caseId={room.id}
          demo={demo}
          allowed={demo || room.aiLinksAllowed !== false}
          origin={origin}
          links={links}
          preview={previewData(room.goal, caseFacts(room), room.visitInDays, demo || room.previewShowVisit !== false, leads)}
          demoLink={demo ? `${origin}/ai/${SAMPLE_AI_TOKEN}` : undefined}
        />
        <p className="mt-6 text-[13px] text-muted">
          <Link href={`/case/${room.id}`}>Back to the case</Link>
        </p>
      </div>
    );
  }

  let places: HelperPlace[];
  let stats = { posted: 0, asked: 0 };
  if (demo) {
    places = SAMPLE_OUTREACH.map((p) => ({ ...p, post: fillLink(p.post, link), comment: p.comment ? fillLink(p.comment, link) : null }));
    stats = { posted: places.filter((p) => p.posted).length, asked: 0 };
  } else {
    const supabase = await createClient();
    const [{ data }, { data: s }] = await Promise.all([
      supabase
        .from("case_outreach")
        .select("id, place, kind, skill, why, community, post, posted, reddit, comment")
        .eq("case_id", room.id)
        .eq("archived", false)
        .order("created_at"),
      supabase.rpc("outreach_stats", { c: room.id }),
    ]);
    places = (data ?? [])
      .map((p) => ({
        ...p,
        skill: (p.skill as Expertise | null) ?? null,
        post: fillLink(p.post, link),
        comment: p.comment ? fillLink(p.comment, link) : null,
      }))
      // The Reddit post leads the list.
      .sort((a, b) => Number(!!b.reddit) - Number(!!a.reddit));
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
      tabs={tabs}
    />
  );
}
