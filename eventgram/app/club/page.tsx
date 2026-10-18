import Link from "next/link";
import ClubDesk from "@/components/ClubDesk";
import { sortEvents, todayIST } from "@/lib/format";
import { getRole } from "@/lib/queries";
import { EVENT_SELECT, type EventFull } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ClubHome() {
  const { supabase, user, isOwner, club } = await getRole();

  if (!isOwner && !club) {
    return (
      <main className="wrap page">
        <div className="empty">
          <h2>Clubs only</h2>
          <p>You&apos;re logged in as {user?.email}, which isn&apos;t a club login. Log out and use your club&apos;s username.</p>
          <form action="/auth/signout" method="post"><button className="ghost press">Log out</button></form>
        </div>
      </main>
    );
  }

  let query = supabase.from("events").select(EVENT_SELECT).or(`event_date.gte.${todayIST()},end_date.gte.${todayIST()}`).order("event_date").limit(500);
  // A club sees its own events plus EventHub events no club has claimed yet.
  if (!isOwner && club) query = query.or(`club_id.eq.${club.id},club_id.is.null`);
  const { data } = await query;
  const events = sortEvents((data ?? []) as unknown as EventFull[]);

  return (
    <main className="wrap page">
      <section className="desk">
        <h1 className="deskh">Club <span>desk</span></h1>
        <p className="hint">
          Events come in from EventHub on their own. Find yours and add what EventHub leaves out: OD details, timings, a hook line, highlights,
          posters, reels and your Insta post. It goes live on the feed straight away.
        </p>
        <div className="whoami">
          <span>{isOwner ? <>Logged in as the <b>owner</b> · you can edit every event</> : <>Logged in as <b>{club!.name}</b></>}</span>
          <span className="actions">
            {isOwner && <Link className="ghost press" href="/owner">Clubs &amp; sync</Link>}
            <form action="/auth/signout" method="post"><button className="ghost press">Log out</button></form>
          </span>
        </div>
        <ClubDesk events={events} />
        <Link className="ghost press" href="/club/events/new" style={{ alignSelf: "flex-start" }}>Event not on EventHub? Add it here</Link>
      </section>
    </main>
  );
}
