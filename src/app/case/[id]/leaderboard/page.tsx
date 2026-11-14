import Link from "next/link";
import { notFound } from "next/navigation";
import { briefProgress, getCaseRoom, leaderboard } from "@/lib/data";

export default async function LeaderboardPage({ params }: PageProps<"/case/[id]/leaderboard">) {
  const { id } = await params;
  const room = await getCaseRoom(id);
  if (!room) notFound();

  const rows = leaderboard(room);
  const tasksChecked = rows.reduce((n, r) => n + r.tasksChecked, 0);
  const reviews = rows.reduce((n, r) => n + r.reviewsDone, 0);
  const stats = [
    { value: tasksChecked, label: "Tasks checked" },
    { value: reviews, label: "Reviews done for others" },
    { value: rows.length, label: "Volunteers" },
  ];

  return (
    <div className="mx-auto flex max-w-[1136px] flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <nav aria-label="Breadcrumb" className="text-[13px] text-subtle">
          <Link href={`/case/${room.id}`}>Case room</Link> / Leaderboard
        </nav>
        <h1 className="font-display text-[28px] font-bold">Contributions leaderboard</h1>
        <p className="text-sm text-subtle">
          Points only for checked work: 3 per checked task, 2 per check you do for someone else.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-[14px] border border-line bg-white p-4">
            <div className="text-[26px] font-bold">{s.value}</div>
            <div className="text-[13px] text-subtle">{s.label}</div>
          </div>
        ))}
        <div className="rounded-[14px] bg-ink p-4 text-white">
          <div className="text-[26px] font-bold">{briefProgress(room)}%</div>
          <div className="text-[13px] text-line-2">Of the brief filled by the team</div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-line bg-white px-4 py-2 sm:px-6">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <caption className="sr-only">Volunteers ranked by points</caption>
          <thead>
            <tr className="text-left text-xs text-subtle">
              <th scope="col" className="px-2 py-3.5 font-semibold">Rank</th>
              <th scope="col" className="px-2 py-3.5 font-semibold">Volunteer</th>
              <th scope="col" className="px-2 py-3.5 font-semibold">About</th>
              <th scope="col" className="px-2 py-3.5 text-right font-semibold">Tasks checked</th>
              <th scope="col" className="px-2 py-3.5 text-right font-semibold">Reviews done</th>
              <th scope="col" className="px-2 py-3.5 text-right font-semibold">Points</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const inProgress = room.tasks.filter(
                (t) => t.ownerId === r.member.id && ["taken", "stuck", "submitted"].includes(t.status),
              ).length;
              return (
                <tr key={r.member.id} className={`border-t border-[#ebeef3] ${i === 0 && r.points > 0 ? "bg-[#fff9ee]" : ""}`}>
                  <td className={`px-2 py-3.5 font-bold ${i === 0 && r.points > 0 ? "text-warn" : ""}`}>{i + 1}</td>
                  <td className="px-2 py-3.5 font-semibold">{r.member.name}</td>
                  <td className="px-2 py-3.5 text-muted">{r.member.headline}</td>
                  <td className="px-2 py-3.5 text-right">{r.tasksChecked}</td>
                  <td className="px-2 py-3.5 text-right">{r.reviewsDone}</td>
                  <td className="px-2 py-3.5 text-right font-bold">
                    {r.points}
                    {inProgress > 0 && (
                      <span className="text-xs font-normal text-subtle"> · {inProgress} in progress</span>
                    )}
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
