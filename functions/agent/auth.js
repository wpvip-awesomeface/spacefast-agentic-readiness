// Anonymous agent sign-up, described in /auth.md. Real but optional: everything on the site is
// public, so the key grants nothing extra. Keys are random and never stored.
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, accept",
};

export async function POST(request) {
  const site = new URL("/", request.url).href;
  const key = "anon_" + crypto.randomUUID().replace(/-/g, "");
  return Response.json(
    {
      identity_type: "anonymous",
      credential_type: "api_key",
      api_key: key,
      token_type: "Bearer",
      expires_at: null,
      scopes: [],
      access: "Everything on this site is public. This key works everywhere but unlocks nothing extra.",
      usage: "Optional. Send it as Authorization: Bearer <api_key>, or send nothing at all.",
      revocation: "Keys are not stored. Discard the key to revoke it.",
      docs: new URL("/auth.md", site).href,
    },
    { status: 201, headers: { ...CORS, "Cache-Control": "no-store" } },
  );
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}
