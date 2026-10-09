// MCP server: stateless Streamable HTTP, read-only, no auth. Tools read the site's own JSON
// data (/api/guides.json), so the API, the MCP server and the pages share one source of truth.
// To add a tool: add it to TOOLS, handle it in callTool, list it in .well-known/mcp/server-card.json.
import { loadJson } from "./_assets.js";
import { SITE_NAME, SERVER_SLUG } from "./_site.js";

const PROTOCOL_VERSIONS = ["2025-06-18", "2025-03-26", "2024-11-05"];
const SERVER_INFO = { name: SERVER_SLUG, title: SITE_NAME, version: "1.0.0" };
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, accept, mcp-protocol-version, mcp-session-id",
};
const READ_ONLY = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };

const TOOLS = [
  {
    name: "list_guides",
    title: "List guides",
    description: "List every guide on " + SITE_NAME + " with its slug, title and one-line summary.",
    inputSchema: { type: "object", properties: {} },
    annotations: READ_ONLY,
  },
  {
    name: "get_guide",
    title: "Get a guide",
    description: "Get one guide by slug, including its steps.",
    inputSchema: { type: "object", properties: { slug: { type: "string", description: "The guide's slug, from list_guides." } }, required: ["slug"] },
    annotations: READ_ONLY,
  },
];

const json = (body, status = 200) => Response.json(body, { status, headers: CORS });
const ok = (id, result) => ({ jsonrpc: "2.0", id, result });
const fail = (id, code, message) => ({ jsonrpc: "2.0", id: id ?? null, error: { code, message } });
const text = (t) => ({ content: [{ type: "text", text: t }] });

async function callTool(params, request, context) {
  const args = (params && params.arguments) || {};
  try {
    const { guides } = await loadJson(request, context, "/api/guides.json");
    switch (params && params.name) {
      case "list_guides":
        return { ...text(guides.map((g) => g.slug + ": " + g.title + ". " + g.summary).join("\n")), structuredContent: { guides } };
      case "get_guide": {
        const guide = guides.find((g) => g.slug === String(args.slug || ""));
        if (!guide) return { ...text("No guide with slug " + JSON.stringify(args.slug) + ". Call list_guides for the slugs."), isError: true };
        return { ...text("# " + guide.title + "\n\n" + guide.summary + "\n\n" + guide.steps.map((s, i) => i + 1 + ". " + s).join("\n")), structuredContent: { guide } };
      }
      default:
        return { ...text("Unknown tool: " + String(params && params.name)), isError: true };
    }
  } catch {
    return { ...text("Could not load the site data. Try again shortly."), isError: true };
  }
}

async function handle(msg, request, context) {
  if (!msg || typeof msg !== "object" || msg.jsonrpc !== "2.0" || typeof msg.method !== "string") return fail(msg && msg.id, -32600, "Invalid Request");
  if (!("id" in msg)) return null; // a notification, e.g. notifications/initialized
  switch (msg.method) {
    case "initialize": {
      const asked = msg.params && msg.params.protocolVersion;
      return ok(msg.id, {
        protocolVersion: PROTOCOL_VERSIONS.includes(asked) ? asked : PROTOCOL_VERSIONS[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER_INFO,
        instructions: "Read-only tools for " + SITE_NAME + " (" + new URL("/", request.url).href + "). No authentication needed.",
      });
    }
    case "ping":
      return ok(msg.id, {});
    case "tools/list":
      return ok(msg.id, { tools: TOOLS });
    case "tools/call":
      return ok(msg.id, await callTool(msg.params, request, context));
    default:
      return fail(msg.id, -32601, "Method not found: " + msg.method);
  }
}

export async function POST(request, context) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json(fail(null, -32700, "Parse error"), 400);
  }
  if (Array.isArray(body)) {
    const out = (await Promise.all(body.map((m) => handle(m, request, context)))).filter(Boolean);
    return out.length ? json(out) : new Response(null, { status: 202, headers: CORS });
  }
  const out = await handle(body, request, context);
  return out ? json(out) : new Response(null, { status: 202, headers: CORS });
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}
