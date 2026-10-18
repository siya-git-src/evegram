"use client";

import { EVENTHUB_URL } from "@/lib/types";
import { toast } from "./Toast";

/**
 * EventHub opens events through a form, not a link, so we can't send students to one event.
 * Register copies the event name for EventHub's search box, then opens EventHub.
 */
export default function RegisterLink({ title, className = "reg press" }: { title: string; className?: string }) {
  function onClick() {
    const done = (ok: boolean) =>
      toast(ok ? `Copied “${title}”. Sign in on EventHub and paste it in Search.` : `On EventHub, search for “${title}”.`, 4200);
    try {
      navigator.clipboard.writeText(title).then(() => done(true), () => done(false));
    } catch {
      done(false);
    }
  }
  return (
    <a className={className} href={EVENTHUB_URL} target="_blank" rel="noopener noreferrer" onClick={onClick}>
      Register on EventHub
    </a>
  );
}
