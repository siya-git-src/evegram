"use client";

import { useEffect, useState } from "react";
import { toast } from "./Toast";

/** Saved events live on the student's own phone, so nobody needs an account. */
const KEY = "eg-saved";
const EVT = "eg-saved-change";

export function readSaved(): string[] {
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; }
}

function writeSaved(ids: string[]) {
  try { localStorage.setItem(KEY, JSON.stringify(ids)); } catch {}
  window.dispatchEvent(new Event(EVT));
}

export function useSaved(): string[] {
  const [ids, setIds] = useState<string[]>([]);
  useEffect(() => {
    const sync = () => setIds(readSaved());
    sync();
    window.addEventListener(EVT, sync);
    window.addEventListener("storage", sync);
    return () => { window.removeEventListener(EVT, sync); window.removeEventListener("storage", sync); };
  }, []);
  return ids;
}

const icon = (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M6 3h12v18l-6-4-6 4z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
  </svg>
);

export default function SaveButton({ eventId }: { eventId: string }) {
  const saved = useSaved().includes(eventId);
  function toggle() {
    const cur = readSaved();
    const next = cur.includes(eventId) ? cur.filter((x) => x !== eventId) : [...cur, eventId];
    writeSaved(next);
    toast(next.includes(eventId) ? "Saved" : "Removed from saved");
  }
  return (
    <button type="button" className="iconbtn press" aria-pressed={saved} onClick={toggle}>
      {icon}
      {saved ? "Saved" : "Save"}
    </button>
  );
}
