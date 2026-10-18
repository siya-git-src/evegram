import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { todayIST } from "@/lib/format";
import { EventHubLoginError, EventHubSession } from "./client";
import { guessCategory, looksLikeLoginPage, openToVitians, parseDashboard, parseDetail } from "./parse";

/** How often the feed refreshes on its own when people open it. */
const STALE_AFTER_MS = 3 * 60 * 60 * 1000;
/** A run that started this recently and hasn't finished is still going; don't start another. */
const RUNNING_FOR_MS = 10 * 60 * 1000;
/** Event pages read per run. Keeps each run short and gentle on EventHub; the rest are read next run. */
const DETAIL_BUDGET = 25;
/** Re-read an event's own page once a day to pick up time and description changes. */
const DETAIL_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const PAUSE_MS = 400;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export type SyncResult = { ok: boolean; message: string; added: number; updated: number; removed: number };

type Existing = {
  id: string; eventhub_eid: string; club_id: string | null; title: string; event_date: string; venue: string;
  fee: number; open_to: string | null; team_size: string | null; start_time: string | null; description: string;
  eh_conducted_by: string | null; eh_detail_at: string | null;
};

export function syncConfigured(): boolean {
  return !!(process.env.EVENTHUB_USERNAME && process.env.EVENTHUB_PASSWORD && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

/** Runs a sync if the last good one is older than a few hours and none is running. */
export async function syncIfStale(): Promise<void> {
  if (!syncConfigured()) return;
  const admin = createAdminClient();
  const { data: last } = await admin.from("sync_runs").select("started_at, finished_at, ok").order("started_at", { ascending: false }).limit(5);
  const now = Date.now();
  const running = (last ?? []).some((r) => !r.finished_at && now - new Date(r.started_at).getTime() < RUNNING_FOR_MS);
  const lastGood = (last ?? []).find((r) => r.ok && r.finished_at);
  const lastTry = (last ?? [])[0];
  if (running) return;
  if (lastGood && now - new Date(lastGood.finished_at!).getTime() < STALE_AFTER_MS) return;
  // After a failure, wait an hour before trying again by itself.
  if (lastTry && !lastTry.ok && lastTry.finished_at && now - new Date(lastTry.finished_at).getTime() < 60 * 60 * 1000) return;
  await runSync();
}

type Deps = { admin?: ReturnType<typeof createAdminClient>; hub?: EventHubSession; today?: string };

export async function runSync(deps: Deps = {}): Promise<SyncResult> {
  const admin = deps.admin ?? createAdminClient();
  const { data: run } = await admin.from("sync_runs").insert({}).select("id").single();
  const finish = async (r: SyncResult) => {
    if (run) await admin.from("sync_runs").update({ finished_at: new Date().toISOString(), ...r }).eq("id", run.id);
    return r;
  };

  const username = process.env.EVENTHUB_USERNAME;
  const password = process.env.EVENTHUB_PASSWORD;
  if (!username || !password) {
    return finish({ ok: false, message: "EVENTHUB_USERNAME and EVENTHUB_PASSWORD aren't set on the server.", added: 0, updated: 0, removed: 0 });
  }

  try {
    const hub = deps.hub ?? new EventHubSession();
    const dashboard = await hub.login(username, password);
    const listed = parseDashboard(dashboard);
    if (listed.length === 0) {
      return finish({ ok: false, message: "Signed in, but EventHub's page had no events I could read. Nothing was changed.", added: 0, updated: 0, removed: 0 });
    }

    const today = deps.today ?? todayIST();
    const nowIso = new Date().toISOString();
    const wanted = listed.filter((x) => x.eid && x.date >= today && openToVitians(x.openTo));

    const [{ data: existingRows, error: exErr }, { data: clubs }] = await Promise.all([
      admin.from("events")
        .select("id,eventhub_eid,club_id,title,event_date,venue,fee,open_to,team_size,start_time,description,eh_conducted_by,eh_detail_at")
        .eq("source", "eventhub"),
      admin.from("clubs").select("id, eventhub_names"),
    ]);
    if (exErr) throw new Error(exErr.message);
    const existing = new Map((existingRows as Existing[] ?? []).map((r) => [r.eventhub_eid, r]));

    // Match EventHub's "Conducted By" (e.g. "VITSOL") to a club the owner set up.
    const clubFor = (conductedBy: string | null) => {
      if (!conductedBy) return null;
      const key = conductedBy.trim().toLowerCase();
      const hit = (clubs ?? []).find((c) => (c.eventhub_names as string[]).some((n) => n.trim().toLowerCase() === key));
      return hit ? (hit.id as string) : null;
    };

    let added = 0, updated = 0, removed = 0, detailsRead = 0, detailsSkipped = 0;

    for (const x of wanted) {
      const ex = existing.get(x.eid!);
      const needDetail = !ex || !ex.eh_detail_at || Date.now() - new Date(ex.eh_detail_at).getTime() > DETAIL_MAX_AGE_MS;
      let detail = null;
      if (needDetail) {
        if (detailsRead < DETAIL_BUDGET) {
          if (detailsRead > 0) await sleep(PAUSE_MS);
          let html = await hub.eventPage(x.eid!);
          if (looksLikeLoginPage(html)) {
            await hub.login(username, password); // session ran out: sign in again once
            html = await hub.eventPage(x.eid!);
          }
          detail = parseDetail(html);
          detailsRead++;
        } else {
          detailsSkipped++;
        }
      }

      const base = {
        title: x.title,
        event_date: x.date,
        venue: x.venue,
        fee: x.fee,
        open_to: x.openTo || null,
        team_size: x.team,
        last_seen_at: nowIso,
        ...(detail
          ? {
              description: detail.description,
              eh_conducted_by: detail.conductedBy,
              eh_detail_at: nowIso,
              ...(detail.time ? { start_time: detail.time } : {}),
            }
          : {}),
      };

      if (!ex) {
        const { error } = await admin.from("events").insert({
          source: "eventhub",
          eventhub_eid: x.eid,
          category: guessCategory(x.title),
          club_id: clubFor(detail?.conductedBy ?? null),
          ...base,
        });
        if (error) throw new Error(error.message);
        added++;
      } else {
        const changed =
          ex.title !== base.title || ex.event_date !== base.event_date || ex.venue !== base.venue || ex.fee !== base.fee ||
          (ex.open_to ?? null) !== base.open_to || (ex.team_size ?? null) !== base.team_size ||
          (detail && ((detail.time && (ex.start_time ?? "").slice(0, 5) !== detail.time) || ex.description !== detail.description || ex.eh_conducted_by !== detail.conductedBy));
        const claim = !ex.club_id && detail ? clubFor(detail.conductedBy) : null;
        const { error } = await admin.from("events").update({ ...base, ...(claim ? { club_id: claim } : {}) }).eq("id", ex.id);
        if (error) throw new Error(error.message);
        if (changed || claim) updated++;
      }
    }

    // Upcoming events that vanished from EventHub were cancelled or unpublished: remove them.
    // Safety: if most of them vanished at once, EventHub probably changed its page, so change nothing.
    const listedIds = new Set(listed.map((x) => x.eid).filter(Boolean));
    const gone = [...existing.values()].filter((r) => r.event_date >= today && !listedIds.has(r.eventhub_eid));
    const upcomingKnown = [...existing.values()].filter((r) => r.event_date >= today).length;
    let note = "";
    const suspicious = (gone.length > 2 && gone.length > upcomingKnown * 0.5) || (upcomingKnown > 1 && gone.length === upcomingKnown);
    if (gone.length && !suspicious) {
      const { error } = await admin.from("events").delete().in("id", gone.map((r) => r.id));
      if (error) throw new Error(error.message);
      removed = gone.length;
    } else if (gone.length) {
      note = ` ${gone.length} events disappeared from EventHub at once, so I left them in place to be safe.`;
    }

    const more = detailsSkipped ? ` ${detailsSkipped} event pages will be read next time.` : "";
    return finish({ ok: true, message: `Read ${listed.length} EventHub events (${wanted.length} upcoming for VITians).${more}${note}`, added, updated, removed });
  } catch (e) {
    const msg = e instanceof EventHubLoginError
      ? "EventHub didn't accept the sync account's username or password. Update EVENTHUB_USERNAME / EVENTHUB_PASSWORD on the server."
      : `Sync stopped: ${e instanceof Error ? e.message : String(e)}`;
    return finish({ ok: false, message: msg, added: 0, updated: 0, removed: 0 });
  }
}
