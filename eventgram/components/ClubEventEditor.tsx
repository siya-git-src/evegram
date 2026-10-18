"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { CATEGORIES, fmtDate, mediaUrl, sortedMedia, whenText } from "@/lib/format";
import type { Category, Club, EventFull, Media } from "@/lib/types";
import EventCard from "./EventCard";
import { toast } from "./Toast";

const MAX_IMAGE = 10 * 1024 * 1024;
const MAX_VIDEO = 50 * 1024 * 1024;
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/webm"];

type NewFile = { key: string; file: File; kind: "poster" | "reel"; preview: string };
const t5 = (t: string | null | undefined) => (t ? t.slice(0, 5) : "");

export default function ClubEventEditor({
  event, clubs, isOwner, today,
}: {
  event: EventFull | null;
  clubs: Pick<Club, "id" | "name">[];
  isOwner: boolean;
  today: string;
}) {
  const router = useRouter();
  const creating = !event;
  const custom = creating || event.source === "club";

  const [f, setF] = useState({
    club_id: event?.club_id ?? (isOwner && clubs.length !== 1 ? "" : clubs[0]?.id ?? ""),
    category: (event?.category ?? "other") as Category,
    title: event?.title ?? "",
    event_date: event?.event_date ?? "",
    start_time: t5(event?.start_time),
    end_time: t5(event?.end_time),
    venue: event?.venue ?? "",
    fee: event ? String(event.fee || "") : "",
    od_status: (event?.od_status ?? "") as "yes" | "no" | "",
    od_from: t5(event?.od_from),
    od_to: t5(event?.od_to),
    od_note: event?.od_note ?? "",
    deadline: event?.deadline ?? "",
    hook: event?.hook ?? "",
    highlights: event?.highlights ?? "",
    instagram_url: event?.instagram_url ?? "",
    contact: event?.contact ?? "",
  });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));

  const [existing, setExisting] = useState<Media[]>(() => [...sortedMedia(event?.media, "poster"), ...sortedMedia(event?.media, "reel")]);
  const [removed, setRemoved] = useState<Media[]>([]);
  const [added, setAdded] = useState<NewFile[]>([]);
  const [err, setErr] = useState("");
  const [status, setStatus] = useState("");
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => () => added.forEach((a) => URL.revokeObjectURL(a.preview)), [added]);

  function addFiles(list: FileList | null) {
    if (!list) return;
    const next: NewFile[] = [];
    const problems: string[] = [];
    Array.from(list).forEach((file) => {
      const isImg = IMAGE_TYPES.includes(file.type);
      const isVid = VIDEO_TYPES.includes(file.type);
      if (!isImg && !isVid) return problems.push(`${file.name}: use JPG, PNG or WebP for posters and MP4 or MOV for reels`);
      if (isImg && file.size > MAX_IMAGE) return problems.push(`${file.name} is over 10 MB`);
      if (isVid && file.size > MAX_VIDEO) return problems.push(`${file.name} is over 50 MB. Export the reel at 1080p or lower`);
      next.push({ key: crypto.randomUUID(), file, kind: isImg ? "poster" : "reel", preview: URL.createObjectURL(file) });
    });
    setAdded((p) => [...p, ...next]);
    setErr(problems.join(". "));
  }

  const clubName = clubs.find((c) => c.id === f.club_id)?.name;

  // What students will see, updated as you type.
  const preview = useMemo<EventFull>(() => {
    const base = event ?? ({
      id: "preview", source: "club", eventhub_eid: null, description: "", open_to: null, team_size: null,
      eh_conducted_by: null, club_updated_at: null, created_at: "", media: [], club: null,
    } as unknown as EventFull);
    return {
      ...base,
      club_id: f.club_id || null,
      club: clubName ? { id: f.club_id, name: clubName, category: f.category, instagram: null } : base.club,
      category: f.category,
      title: custom ? f.title || "Your event name" : base.title,
      event_date: custom ? f.event_date || today : base.event_date,
      venue: custom ? f.venue : base.venue,
      fee: custom ? parseInt(f.fee || "0", 10) || 0 : base.fee,
      start_time: f.start_time || null,
      end_time: f.end_time || null,
      od_status: f.od_status || null,
      od_from: f.od_status === "yes" ? f.od_from || null : null,
      od_to: f.od_status === "yes" ? f.od_to || null : null,
      od_note: f.od_note || null,
      deadline: f.deadline || null,
      hook: f.hook || null,
      media: existing,
    };
  }, [event, f, clubName, custom, existing, today]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    if (!f.club_id) return setErr("Pick which club this event belongs to.");
    if (custom) {
      const missing = [!f.title.trim() && "event name", !f.event_date && "date", !f.venue.trim() && "venue"].filter(Boolean);
      if (missing.length) return setErr(`Add the ${missing.join(", ")}.`);
      if (creating && f.event_date < today) return setErr("Pick today or a later date.");
    }
    const eventDate = custom ? f.event_date : event!.event_date;
    if (f.od_status === "yes" && f.od_from && f.od_to && f.od_to <= f.od_from) return setErr("OD until should be later than OD from.");
    if (f.deadline && f.deadline > eventDate) return setErr(`Registration should close on or before the event date (${fmtDate(eventDate)}).`);
    if (f.instagram_url && !/^https:\/\//i.test(f.instagram_url.trim())) return setErr("The Instagram link should start with https://");

    setBusy(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const clubFields = {
      club_id: f.club_id,
      category: f.category,
      end_time: f.end_time || null,
      od_status: f.od_status || null,
      od_from: f.od_status === "yes" ? f.od_from || null : null,
      od_to: f.od_status === "yes" ? f.od_to || null : null,
      od_note: f.od_status === "yes" ? f.od_note.trim() || null : null,
      deadline: f.deadline || null,
      hook: f.hook.trim() || null,
      highlights: f.highlights.trim() || null,
      instagram_url: f.instagram_url.trim() || null,
      contact: f.contact.trim() || null,
      club_updated_at: new Date().toISOString(),
    };
    const basics = custom
      ? { title: f.title.trim(), event_date: f.event_date, venue: f.venue.trim(), fee: Math.max(0, parseInt(f.fee || "0", 10) || 0), start_time: f.start_time || null }
      : event!.start_time ? {} : { start_time: f.start_time || null }; // EventHub's time wins when it has one

    try {
      setStatus("Saving…");
      let id = event?.id;
      if (creating) {
        const { data, error } = await supabase.from("events").insert({ source: "club", created_by: user?.id, ...basics, ...clubFields }).select("id").single();
        if (error) throw error;
        id = data.id as string;
      } else {
        const { data, error } = await supabase.from("events").update({ ...basics, ...clubFields }).eq("id", id!).select("id");
        if (error) throw error;
        if (!data?.length) throw new Error("not_allowed");
      }

      if (removed.length) {
        setStatus("Removing media…");
        await supabase.storage.from("media").remove(removed.map((m) => m.path));
        const { error } = await supabase.from("event_media").delete().in("id", removed.map((m) => m.id));
        if (error) throw error;
      }
      let pos = existing.length ? Math.max(...existing.map((m) => m.position)) + 1 : 0;
      for (let i = 0; i < added.length; i++) {
        const a = added[i];
        setStatus(`Uploading ${a.kind} ${i + 1} of ${added.length}…`);
        setProgress(Math.round((i / added.length) * 100));
        const ext = (a.file.name.split(".").pop() || (a.kind === "poster" ? "jpg" : "mp4")).toLowerCase().replace(/[^a-z0-9]/g, "");
        const path = `${f.club_id}/${id}/${crypto.randomUUID()}.${ext}`;
        const up = await supabase.storage.from("media").upload(path, a.file, { contentType: a.file.type, cacheControl: "31536000" });
        if (up.error) throw new Error(`Couldn't upload ${a.file.name}: ${up.error.message}`);
        const { error } = await supabase.from("event_media").insert({ event_id: id, kind: a.kind, path, position: pos++ });
        if (error) throw error;
      }
      setProgress(100);
      toast("Saved · live on the feed");
      router.push(`/event/${id}`);
      router.refresh();
    } catch (x: unknown) {
      const m = x instanceof Error ? x.message : (x as { message?: string })?.message ?? "Something went wrong";
      setErr(/not_allowed|row-level security|permission/i.test(m)
        ? "This event belongs to another club, so your login can't change it."
        : m);
      setStatus("");
      setBusy(false);
    }
  }

  async function remove() {
    if (!event) return;
    if (!confirmDelete) return setConfirmDelete(true);
    setBusy(true);
    const supabase = createClient();
    if (event.media.length) await supabase.storage.from("media").remove(event.media.map((m) => m.path));
    const { error } = await supabase.from("events").delete().eq("id", event.id);
    if (error) { setErr(error.message); setBusy(false); return; }
    toast("Event deleted");
    router.push("/club");
    router.refresh();
  }

  return (
    <>
      <Link className="ghost press back" href="/club">← All events</Link>
      <form className="form" onSubmit={save} noValidate>
        <h1>{creating ? <>Add an <span>event</span></> : event.title}</h1>
        {!custom && (
          <p className="hint">
            {whenText(event!)} · {event!.venue} · from EventHub. The name, date, venue and fee come from EventHub and update on their own.
            Everything below is yours to add.
          </p>
        )}

        <div className="grid2">
          <label className="field" htmlFor="club">
            Club
            <select id="club" value={f.club_id} onChange={(e) => set("club_id", e.target.value)} disabled={!isOwner}>
              {!f.club_id && <option value="">Pick a club</option>}
              {clubs.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label className="field" htmlFor="category">
            Category
            <select id="category" value={f.category} onChange={(e) => set("category", e.target.value as Category)}>
              {Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </label>
        </div>

        {custom && (
          <>
            <label className="field" htmlFor="title">
              Event name
              <input id="title" maxLength={120} value={f.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Intro to PCB Design" />
            </label>
            <div className="grid2">
              <label className="field" htmlFor="date">
                Date
                <input id="date" type="date" min={creating ? today : undefined} value={f.event_date} onChange={(e) => set("event_date", e.target.value)} />
              </label>
              <label className="field" htmlFor="venue">
                Venue
                <input id="venue" maxLength={80} value={f.venue} onChange={(e) => set("venue", e.target.value)} placeholder="e.g. Anna Auditorium" />
              </label>
            </div>
            <label className="field" htmlFor="fee">
              Entry fee (₹)
              <input id="fee" type="number" inputMode="numeric" min={0} step={10} value={f.fee} onChange={(e) => set("fee", e.target.value)} placeholder="0 for free" />
            </label>
          </>
        )}

        <fieldset className="seg">
          <legend>Does this event give OD?</legend>
          {([["yes", "Yes"], ["no", "No"], ["", "Not sure yet"]] as const).map(([v, label]) => (
            <label key={v || "unsure"}>
              <input type="radio" name="od_status" value={v} checked={f.od_status === v} onChange={() => set("od_status", v)} /> {label}
            </label>
          ))}
        </fieldset>
        {f.od_status === "yes" && (
          <div className="odbox">
            <div className="grid2">
              <label className="field" htmlFor="od_from">OD from<input id="od_from" type="time" value={f.od_from} onChange={(e) => set("od_from", e.target.value)} /></label>
              <label className="field" htmlFor="od_to">OD until<input id="od_to" type="time" value={f.od_to} onChange={(e) => set("od_to", e.target.value)} /></label>
            </div>
            <label className="field" htmlFor="od_note">
              OD note
              <input id="od_note" maxLength={160} value={f.od_note} onChange={(e) => set("od_note", e.target.value)} placeholder="e.g. Only for registered participants, attendance taken at entry" />
            </label>
          </div>
        )}

        <div className="grid2">
          <label className="field" htmlFor="start">
            Event starts
            <input id="start" type="time" value={f.start_time} disabled={!custom && !!event?.start_time} onChange={(e) => set("start_time", e.target.value)} />
          </label>
          <label className="field" htmlFor="end">
            Event ends
            <input id="end" type="time" value={f.end_time} onChange={(e) => set("end_time", e.target.value)} />
          </label>
        </div>
        <label className="field" htmlFor="deadline">
          Registration closes
          <input id="deadline" type="date" max={custom ? f.event_date || undefined : event!.event_date} value={f.deadline} onChange={(e) => set("deadline", e.target.value)} />
        </label>

        <h3>Make it pop</h3>
        <label className="field" htmlFor="hook">
          Hook line
          <input id="hook" maxLength={120} value={f.hook} onChange={(e) => set("hook", e.target.value)} placeholder="e.g. ₹30k prize pool + free merch for every team" />
        </label>
        <label className="field" htmlFor="highlights">
          Highlights
          <textarea id="highlights" maxLength={1200} value={f.highlights} onChange={(e) => set("highlights", e.target.value)} placeholder="Prizes, speakers, what you'll learn, what to bring, food…" />
        </label>
        <div className="grid2">
          <label className="field" htmlFor="insta">
            Instagram post or reel
            <input id="insta" type="url" value={f.instagram_url} onChange={(e) => set("instagram_url", e.target.value)} placeholder="https://instagram.com/p/…" />
          </label>
          <label className="field" htmlFor="contact">
            Contact for questions
            <input id="contact" maxLength={80} value={f.contact} onChange={(e) => set("contact", e.target.value)} placeholder="e.g. @codingclub_vit" />
          </label>
        </div>

        <div className="field-label">
          Posters and reels
          <div className="uploads">
            {existing.map((m) => (
              <div className="thumb" key={m.id}>
                {m.kind === "poster"
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={mediaUrl(m.path)} alt="" />
                  : <video src={mediaUrl(m.path) + "#t=0.1"} muted playsInline preload="metadata" />}
                <span className="pill k">{m.kind === "poster" ? "Poster" : "Reel"}</span>
                <button type="button" className="x" aria-label="Remove" onClick={() => { setExisting((p) => p.filter((x) => x.id !== m.id)); setRemoved((p) => [...p, m]); }}>×</button>
              </div>
            ))}
            {added.map((a) => (
              <div className="thumb" key={a.key}>
                {a.kind === "poster"
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={a.preview} alt="" />
                  : <video src={a.preview} muted playsInline preload="metadata" />}
                <span className="pill k">{a.kind === "poster" ? "Poster" : "Reel"}</span>
                <button type="button" className="x" aria-label="Remove" onClick={() => setAdded((p) => p.filter((x) => x.key !== a.key))}>×</button>
              </div>
            ))}
          </div>
          <label className="dropzone" htmlFor="files">
            <strong>Add posters and reels</strong>
            <span className="hint">Posters: JPG, PNG or WebP up to 10 MB, 4:5 looks best. Reels: MP4 or MOV up to 50 MB, vertical. No poster? Students see a ticket made from the details.</span>
            <input id="files" type="file" multiple accept={[...IMAGE_TYPES, ...VIDEO_TYPES].join(",")} onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} style={{ marginTop: 6 }} />
          </label>
        </div>

        <div>
          <p className="count">How students see it</p>
          <div className="cardprev"><EventCard e={preview} today={today} preview /></div>
        </div>

        {status && (
          <div>
            <p className="hint">{status}</p>
            <div className="progress"><span style={{ width: `${progress}%` }} /></div>
          </div>
        )}
        {err && <p className="err">{err}</p>}
        <button className="btn press" disabled={busy}>{creating ? "Publish event" : "Save and update the feed"}</button>
        {!creating && custom && (
          <button type="button" className="ghost danger press" style={{ justifyContent: "center" }} disabled={busy} onClick={remove}>
            {confirmDelete ? "Tap again to delete this event for good" : "Delete event"}
          </button>
        )}
      </form>
    </>
  );
}
