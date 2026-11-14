import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { loadLeaderboard } from "@/lib/db-case";
import { briefProgress, getRoom, leaderboard, memberById } from "@/lib/data";

export default async function LeaderboardPage({ params }: PageProps<"/case/[id]/leaderboard">) {
  const { id } = await params;
  const loaded = await getRoom(id);
  if (!loaded) notFound();
  if (loaded.teaser) redirect(`/case/${id}`);
  const room = loaded.room;

  // The sample case is computed here; real cases use the database's own scoring.
  const rows =
    room.viewer === null
      ? leaderboard(room).map((r) => ({
          id: r.member.id,
          name: r.member.name,
          headline: r.member.headline,
          tasksChecked: r.tasksChecked,
          reviewsDone: r.reviewsDone,
          points: r.points,
        }))
      : (await loadLeaderboard(room.id)).map((r) => ({
          id: r.user_id,
          name: r.display_name,
          headline: r.headline ?? "",
          tasksChecked: r.tasks_checked,
          reviewsDone: r.reviews_done,
          points: r.points,
        }));

  const tasksChecked = rows.reduce((n, r) => n + r.tasksChecked, 0);
  const reviews = rows.reduce((n, r) => n + r.reviewsDone, 0);
  const stats = [
    { value: tasksChecked, label: "Pieces of work checked" },
    { value: reviews, label: "Reviews done for others" },
    { value: rows.length, label: "People on the case" },
  ];

  return (
    <div className="mx-auto flex max-w-[1136px] flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <nav aria-label="Breadcrumb" className="text-[13px] text-subtle">
          <Link href={`/case/${room.id}`}>The brief</Link> / Leaderboard
        </nav>
        <h1 className="font-display text-[38px] leading-tight font-medium tracking-[-0.01em]">Contributions leaderboard</h1>
        <p className="text-sm text-subtle">
          Points only for checked work: 3 for each piece of your work that passes a check, 2 for each check you do for
          someone else.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-[14px] border border-line bg-white p-4">
            <div className="font-display text-[34px] leading-none font-medium">{s.value}</div>
            <div className="text-[13px] text-subtle">{s.label}</div>
          </div>
        ))}
        <div className="rounded-[14px] bg-ink p-4 text-white">
          <div className="font-display text-[34px] leading-none font-medium">{briefProgress(room)}%</div>
          <div className="text-[13px] text-line-2">Of the brief filled by the team</div>
        </div>
      </div>

      <div className="overflow-x-auto panel px-4 py-2 sm:px-6">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <caption className="sr-only">People ranked by points</caption>
          <thead>
            <tr className="text-left text-xs text-subtle">
              <th scope="col" className="px-2 py-3.5 font-semibold">Rank</th>
              <th scope="col" className="px-2 py-3.5 font-semibold">Name</th>
              <th scope="col" className="px-2 py-3.5 font-semibold">About</th>
              <th scope="col" className="px-2 py-3.5 text-right font-semibold">Work checked</th>
              <th scope="col" className="px-2 py-3.5 text-right font-semibold">Reviews done</th>
              <th scope="col" className="px-2 py-3.5 text-right font-semibold">Points</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const inProgress = room.tasks.filter(
                (t) => t.ownerId === r.id && ["taken", "stuck", "submitted"].includes(t.status),
              ).length;
              const top = i === 0 && r.points > 0;
              const isYou = r.id === room.viewer?.id;
              return (
                <tr key={r.id} className={`border-t border-[#ebeef3] ${top ? "bg-[#fff9ee]" : ""}`}>
                  <td className={`px-2 py-3.5 font-semibold ${top ? "text-warn" : ""}`}>{i + 1}</td>
                  <td className="px-2 py-3.5 font-semibold">
                    {r.name}
                    {isYou && <span className="font-normal text-subtle"> (you)</span>}
                  </td>
                  <td className="px-2 py-3.5 text-muted">{r.headline || memberById(room, r.id)?.headline}</td>
                  <td className="px-2 py-3.5 text-right">{r.tasksChecked}</td>
                  <td className="px-2 py-3.5 text-right">{r.reviewsDone}</td>
                  <td className="px-2 py-3.5 text-right font-semibold">
                    {r.points}
                    {inProgress > 0 && <span className="text-xs font-normal text-subtle">, {inProgress} in progress</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
