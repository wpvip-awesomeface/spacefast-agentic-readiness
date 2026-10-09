import { CODE_TTL_SECONDS, codeStore, randomToken, validRedirect } from "./_shared.js";
import { SITE_NAME } from "../_site.js";

const esc = (s) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

function read(p) {
  if (p.get("response_type") !== "code") return "response_type must be code";
  const clientId = p.get("client_id") || "";
  if (!clientId || clientId.length > 255) return "client_id is required";
  const redirect = validRedirect(p.get("redirect_uri"));
  if (!redirect) return "redirect_uri must be https (or http on localhost)";
  const challenge = p.get("code_challenge") || "";
  if (p.get("code_challenge_method") !== "S256" || !/^[A-Za-z0-9_-]{43,128}$/.test(challenge)) return "PKCE with code_challenge_method=S256 is required";
  return { clientId, redirect, state: (p.get("state") || "").slice(0, 512), challenge };
}

const page = (body, status = 200) =>
  new Response(
    '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Authorize | ' + esc(SITE_NAME) + '</title><link rel="stylesheet" href="/styles.css"></head><body><main class="wrap narrow">' + body + "</main></body></html>",
    { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-frame-options": "DENY" } },
  );

export async function GET(request) {
  const r = read(new URL(request.url).searchParams);
  if (typeof r === "string") return page("<h1>Can't authorize</h1><p>" + esc(r) + ".</p>", 400);
  const hidden = ["response_type=code", "client_id", "redirect_uri", "state", "code_challenge", "code_challenge_method"]
    .map((k) => k.split("=")[0])
    .map((k) => '<input type="hidden" name="' + k + '" value="' + esc(new URL(request.url).searchParams.get(k) || "") + '">')
    .join("");
  return page(
    "<h1>Allow access?</h1><p><code>" + esc(r.clientId) + "</code> wants an access token for " + esc(SITE_NAME) + ".</p>" +
      "<p>Everything on this site is already public, so the token unlocks nothing extra. You will be sent back to <code>" + esc(r.redirect.host) + "</code>.</p>" +
      '<form method="post">' + hidden + '<button type="submit">Allow and continue</button></form>',
  );
}

export async function POST(request, context) {
  const form = new URLSearchParams(await request.text());
  const r = read(form);
  if (typeof r === "string") return page("<h1>Can't authorize</h1><p>" + esc(r) + ".</p>", 400);
  const code = randomToken("code_");
  await codeStore(context).put(code, { client_id: r.clientId, redirect_uri: r.redirect.href, code_challenge: r.challenge, expires_at: Math.floor(Date.now() / 1000) + CODE_TTL_SECONDS });
  const back = new URL(r.redirect.href);
  back.searchParams.set("code", code);
  if (r.state) back.searchParams.set("state", r.state);
  back.searchParams.set("iss", new URL("/", request.url).origin);
  return new Response(null, { status: 302, headers: { location: back.href, "cache-control": "no-store" } });
}
