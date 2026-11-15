import { revalidatePath } from "next/cache";
import { writeOutreach } from "@/lib/ai/outreach";
import { createClient } from "@/lib/supabase/server";
import { UUID_RE } from "@/lib/time";

export const maxDuration = 120;

/** Find your helpers: the AI writes places and posts for this case. Creator only.
 *  Running it again archives the current set and writes a new one. */
export async function POST(_: Request, ctx: RouteContext<"/api/case/[id]/outreach">) {
  const { id } = await ctx.params;
  if (!UUID_RE.test(id)) return Response.json({ error: "That case link is broken." }, { status: 400 });
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub as string | undefined;
  if (!userId) return Response.json({ error: "Sign in first." }, { status: 401 });
  const { data: me } = await supabase.from("case_members").select("role, status").eq("case_id", id).eq("user_id", userId).maybeSingle();
  if (!me || me.status !== "approved" || me.role !== "creator")
    return Response.json({ error: "Only the case creator can do this." }, { status: 403 });
  if (!process.env.ANTHROPIC_API_KEY)
    return Response.json({ error: "The AI isn't switched on yet. The site owner needs to add the AI key." }, { status: 503 });

  const r = await writeOutreach(supabase, id);
  if (!r.places) return Response.json({ error: r.error ?? "Something went wrong. Try again." }, { status: 502 });
  const { error: archiveError } = await supabase.rpc("archive_outreach", { c: id });
  if (archiveError) return Response.json({ error: "Couldn't save the posts. Try again." }, { status: 500 });
  const { error } = await supabase.from("case_outreach").insert(
    r.places.map((p) => ({
      case_id: id,
      place: p.place,
      kind: p.kind,
      skill: p.skill,
      why: p.why,
      community: p.community,
      post: p.post,
      created_by: userId,
    })),
  );
  if (error) return Response.json({ error: "Couldn't save the posts. Try again." }, { status: 500 });
  revalidatePath(`/case/${id}/share`);
  return Response.json({ places: r.places.length });
}
