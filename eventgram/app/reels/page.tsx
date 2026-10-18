import Reels from "@/components/Reels";
import { getUpcomingEvents } from "@/lib/queries";
import { sortedMedia } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ReelsPage() {
  const events = await getUpcomingEvents();
  // One entry per reel, soonest events first.
  const reels = events.flatMap((e) => sortedMedia(e.media, "reel").map((m) => ({ media: m, event: e })));
  return <Reels reels={reels} />;
}
