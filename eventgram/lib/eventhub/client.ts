import "server-only";
import { looksLikeDashboard, looksLikeLoginPage } from "./parse";

const BASE = "https://eventhubcc.vit.ac.in/EventHub";
const UA = "EventgramSync/1.0 (student event listing; reads public event details once every few hours)";

export class EventHubLoginError extends Error {}

/**
 * A signed-in EventHub session, kept as cookies between requests.
 * Read-only: it only loads the dashboard and event pages; it never registers or submits anything else.
 */
export class EventHubSession {
  private cookies = new Map<string, string>();
  constructor(private base: string = BASE) {}

  private cookieHeader() {
    return [...this.cookies].map(([k, v]) => `${k}=${v}`).join("; ");
  }

  private keepCookies(res: Response) {
    const list = typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [];
    for (const c of list) {
      const [pair] = c.split(";");
      const eq = pair.indexOf("=");
      if (eq > 0) this.cookies.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
    }
  }

  private async request(path: string, form?: Record<string, string>): Promise<string> {
    let url = path.startsWith("http") ? path : this.base + path;
    let method = form ? "POST" : "GET";
    let body: string | undefined = form ? new URLSearchParams(form).toString() : undefined;
    for (let hop = 0; hop < 6; hop++) {
      const res = await fetch(url, {
        method,
        body,
        redirect: "manual",
        cache: "no-store",
        signal: AbortSignal.timeout(20000),
        headers: {
          "User-Agent": UA,
          Accept: "text/html",
          ...(body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
          ...(this.cookies.size ? { Cookie: this.cookieHeader() } : {}),
        },
      });
      this.keepCookies(res);
      const loc = res.headers.get("location");
      if (res.status >= 300 && res.status < 400 && loc) {
        url = new URL(loc, url).toString();
        method = "GET";
        body = undefined;
        continue;
      }
      if (!res.ok) throw new Error(`EventHub answered ${res.status} for ${path}`);
      return await res.text();
    }
    throw new Error("EventHub redirected too many times");
  }

  /** Signs in as a VITian and returns the dashboard HTML (the list of events). */
  async login(username: string, password: string): Promise<string> {
    await this.request("/eventPreview"); // picks up the session cookie
    const html = await this.request("/mainDashboard", { validateVitian: "1", username, password });
    if (looksLikeDashboard(html)) return html;
    if (looksLikeLoginPage(html)) throw new EventHubLoginError("EventHub didn't accept the username or password.");
    throw new Error("EventHub showed an unexpected page after signing in.");
  }

  /** The page EventHub shows when you press View on an event. */
  async eventPage(eid: string): Promise<string> {
    return this.request("/eventPreview", { typeEvent: "0", clubSubCategory: "", eid });
  }
}
