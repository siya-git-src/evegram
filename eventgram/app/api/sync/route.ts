import { NextResponse } from "next/server";
import { runSync, syncConfigured } from "@/lib/eventhub/sync";

// Reading ~25 EventHub pages with pauses takes a while.
export const maxDuration = 60;
export const dynamic = "force-dynamic";

/** Called by the daily Vercel cron (it sends "Authorization: Bearer <CRON_SECRET>"). */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Not allowed" }, { status: 401 });
  }
  if (!syncConfigured()) return NextResponse.json({ error: "Sync isn't set up on the server" }, { status: 500 });
  const result = await runSync();
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
