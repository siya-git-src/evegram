"use client";

import { useEffect, useState } from "react";

const SUN = (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="12" cy="12" r="4.5" fill="currentColor" />
    <path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
  </svg>
);
const MOON = (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z" fill="currentColor" />
  </svg>
);

function current(): "light" | "dark" {
  const t = document.documentElement.dataset.theme;
  if (t === "dark" || t === "light") return t;
  return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark" | null>(null);
  useEffect(() => setTheme(current()), []);

  function flip() {
    const next = current() === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem("eg-theme", next); } catch {}
    setTheme(next);
  }

  const dark = theme === "dark";
  return (
    <button type="button" className="mode press" onClick={flip} aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}>
      {theme === null ? null : dark ? SUN : MOON}
    </button>
  );
}
