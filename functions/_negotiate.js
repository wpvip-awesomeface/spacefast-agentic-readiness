// Accept header helpers. A type's weight is its q value (1 when absent, 0 when not listed).
export function weight(accept, types) {
  let best = 0;
  for (const part of (accept || "").split(",")) {
    const [type, ...params] = part.trim().toLowerCase().split(";");
    if (!types.includes(type.trim())) continue;
    const q = params.map((p) => p.trim()).find((p) => p.startsWith("q="));
    best = Math.max(best, q ? Number(q.slice(2)) || 0 : 1);
  }
  return best;
}

const MD = ["text/markdown", "text/x-markdown"];
const HTML = ["text/html", "application/xhtml+xml"];
const JSONT = ["application/json", "application/problem+json"];

// Markdown wins when it is asked for at least as strongly as HTML.
export function prefersMarkdown(accept) {
  const md = weight(accept, MD);
  return md > 0 && md >= weight(accept, HTML);
}

// "markdown" | "json" | "html" for error pages.
export function pickErrorFormat(accept, path) {
  if (path === "/api" || path.startsWith("/api/")) return "json";
  const md = weight(accept, MD), html = weight(accept, HTML), json = weight(accept, JSONT);
  if (md > 0 && md >= html && md >= json) return "markdown";
  if (json > 0 && json > html) return "json";
  return "html";
}
