import { TOKEN_TTL_SECONDS, codeStore, randomToken, s256, validRedirect } from "./_shared.js";

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "content-type, accept" };
const reply = (body, status = 200) =>
  Response.json(body, { status, headers: { ...CORS, "cache-control": "no-store", pragma: "no-cache" } });
const error = (code, description, status = 400) => reply({ error: code, error_description: description }, status);
const issue = () =>
  reply({
    access_token: randomToken("at_"),
    token_type: "Bearer",
    expires_in: TOKEN_TTL_SECONDS,
    scope: "",
    note: "Everything on this site is public. This token unlocks nothing extra.",
  });

export async function POST(request, context) {
  const type = request.headers.get("content-type") || "";
  if (!type.includes("application/x-www-form-urlencoded")) return error("invalid_request", "Send application/x-www-form-urlencoded");
  const p = new URLSearchParams(await request.text());
  const grant = p.get("grant_type");

  if (grant === "client_credentials") return issue();

  if (grant === "authorization_code") {
    const code = p.get("code") || "";
    const verifier = p.get("code_verifier") || "";
    const clientId = p.get("client_id") || "";
    const redirect = validRedirect(p.get("redirect_uri"));
    if (!code || !verifier || !clientId || !redirect) return error("invalid_request", "code, code_verifier, client_id and redirect_uri are required");
    const row = await codeStore(context).take(code);
    if (!row || Number(row.expires_at) < Date.now() / 1000) return error("invalid_grant", "Code is invalid, used or expired");
    if (row.client_id !== clientId || row.redirect_uri !== redirect.href) return error("invalid_grant", "client_id or redirect_uri does not match");
    if ((await s256(verifier)) !== row.code_challenge) return error("invalid_grant", "PKCE verification failed");
    return issue();
  }

  return error("unsupported_grant_type", "Use authorization_code or client_credentials");
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}
