// Unit tests for functions/: run the real handlers through the catch-all router, reading this
// repo's files from disk instead of the network. Run: node --test "tests/*.test.mjs"
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import * as rest from "../functions/[...rest].js";

const ROOT = new URL("../", import.meta.url);
const file = (p) => readFileSync(new URL("." + p, ROOT), "utf8");
const context = { assets: async (p) => ({ body: file(p), etag: null, link: p === "/index.html" ? '</.well-known/api-catalog>; rel="api-catalog"' : null }) };
const call = (path, init = {}) => rest[init.method || "GET"](new Request("https://site.example" + path, init), context);
const type = (r) => r.headers.get("content-type") || "";

test("/ (rewritten to /home) negotiates HTML vs Markdown with Vary: Accept", async () => {
  const html = await call("/home", { headers: { accept: "text/html" } });
  assert.equal(html.status, 200);
  assert.match(type(html), /^text\/html/);
  assert.match(html.headers.get("link"), /api-catalog/);
  const md = await call("/home", { headers: { accept: "text/markdown" } });
  assert.match(type(md), /^text\/markdown/);
  assert.equal(md.headers.get("vary"), "Accept");
  assert.match(await md.text(), /^# /);
});

test("catch-all hands exact routes to their modules (the Spacefast trap)", async () => {
  const init = await call("/mcp", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18" } }) });
  assert.equal(init.status, 200);
  assert.equal((await init.json()).result.serverInfo.title.length > 0, true);
  assert.equal((await call("/mcp")).status, 405);
  const card = await call("/mcp-manifest");
  assert.equal(card.status, 200);
  assert.ok((await card.json()).transport);
  assert.equal((await call("/agent/auth", { method: "POST" })).status, 201);
  assert.equal((await call("/oauth/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: "grant_type=client_credentials" })).status, 200);
});

test("MCP tools read the site data", async () => {
  const rpc = async (body) => (await call("/mcp", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })).json();
  const list = await rpc({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "list_guides", arguments: {} } });
  assert.ok(!list.result.isError);
  const missing = await rpc({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "get_guide", arguments: { slug: "nope" } } });
  assert.equal(missing.result.isError, true);
});

test("unknown paths: Markdown, problem+json and HTML 404s", async () => {
  const md = await call("/nope", { headers: { accept: "text/markdown" } });
  assert.equal(md.status, 404);
  assert.match(type(md), /^text\/markdown/);
  const api = await call("/api/v1/nope");
  assert.match(type(api), /^application\/problem\+json/);
  assert.equal((await api.json()).code, "endpoint_not_found");
  const html = await call("/<b>", { headers: { accept: "text/html" } });
  assert.doesNotMatch(await html.text(), /<b>/);
});

test("PKCE authorization_code flow (memory store when there is no DB)", async () => {
  const verifier = "v".repeat(50);
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const params = new URLSearchParams({ response_type: "code", client_id: "t", redirect_uri: "http://localhost/cb", code_challenge: challenge, code_challenge_method: "S256" });
  const approve = await call("/oauth/authorize", { method: "POST", body: params.toString() });
  assert.equal(approve.status, 302);
  const code = new URL(approve.headers.get("location")).searchParams.get("code");
  const body = new URLSearchParams({ grant_type: "authorization_code", code, code_verifier: verifier, client_id: "t", redirect_uri: "http://localhost/cb" }).toString();
  const headers = { "content-type": "application/x-www-form-urlencoded" };
  assert.equal((await call("/oauth/token", { method: "POST", headers, body })).status, 200);
  assert.equal((await call("/oauth/token", { method: "POST", headers, body })).status, 400);
});

test("skill digest matches raw/skill.txt", () => {
  const index = JSON.parse(file("/.well-known/agent-skills/index.json"));
  const digest = "sha256:" + createHash("sha256").update(readFileSync(new URL("./raw/skill.txt", ROOT))).digest("hex");
  for (const s of index.skills) assert.equal(s.digest, digest, "run node scripts/skill-digest.mjs");
});

test("every route module the router imports exists as its own file", () => {
  const router = file("/functions/_router.js");
  for (const [, mod] of router.matchAll(/from "\.\/(.+?)"/g)) assert.ok(file("/functions/" + mod).length > 0, mod);
});

test("trust pages have real content (500+ characters)", () => {
  for (const f of ["about", "contact", "privacy"]) {
    const text = file(`/${f}.html`).replace(/<script[\s\S]*?<\/script>/g, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
    assert.ok(text.length >= 500, f);
  }
});
