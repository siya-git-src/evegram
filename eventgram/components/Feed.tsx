"use client";

import { useMemo, useState } from "react";
import { addDays, CATEGORIES, clubName, fmtDate, lastDay, odState, onDay, parts } from "@/lib/format";
import type { Category, EventFull } from "@/lib/types";
import EventCard from "./EventCard";

export default function Feed({ events, today, syncedText }: { events: EventFull[]; today: string; syncedText: string | null }) {
  const [date, setDate] = useState<string>("all");
  const [od, setOd] = useState(false);
  const [cat, setCat] = useState<Category | "all">("all");
  const [club, setClub] = useState("all");
  const [q, setQ] = useState("");

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    events.forEach((e) => {
      // count the event on each of its days (up to two weeks)
      for (let d = e.event_date, i = 0; d <= lastDay(e) && i < 15; d = addDays(d, 1), i++) c[d] = (c[d] || 0) + 1;
    });
    return c;
  }, [events]);

  const clubs = useMemo(() => [...new Set(events.map(clubName))].sort(), [events]);

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return events.filter(
      (e) =>
        (date === "all" || onDay(e, date)) &&
        (!od || odState(e) === "yes") &&
        (cat === "all" || e.category === cat) &&
        (club === "all" || clubName(e) === club) &&
        (!needle || `${e.title} ${clubName(e)} ${e.venue} ${e.description} ${e.hook ?? ""}`.toLowerCase().includes(needle))
    );
  }, [events, date, od, cat, club, q]);

  const days = Array.from({ length: 14 }, (_, i) => addDays(today, i));

  function clear() {
    setDate("all"); setOd(false); setCat("all"); setClub("all"); setQ("");
  }

  return (
    <>
      <div className="top">
        <div className="wrap">
          <div className="dates" aria-label="Pick a date">
            <button className="day all press" aria-pressed={date === "all"} onClick={() => setDate("all")}>
              <span className="dw">All</span>
              <span className="dn">Upcoming</span>
              <span className="dc">{events.length}</span>
            </button>
            {days.map((d, i) => {
              const p = parts(d);
              const cls = "day press" + (i === 0 ? " today" : p.dowIndex === 0 || p.dowIndex === 6 ? " weekend" : "");
              return (
                <button key={d} className={cls} aria-pressed={date === d} onClick={() => setDate(d)}>
                  <span className="dw">{i === 0 ? "Today" : i === 1 ? "Tmrw" : p.dow}</span>
                  <span className="dn">{p.day}</span>
                  <span className="dc">{counts[d] ? `${counts[d]} ev` : ""}</span>
                </button>
              );
            })}
          </div>
          <div className="filters">
            <button className="chip od press" aria-pressed={od} onClick={() => setOd(!od)}>OD only</button>
            <select className="chip cat-sel" aria-label="Category" value={cat} onChange={(e) => setCat(e.target.value as Category | "all")}>
              <option value="all">All categories</option>
              {Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <select className="chip club-sel" aria-label="Club" value={club} onChange={(e) => setClub(e.target.value)}>
              <option value="all">All clubs</option>
              {clubs.map((c) => <option key={c}>{c}</option>)}
            </select>
            <input className="search" type="search" placeholder="Search events" aria-label="Search events" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>
      </div>

      <main className="wrap page">
        <p className="count">
          {date === "all" ? "What's on" : fmtDate(date)}
          <small>{list.length} event{list.length === 1 ? "" : "s"}{od ? " · OD only" : ""}</small>
        </p>
        {syncedText && <p className="synced">{syncedText}</p>}
        {events.length === 0 ? (
          <div className="empty">
            <h2>No events yet</h2>
            <p>Events appear here after the first EventHub sync, or when a club adds one.</p>
          </div>
        ) : list.length === 0 ? (
          <div className="empty">
            <h2>Nothing matches</h2>
            <p>{od ? "Clubs haven't confirmed OD for many events yet. Try turning off OD only." : "Try another date, or turn off a filter."}</p>
            <button className="ghost press" onClick={clear}>Clear filters</button>
          </div>
        ) : (
          <div className="feed">
            {list.map((e) => <EventCard key={e.id} e={e} today={today} />)}
          </div>
        )}
      </main>
    </>
  );
}
