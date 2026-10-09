// /.well-known/mcp: GET returns the MCP server card, POST speaks MCP (same server as /mcp), so
// clients that probe the well-known path get a live handshake.
import { loadAsset } from "./_assets.js";
import * as mcp from "./mcp.js";

export async function GET(request, context) {
  const card = await loadAsset(request, context, "/.well-known/mcp/server-card.json");
  return new Response(card.body, { headers: { "content-type": "application/json; charset=utf-8", "access-control-allow-origin": "*", "cache-control": "public, max-age=300" } });
}
export const HEAD = async (request, context) => new Response(null, { headers: (await GET(request, context)).headers });
export const POST = mcp.POST;
export const OPTIONS = mcp.OPTIONS;
