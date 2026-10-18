"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createClub, deleteClub, resetClubPassword, syncNow, updateClub, type ActionResult } from "@/app/owner/actions";
import { CATEGORIES } from "@/lib/format";
import type { Category, Club } from "@/lib/types";

type Run = { started_at: string; finished_at: string | null; ok: boolean | null; message: string | null; added: number; updated: number; removed: number };

/** Easy to read out and type: no 0/O or 1/l lookalikes. */
function makePassword() {
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const arr = new Uint32Array(12);
  crypto.getRandomValues(arr);
  const s = Array.from(arr, (n) => chars[n % chars.length]).join("");
  return `${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8, 12)}`;
}

function when(iso: string) {
  return new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

function Msg({ r }: { r: ActionResult | null }) {
  if (!r) return null;
  return <p className={r.ok ? "okmsg" : "err"}>{r.message}</p>;
}

function Secret({ username, password }: { username: string; password: string }) {
  const [copied, setCopied] = useState(false);
  const text = `Eventgram club login\nUsername: ${username}\nPassword: ${password}`;
  return (
    <div className="notice" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <b>Give these to the club now. The password can&apos;t be shown again.</b>
      <div className="secret">Username: {username}<br />Password: {password}</div>
      <button type="button" className="ghost press" style={{ alignSelf: "flex-start" }}
        onClick={() => navigator.clipboard.writeText(text).then(() => setCopied(true), () => setCopied(false))}>
        {copied ? "Copied" : "Copy login details"}
      </button>
    </div>
  );
}

export default function OwnerPanel({ clubs, eventCounts, runs, syncReady }: {
  clubs: Club[]; eventCounts: Record<string, number>; runs: Run[]; syncReady: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [syncMsg, setSyncMsg] = useState<ActionResult | null>(null);

  const [form, setForm] = useState({ name: "", username: "", password: makePassword(), category: "tech", instagram: "", eventhubNames: "" });
  const [createMsg, setCreateMsg] = useState<ActionResult | null>(null);
  const [shown, setShown] = useState<{ username: string; password: string } | null>(null);

  const [open, setOpen] = useState<string | null>(null);
  const [edit, setEdit] = useState<{ category: string; instagram: string; eventhubNames: string; password: string }>({ category: "", instagram: "", eventhubNames: "", password: "" });
  const [rowMsg, setRowMsg] = useState<ActionResult | null>(null);
  const [rowSecret, setRowSecret] = useState<{ username: string; password: string } | null>(null);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);

  function suggestUsername(name: string) {
    return name.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "").slice(0, 24);
  }

  function submitCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreateMsg(null);
    start(async () => {
      const r = await createClub(form);
      setCreateMsg(r);
      if (r.ok) {
        setShown({ username: form.username.trim().toLowerCase(), password: form.password });
        setForm({ name: "", username: "", password: makePassword(), category: "tech", instagram: "", eventhubNames: "" });
        router.refresh();
      }
    });
  }

  function openRow(c: Club) {
    setOpen(open === c.id ? null : c.id);
    setEdit({ category: c.category, instagram: c.instagram ?? "", eventhubNames: c.eventhub_names.join(", "), password: "" });
    setRowMsg(null); setRowSecret(null); setConfirmDel(null);
  }

  const last = runs[0];
  return (
    <div className="desk">
      <h1 className="deskh">Clubs &amp; <span>sync</span></h1>

      <section className="form">
        <h2>EventHub sync</h2>
        {!syncReady ? (
          <p className="err">The sync isn&apos;t set up yet. Add EVENTHUB_USERNAME, EVENTHUB_PASSWORD and SUPABASE_SERVICE_ROLE_KEY in Vercel → Settings → Environment Variables, then redeploy.</p>
        ) : (
          <p className="hint">Eventgram checks EventHub on its own: every morning, and whenever someone opens the feed and the last check is over 3 hours old.</p>
        )}
        {last ? (
          <p className={last.ok ? "okmsg" : last.finished_at ? "err" : "hint"}>
            {last.finished_at ? `${when(last.finished_at)} · ` : "Running now · "}{last.message ?? ""}
            {last.ok ? ` Added ${last.added}, updated ${last.updated}, removed ${last.removed}.` : ""}
          </p>
        ) : <p className="hint">No sync has run yet.</p>}
        <button type="button" className="btn press" disabled={pending || !syncReady}
          onClick={() => { setSyncMsg(null); start(async () => { setSyncMsg(await syncNow()); router.refresh(); }); }}>
          {pending ? "Working…" : "Sync now"}
        </button>
        <Msg r={syncMsg} />
      </section>

      <form className="form" onSubmit={submitCreate}>
        <h2>Add a <span>club</span></h2>
        <p className="hint">Each club gets one username and password for its core team. They can only edit their own club&apos;s events.</p>
        <div className="grid2">
          <label className="field" htmlFor="c-name">
            Club name
            <input id="c-name" value={form.name} maxLength={60} placeholder="e.g. Coding Club"
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value, username: p.username && p.username !== suggestUsername(p.name) ? p.username : suggestUsername(e.target.value) }))} />
          </label>
          <label className="field" htmlFor="c-user">
            Username
            <input id="c-user" value={form.username} maxLength={30} autoCapitalize="none" spellCheck={false} placeholder="e.g. codingclub"
              onChange={(e) => setForm((p) => ({ ...p, username: e.target.value.toLowerCase() }))} />
          </label>
        </div>
        <label className="field" htmlFor="c-pass">
          Password
          <span style={{ display: "flex", gap: 8 }}>
            <input id="c-pass" className="input" value={form.password} onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))} />
            <button type="button" className="ghost press" onClick={() => setForm((p) => ({ ...p, password: makePassword() }))}>New</button>
          </span>
        </label>
        <div className="grid2">
          <label className="field" htmlFor="c-cat">
            Usual category
            <select id="c-cat" value={form.category} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}>
              {Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </label>
          <label className="field" htmlFor="c-insta">
            Instagram (optional)
            <input id="c-insta" value={form.instagram} placeholder="@clubhandle" onChange={(e) => setForm((p) => ({ ...p, instagram: e.target.value }))} />
          </label>
        </div>
        <label className="field" htmlFor="c-eh">
          Name on EventHub (optional)
          <input id="c-eh" value={form.eventhubNames} placeholder="How EventHub's “Conducted By” writes it, e.g. VITSOL" onChange={(e) => setForm((p) => ({ ...p, eventhubNames: e.target.value }))} />
        </label>
        <p className="hint">With the EventHub name filled in, the sync puts new EventHub events straight under this club. Separate several with commas.</p>
        <Msg r={createMsg} />
        {shown && <Secret {...shown} />}
        <button className="btn press" disabled={pending}>Create club login</button>
      </form>

      <h2 className="section-title">{clubs.length} club{clubs.length === 1 ? "" : "s"}</h2>
      {clubs.length === 0 && <p className="hint">No clubs yet. Add the first one above.</p>}
      <ul className="list">
        {clubs.map((c) => (
          <li key={c.id}>
            <div className="row">
              <div className="grow">
                <b>{c.name}</b>
                <div className="sub">
                  Username <b>{c.username}</b> · {(CATEGORIES[c.category as Category] ?? CATEGORIES.other).label} · {eventCounts[c.id] || 0} events
                  {c.eventhub_names.length ? ` · EventHub: ${c.eventhub_names.join(", ")}` : ""}
                  {!c.auth_user_id ? " · no login yet" : ""}
                </div>
              </div>
              <button type="button" className="ghost press" onClick={() => openRow(c)}>{open === c.id ? "Close" : "Manage"}</button>
            </div>
            {open === c.id && (
              <div className="odbox">
                <div className="grid2">
                  <label className="field" htmlFor={`cat-${c.id}`}>
                    Usual category
                    <select id={`cat-${c.id}`} value={edit.category} onChange={(e) => setEdit((p) => ({ ...p, category: e.target.value }))}>
                      {Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>
                  </label>
                  <label className="field" htmlFor={`ig-${c.id}`}>
                    Instagram
                    <input id={`ig-${c.id}`} value={edit.instagram} onChange={(e) => setEdit((p) => ({ ...p, instagram: e.target.value }))} />
                  </label>
                </div>
                <label className="field" htmlFor={`eh-${c.id}`}>
                  Name on EventHub
                  <input id={`eh-${c.id}`} value={edit.eventhubNames} placeholder="e.g. VITSOL" onChange={(e) => setEdit((p) => ({ ...p, eventhubNames: e.target.value }))} />
                </label>
                <button type="button" className="ghost press" disabled={pending} style={{ alignSelf: "flex-start" }}
                  onClick={() => start(async () => { setRowMsg(await updateClub(c.id, edit)); router.refresh(); })}>
                  Save details
                </button>

                <label className="field" htmlFor={`pw-${c.id}`}>
                  New password
                  <span style={{ display: "flex", gap: 8 }}>
                    <input id={`pw-${c.id}`} className="input" value={edit.password} placeholder="At least 8 characters" onChange={(e) => setEdit((p) => ({ ...p, password: e.target.value }))} />
                    <button type="button" className="ghost press" onClick={() => setEdit((p) => ({ ...p, password: makePassword() }))}>New</button>
                  </span>
                </label>
                <button type="button" className="ghost press" disabled={pending || !edit.password} style={{ alignSelf: "flex-start" }}
                  onClick={() => start(async () => {
                    const r = await resetClubPassword(c.id, edit.password);
                    setRowMsg(r);
                    if (r.ok) { setRowSecret({ username: c.username, password: edit.password }); setEdit((p) => ({ ...p, password: "" })); }
                  })}>
                  Set new password
                </button>
                {rowSecret && <Secret {...rowSecret} />}
                <Msg r={rowMsg} />

                <button type="button" className="ghost danger press" disabled={pending} style={{ alignSelf: "flex-start" }}
                  onClick={() => {
                    if (confirmDel !== c.id) return setConfirmDel(c.id);
                    start(async () => { setRowMsg(await deleteClub(c.id)); setOpen(null); router.refresh(); });
                  }}>
                  {confirmDel === c.id ? "Tap again to remove the club and its login" : "Remove club"}
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
