import Link from "next/link";
import { CATEGORIES, clubAvatar, clubName, deadlineInfo, fmtDate, fmtDateRange, fmtTime, initials, odState, odTimes, vitiansCanJoin } from "@/lib/format";
import type { EventFull } from "@/lib/types";
import EventMedia from "./EventMedia";
import RegisterLink from "./RegisterLink";
import SaveButton from "./SaveButton";
import ShareButton from "./ShareButton";

export function shareText(e: Pick<EventFull, "title" | "event_date" | "od_status" | "source">) {
  return `${e.title} · ${fmtDate(e.event_date)}${odState(e) === "yes" ? " · OD given" : ""} · on Eventgram`;
}

export function ClosesBand({ e, today }: { e: Pick<EventFull, "deadline">; today: string }) {
  const d = deadlineInfo(e, today);
  if (d.kind === "unknown")
    return <div className="closes unknown"><span>Registrations close</span><b>Date not announced yet</b></div>;
  if (d.kind === "closed")
    return <div className="closes over"><span>Registrations</span><b>Closed on {fmtDate(d.date)}</b></div>;
  const left = d.days === 0 ? "today" : d.days === 1 ? "tomorrow" : `${d.days} days left`;
  return (
    <div className={"closes" + (d.days <= 2 ? " soon" : "")}>
      <span>Registrations close</span>
      <b>{fmtDate(d.date)} · {left}</b>
    </div>
  );
}

/** `preview` renders the card without links or buttons (used on the club desk). */
export default function EventCard({ e, today, preview = false }: { e: EventFull; today: string; preview?: boolean }) {
  const club = clubName(e);
  const c = CATEGORIES[e.category] ?? CATEGORIES.other;
  const od = odState(e) === "yes";
  const meta = (
    <div className="meta">
      <span><b>{fmtDateRange(e)}</b>{e.start_time ? " · " + fmtTime(e.start_time) : ""}</span>
      <span>{e.venue}</span>
      {!vitiansCanJoin(e.open_to) && <span className="nonvit">Non-VITians only</span>}
      {od && e.od_from && <span className="odline">OD {odTimes(e)}</span>}
    </div>
  );
  return (
    <article className="card" style={{ "--cat": c.sw.bg } as React.CSSProperties}>
      <div className="cardhead">
        <span className="avatar" style={clubAvatar(club)}>{initials(club)}</span>
        <span className="clubname">{club}</span>
        <span className="cat">{c.label}</span>
      </div>
      {preview ? <EventMedia e={e} /> : <Link href={`/event/${e.id}`} aria-label={`Open ${e.title}`}><EventMedia e={e} /></Link>}
      <div className="cardbody">
        {e.hook && <p className="hook">{e.hook}</p>}
        {meta}
        {!preview && (
          <div className="actions">
            <SaveButton eventId={e.id} />
            <ShareButton eventId={e.id} text={shareText(e)} />
            <RegisterLink title={e.title} />
          </div>
        )}
      </div>
      <ClosesBand e={e} today={today} />
    </article>
  );
}
