import { after } from "next/server";
import Feed from "@/components/Feed";
import { todayIST } from "@/lib/format";
import { getLastSync, getUpcomingEvents } from "@/lib/queries";
import { syncIfStale } from "@/lib/eventhub/sync";

export const dynamic = "force-dynamic";

function ago(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 2) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const h = Math.round(mins / 60);
  return h < 24 ? `${h} hour${h === 1 ? "" : "s"} ago` : `${Math.round(h / 24)} day${h < 48 ? "" : "s"} ago`;
}

export default async function Home() {
  const [events, last] = await Promise.all([getUpcomingEvents(), getLastSync()]);
  // If the last EventHub sync is old, refresh in the background after this page is sent.
  after(() => syncIfStale().catch(() => {}));
  const syncedText = last ? `Updated from EventHub ${ago(last.finished_at)}` : null;
  return <Feed events={events} today={todayIST()} syncedText={syncedText} />;
}
