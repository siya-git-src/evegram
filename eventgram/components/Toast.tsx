"use client";

/** Tiny toast without a provider: one element, reused. */
let timer: ReturnType<typeof setTimeout> | undefined;

export function toast(message: string, ms = 2000) {
  if (typeof document === "undefined") return;
  let el = document.getElementById("eg-toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "eg-toast";
    el.className = "toast";
    el.setAttribute("role", "status");
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.hidden = false;
  clearTimeout(timer);
  timer = setTimeout(() => { if (el) el.hidden = true; }, ms);
}
