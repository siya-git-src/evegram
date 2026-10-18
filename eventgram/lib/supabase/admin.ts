import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Server-only client with the service key. It skips the database's access rules,
 * so only use it after checking who is asking (owner actions, the EventHub sync).
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set on the server.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
