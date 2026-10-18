import Link from "next/link";
import OwnerPanel from "@/components/OwnerPanel";
import { syncConfigured } from "@/lib/eventhub/sync";
import { getRole } from "@/lib/queries";
import type { Club } from "@/lib/types";

export const dynamic = "force-dynamic";
// "Sync now" reads EventHub inside this page's server action.
export const maxDuration = 60;

export default async function OwnerPage() {
  const { supabase, isOwner } = await getRole();
  if (!isOwner) {
    return (
      <main className="wrap page">
        <div className="empty">
          <h2>Owner only</h2>
          <p>This page is for the person who runs Eventgram.</p>
          <Link className="ghost press" href="/club">Back to the club desk</Link>
        </div>
      </main>
    );
  }
  const [{ data: clubs }, { data: runs }, { data: counts }] = await Promise.all([
    supabase.from("clubs").select("id,name,username,category,instagram,eventhub_names,auth_user_id").order("name"),
    supabase.from("sync_runs").select("started_at,finished_at,ok,message,added,updated,removed").order("started_at", { ascending: false }).limit(5),
    supabase.from("events").select("club_id"),
  ]);
  const perClub: Record<string, number> = {};
  (counts ?? []).forEach((r) => { if (r.club_id) perClub[r.club_id] = (perClub[r.club_id] || 0) + 1; });

  return (
    <main className="wrap page">
      <Link className="ghost press back" href="/club">← Club desk</Link>
      <OwnerPanel
        clubs={(clubs ?? []) as Club[]}
        eventCounts={perClub}
        runs={runs ?? []}
        syncReady={syncConfigured()}
      />
    </main>
  );
}
