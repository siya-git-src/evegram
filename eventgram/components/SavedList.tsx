"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { lastDay, odState, sortEvents } from "@/lib/format";
import { EVENT_SELECT, type EventFull } from "@/lib/types";
import EventCard from "./EventCard";
import { useSaved } from "./SaveButton";

export default function SavedList({ today }: { today: string }) {
  const ids = useSaved();
  const [events, setEvents] = useState<EventFull[] | null>(null);

  useEffect(() => {
    if (!ids.length) { setEvents([]); return; }
    let live = true;
    createClient()
      .from("events")
      .select(EVENT_SELECT)
      .in("id", ids.slice(0, 200))
      .then(({ data }) => { if (live) setEvents(sortEvents((data ?? []) as unknown as EventFull[])); });
    return () => { live = false; };
  }, [ids]);

  if (events === null) return <p className="hint">Loading your saved events…</p>;

  const upcoming = events.filter((e) => lastDay(e) >= today);
  if (!upcoming.length)
    return (
      <div className="empty">
        <h2>Nothing saved yet</h2>
        <p>Tap Save on any event and it shows up here, sorted by date. Saved events stay on this phone.</p>
        <Link className="ghost press" href="/">Browse events</Link>
      </div>
    );

  return (
    <>
      <p className="count">Your list<small>{upcoming.length} saved · {upcoming.filter((e) => odState(e) === "yes").length} with OD</small></p>
      <div className="feed">
        {upcoming.map((e) => <EventCard key={e.id} e={e} today={today} />)}
      </div>
    </>
  );
}
