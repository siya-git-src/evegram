import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import CalendarButton from "@/components/CalendarButton";
import { ClosesBand, shareText } from "@/components/EventCard";
import ShareButton from "@/components/ShareButton";
import { googleCalendarUrl } from "@/lib/calendar";
import { headers } from "next/headers";
import EventMedia from "@/components/EventMedia";
import RegisterLink from "@/components/RegisterLink";
import SaveButton from "@/components/SaveButton";
import { vitiansCanJoin } from "@/lib/format";
import { CATEGORIES, clubAvatar, clubName, deadlineInfo, fmtDate, initials, mediaUrl, odState, odTimes, sortedMedia, todayIST, whenText } from "@/lib/format";
import { getRole } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import { EVENT_SELECT, type EventFull } from "@/lib/types";

export const dynamic = "force-dynamic";

async function load(id: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("events").select(EVENT_SELECT).eq("id", id).maybeSingle();
  return data as unknown as EventFull | null;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const e = await load(id);
  if (!e) return { title: "Event not found · Eventgram" };
  const poster = sortedMedia(e.media, "poster")[0];
  return {
    title: `${e.title} · Eventgram`,
    description: e.hook || `${whenText(e)} at ${e.venue}${odState(e) === "yes" ? " · OD given" : ""}`,
    openGraph: { title: e.title, description: e.hook || `${whenText(e)} · ${e.venue}`, type: "website", ...(poster ? { images: [mediaUrl(poster.path)] } : {}) },
    twitter: { card: "summary_large_image" },
  };
}

export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [e, role] = await Promise.all([load(id), getRole()]);
  if (!e) notFound();
  const today = todayIST();
  const club = clubName(e);
  const od = odState(e);
  const dl = deadlineInfo(e, today);
  const h = await headers();
  const pageUrl = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}/event/${e.id}`;
  const canEdit = role.isOwner || (role.club && (e.club_id === role.club.id || !e.club_id));

  return (
    <main className="wrap page detail">
      <div className="cardhead" style={{ padding: 0, background: "none", border: 0 }}>
        <span className="avatar" style={clubAvatar(club)}>{initials(club)}</span>
        <span className="clubname">{club}</span>
        <span className="cat">{(CATEGORIES[e.category] ?? CATEGORIES.other).label}</span>
      </div>
      <EventMedia e={e} full />
      <h1>{e.title}</h1>
      <dl className="facts">
        <dt>When</dt>
        <dd>{whenText(e)}</dd>
        <dt>Where</dt>
        <dd>{e.venue || "To be announced"}</dd>
        <dt>OD</dt>
        <dd>
          {od === "yes" ? (
            <>
              <span className="odtag">Yes, OD given</span>
              {e.od_from && <> <b>{odTimes(e)}</b></>}
              {e.od_note && <span className="odnote">{e.od_note}</span>}
            </>
          ) : od === "no" ? "No OD" : "Not confirmed by the club yet"}
        </dd>
        <dt>Entry</dt>
        <dd>{e.fee ? `₹${e.fee}` : "Free"}</dd>
        {dl.kind !== "unknown" && (
          <>
            <dt>Register by</dt>
            <dd>{fmtDate(dl.date)} {dl.kind === "closed" && <span className="muted">· closed</span>}</dd>
          </>
        )}
        {e.open_to && (<><dt>Open to</dt><dd>{vitiansCanJoin(e.open_to) ? e.open_to : "Non-VITians only"}{e.team_size ? ` · team of ${e.team_size.replace("-", "–")}` : ""}</dd></>)}
      </dl>

      {(e.hook || e.highlights || e.instagram_url || e.contact) && (
        <div className="fromclub">
          <span className="fctag">From the club</span>
          {e.hook && <p className="hook big">{e.hook}</p>}
          {e.highlights && <p className="desc">{e.highlights}</p>}
          {e.contact && <p className="hint">Questions? {e.contact}</p>}
          {e.instagram_url && /^https:\/\//i.test(e.instagram_url) && (
            <a className="ig press" href={e.instagram_url} target="_blank" rel="noopener noreferrer">See it on Instagram</a>
          )}
        </div>
      )}
      {e.description && <p className="desc">{e.description}</p>}

      <div className="actions">
        <SaveButton eventId={e.id} />
        <ShareButton eventId={e.id} text={shareText(e)} />
        <CalendarButton eventId={e.id} googleUrl={googleCalendarUrl(e, pageUrl)} hasDeadline={!!e.deadline && dl.kind === "open"} />
        {canEdit && <Link className="ghost press" href={`/club/events/${e.id}`}>Edit as club</Link>}
      </div>
      <div className="card" style={{ boxShadow: "none" }}><ClosesBand e={e} today={today} /></div>
      <p className="tip">Tapping Register copies the event name, so you can paste it into EventHub&apos;s search after signing in.</p>
      <div className="sticky-cta">
        <RegisterLink title={e.title} />
      </div>
    </main>
  );
}
