import { notFound, redirect } from "next/navigation";
import ClubEventEditor from "@/components/ClubEventEditor";
import { todayIST } from "@/lib/format";
import { getRole } from "@/lib/queries";
import { EVENT_SELECT, type Club, type EventFull } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function EditEvent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, isOwner, club } = await getRole();
  if (!isOwner && !club) redirect("/club");

  const { data } = await supabase.from("events").select(EVENT_SELECT).eq("id", id).maybeSingle();
  if (!data) notFound();
  const event = data as unknown as EventFull;
  // Clubs can edit their own events and claim ones nobody has claimed.
  if (!isOwner && event.club_id && event.club_id !== club!.id) redirect("/club");

  let clubs: Pick<Club, "id" | "name">[] = club ? [club] : [];
  if (isOwner) {
    const { data: all } = await supabase.from("clubs").select("id,name").order("name");
    clubs = (all ?? []) as Pick<Club, "id" | "name">[];
  }
  return (
    <main className="wrap page">
      <ClubEventEditor event={event} clubs={clubs} isOwner={isOwner} today={todayIST()} />
    </main>
  );
}
