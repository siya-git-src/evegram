import { redirect } from "next/navigation";
import ClubEventEditor from "@/components/ClubEventEditor";
import { todayIST } from "@/lib/format";
import { getRole } from "@/lib/queries";
import type { Club } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function NewEvent() {
  const { supabase, isOwner, club } = await getRole();
  if (!isOwner && !club) redirect("/club");
  let clubs: Pick<Club, "id" | "name">[] = club ? [club] : [];
  if (isOwner) {
    const { data } = await supabase.from("clubs").select("id,name").order("name");
    clubs = (data ?? []) as Pick<Club, "id" | "name">[];
  }
  if (!clubs.length) redirect("/owner");
  return (
    <main className="wrap page">
      <ClubEventEditor event={null} clubs={clubs} isOwner={isOwner} today={todayIST()} />
    </main>
  );
}
