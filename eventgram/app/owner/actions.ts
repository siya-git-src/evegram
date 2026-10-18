"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { runSync } from "@/lib/eventhub/sync";
import { clubEmail } from "@/lib/types";

export type ActionResult = { ok: boolean; message: string };

const USERNAME = /^[a-z0-9][a-z0-9._-]{2,29}$/;
const CATS = ["tech", "cultural", "sports", "workshop", "fest", "social", "other"];

async function requireOwner() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("is_owner");
  if (!data) throw new Error("Only the Eventgram owner can do this.");
}

function checkPassword(p: string): string | null {
  if (p.length < 8) return "Passwords need at least 8 characters.";
  if (p.length > 72) return "That password is too long (72 characters max).";
  return null;
}

const names = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean).slice(0, 10);

export async function createClub(input: {
  name: string; username: string; password: string; category: string; instagram: string; eventhubNames: string;
}): Promise<ActionResult> {
  try {
    await requireOwner();
    const name = input.name.trim();
    const username = input.username.trim().toLowerCase();
    if (name.length < 2) return { ok: false, message: "Give the club a name." };
    if (!USERNAME.test(username)) return { ok: false, message: "Usernames are 3–30 characters: lowercase letters, numbers, dots, dashes or underscores, starting with a letter or number." };
    const bad = checkPassword(input.password);
    if (bad) return { ok: false, message: bad };

    const admin = createAdminClient();
    const { data: club, error } = await admin.from("clubs").insert({
      name,
      username,
      category: CATS.includes(input.category) ? input.category : "other",
      instagram: input.instagram.trim().replace(/^@/, "") || null,
      eventhub_names: names(input.eventhubNames),
    }).select("id").single();
    if (error) {
      return { ok: false, message: /duplicate|unique/i.test(error.message) ? "A club with that name or username already exists." : error.message };
    }

    const { data: created, error: authErr } = await admin.auth.admin.createUser({
      email: clubEmail(username),
      password: input.password,
      email_confirm: true,
      user_metadata: { club: name },
    });
    if (authErr || !created.user) {
      await admin.from("clubs").delete().eq("id", club.id);
      return { ok: false, message: `Couldn't create the login: ${authErr?.message ?? "unknown error"}` };
    }
    await admin.from("clubs").update({ auth_user_id: created.user.id }).eq("id", club.id);
    revalidatePath("/owner");
    return { ok: true, message: `${name} can now log in as “${username}”.` };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}

export async function resetClubPassword(clubId: string, password: string): Promise<ActionResult> {
  try {
    await requireOwner();
    const bad = checkPassword(password);
    if (bad) return { ok: false, message: bad };
    const admin = createAdminClient();
    const { data: club } = await admin.from("clubs").select("name, username, auth_user_id").eq("id", clubId).single();
    if (!club) return { ok: false, message: "That club doesn't exist any more." };
    if (club.auth_user_id) {
      const { error } = await admin.auth.admin.updateUserById(club.auth_user_id, { password });
      if (error) return { ok: false, message: error.message };
    } else {
      const { data: created, error } = await admin.auth.admin.createUser({ email: clubEmail(club.username), password, email_confirm: true });
      if (error || !created.user) return { ok: false, message: error?.message ?? "Couldn't create the login." };
      await admin.from("clubs").update({ auth_user_id: created.user.id }).eq("id", clubId);
    }
    revalidatePath("/owner");
    return { ok: true, message: `New password set for ${club.name}. Anyone still logged in as the club stays logged in until they log out.` };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}

export async function updateClub(clubId: string, input: { category: string; instagram: string; eventhubNames: string }): Promise<ActionResult> {
  try {
    await requireOwner();
    const admin = createAdminClient();
    const { error } = await admin.from("clubs").update({
      category: CATS.includes(input.category) ? input.category : "other",
      instagram: input.instagram.trim().replace(/^@/, "") || null,
      eventhub_names: names(input.eventhubNames),
    }).eq("id", clubId);
    if (error) return { ok: false, message: error.message };
    revalidatePath("/owner");
    return { ok: true, message: "Saved." };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}

export async function deleteClub(clubId: string): Promise<ActionResult> {
  try {
    await requireOwner();
    const admin = createAdminClient();
    const { data: club } = await admin.from("clubs").select("name, auth_user_id").eq("id", clubId).single();
    if (!club) return { ok: false, message: "That club doesn't exist any more." };
    if (club.auth_user_id) await admin.auth.admin.deleteUser(club.auth_user_id);
    const { error } = await admin.from("clubs").delete().eq("id", clubId);
    if (error) return { ok: false, message: error.message };
    revalidatePath("/owner");
    return { ok: true, message: `${club.name} and its login were removed. Its events stay on the feed without a club.` };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}

export async function syncNow(): Promise<ActionResult> {
  try {
    await requireOwner();
    const r = await runSync();
    revalidatePath("/owner");
    revalidatePath("/");
    return { ok: r.ok, message: r.ok ? `${r.message} Added ${r.added}, updated ${r.updated}, removed ${r.removed}.` : r.message };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}
