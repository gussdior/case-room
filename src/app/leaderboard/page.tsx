import { redirect } from "next/navigation";

// Leaderboards live inside each case. Send stray visits to the case list.
export default function LeaderboardRedirect() {
  redirect("/cases");
}
