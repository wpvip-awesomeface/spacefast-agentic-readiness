# Agent instructions: spacefast-agentic-readiness

You are helping a user turn this template into their own agent-ready Spacefast Space. The template ships a working sample site called **Acme Guides**. Your job is to (1) collect a few facts, (2) run setup, (3) replace the sample content with theirs, (4) verify, (5) deploy, and then (6) build whatever they want on top without breaking the agent-readiness features.

Keep the user's effort low. Ask in one batch, offer sensible defaults, and do the work yourself.

## 1. Ask the user (one message)

Ask these together. Required items are marked with *.

1. **Site name*** (e.g. "Oak & Ivy Studio").
2. **What the site is, in one sentence***, plus who it's for.
3. **Space slug*** (the URL becomes `https://<slug>.space.fast`), or their custom domain if they have one. Check `sf whoami` works first; if not, they need to run `sf login`.
4. **Contact email*** to publish on the Contact page and in Organization data.
5. **Postal address** for the Contact page and Organization JSON-LD. Optional, but agent-readiness checkers look for it. If they decline, skip the address flags.
6. **What content the site should have**: the main things it lists or explains (products, guides, services, docs…), and whether they have existing text or a site to pull from.

Don't ask about anything technical you can decide yourself (file layout, schema details, headers).

## 2. Run setup

```bash
node scripts/setup.mjs --name "<name>" --url https://<slug>.space.fast --email <email> \
  [--street "<street>" --city "<city>" --region "<state/region>" --postal "<postcode>" --country <2-letter> --country-name "<country>"]
```

This swaps the name, URL, email and address everywhere, renames the agent skill folder and recomputes its digest. Run it once. If a value changes later, edit the files directly, or `git checkout .` and rerun it.

## 3. Replace the sample content

Work through these in order. Write like a person: plain sentences, no marketing filler, no em dashes, no "Whether you're…" openers.

1. **Data first:** `api/guides.json` holds the site's main items. If the user's site isn't guides, rename the concept (e.g. `products`, `services`) in **all** of these: `api/*.json`, `api/openapi.json` (paths, schema names), `_redirects` (API rewrites), `functions/mcp.js` (tool names and descriptions), `.well-known/mcp/server-card.json`, `raw/api.txt`, `index.html` (list markup + the WebMCP script), `raw/index.txt`, `llms.txt`, `tests/handlers.test.mjs`, `tests/agent-endpoints.sh`.
2. **Homepage:** `index.html` and `raw/index.txt` must say the same thing (the Markdown is what agents read). Update the JSON-LD `@graph` (WebSite, Organization description, Article, ItemList).
3. **`functions/_site.js`:** set `SITE_BLURB` to a short lowercase phrase ("a studio that designs small gardens").
4. **About, Contact, Privacy:** rewrite with the user's facts. Keep each over 500 characters of real text. Privacy must match reality: if they add analytics, forms or third-party scripts, say so.
5. **Agent-facing text:** `llms.txt` ("When to use" says what the site is right and wrong for), `.well-known/ai-catalog.json` (`representativeQueries` are real questions people ask), `raw/skill.txt` (served as the skill's `SKILL.md`). After editing it, run `node scripts/skill-digest.mjs`.
6. **Remove leftovers:** `grep -ri "acme" --exclude-dir=scripts --exclude-dir=.git .` should only match README/AGENTS.

## 4. Verify locally

```bash
node --test "tests/*.test.mjs"     # must pass
```

To eyeball the pages, serve the folder with any static server (for example `python3 -m http.server`). Function routes won't run locally, which is fine; the tests cover them.

## 5. Create the Space and deploy

Pushing `main` deploys to production, so confirm with the user first.

```bash
sf api GET /v1/me                                   # find the team id
sf api POST /v1/spaces -i '{"teamId":"<team>","slug":"<slug>","title":"<name>","access":"public"}'
git remote remove origin                            # the GitHub remote they cloned from
sf git origin --space <slug>
git push origin main
```

Right after the push, check the two routes that break first, then everything:

```bash
curl -s -o /dev/null -w '%{http_code}\n' https://<slug>.space.fast/          # 200
bash tests/agent-endpoints.sh https://<slug>.space.fast                       # every line "ok"
```

If `/` or `/mcp` fails, revert the last commit and push again, then debug locally.

Then suggest they run the URL through https://isitagentready.com and https://is-agentic.com. Explain failures using the README section "Scores and what they can't fix". On `*.space.fast`, bot-blocking and random 429s come from the platform CDN, not the code.

## 6. Building on top: rules that keep the score

Change anything you like, but keep these true:

- `GET /` with `Accept: text/markdown` returns Markdown with `Content-Type: text/markdown` and `Vary: Accept`. With `Accept: text/html`, it returns HTML. That's `functions/home.js` plus the `/ /home 200!` rewrite.
- The homepage keeps its `Link` header (the `/` and `/index.html` blocks in `_headers`).
- Unknown paths return 404 (Markdown, problem+json, or HTML by `Accept`) from `functions/[...rest].js`.
- **Every new function file is also imported in `functions/_router.js`.** Otherwise the catch-all 404s it.
- **Never add `/* ... 404` (or any splat 404 rule) to `_redirects`.** It shadows function routes like `/mcp`.
- **Don't trust branch previews for function changes.** They run the live worker. Test locally, then check live right after pushing main.
- `.md` files get rendered as HTML by Spacefast. Put raw Markdown in `raw/*.txt` and add a forced rewrite.
- Every new page goes in `sitemap.xml` and, if it matters to agents, in `llms.txt`.
- Every new API endpoint gets `/api/v1/...` and unversioned rewrites, a named schema in `openapi.json` and a row in `raw/api.txt`. Errors stay `application/problem+json`.
- Every new MCP tool is listed in `server-card.json`.
- `robots.txt` keeps allowing AI crawlers unless the user explicitly wants to block them.
- Never commit secrets.

When you add a feature, add a test in `tests/handlers.test.mjs` and a line in `tests/agent-endpoints.sh`.

## File map

```
_redirects                 rewrites: / -> /home, raw Markdown URLs, API v1 + aliases
_headers                   content types, CORS, rate-limit headers, homepage Link header
functions/                 Spacefast functions (Web-standard handlers)
  [...rest].js             catch-all: hands exact routes to _router.js, else 404
  _router.js               exact dynamic routes + 404 fallback (add new function files here)
  home.js                  "/" HTML vs Markdown negotiation
  mcp.js                   MCP server (Streamable HTTP)
  agent/auth.js            anonymous agent sign-up (auth.md)
  oauth/                   OAuth 2.0: authorize (PKCE), token, shared helpers (codes in env.DB)
  _not-found.js            agent-friendly 404s
  _site.js                 site name/blurb used by handlers
raw/                       raw Markdown: index (homepage), auth.md, API docs, SKILL.md
index.html, about.html, contact.html, privacy.html, styles.css, favicon.svg
api/                       JSON API data + openapi.json
.well-known/               api-catalog, ai-catalog, agent skills, MCP card, OAuth metadata
scripts/setup.mjs          one-time rebrand
scripts/skill-digest.mjs   recompute SKILL.md digest
tests/handlers.test.mjs    unit tests (node --test "tests/*.test.mjs")
tests/agent-endpoints.sh   live checks against the deployed Space
```
