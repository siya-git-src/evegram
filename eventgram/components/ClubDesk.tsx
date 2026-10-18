"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { clubName, odState, parts } from "@/lib/format";
import type { EventFull } from "@/lib/types";

function Status({ e }: { e: EventFull }) {
  const o = odState(e);
  if (o === "yes") return <span className="st ok">OD added</span>;
  if (o === "no") return <span className="st">No OD</span>;
  return <span className="st need">Needs OD info</span>;
}

export default function ClubDesk({ events }: { events: EventFull[] }) {
  const [q, setQ] = useState("");
  const list = useMemo(() => {
    const n = q.trim().toLowerCase();
    return events.filter((e) => !n || `${e.title} ${clubName(e)}`.toLowerCase().includes(n));
  }, [events, q]);
  const need = events.filter((e) => odState(e) === "unknown").length;

  return (
    <>
      <div className="deskbar">
        <input className="search" type="search" placeholder="Find your event" aria-label="Find your event" value={q} onChange={(e) => setQ(e.target.value)} />
        {need > 0 && <span className="needcount">{need} need OD info</span>}
      </div>
      {list.length === 0 ? (
        <p className="hint">{events.length ? "No events match. Check the spelling, or add it below if it isn't on EventHub yet." : "No upcoming events yet. They appear after the next EventHub sync."}</p>
      ) : (
        <ul className="picklist">
          {list.map((e) => {
            const p = parts(e.event_date);
            return (
              <li key={e.id}>
                <Link className="pick press" href={`/club/events/${e.id}`}>
                  <span className="pdate"><b>{p.day}</b>{p.month}</span>
                  <span className="ptext">
                    <span className="pt">{e.title}</span>
                    <span className="pc">{e.club ? e.club.name : e.eh_conducted_by ? `${e.eh_conducted_by} · not claimed yet` : "Not claimed by a club yet"}</span>
                  </span>
                  <Status e={e} />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
