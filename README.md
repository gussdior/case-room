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
