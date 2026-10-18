import { parse } from "node-html-parser";
import type { Category } from "@/lib/types";

/** One event as it appears on EventHub's dashboard (the page right after signing in). */
export type ListedEvent = {
  eid: string | null; // null for past events (no View button)
  title: string;
  openTo: string; // "VITian", "Non-VITian", "VITian/Non-VITian"
  date: string; // YYYY-MM-DD
  venue: string;
  fee: number;
  team: string | null; // "1", "1-3"
};

export type EventDetail = {
  title: string | null;
  description: string;
  time: string | null; // HH:MM
  conductedBy: string | null;
};

const clean = (s: string | undefined | null) => (s ?? "").replace(/\s+/g, " ").trim();

/** Is this the page with the event cards (i.e. the login worked)? */
export function looksLikeDashboard(html: string): boolean {
  return html.includes("card-body") && html.includes('name="eid"');
}

export function looksLikeLoginPage(html: string): boolean {
  return html.includes('name="validateVitian"') && !html.includes("card-body");
}

export function parseDashboard(html: string): ListedEvent[] {
  const root = parse(html, { comment: false });
  const out: ListedEvent[] = [];
  for (const card of root.querySelectorAll(".card-body")) {
    const title = clean(card.querySelector("h3 span")?.text ?? card.querySelector("h3")?.text);
    if (!title) continue;
    const field: Record<string, string> = {};
    for (const icon of card.querySelectorAll("i")) {
      const cls = icon.getAttribute("class") ?? "";
      const key = (cls.match(/fa-(people-carry-box|calendar-days|map-location-dot|indian-rupee-sign|street-view)/) || [])[1];
      if (!key) continue;
      const next = icon.nextElementSibling;
      if (next && next.tagName === "SPAN") field[key] = clean(next.text);
    }
    const date = field["calendar-days"] ?? "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    const feeText = field["indian-rupee-sign"] ?? "";
    out.push({
      eid: card.querySelector('button[name="eid"]')?.getAttribute("value") ?? null,
      title,
      openTo: field["people-carry-box"] ?? "",
      date,
      venue: cleanVenue(field["map-location-dot"] ?? ""),
      fee: /^\d+$/.test(feeText) ? parseInt(feeText, 10) : 0,
      team: field["street-view"] || null,
    });
  }
  return out;
}

const LABELS = ["Event Name", "Event Description", "Participants", "Event Date", "Event Venue", "Event Time", "Conducted By", "Total Fees"];
const STOP = new Set(["Back", "Register"]);

/** The page EventHub shows when you press View on an event. */
export function parseDetail(html: string): EventDetail | null {
  if (!html.includes("Event Name")) return null;
  const root = parse(html, { comment: false });
  root.querySelectorAll("script,style,nav,header,footer").forEach((n) => n.remove());
  const lines = root.structuredText.split("\n").map((l) => l.trim()).filter(Boolean);
  const value = (label: string) => {
    let i = lines.indexOf(label);
    if (i < 0) {
      // Label and value on one line, e.g. "Event Time: 08:00"
      const inline = lines.find((l) => l.startsWith(label) && l.length > label.length);
      if (inline) return inline.slice(label.length).replace(/^\s*[:\-–]\s*/, "").trim() || null;
      i = lines.findIndex((l) => l.replace(/\s*:$/, "") === label);
      if (i < 0) return null;
    }
    const vals: string[] = [];
    for (let j = i + 1; j < lines.length; j++) {
      const l = lines[j];
      if (LABELS.includes(l) || STOP.has(l) || l.startsWith("©")) break;
      vals.push(l);
    }
    return vals.join("\n").trim() || null;
  };
  const time = value("Event Time");
  return {
    title: value("Event Name"),
    description: value("Event Description") ?? "",
    time: time && /^\d{1,2}:\d{2}/.test(time) ? time.slice(0, 5).padStart(5, "0") : null,
    conductedBy: value("Conducted By"),
  };
}

/** "NETHAJI Auditorium (AB1-7th Floor) [Cap.- 310]" → "NETHAJI Auditorium (AB1-7th Floor)" */
export function cleanVenue(v: string): string {
  return clean(v.replace(/\[\s*Cap\.?[^\]]*\]/i, ""));
}

/** Only events VIT students can attend. */
export function openToVitians(openTo: string): boolean {
  return openTo.split("/").some((p) => p.trim().toLowerCase() === "vitian");
}

/** First guess at a category from the event name; clubs can change it on the club desk. */
export function guessCategory(title: string): Category {
  const t = " " + title.toLowerCase() + " ";
  const has = (words: string) => new RegExp(`\\b(${words})\\b`).test(t);
  if (has("sports?|cricket|football|basketball|volleyball|badminton|chess|athletics|marathon|kabaddi|tournament|futsal|throwball")) return "sports";
  if (has("hack\\w*|hackathon|code\\w*|coding|ai|ml|machine learning|data|robotics?|tech\\w*|design challenge|pitch\\w*|patent|startup|innovation|prompt|cyber\\w*|cloud|iot|blockchain")) return "tech";
  if (has("workshop|training|value added|hands-?on|handson|bootcamp|course|certification|fdp|sttp")) return "workshop";
  if (has("fest|festival|carnival|utsav|pro-?show")) return "fest";
  if (has("game night|nss|blood|donation|awareness|wellness|mind balance|yoga|meditation|social")) return "social";
  if (has("dance|music|rangoli|deepotsav|diwali|ramkatha|katha|chhath?|puja|drama|art|arts|film|poetry|cultural|garba|mun|debate|quiz|open mic")) return "cultural";
  return "other";
}
