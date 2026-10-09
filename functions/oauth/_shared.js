// Helpers for the demo OAuth server (RFC 8414 metadata at /.well-known/oauth-authorization-server).
// Tokens are opaque and unlock nothing extra: every resource on this site is public.
// Authorization codes are kept for CODE_TTL_SECONDS. On Spacefast they go in the Space's database
// (context.env.DB); anywhere else they live in memory, which is fine for one server process.
// Behind several instances, swap codeStore for your shared store (Redis, KV, SQL).

export const CODE_TTL_SECONDS = 300;
export const TOKEN_TTL_SECONDS = 3600;

export function randomToken(prefix) {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return prefix + Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function s256(verifier) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  let bin = "";
  for (const b of new Uint8Array(digest)) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// https anywhere, or http only for loopback (native and CLI clients).
export function validRedirect(uri) {
  if (!uri) return null;
  try {
    const u = new URL(uri);
    if (u.hash) return null;
    if (u.protocol === "https:") return u;
    if (u.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(u.hostname)) return u;
    return null;
  } catch {
    return null;
  }
}

const memory = new Map();

function sqlStore(db) {
  const ready = db
    .prepare("CREATE TABLE IF NOT EXISTS oauth_codes (code VARCHAR(80) PRIMARY KEY, client_id VARCHAR(255) NOT NULL, redirect_uri VARCHAR(2048) NOT NULL, code_challenge VARCHAR(128) NOT NULL, expires_at BIGINT NOT NULL)")
    .run();
  return {
    async put(code, row) {
      await ready;
      await db.prepare("INSERT INTO oauth_codes (code, client_id, redirect_uri, code_challenge, expires_at) VALUES (?, ?, ?, ?, ?)")
        .bind(code, row.client_id, row.redirect_uri, row.code_challenge, row.expires_at).run();
    },
    // Single use: the row is deleted before the caller checks it, so a replay always fails.
    async take(code) {
      await ready;
      const row = await db.prepare("SELECT client_id, redirect_uri, code_challenge, expires_at FROM oauth_codes WHERE code = ?").bind(code).first();
      await db.prepare("DELETE FROM oauth_codes WHERE code = ? OR expires_at < ?").bind(code, Math.floor(Date.now() / 1000)).run();
      return row || null;
    },
  };
}

const memoryStore = {
  async put(code, row) {
    memory.set(code, row);
  },
  async take(code) {
    const row = memory.get(code) || null;
    memory.delete(code);
    const now = Date.now() / 1000;
    for (const [k, v] of memory) if (v.expires_at < now) memory.delete(k);
    return row;
  },
};

export function codeStore(context) {
  const db = context && context.env && context.env.DB;
  return db ? sqlStore(db) : memoryStore;
}
