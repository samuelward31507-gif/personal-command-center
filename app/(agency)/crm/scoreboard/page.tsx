import { redirect } from "next/navigation";

/** The scoreboard merged into the dashboard. */
export default function ScoreboardPage() {
  redirect("/crm/needs-you");
}
