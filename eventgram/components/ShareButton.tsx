"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "./Toast";

const icon = (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 3v12M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** Shares an event: the phone's own share sheet when there is one, otherwise WhatsApp / copy link. */
export default function ShareButton({ eventId, text }: { eventId: string; text: string }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const url = () => `${location.origin}/event/${eventId}`;

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [open]);

  async function share() {
    if (typeof navigator.share === "function") {
      try { await navigator.share({ title: text, text, url: url() }); return; }
      catch (e) { if ((e as Error).name === "AbortError") return; }
    }
    setOpen((o) => !o);
  }

  function copy() {
    navigator.clipboard.writeText(url()).then(() => toast("Link copied"), () => toast(url(), 4000));
    setOpen(false);
  }

  return (
    <div className="menuwrap" ref={box}>
      <button type="button" className="iconbtn press" onClick={share} aria-expanded={open}>{icon}Share</button>
      {open && (
        <div className="menu" role="menu">
          <a role="menuitem" href={`https://wa.me/?text=${encodeURIComponent(`${text}\n${url()}`)}`} target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)}>WhatsApp</a>
          <a role="menuitem" href={`https://t.me/share/url?url=${encodeURIComponent(url())}&text=${encodeURIComponent(text)}`} target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)}>Telegram</a>
          <button role="menuitem" type="button" onClick={copy}>Copy link</button>
        </div>
      )}
    </div>
  );
}
