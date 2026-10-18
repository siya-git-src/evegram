export type Category = "tech" | "cultural" | "sports" | "workshop" | "fest" | "social" | "other";

export type Club = {
  id: string;
  name: string;
  username: string;
  category: Category;
  instagram: string | null;
  eventhub_names: string[];
  auth_user_id?: string | null;
};

export type Media = {
  id: string;
  event_id: string;
  kind: "poster" | "reel";
  path: string;
  position: number;
};

export type EventRow = {
  id: string;
  source: "eventhub" | "club";
  eventhub_eid: string | null;
  club_id: string | null;
  title: string;
  description: string;
  category: Category;
  event_date: string; // YYYY-MM-DD
  start_time: string | null; // HH:MM:SS
  end_time: string | null;
  venue: string;
  fee: number;
  open_to: string | null;
  team_size: string | null;
  eh_conducted_by: string | null;
  eh_detail_at?: string | null;
  last_seen_at?: string | null;
  od_status: "yes" | "no" | null;
  od_from: string | null;
  od_to: string | null;
  od_note: string | null;
  deadline: string | null;
  hook: string | null;
  highlights: string | null;
  instagram_url: string | null;
  contact: string | null;
  club_updated_at: string | null;
  created_at: string;
};

export type EventFull = EventRow & {
  club: Pick<Club, "id" | "name" | "category" | "instagram"> | null;
  media: Media[];
};

// One select string used everywhere we load events with their club and media.
export const EVENT_SELECT = "*, club:clubs(id,name,category,instagram), media:event_media(id,event_id,kind,path,position)";

/** Club logins are Supabase accounts with this made-up email domain; clubs only ever type the username. */
export const CLUB_EMAIL_DOMAIN = "clubs.eventgram.app";
export const clubEmail = (username: string) => `${username.trim().toLowerCase()}@${CLUB_EMAIL_DOMAIN}`;

export const EVENTHUB_URL = "https://eventhubcc.vit.ac.in/EventHub/eventPreview";
