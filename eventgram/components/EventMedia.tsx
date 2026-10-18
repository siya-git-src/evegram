import { CATEGORIES, fmtTime, mediaUrl, odState, parts, sortedMedia } from "@/lib/format";
import type { EventFull, EventRow } from "@/lib/types";

type TicketFields = Pick<EventRow, "title" | "category" | "event_date" | "start_time" | "fee">;

/** Ticket-style poster built from the event details, for events without an uploaded poster. */
export function Ticket({ e }: { e: TicketFields }) {
  const c = CATEGORIES[e.category] ?? CATEGORIES.other;
  const p = parts(e.event_date);
  const style = { "--pbg": c.sw.bg, "--pink-ink": c.sw.ink } as React.CSSProperties;
  return (
    <div className="ticket" style={style}>
      <span className="pkick">{c.label}</span>
      <p className="ptitle">{e.title}</p>
      <div className="stub">
        <div><span className="l">{p.dow}</span><span className="v">{p.day} {p.month}</span></div>
        <div><span className="l">Time</span><span className="v">{e.start_time ? fmtTime(e.start_time) : "TBA"}</span></div>
        <div><span className="l">Entry</span><span className="v">{e.fee ? `₹${e.fee}` : "Free"}</span></div>
      </div>
    </div>
  );
}

export function OdSticker() {
  return <span className="sticker" aria-label="OD given">OD!</span>;
}

/**
 * Swipeable posters + reels for one event. Posters first, then reels.
 * `full` shows every item; otherwise only the first (feed cards stay light).
 */
export default function EventMedia({ e, full = false }: { e: EventFull; full?: boolean }) {
  const items = [...sortedMedia(e.media, "poster"), ...sortedMedia(e.media, "reel")];
  const shown = full ? items : items.slice(0, 1);
  const od = odState(e) === "yes";
  return (
    <div className="frame">
      {od && <div className="badges"><OdSticker /></div>}
      {shown.length === 0 ? (
        <Ticket e={e} />
      ) : (
        <>
          {items.length > 1 && <span className="pill count-dot">1/{items.length}</span>}
          <div className="carousel">
            {shown.map((m) =>
              m.kind === "poster" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={m.id} src={mediaUrl(m.path)} alt={`${e.title} poster`} loading="lazy" />
              ) : (
                <video key={m.id} src={mediaUrl(m.path) + "#t=0.1"} preload="metadata" playsInline muted controls={full} aria-label={`${e.title} reel`} />
              )
            )}
          </div>
        </>
      )}
    </div>
  );
}
