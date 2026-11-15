# Case Room

Volunteers with different expertise and AI work together on one cancer case.
They build one brief of questions and options for the patient's own doctor.

## Safety rules (built into the database)

1. Output is questions and options for the patient's own doctor. Never treatment advice.
2. A case needs patient consent. No names or ID numbers.
3. Every submission needs a source link. Nothing counts until a second person or the AI checks it.
4. No asking the family for money. No private messages.
5. Volunteers ask to join; the case creator (or a co-approver) approves or declines.

## What is built

| Page | Path |
|---|---|
| Home | `/` |
| Case room: brief, gaps, case discussion | `/case/sample` |
| Task page with its own thread | `/case/sample/task/[taskId]` |
| People: approve or decline volunteers | `/case/sample/people` |
| Leaderboard | `/case/sample/leaderboard` |

Pages currently read a made up sample case (`src/lib/sample-case.ts`).
Buttons explain that they work once sign in is connected.

The database schema with all access rules is in `supabase/migrations/0001_init.sql`.

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000/case/sample

## Database

Migrations in `supabase/migrations/` run in order (0001 to 0005). Every access rule is enforced in the
database (row level security and server functions), so the app's checks are only for clearer messages.

Key rules:
- Only approved members can read a case. Outsiders see only the goal and the skills needed.
- Expertise is fixed per case when someone joins; editing a profile doesn't change who may check work.
- Work can be checked only by someone other than its author, the task owner or a helper, who has the
  same expertise as the task (or is a doctor or nurse), and only on the latest version.
- Only a human check puts work into the brief. AI checks are notes.
- Links (sources, proof links) must be http(s).

## Sign in email template

In Supabase > Authentication > Email Templates > Magic Link, use a link that works on any device and
include the code:

```html
<h2>Sign in to Case Room</h2>
<p><a href="{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=email">Sign in</a></p>
<p>Or enter this code: {{ .Token }}</p>
```

Add your site's `/auth/callback` to Authentication > URL Configuration > Redirect URLs.

## Next steps

1. Deploy on Vercel with the variables from `.env.example` (set `NEXT_PUBLIC_SITE_URL`).
2. Add the AI helper: gap drafting, source checks, daily summary.

## Case alerts and the AI helper

- Creators can list a case (`cases.listed`). `listed_cases_for_me()` returns listed cases with open tasks for the caller's expertise. **Alert emails are not sent yet**: that needs a mail sender (Resend) and a scheduled job reading `profiles.alerts_on` and `alert_frequency`.
- The AI helper (`POST /api/ai/task`) needs `ANTHROPIC_API_KEY` in Vercel. It searches ClinicalTrials.gov, PubMed and bioRxiv/medRxiv, streams its answer as server sent events, and saves the chat to `ai_messages`.
- `POST /api/ai/check-sources` checks each link before submitting: trial links for current recruitment status, other links for whether they open.

## Leads and AI runs

The case page is now **Leads**: ideas the team is checking (a trial, an existing drug used a new way, a personalized or vaccine approach, a test, access help). Each lead has "what would need to be true", its AI runs, and a status. Ruling a lead out needs a reason and a source, and logs it on What we tried. The brief moved to **For the doctor** (`/case/[id]/doctor`).

- **AI runs** (`ai_runs`): every built in AI answer, plus results people paste from their own AI. Pasted links are checked and names and IDs are scrubbed before saving.
- **Copy case for your AI**: `GET /api/case/[id]/pack` returns a scrubbed plain text case with rules for any AI.
- **Suggested leads**: `POST /api/case/[id]/suggest-leads` (case admins). Runs automatically right after a case opens from documents.
- **Prompts that worked**: `top_prompts(lead)` returns this lead's most reused prompts, then well reused, scrubbed prompts from leads of the same kind in other cases (prompt text only).

### Verified AI answers: add `SUPABASE_SERVICE_ROLE_KEY`

Only rows the server writes with the service key are marked `written_by_server`. A database trigger forces that flag to false for every other write, so nobody can plant a "Case Room AI" answer or a "sources checked" badge that shows as verified (migration 0016).

Without the key, AI answers and pasted runs still save (through `save_ai_run` and `save_ai_exchange`), but the app shows them as "Not verified: saved without the server check" and hides source check results. Add the key in Vercel to get verified answers back. After that you can also revoke the fallback functions:

```sql
revoke execute on function public.save_ai_run(uuid, uuid, uuid, ai_tool, text, text, text, jsonb, jsonb) from authenticated;
revoke execute on function public.save_ai_exchange(uuid, text, text, jsonb) from authenticated;
```

### AI cost limits

Every AI route counts calls per person per day in `ai_usage` (see `src/lib/ai/limits.ts` for the limits). Over the limit, people see "Daily AI limit reached. It resets tomorrow." Set `AI_DAILY_GLOBAL_CAP` in Vercel to also pause the AI for everyone after that many calls in a day. Keep the Anthropic spend limit as the last backstop.

The key bypasses all row level security. Keep it server only: never prefix it with `NEXT_PUBLIC_`.

## Privacy, preview and deleting (Group 1)

- `/privacy` and `/terms` are drafts. Sections tagged "Lawyer review" must be checked before launch, including the
  30 day deletion promise: Supabase backups roll off on their own schedule (daily backups kept 7 days on Pro, longer on
  higher plans, point in time recovery if enabled), so the lawyer should confirm the wording matches the plan in use.
- Footer contact email: set `NEXT_PUBLIC_CONTACT_EMAIL` in Vercel. Without it the footer shows "Contact" linking to the
  terms page, which says contact details are coming soon.
- Public preview: `cases.public_preview` and `cases.preview_show_visit`, read through `case_preview(id)` (callable signed
  out, returns only goal, cancer type and stage, visit days if allowed, skills needed, helper count). Listing a case
  turns the preview on.
- Deleting: migration `0012_delete_case_and_account.sql` adds `delete_case` and `delete_my_account`. The database tool
  asks for confirmation on statements that delete rows, so apply this file once from the Supabase SQL editor. Until then
  the delete buttons say deleting isn't switched on yet.
- Deleting an account empties and closes the profile ("Deleted user"), deletes cases they created, their drafts, files,
  memberships and private AI chats. Work they shared in other cases stays, credited to "Deleted user". Removing the sign
  in record needs `SUPABASE_SERVICE_ROLE_KEY` (soft delete through the admin API). Without the key the sign in record
  stays, and signing in again starts a fresh empty profile.

## AI share links

People on a case can create a link at `/ai/<token>` that any AI can read (migration `0018_ai_links.sql`).
- Only a hash of the token is stored, so the full link is shown once, when it is created.
- The page and `/ai/<token>/text` show the chosen case text with no names, member identities, documents or messages.
- Links expire after 24 hours, 7 days or 30 days, can be turned off, and the creator can switch AI links off for the whole case.
- `ai_link_pack` is callable signed out on purpose. The regex scrub runs in the app, so a direct database call with a valid token skips that second pass.
- Reddit posts reuse `case_outreach` with `reddit = true` and kind `other`, because changing the kind check would need a constraint to be removed.
