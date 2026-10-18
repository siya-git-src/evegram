import { ImageResponse } from "next/og";
import { createClient } from "@supabase/supabase-js";
import { CATEGORIES, fmtDate, fmtTime, mediaUrl, odState, odTimes, sortedMedia } from "@/lib/format";
import type { EventFull } from "@/lib/types";
import { EVENT_SELECT } from "@/lib/types";

// The picture WhatsApp, Instagram and others show when an event link is shared.
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Event on Eventgram";

async function loadFont(): Promise<ArrayBuffer | null> {
  try {
    // An old browser user-agent makes Google Fonts return a .ttf, which the image renderer can read.
    const css = await fetch("https://fonts.googleapis.com/css2?family=Shrikhand", {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 6.1; WOW64; rv:27.0) Gecko/20100101 Firefox/27.0" },
    }).then((r) => r.text());
    const url = css.match(/src:\s*url\(([^)]+)\)/)?.[1];
    return url ? await fetch(url).then((r) => r.arrayBuffer()) : null;
  } catch {
    return null;
  }
}

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
  const [{ data }, font] = await Promise.all([
    supabase.from("events").select(EVENT_SELECT).eq("id", id).maybeSingle(),
    loadFont(),
  ]);
  const e = data as unknown as EventFull | null;
  const display = font ? "Shrikhand" : "serif";
  // Without the display font, leave `fonts` out so the built-in font is used.
  const fonts = font ? { fonts: [{ name: "Shrikhand", data: font, style: "normal" as const, weight: 400 as const }] } : {};

  if (!e) {
    return new ImageResponse(
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#FFF0B3", color: "#231815", fontSize: 96, fontFamily: display }}>
        eventgram
      </div>,
      { ...size, ...fonts },
    );
  }

  const c = CATEGORIES[e.category] ?? CATEGORIES.other;
  const poster = sortedMedia(e.media, "poster")[0];
  const od = odState(e) === "yes";
  const club = e.club?.name || e.eh_conducted_by || "";
  const when = `${fmtDate(e.event_date)}${e.start_time ? " · " + fmtTime(e.start_time) : ""}`;
  const titleSize = e.title.length > 60 ? 54 : e.title.length > 34 ? 66 : 82;

  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", background: "#FFF0B3", padding: 28, fontFamily: "sans-serif" }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", background: c.sw.bg, color: c.sw.ink, border: "6px solid #231815", borderRadius: 36, boxShadow: "12px 12px 0 #231815", padding: "40px 48px", position: "relative" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", border: `4px solid ${c.sw.ink}`, borderRadius: 999, padding: "6px 20px", fontSize: 26, fontWeight: 800, letterSpacing: 2, textTransform: "uppercase" }}>
            {c.label}{club ? ` · ${club}` : ""}
          </div>
          <div style={{ display: "flex", fontFamily: display, fontSize: 40 }}>event<span style={{ color: "#E0263C", marginLeft: 2 }}>gram</span></div>
        </div>
        <div style={{ display: "flex", flex: 1, gap: 36, marginTop: 24 }}>
          <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "flex-end" }}>
            <div style={{ display: "flex", fontFamily: display, fontSize: titleSize, lineHeight: 1.05 }}>{e.title}</div>
            {e.hook && <div style={{ display: "flex", fontSize: 30, fontWeight: 700, marginTop: 16, opacity: 0.9 }}>{e.hook.slice(0, 90)}</div>}
            <div style={{ display: "flex", borderTop: `4px dashed ${c.sw.ink}`, marginTop: 26, paddingTop: 20, gap: 40, fontSize: 30, fontWeight: 800 }}>
              <span>{when}</span>
              <span>{e.fee ? `₹${e.fee}` : "Free"}</span>
              {od && <span>OD {e.od_from ? odTimes(e) : "given"}</span>}
            </div>
          </div>
          {poster && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={mediaUrl(poster.path)} alt="" width={300} height={375} style={{ objectFit: "cover", borderRadius: 20, border: "5px solid #231815", alignSelf: "center" }} />
          )}
        </div>
        {od && (
          <div style={{ position: "absolute", top: 110, right: poster ? 380 : 60, width: 130, height: 130, borderRadius: 999, background: "#FFE57A", color: "#231815", border: "5px solid #231815", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: display, fontSize: 40, transform: "rotate(12deg)" }}>
            OD!
          </div>
        )}
      </div>
    </div>,
    { ...size, ...fonts },
  );
}
