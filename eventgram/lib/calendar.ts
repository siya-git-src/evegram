import { addDays, odState, odTimes } from "./format";
import type { EventRow } from "./types";

type CalEvent = Pick<EventRow, "id" | "title" | "event_date" | "start_time" | "end_time" | "venue" | "deadline" | "od_status" | "od_from" | "od_to" | "source" | "hook">;

const pad = (n: number) => String(n).padStart(2, "0");

/** Date + India time (HH:MM[:SS]) → "YYYYMMDDTHHMMSSZ" in UTC. */
function utcStamp(date: string, time: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d, hh, mm) - 330 * 60000); // IST is UTC+5:30
  return `${t.getUTCFullYear()}${pad(t.getUTCMonth() + 1)}${pad(t.getUTCDate())}T${pad(t.getUTCHours())}${pad(t.getUTCMinutes())}00Z`;
}
const dayStamp = (date: string) => date.replaceAll("-", "");

/** Start/end for calendars. No time known → an all-day event. No end → two hours. */
export function eventTimes(e: CalEvent): { allDay: true; start: string; end: string } | { allDay: false; start: string; end: string } {
  if (!e.start_time) return { allDay: true, start: dayStamp(e.event_date), end: dayStamp(addDays(e.event_date, 1)) };
  const start = utcStamp(e.event_date, e.start_time);
  let endTime = e.end_time;
  let endDate = e.event_date;
  if (!endTime) {
    const [h, m] = e.start_time.split(":").map(Number);
    const total = h * 60 + m + 120;
    endTime = `${pad(Math.floor(total / 60) % 24)}:${pad(total % 60)}`;
    if (total >= 24 * 60) endDate = addDays(e.event_date, 1);
  } else if (endTime <= e.start_time) {
    endDate = addDays(e.event_date, 1); // runs past midnight, e.g. a 24-hour hackathon
  }
  return { allDay: false, start, end: utcStamp(endDate, endTime) };
}

export function eventDetails(e: CalEvent, url: string): string {
  const lines: string[] = [];
  if (e.hook) lines.push(e.hook);
  const od = odState(e);
  if (od === "yes") lines.push(`OD given${e.od_from ? `: ${odTimes(e)}` : ""}`);
  lines.push("Register on EventHub: https://eventhubcc.vit.ac.in/EventHub/eventPreview");
  lines.push(`Details: ${url}`);
  return lines.join("\n");
}

export function googleCalendarUrl(e: CalEvent, url: string): string {
  const t = eventTimes(e);
  const p = new URLSearchParams({
    action: "TEMPLATE",
    text: e.title,
    dates: `${t.start}/${t.end}`,
    details: eventDetails(e, url),
    location: e.venue || "",
    ctz: "Asia/Kolkata",
  });
  return `https://calendar.google.com/calendar/render?${p.toString()}`;
}

const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

/** Lines longer than 75 bytes must be folded in .ics files. */
function fold(line: string): string {
  const out: string[] = [];
  let cur = "";
  for (const ch of line) {
    if (Buffer.byteLength(cur + ch) > 74) { out.push(cur); cur = " " + ch; } else cur += ch;
  }
  out.push(cur);
  return out.join("\r\n");
}

/** An .ics file (Apple Calendar, Outlook…) with a reminder, plus the registration deadline if there is one. */
export function icsFile(e: CalEvent, url: string): string {
  const t = eventTimes(e);
  const now = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const lines = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Eventgram//VIT events//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${e.id}@eventgram`,
    `DTSTAMP:${now}`,
    t.allDay ? `DTSTART;VALUE=DATE:${t.start}` : `DTSTART:${t.start}`,
    t.allDay ? `DTEND;VALUE=DATE:${t.end}` : `DTEND:${t.end}`,
    `SUMMARY:${esc(e.title)}`,
    `LOCATION:${esc(e.venue || "")}`,
    `DESCRIPTION:${esc(eventDetails(e, url))}`,
    `URL:${url}`,
    "BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${esc(e.title)}`, t.allDay ? "TRIGGER:-PT15H" : "TRIGGER:-PT2H", "END:VALARM",
    "END:VEVENT",
  ];
  if (e.deadline) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${e.id}-deadline@eventgram`,
      `DTSTAMP:${now}`,
      `DTSTART;VALUE=DATE:${dayStamp(e.deadline)}`,
      `DTEND;VALUE=DATE:${dayStamp(addDays(e.deadline, 1))}`,
      `SUMMARY:${esc(`Last day to register: ${e.title}`)}`,
      `DESCRIPTION:${esc("Register on EventHub: https://eventhubcc.vit.ac.in/EventHub/eventPreview")}`,
      "BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${esc(`Registration closes today: ${e.title}`)}`, "TRIGGER:PT9H", "END:VALARM",
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}
