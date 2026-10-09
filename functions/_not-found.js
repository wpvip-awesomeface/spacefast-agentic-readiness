// Agent-friendly 404s: one answer in three formats.
// - /api/* or Accept: application/json -> RFC 9457 problem+json with a code and a hint
// - Accept: text/markdown -> Markdown that links to the guide, llms.txt and the sitemap
// - anything else -> a small HTML page
import { SITE_NAME, SITE_BLURB } from "./_site.js";
import { pickErrorFormat } from "./_negotiate.js";

const esc = (s) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

function problem(path, origin) {
  const api = path === "/api" || path.startsWith("/api/");
  return JSON.stringify({
    type: origin + "/docs/api#errors",
    title: "Not Found",
    status: 404,
    code: api ? "endpoint_not_found" : "page_not_found",
    detail: api ? "No API endpoint exists at " + path + "." : "Nothing is published at " + path + ".",
    instance: path,
    hint: api ? "List the endpoints with GET /api/v1, or read /api/openapi.json." : "Start from /llms.txt or /index.md.",
    links: { api: origin + "/api/v1", openapi: origin + "/api/openapi.json", docs: origin + "/docs/api", llms: origin + "/llms.txt" },
  }, null, 2) + "\n";
}

function markdown(path, origin) {
  return [
    "# 404: Page not found",
    "",
    "Nothing is published at `" + path + "` on " + SITE_NAME + ", " + SITE_BLURB + ".",
    "",
    "Try one of these instead:",
    "",
    "- [The site as Markdown](" + origin + "/index.md)",
    "- [llms.txt](" + origin + "/llms.txt)",
    "- [API docs](" + origin + "/docs/api)",
    "- [Sitemap](" + origin + "/sitemap.xml)",
    "",
  ].join("\n");
}

function html(path) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Page not found | ${esc(SITE_NAME)}</title>
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="/styles.css">
</head>
<body>
<main class="wrap narrow error-page">
<p class="eyebrow">404</p>
<h1>Page not found</h1>
<p>Nothing is published at <code>${esc(path)}</code>.</p>
<p><a href="/">Home</a> · <a href="/index.md">Markdown</a> · <a href="/llms.txt">llms.txt</a> · <a href="/sitemap.xml">Sitemap</a></p>
</main>
</body>
</html>
`;
}

const TYPES = { json: "application/problem+json; charset=utf-8", markdown: "text/markdown; charset=utf-8", html: "text/html; charset=utf-8" };
const BODIES = { json: problem, markdown, html };

export function notFound(request) {
  const url = new URL(request.url);
  const kind = pickErrorFormat(request.headers.get("accept"), url.pathname);
  const headers = { "content-type": TYPES[kind], "cache-control": "private, no-cache", vary: "Accept", "x-content-type-options": "nosniff" };
  if (kind === "json") headers["access-control-allow-origin"] = "*";
  const body = request.method === "HEAD" ? null : BODIES[kind](url.pathname, url.origin);
  return new Response(body, { status: 404, headers });
}
