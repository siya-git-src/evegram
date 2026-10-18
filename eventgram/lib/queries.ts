import { createClient } from "@/lib/supabase/server";
import { sortEvents, todayIST } from "@/lib/format";
import { EVENT_SELECT, type Club, type EventFull } from "@/lib/types";

export async function getViewer() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}

/** Who is signed in and what they may do: the owner, a club login, or nobody. */
export async function getRole() {
  const { supabase, user } = await getViewer();
  if (!user) return { supabase, user: null, isOwner: false, club: null as Club | null };
  const [{ data: owner }, { data: club }] = await Promise.all([
    supabase.rpc("is_owner"),
    supabase.from("clubs").select("id,name,username,category,instagram,eventhub_names").eq("auth_user_id", user.id).maybeSingle(),
  ]);
  return { supabase, user, isOwner: !!owner, club: (club as Club | null) ?? null };
}

export async function getUpcomingEvents(): Promise<EventFull[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("events")
    .select(EVENT_SELECT)
    .gte("event_date", todayIST())
    .order("event_date")
    .limit(500);
  if (error) throw new Error(error.message);
  return sortEvents((data ?? []) as unknown as EventFull[]);
}

export async function getLastSync() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("sync_runs")
    .select("finished_at, ok, message, added, updated, removed")
    .not("finished_at", "is", null)
    .order("finished_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data as { finished_at: string; ok: boolean; message: string | null; added: number; updated: number; removed: number } | null;
}
