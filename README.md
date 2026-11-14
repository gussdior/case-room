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

## Next steps

1. Create a Supabase project and run `supabase/migrations/0001_init.sql` in its SQL editor.
2. Copy `.env.example` to `.env.local` and fill in the keys.
3. Connect sign in and swap `src/lib/data.ts` from the sample case to Supabase.
4. Add the AI helper: gap drafting, source checks, daily summary.
5. Deploy on Vercel.
