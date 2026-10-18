import "server-only";
import { X509Certificate } from "node:crypto";
import { readFileSync } from "node:fs";
import http from "node:http";
import https from "node:https";
import tls from "node:tls";
import { looksLikeDashboard, looksLikeLoginPage } from "./parse";

const BASE = "https://eventhubcc.vit.ac.in/EventHub";
const UA = "EventgramSync/1.0 (student event listing; reads public event details once every few hours)";
const TIMEOUT_MS = 20000;

export class EventHubLoginError extends Error {}

/** Errors that mean "the server didn't send its full certificate chain". */
const CHAIN_ERRORS = new Set(["UNABLE_TO_VERIFY_LEAF_SIGNATURE", "UNABLE_TO_GET_ISSUER_CERT", "UNABLE_TO_GET_ISSUER_CERT_LOCALLY"]);

/** Turns low-level network errors into a sentence the owner page can show. */
export function describeNetworkError(e: unknown): string {
  const err = e as { code?: string; message?: string; cause?: { code?: string; message?: string } };
  const code = err?.code || err?.cause?.code || "";
  const msg = err?.cause?.message || err?.message || String(e);
  switch (code) {
    case "ETIMEDOUT":
    case "UND_ERR_CONNECT_TIMEOUT":
    case "ECONNREFUSED":
    case "ECONNRESET":
    case "EHOSTUNREACH":
    case "ENETUNREACH":
      return `Couldn't connect to EventHub (${code}). EventHub may block servers outside India or be down right now.`;
    case "ENOTFOUND":
    case "EAI_AGAIN":
      return `Couldn't find EventHub's address (${code}). It may be down, or only reachable on campus.`;
    default:
      if (CHAIN_ERRORS.has(code) || /certificate/i.test(msg)) return `EventHub's security certificate couldn't be checked (${code || msg}).`;
      return code ? `${msg} (${code})` : msg;
  }
}

/** Extra trusted certificates for local testing (NODE_EXTRA_CA_CERTS). Empty in production. */
function extraCAs(): string[] {
  const f = process.env.NODE_EXTRA_CA_CERTS;
  if (!f) return [];
  try { return [readFileSync(f, "utf8")]; } catch { return []; }
}

type RawResponse = { status: number; headers: http.IncomingHttpHeaders; body: string };

function rawRequest(url: string, method: string, headers: Record<string, string>, body: string | undefined, agent?: https.Agent): Promise<RawResponse> {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const lib = u.protocol === "https:" ? https : http;
    const req = lib.request(
      u,
      { method, headers: { ...headers, ...(body ? { "Content-Length": Buffer.byteLength(body).toString() } : {}) }, ...(u.protocol === "https:" && agent ? { agent } : {}) },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c: Buffer) => chunks.push(c));
        res.on("end", () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body: Buffer.concat(chunks).toString("utf8") }));
        res.on("error", reject);
      }
    );
    req.setTimeout(TIMEOUT_MS, () => req.destroy(Object.assign(new Error("EventHub took too long to answer"), { code: "ETIMEDOUT" })));
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

function download(url: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith("https:") ? https : http;
    const req = lib.get(url, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (c: Buffer) => chunks.push(c));
      res.on("end", () => resolve(Buffer.concat(chunks)));
      res.on("error", reject);
    });
    req.setTimeout(TIMEOUT_MS, () => req.destroy(new Error("timeout")));
    req.on("error", reject);
  });
}

/**
 * Some servers don't send their intermediate certificate. Browsers quietly fetch it; Node doesn't.
 * This reads the certificate's own "CA Issuers" link, downloads the missing piece, and trusts it
 * only as part of a chain that still has to end at a normal trusted root. Verification stays on.
 */
async function agentWithFetchedIntermediates(host: string, port: number): Promise<https.Agent | null> {
  const peer = await new Promise<tls.DetailedPeerCertificate | null>((resolve) => {
    const s = tls.connect({ host, port, servername: host, rejectUnauthorized: false }, () => {
      const c = s.getPeerCertificate(true);
      s.end();
      resolve(c && Object.keys(c).length ? c : null);
    });
    s.setTimeout(TIMEOUT_MS, () => { s.destroy(); resolve(null); });
    s.on("error", () => resolve(null));
  });
  if (!peer) return null;
  const pems: string[] = [];
  let cert: tls.DetailedPeerCertificate | undefined = peer;
  for (let depth = 0; cert && depth < 4; depth++) {
    const links = (cert.infoAccess?.["CA Issuers - URI"] ?? []).filter((x) => /^https?:\/\//.test(x));
    if (!links.length) break;
    let next: X509Certificate | null = null;
    for (const link of links) {
      try {
        const buf = await download(link);
        next = new X509Certificate(buf.toString("utf8").includes("BEGIN CERTIFICATE") ? buf.toString("utf8") : buf);
        break;
      } catch { /* try the next link */ }
    }
    if (!next) break;
    pems.push(next.toString());
    if (next.issuer === next.subject) break; // reached a root
    // Keep walking up only if this intermediate also points to its issuer.
    const info = next.infoAccess ?? "";
    const m = info.match(/CA Issuers - URI:(\S+)/);
    cert = m ? ({ infoAccess: { "CA Issuers - URI": [m[1]] } } as unknown as tls.DetailedPeerCertificate) : undefined;
  }
  if (!pems.length) return null;
  return new https.Agent({ keepAlive: true, ca: [...tls.rootCertificates, ...extraCAs(), ...pems] });
}

/**
 * A signed-in EventHub session, kept as cookies between requests.
 * Read-only: it only loads the dashboard and event pages; it never registers or submits anything else.
 */
export class EventHubSession {
  private cookies = new Map<string, string>();
  private agent: https.Agent | undefined;
  private triedChainFix = false;
  constructor(private base: string = BASE) {}

  private cookieHeader() {
    return [...this.cookies].map(([k, v]) => `${k}=${v}`).join("; ");
  }

  private keepCookies(headers: http.IncomingHttpHeaders) {
    const raw = headers["set-cookie"];
    for (const c of Array.isArray(raw) ? raw : raw ? [raw] : []) {
      const [pair] = c.split(";");
      const eq = pair.indexOf("=");
      if (eq > 0) this.cookies.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
    }
  }

  private async send(url: string, method: string, headers: Record<string, string>, body?: string): Promise<RawResponse> {
    try {
      return await rawRequest(url, method, headers, body, this.agent);
    } catch (e) {
      const code = (e as { code?: string }).code ?? "";
      if (CHAIN_ERRORS.has(code) && !this.triedChainFix) {
        this.triedChainFix = true;
        const u = new URL(url);
        const fixed = await agentWithFetchedIntermediates(u.hostname, Number(u.port) || 443);
        if (fixed) {
          this.agent = fixed;
          return await rawRequest(url, method, headers, body, this.agent);
        }
      }
      throw e;
    }
  }

  private async request(path: string, form?: Record<string, string>): Promise<string> {
    let url = path.startsWith("http") ? path : this.base + path;
    let method = form ? "POST" : "GET";
    let body: string | undefined = form ? new URLSearchParams(form).toString() : undefined;
    for (let hop = 0; hop < 6; hop++) {
      const res = await this.send(url, method, {
        "User-Agent": UA,
        Accept: "text/html",
        ...(body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
        ...(this.cookies.size ? { Cookie: this.cookieHeader() } : {}),
      }, body);
      this.keepCookies(res.headers);
      const loc = res.headers.location;
      if (res.status >= 300 && res.status < 400 && loc) {
        url = new URL(loc, url).toString();
        method = "GET";
        body = undefined;
        continue;
      }
      if (res.status < 200 || res.status >= 300) throw new Error(`EventHub answered ${res.status} for ${path}`);
      return res.body;
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
