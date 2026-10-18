"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { clubEmail } from "@/lib/types";

export default function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    const u = username.trim();
    if (!u || !password) return setErr("Enter your club's username and password.");
    setBusy(true);
    // Clubs type a username; the owner signs in with their email.
    const email = u.includes("@") ? u.toLowerCase() : clubEmail(u);
    const { error } = await createClient().auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      setErr(/invalid/i.test(error.message)
        ? "That username and password don't match. Check with the Eventgram owner if you've forgotten them."
        : /rate|too many/i.test(error.message) ? "Too many tries. Wait a minute and try again." : error.message);
      return;
    }
    router.replace(next);
    router.refresh();
  }

  return (
    <form className="form" onSubmit={submit}>
      <div className="lockicon" aria-hidden="true">
        <svg viewBox="0 0 24 24"><rect x="4.5" y="10.5" width="15" height="10" rx="2.5" fill="currentColor" /><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" fill="none" stroke="currentColor" strokeWidth="2.4" /></svg>
      </div>
      <h1>Club <span>login</span></h1>
      <p className="hint">For club core teams. Use the username and password the Eventgram owner gave your club. Students don&apos;t need to log in.</p>
      <label className="field" htmlFor="username">
        Username
        <input id="username" autoComplete="username" autoCapitalize="none" spellCheck={false} placeholder="e.g. codingclub" value={username} onChange={(e) => setUsername(e.target.value)} />
      </label>
      <label className="field" htmlFor="password">
        Password
        <input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </label>
      {err && <p className="err">{err}</p>}
      <button className="btn press" disabled={busy}>{busy ? "Logging in…" : "Log in"}</button>
    </form>
  );
}
