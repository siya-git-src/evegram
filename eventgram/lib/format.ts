import type { Category, EventFull, EventRow, Media } from "./types";

export type Swatch = { bg: string; ink: string };

/** The palette: butter, cherry, sky, cocoa, java (near-black) and a fest pink. */
export const SWATCH = {
  sky: { bg: "#8DB8F2", ink: "#231815" },
  cherry: { bg: "#E0263C", ink: "#FFF9E2" },
  cocoa: { bg: "#6B3E2E", ink: "#FFF0B3" },
  butter: { bg: "#FFE57A", ink: "#231815" },
  java: { bg: "#231815", ink: "#FFF0B3" },
  pink: { bg: "#FF9FB0", ink: "#231815" },
} as const;

export const CATEGORIES: Record<Category, { label: string; sw: Swatch }> = {
  tech: { label: "Tech", sw: SWATCH.sky },
  cultural: { label: "Cultural", sw: SWATCH.cherry },
  sports: { label: "Sports", sw: SWATCH.butter },
  workshop: { label: "Workshop", sw: SWATCH.cocoa },
  fest: { label: "Fest", sw: SWATCH.pink },
  social: { label: "Social & NSS", sw: SWATCH.java },
  other: { label: "Other", sw: SWATCH.cocoa },
};

const DW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const pad = (n: number) => String(n).padStart(2, "0");

/** Today's date in India, as YYYY-MM-DD, whatever timezone the server runs in. */
export function todayIST(): string {
  return new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
}

export function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

function utc(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

export function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((utc(toIso) - utc(fromIso)) / 86400000);
}

export function parts(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return { dow: DW[dt.getUTCDay()], dowIndex: dt.getUTCDay(), day: d, month: MON[m - 1] };
}

export function fmtDate(iso: string): string {
  const p = parts(iso);
  return `${p.dow}, ${p.day} ${p.month}`;
}

export function fmtTime(t: string | null | undefined): string {
  if (!t) return "";
  let [h, m] = t.split(":").map(Number);
  const ap = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}${m ? ":" + pad(m) : ""} ${ap}`;
}

/** Last day of an event (multi-day events have an end_date). */
export const lastDay = (e: { event_date: string; end_date?: string | null }) => e.end_date && e.end_date > e.event_date ? e.end_date : e.event_date;

/** Is the event on this day (counting every day of multi-day events)? */
export const onDay = (e: { event_date: string; end_date?: string | null }, day: string) => e.event_date <= day && lastDay(e) >= day;

/** "Sat, 18 Oct" or, for multi-day events, "Sat, 18 Oct – Mon, 20 Oct" */
export function fmtDateRange(e: { event_date: string; end_date?: string | null }): string {
  const end = lastDay(e);
  return end === e.event_date ? fmtDate(e.event_date) : `${fmtDate(e.event_date)} – ${fmtDate(end)}`;
}

/** Can VIT students sign up? EventHub writes "VITian", "Non-VITian" or "VITian/Non-VITian". */
export function vitiansCanJoin(openTo: string | null | undefined): boolean {
  if (!openTo) return true;
  return openTo.split("/").some((p) => p.trim().toLowerCase() === "vitian");
}

export function whenText(e: Pick<EventRow, "event_date" | "start_time" | "end_time"> & { end_date?: string | null }) {
  let s = fmtDateRange(e);
  if (e.start_time) s += ", " + fmtTime(e.start_time);
  if (e.end_time) s += " – " + fmtTime(e.end_time);
  return s;
}

export function odTimes(e: Pick<EventRow, "od_from" | "od_to">): string {
  if (!e.od_from) return "";
  return fmtTime(e.od_from) + (e.od_to ? " – " + fmtTime(e.od_to) : "");
}

/** "yes" | "no" | "unknown" — EventHub never says, so synced events start unknown. */
export function odState(e: Pick<EventRow, "od_status" | "source">): "yes" | "no" | "unknown" {
  if (e.od_status === "yes") return "yes";
  if (e.od_status === "no") return "no";
  return e.source === "eventhub" ? "unknown" : "no";
}

export type DeadlineInfo =
  | { kind: "unknown" }
  | { kind: "closed"; date: string }
  | { kind: "open"; date: string; days: number };

export function deadlineInfo(e: Pick<EventRow, "deadline">, today: string): DeadlineInfo {
  if (!e.deadline) return { kind: "unknown" };
  const days = daysBetween(today, e.deadline);
  return days < 0 ? { kind: "closed", date: e.deadline } : { kind: "open", date: e.deadline, days };
}

export function mediaUrl(path: string): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/media/${path}`;
}

export function sortedMedia(media: Media[] | null | undefined, kind?: Media["kind"]): Media[] {
  return (media ?? []).filter((m) => !kind || m.kind === kind).sort((a, b) => a.position - b.position);
}

export function sortEvents<T extends Pick<EventRow, "event_date" | "start_time">>(list: T[]): T[] {
  return list.slice().sort((a, b) => (a.event_date + (a.start_time ?? "")).localeCompare(b.event_date + (b.start_time ?? "")));
}

export function clubName(e: Pick<EventFull, "club" | "eh_conducted_by">): string {
  return e.club?.name || e.eh_conducted_by || "Listed on EventHub";
}

export function initials(s: string | undefined): string {
  return (s || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

const AVATARS: Swatch[] = [SWATCH.cherry, SWATCH.sky, SWATCH.butter, SWATCH.pink];

/** A stable palette colour for a club's avatar. */
export function clubAvatar(name: string | undefined): { background: string; color: string } {
  let h = 0;
  for (const ch of name || "") h = (h * 31 + ch.charCodeAt(0)) % AVATARS.length;
  return { background: AVATARS[h].bg, color: AVATARS[h].ink };
}
