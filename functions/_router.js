// One entry point for every dynamic route. ROUTES maps exact paths to handler modules; anything
// else gets the agent-friendly 404. Method not exported -> 405 with Allow.
// When you add a handler module, import it here and add its path.
import * as home from "./home.js";
import * as mcp from "./mcp.js";
import * as mcpManifest from "./mcp-manifest.js";
import * as agentAuth from "./agent/auth.js";
import * as oauthAuthorize from "./oauth/authorize.js";
import * as oauthToken from "./oauth/token.js";
import { notFound } from "./_not-found.js";

export const ROUTES = {
  "/home": home,
  "/mcp": mcp,
  "/mcp-manifest": mcpManifest, // Spacefast rewrites /.well-known/mcp here
  "/.well-known/mcp": mcpManifest,
  "/agent/auth": agentAuth,
  "/oauth/authorize": oauthAuthorize,
  "/oauth/token": oauthToken,
};
const METHODS = ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"];

export function route(request, context) {
  const path = new URL(request.url).pathname.replace(/\/+$/, "") || "/";
  const mod = ROUTES[path === "/" ? "/home" : path];
  if (!mod) return notFound(request);
  const handler = mod[request.method] || (request.method === "HEAD" ? mod.GET : undefined);
  if (handler) return handler(request, context);
  const allow = METHODS.filter((m) => typeof mod[m] === "function").join(", ");
  return new Response("Method not allowed\n", { status: 405, headers: { allow, "content-type": "text/plain; charset=utf-8" } });
}
