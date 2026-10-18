"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  {
    href: "/",
    label: "Feed",
    match: (p: string) => p === "/" || p.startsWith("/event"),
    icon: <path d="M4 5h16M4 12h16M4 19h10" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />,
  },
  {
    href: "/reels",
    label: "Reels",
    match: (p: string) => p.startsWith("/reels"),
    icon: (
      <>
        <rect x="3.5" y="3.5" width="17" height="17" rx="4" fill="none" stroke="currentColor" strokeWidth="2.2" />
        <path d="M10 8.5v7l6-3.5z" fill="currentColor" />
      </>
    ),
  },
  {
    href: "/saved",
    label: "Saved",
    match: (p: string) => p.startsWith("/saved"),
    icon: <path d="M6 3h12v18l-6-4-6 4z" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" />,
  },
  {
    href: "/club",
    label: "Clubs",
    match: (p: string) => p.startsWith("/club") || p.startsWith("/owner") || p.startsWith("/login"),
    icon: (
      <>
        <circle cx="9" cy="8.5" r="3.5" fill="none" stroke="currentColor" strokeWidth="2.2" />
        <path d="M2.5 20c1-3.6 3.5-5.5 6.5-5.5s5.5 1.9 6.5 5.5M16 5.5a3.2 3.2 0 0 1 0 6.2M18.5 14.8c1.6.8 2.6 2.4 3 5.2" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      </>
    ),
  },
];

export default function BottomNav() {
  const path = usePathname();
  return (
    <nav className="nav" aria-label="Main">
      <ul>
        {items.map((it) => (
          <li key={it.href}>
            <Link href={it.href} aria-current={it.match(path) ? "page" : undefined}>
              <svg viewBox="0 0 24 24" aria-hidden="true">{it.icon}</svg>
              {it.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
