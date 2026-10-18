"use client";

import { useEffect, useRef, useState } from "react";

const icon = (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <rect x="3.5" y="5" width="17" height="15.5" rx="3" fill="none" stroke="currentColor" strokeWidth="2.2" />
    <path d="M3.5 10h17M8 3v4M16 3v4M12 13v5M9.5 15.5h5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
  </svg>
);

/** Google Calendar link, or an .ics download for Apple Calendar / Outlook. */
export default function CalendarButton({ eventId, googleUrl, hasDeadline }: { eventId: string; googleUrl: string; hasDeadline: boolean }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [open]);

  return (
    <div className="menuwrap" ref={box}>
      <button type="button" className="iconbtn press" onClick={() => setOpen((o) => !o)} aria-expanded={open}>{icon}Add to calendar</button>
      {open && (
        <div className="menu" role="menu">
          <a role="menuitem" href={googleUrl} target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)}>Google Calendar</a>
          <a role="menuitem" href={`/event/${eventId}/calendar`} onClick={() => setOpen(false)}>
            Apple / Outlook{hasDeadline ? " (with deadline reminder)" : ""}
          </a>
        </div>
      )}
    </div>
  );
}
