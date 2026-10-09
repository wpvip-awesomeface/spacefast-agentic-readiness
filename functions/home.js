// GET / : the HTML page for browsers, the Markdown copy when the client prefers text/markdown
// (Markdown for Agents / acceptmarkdown.com). Both come from static files, so each has one source.
// Responses vary by Accept; many edge caches ignore Vary, so this route is never shared-cached.
import { loadAsset } from "./_assets.js";
import { prefersMarkdown } from "./_negotiate.js";

// Where the two representations live. Spacefast renders .md files as HTML, so the Spacefast
// template keeps the raw Markdown at /raw/index.txt; the web template serves /index.md as is.
export const SOURCES = { html: "/index.html", markdown: "/raw/index.txt" };

async function serve(request, context, withBody) {
  const markdown = prefersMarkdown(request.headers.get("accept"));
  let asset;
  try {
    asset = await loadAsset(request, context, markdown ? SOURCES.markdown : SOURCES.html);
  } catch {
    return new Response("Not found\n", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
  }
  const headers = new Headers({
    "content-type": markdown ? "text/markdown; charset=utf-8" : "text/html; charset=utf-8",
    "cache-control": "private, no-cache",
    vary: "Accept",
    "x-content-type-options": "nosniff",
  });
  if (asset.etag) headers.set("etag", asset.etag);
  if (asset.link) headers.set("link", asset.link);
  if (markdown) headers.set("x-markdown-tokens", String(Math.ceil(asset.body.length / 4)));
  return new Response(withBody ? asset.body : null, { status: 200, headers });
}

export const GET = (request, context) => serve(request, context, true);
export const HEAD = (request, context) => serve(request, context, false);
