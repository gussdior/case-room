import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import { scrub } from "@/lib/drafts/scrub";
import { AGE_RANGE_LABEL, EXPERTISE_LABEL, EXPERTISE_ORDER, type AgeRange, type Expertise } from "@/lib/types";

import { aiErrorMessage } from "@/lib/ai/errors";
const MODEL = "claude-sonnet-5-5";
export const LINK_TOKEN = "{LINK}";

export type OutreachKind = "patients" | "science" | "clinicians" | "people_you_know" | "other";
const KINDS: OutreachKind[] = ["patients", "science", "clinicians", "people_you_know", "other"];

const TOOL: Anthropic.Tool = {
  name: "suggest_places",
  description: "Suggest where a family should post to find volunteer helpers for one case, with a ready to copy post for each place.",
  input_schema: {
    type: "object",
    properties: {
      places: {
        type: "array",
        minItems: 3,
        maxItems: 5,
        items: {
          type: "object",
          properties: {
            place: {
              type: "string",
              description:
                "A kind of place in plain words, for example 'Lung cancer patient and caregiver groups'. Only name a specific community if you are sure it exists and is well known, like r/cancer. Never invent group names.",
            },
            kind: { type: "string", enum: KINDS },
            skill: { type: "string", enum: EXPERTISE_ORDER },
            why: { type: "string", description: "One sentence: why people there can help with this skill" },
            community: { type: "boolean", description: "True for public forums and online groups, false for private messages to people you know" },
            post: {
              type: "string",
              description: `The ready to copy post. Story first, then ask for one specific skill and roughly how long it takes, then the line with ${LINK_TOKEN}. Under 900 characters. No names, ages in years, places, hospitals, doctors or dates of birth.`,
            },
          },
          required: ["place", "kind", "skill", "why", "community", "post"],
          additionalProperties: false,
        },
      },
      reddit: {
        type: "object",
        description: "A Reddit text post for the family's own account, plus a short comment that carries the link.",
        properties: {
          place: {
            type: "string",
            description:
              "The kinds of subreddits that fit, in plain words, for example 'Cancer support and caregiver subreddits'. Only name a specific subreddit if you are sure it exists and is well known, like r/cancer. Never invent subreddit names.",
          },
          skill: { type: "string", enum: EXPERTISE_ORDER },
          why: { type: "string", description: "One sentence: why people there can help" },
          post: {
            type: "string",
            description:
              "A text post. Story first in the family's own voice, then one clear ask for research help with one skill and roughly how long it takes. No link, no web address and no site name anywhere in it. Never asks for medical advice. Under 1200 characters. No names, ages in years, places, hospitals, doctors or dates.",
          },
          comment: {
            type: "string",
            description: `A short reply to post only if someone asks for the link or the subreddit allows links. One or two sentences ending with ${LINK_TOKEN}. Under 300 characters.`,
          },
        },
        required: ["place", "skill", "why", "post", "comment"],
        additionalProperties: false,
      },
    },
    required: ["places", "reddit"],
    additionalProperties: false,
  },
};

const SYSTEM = `You help a family find volunteer helpers for a cancer case on Case Room, where volunteers use AI to research and turn what they find into questions for the patient's own doctor.
Suggest 3 to 5 places to post, matched to the cancer type and the skills the case needs. Always include one "people you know" private message. Mix patient and caregiver communities, science and data communities, and places to reach doctors and nurses as fits the skills needed.
Write each post in the family's voice, warm and plain:
- Start with the story in two or three sentences: what is happening and what the family wants to know.
- Ask for one specific skill and roughly how much time it takes.
- Say plainly it is about better questions for her doctor, never treatment advice, and nobody is asked for money.
- End with a line that contains ${LINK_TOKEN} exactly once, where the case link goes.
Also write one Reddit text post, separate from the places:
- It is posted from the family's own account, so write it in the first person, story first.
- No link, web address or site name in the post body. Many subreddits remove posts that carry links.
- Ask for research help and for help writing questions for her doctor. Never ask what treatment she should take, and never ask for medical advice.
- Add a separate short comment that holds ${LINK_TOKEN} exactly once, to post only if someone asks or the subreddit allows links.
Never include names, exact ages, cities, hospitals, doctor names, dates of birth or ID numbers. Never promise a cure or results.`;

export type Place = { place: string; kind: OutreachKind; skill: Expertise; why: string; community: boolean; post: string };
export type RedditPost = { place: string; skill: Expertise; why: string; post: string; comment: string };

/** Builds a short, identifier free description of the case for the AI. The caller must be the creator. */
async function context(supabase: SupabaseClient, caseId: string): Promise<string | null> {
  const { data: kase } = await supabase
    .from("cases")
    .select("goal, public_goal, cancer_type, cancer_stage, age_range, current_treatment, visit_date")
    .eq("id", caseId)
    .maybeSingle();
  if (!kase) return null;
  const [{ data: leads }, { data: members }] = await Promise.all([
    supabase.from("leads").select("title, status, next_step_expertise").eq("case_id", caseId).limit(12),
    supabase.from("case_members").select("status, expertise").eq("case_id", caseId),
  ]);
  const have = new Set((members ?? []).filter((m) => m.status === "approved").map((m) => m.expertise as Expertise));
  const needed = new Set<Expertise>();
  for (const l of leads ?? []) if (l.status === "needs_someone" && l.next_step_expertise) needed.add(l.next_step_expertise as Expertise);
  for (const e of ["doctor_nurse", "researcher"] as Expertise[]) if (!have.has(e)) needed.add(e);
  needed.delete("no_medical");
  const days = kase.visit_date ? Math.round((new Date(kase.visit_date).getTime() - Date.now()) / 86400000) : null;
  const lines = [
    `Goal: ${kase.public_goal || kase.goal}`,
    kase.cancer_type ? `Cancer type: ${kase.cancer_type}` : null,
    kase.cancer_stage ? `Stage: ${kase.cancer_stage}` : null,
    kase.age_range ? `Age range: ${AGE_RANGE_LABEL[kase.age_range as AgeRange] ?? ""}` : null,
    kase.current_treatment ? `Now: ${kase.current_treatment}` : null,
    days !== null && days >= 0 ? `Next doctor visit: in ${days} days` : null,
    `Skills the case needs most: ${[...needed].map((e) => EXPERTISE_LABEL[e]).join(", ") || "Doctor or nurse, Researcher"}`,
    (leads ?? []).length ? `Ideas the team is checking: ${(leads ?? []).map((l) => l.title).slice(0, 6).join("; ")}` : null,
  ].filter(Boolean);
  return scrub(lines.join("\n")).text;
}

/** Asks the AI for places and posts. Returns posts with the link token still in place. */
export async function writeOutreach(
  supabase: SupabaseClient,
  caseId: string,
): Promise<{ places?: Place[]; reddit?: RedditPost | null; error?: string }> {
  if (!process.env.ANTHROPIC_API_KEY) return { error: "The AI isn't switched on yet. The site owner needs to add the AI key." };
  const ctx = await context(supabase, caseId);
  if (!ctx) return { error: "Only the case creator can do this." };
  let places: Place[] = [];
  let rawReddit: Partial<RedditPost> | undefined;
  try {
    const msg = await new Anthropic().messages.create({
      model: MODEL,
      max_tokens: 4000,
      system: SYSTEM,
      tools: [TOOL],
      tool_choice: { type: "tool", name: TOOL.name },
      messages: [{ role: "user", content: ctx }],
    });
    const use = msg.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
    const input = use?.input as { places?: Place[]; reddit?: Partial<RedditPost> } | undefined;
    places = (input?.places ?? []).slice(0, 5);
    rawReddit = input?.reddit;
  } catch (err) {
    return { error: aiErrorMessage(err, "outreach") };
  }
  const clean = places
    .map((p) => ({
      place: scrub(String(p.place ?? "")).text.trim().slice(0, 120),
      kind: KINDS.includes(p.kind) ? p.kind : "other",
      skill: EXPERTISE_ORDER.includes(p.skill) ? p.skill : "researcher",
      why: scrub(String(p.why ?? "")).text.trim().slice(0, 400),
      community: !!p.community && p.kind !== "people_you_know",
      post: withToken(scrub(String(p.post ?? "")).text.trim()).slice(0, 1900),
    }))
    .filter((p) => p.place.length >= 2 && p.post.length >= 20);
  if (clean.length === 0) return { error: "The AI didn't return any posts. Try again." };
  return { places: clean, reddit: cleanReddit(rawReddit) };
}

/** The Reddit post never carries a link or the token. The comment carries the link exactly once. */
function cleanReddit(r: Partial<RedditPost> | undefined): RedditPost | null {
  if (!r) return null;
  const post = scrub(String(r.post ?? ""))
    .text.split(LINK_TOKEN)
    .join("")
    .replace(/https?:\/\/\S+/gi, "")
    .replace(/\bwww\.\S+/gi, "")
    .replace(/[ \t]+\n/g, "\n")
    .trim()
    .slice(0, 1900);
  if (post.length < 40) return null;
  const comment = withToken(scrub(String(r.comment ?? "")).text.trim() || "Here is the case, with no names:").slice(0, 580);
  return {
    place: scrub(String(r.place ?? "")).text.trim().slice(0, 120) || "Cancer support and research subreddits",
    skill: EXPERTISE_ORDER.includes(r.skill as Expertise) ? (r.skill as Expertise) : "researcher",
    why: scrub(String(r.why ?? "")).text.trim().slice(0, 400),
    post,
    comment,
  };
}

/** Makes sure every post has the link exactly once. */
function withToken(post: string) {
  const parts = post.split(LINK_TOKEN);
  if (parts.length === 1) return `${post}\n\nThe case, with no names: ${LINK_TOKEN}`;
  return parts[0] + LINK_TOKEN + parts.slice(1).join("");
}

export function fillLink(post: string, link: string) {
  return post.split(LINK_TOKEN).join(link);
}
