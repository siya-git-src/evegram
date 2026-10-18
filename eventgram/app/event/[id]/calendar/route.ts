import { NextResponse } from "next/server";
import { icsFile } from "@/lib/calendar";
import { createClient } from "@/lib/supabase/server";

/** Downloads the event as an .ics file (opens in Apple Calendar, Outlook and others). */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: e } = await supabase
    .from("events")
    .select("id,title,event_date,start_time,end_time,venue,deadline,od_status,od_from,od_to,source,hook")
    .eq("id", id)
    .maybeSingle();
  if (!e) return NextResponse.json({ error: "Event not found" }, { status: 404 });
  const url = new URL(`/event/${id}`, request.url).toString();
  const slug = e.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "event";
  return new NextResponse(icsFile(e, url), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${slug}.ics"`,
      "Cache-Control": "no-store",
    },
  });
}
