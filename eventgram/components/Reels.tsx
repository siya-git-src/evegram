"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { clubName, fmtDate, fmtTime, mediaUrl, odState } from "@/lib/format";
import type { EventFull, Media } from "@/lib/types";
import RegisterLink from "./RegisterLink";

export default function Reels({ reels }: { reels: { media: Media; event: EventFull }[] }) {
  const box = useRef<HTMLDivElement>(null);
  const [muted, setMuted] = useState(true);

  // Play the reel that's on screen, pause the rest.
  useEffect(() => {
    const root = box.current;
    if (!root) return;
    const vids = Array.from(root.querySelectorAll("video"));
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => {
          const v = en.target as HTMLVideoElement;
          if (en.isIntersecting && en.intersectionRatio > 0.6) v.play().catch(() => {});
          else v.pause();
        });
      },
      { root, threshold: [0, 0.6, 1] }
    );
    vids.forEach((v) => io.observe(v));
    return () => io.disconnect();
  }, [reels]);

  useEffect(() => {
    box.current?.querySelectorAll("video").forEach((v) => (v.muted = muted));
  }, [muted]);

  if (reels.length === 0) {
    return (
      <div className="reels">
        <div className="reels-empty">
          <div>
            <h2>No reels yet</h2>
            <p>When clubs upload reels for upcoming events, you can swipe through them here.</p>
            <Link className="btn press" href="/">Back to the feed</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="reels" ref={box}>
      {reels.map(({ media, event: e }) => (
        <section className="reel" key={media.id}>
          <video
            src={mediaUrl(media.path)}
            loop
            muted={muted}
            playsInline
            preload="metadata"
            onClick={(ev) => {
              const v = ev.currentTarget;
              if (v.paused) v.play().catch(() => {});
              else v.pause();
            }}
          />
          <button className="mute" onClick={() => setMuted(!muted)}>{muted ? "Sound off" : "Sound on"}</button>
          <div className="overlay">
            <div className="row">
              <strong>{clubName(e)}</strong>
              {odState(e) === "yes" && <span className="odtag">OD</span>}
              <span className="pill">{e.fee ? `₹${e.fee}` : "Free"}</span>
            </div>
            <h2>{e.title}</h2>
            <div className="row">
              {fmtDate(e.event_date)}
              {e.start_time ? " · " + fmtTime(e.start_time) : ""} · {e.venue}
            </div>
            <div className="row">
              <Link className="ghost" href={`/event/${e.id}`}>Details</Link>
              <RegisterLink title={e.title} />
            </div>
          </div>
        </section>
      ))}
    </div>
  );
}
