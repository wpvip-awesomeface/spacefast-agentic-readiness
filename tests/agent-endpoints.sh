#!/usr/bin/env bash
# Live check of every agent-facing endpoint on a deployed site. Exits non-zero on any failure.
# Usage: bash tests/agent-endpoints.sh https://your-site.example
# Add a line here whenever you add an endpoint or page.
set -u
U=${1:?usage: agent-endpoints.sh <base-url>}; U=${U%/}
fail=0
expect() { # name, want-status, want-content-type-prefix, curl args...
  local name=$1 want=$2 type=$3; shift 3
  local got; got=$(curl -sS -o /dev/null -w '%{http_code} %{content_type}' "$@")
  if [[ $got == "$want $type"* ]]; then echo "ok   $name ($got)"; else echo "FAIL $name: want $want $type, got $got"; fail=1; fi
}
has_header() { # name, header-regex, curl args...
  local name=$1 re=$2; shift 2
  if curl -sS -D - -o /dev/null "$@" | tr -d '\r' | grep -Eqi "$re"; then echo "ok   $name"; else echo "FAIL $name"; fail=1; fi
}

expect "/ as HTML"                 200 text/html          -H 'Accept: text/html' "$U/"
expect "/ as Markdown"             200 text/markdown      -H 'Accept: text/markdown' "$U/"
has_header "/ Markdown has Vary: Accept" '^vary:.*accept[[:space:]]*(,|$)' -H 'Accept: text/markdown' "$U/"
has_header "/ has Link api-catalog"      '^link:.*rel="api-catalog"' -H 'Accept: text/html' "$U/"
expect "/index.md"                 200 text/markdown      "$U/index.md"
expect "/llms.txt"                 200 text/plain         "$U/llms.txt"
expect "/robots.txt"               200 text/plain         "$U/robots.txt"
expect "/sitemap.xml"              200 application/xml    "$U/sitemap.xml"
for p in about contact privacy; do expect "/$p" 200 text/html "$U/$p"; done
for p in api api/v1 api/v1/guides api/v1/health api/guides api/openapi.json; do expect "/$p" 200 application/json "$U/$p"; done
has_header "/api/v1/guides has RateLimit-Policy" '^ratelimit-policy:' "$U/api/v1/guides"
expect "/docs/api"                 200 text/markdown      "$U/docs/api"
expect "/auth.md"                  200 text/markdown      "$U/auth.md"
expect "api-catalog"               200 application/linkset+json "$U/.well-known/api-catalog"
expect "ai-catalog"                200 application/json   "$U/.well-known/ai-catalog.json"
expect "agent-skills index"        200 application/json   "$U/.well-known/agent-skills/index.json"
skill=$(curl -sS "$U/.well-known/agent-skills/index.json" | sed -n 's/.*"url": *"\([^"]*SKILL\.md\)".*/\1/p' | head -1)
expect "SKILL.md"                  200 text/markdown      "${skill:-$U/missing-skill}"
expect "MCP server card"           200 application/json   "$U/.well-known/mcp/server-card.json"
expect "oauth-authorization-server" 200 application/json  "$U/.well-known/oauth-authorization-server"
expect "oauth-protected-resource"  200 application/json   "$U/.well-known/oauth-protected-resource"
expect "jwks"                      200 application/jwk-set+json "$U/.well-known/jwks.json"
expect "/mcp initialize"           200 application/json   -X POST -H 'content-type: application/json' -H 'accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"check","version":"1"}}}' "$U/mcp"
expect "/.well-known/mcp card"     200 application/json   "$U/.well-known/mcp"
expect "/.well-known/mcp initialize" 200 application/json -X POST -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"check","version":"1"}}}' "$U/.well-known/mcp"
expect "/og.png"                   200 image/png          "$U/og.png"
expect "/mcp GET is 405"           405 ""                 "$U/mcp"
expect "/agent/auth POST"          201 application/json   -X POST "$U/agent/auth"
expect "/oauth/token client_credentials" 200 application/json -X POST -H 'content-type: application/x-www-form-urlencoded' -d 'grant_type=client_credentials' "$U/oauth/token"
expect "404 as Markdown"           404 text/markdown      -H 'Accept: text/markdown' "$U/__missing-page"
expect "404 as HTML"               404 text/html          -H 'Accept: text/html' "$U/__missing-page"
expect "404 API as problem+json"   404 application/problem+json "$U/api/v1/__missing"
exit $fail
