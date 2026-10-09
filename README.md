# spacefast-agentic-readiness

A starter [Spacefast](https://spacefast.com) Space that AI agents can actually use. Unchanged, it scored **93** on [isitagentready.com](https://isitagentready.com) (Cloudflare) and **75** on [is-agentic.com](https://is-agentic.com) (Vercel) on its first scan. Most of the remaining is-agentic points are lost to Spacefast's CDN, not this code (see [Scores](#scores-and-what-they-cant-fix)).

Clone it, run one setup command, swap in your content, `git push` to your Space. No build step, no dependencies.

> Not on Spacefast? Use the sister repo, [web-agentic-readiness](https://github.com/wpvip-awesomeface/web-agentic-readiness). It has the same features and runs on any Node host.

## What you get

| Agents look for | This template ships |
| --- | --- |
| Markdown instead of HTML | `/` returns Markdown when asked for `Accept: text/markdown` (with `Vary: Accept`), plus `/index.md` |
| A map of the site | `llms.txt` with a "when to use" section, `sitemap.xml`, `robots.txt` with AI crawler rules and [Content Signals](https://contentsignals.org) |
| Discovery | Homepage `Link` header, `/.well-known/api-catalog` (RFC 9727), `ai-catalog.json`, agent skills index, MCP server card |
| An API | Versioned read-only JSON API (`/api/v1`), OpenAPI 3.1 with typed schemas, rate-limit headers |
| Tools | A real MCP server (Streamable HTTP) at `/mcp`, plus WebMCP tools in the page |
| Auth, if they want it | `auth.md` anonymous agent sign-up and a small OAuth 2.0 server (PKCE + client credentials, codes stored in the Space's database) |
| Errors they can read | 404s as Markdown, as RFC 9457 `problem+json` for the API, or as HTML for people |
| Trust signals | About, Contact and Privacy pages, and Organization JSON-LD with contact details and an address |

## Quick start

You need the Spacefast CLI (`sf`), logged in to a team, plus Node 20+ to run the setup script and tests.

```bash
git clone https://github.com/wpvip-awesomeface/spacefast-agentic-readiness my-site
cd my-site
node --test "tests/*.test.mjs"     # 8 checks on the handlers, no network
```

Make it yours. Every value in this command gets swapped site-wide:

```bash
node scripts/setup.mjs --name "My Site" --url https://my-site.space.fast --email hello@my-site.com \
  --street "1 Main St" --city Portland --region OR --postal 97201 --country US --country-name "United States"
```

Add `--dry-run` to preview. The address is optional, but checkers look for one in your Organization data.

### Create the Space and deploy

```bash
# 1. Create a Space (pick a slug; the URL becomes https://<slug>.space.fast)
sf api POST /v1/spaces -i '{"teamId":"<your team id>","slug":"my-site","title":"My Site","access":"public"}'
#    find your team id with: sf api GET /v1/me

# 2. Point this repo at the Space's git remote and push. Pushing main deploys to production.
git remote remove origin            # drop the GitHub remote you cloned from
sf git origin --space my-site
git push origin main
```

The push prints the build result and the live URL. Then check every endpoint:

```bash
bash tests/agent-endpoints.sh https://my-site.space.fast
```

### Let your AI agent do it

Open the repo in Claude Code, Cursor, Codex or any coding agent and say:

> Set this Space up for me.

[AGENTS.md](AGENTS.md) tells the agent what to ask you, what to run and which Spacefast traps to avoid.

## How it's wired (and the traps it avoids)

- **`/` is a function.** `_redirects` sends `/` to `functions/home.js` with a forced rewrite (`200!`), because the static `index.html` would otherwise win. `home.js` returns the HTML or `raw/index.txt`, depending on `Accept`.
- **Raw Markdown lives in `raw/*.txt`.** Spacefast renders `.md` files as HTML pages, so `_redirects` serves the raw text at `/index.md`, `/auth.md`, `/docs/api` and the skill's `SKILL.md`.
- **404s come from `functions/[...rest].js`.** On Spacefast a catch-all route outranks the exact function routes. So it imports them (`_router.js`) and hands `/home`, `/mcp`, `/agent/auth` and `/oauth/*` over before returning a 404. **Never** add a `/* … 404` rule to `_redirects`: it shadows `/mcp` and the other functions.
- **Previews can't test function changes.** Branch previews run the live worker, so changed function code returns 500 there. Unit-test functions locally (`node --test`), use previews only for static files, and check `/` and `/mcp` right after pushing to main.
- **`/` is never edge-cached.** Spacefast's edge cache ignores `Vary`, so the negotiated homepage is `private, no-cache`.

## Customize it

| You want to change | Edit |
| --- | --- |
| Look and feel | `styles.css` (tokens at the top) |
| Homepage | `index.html` **and** `raw/index.txt` (keep them saying the same thing) |
| About / Contact / Privacy | `about.html`, `contact.html`, `privacy.html` (keep each above 500 characters of real text) |
| API data | `api/*.json`, then `api/openapi.json` and `raw/api.txt` (served at `/docs/api`) |
| MCP tools | `functions/mcp.js` and `.well-known/mcp/server-card.json` |
| In-page agent tools (WebMCP) | the script at the bottom of `index.html` |
| What agents are told | `llms.txt`, `.well-known/ai-catalog.json`, `raw/skill.txt` |
| Clean URLs and headers | `_redirects` and `_headers` |

**Add a page:** create `your-page.html` (Spacefast serves it at `/your-page`) and list it in `sitemap.xml`.

**Add an API endpoint:** add `api/thing.json`, add `/api/v1/thing` and `/api/thing` rewrites to `_redirects`, add a path plus a named schema to `openapi.json`, and add a row to `raw/api.txt`.

**Add a function route:** create `functions/thing.js` **and** import it in `functions/_router.js` with its path. If you skip the second step, the catch-all will 404 it.

**Edited `raw/skill.txt`?** Run `node scripts/skill-digest.mjs` so the published digest still matches.

## Scores and what they can't fix

- **Bot blocking (is-agentic).** Spacefast's CDN challenges requests that claim to be `GPTBot`, `ClaudeBot` and other AI crawlers unless they come from those companies' own servers. Checkers that fake the user agent mark the site "blocked". Your `robots.txt` can't change that.
- **Rate limits.** The CDN returns `429` once one IP sends about 20 parallel requests to uncached URLs. Checkers do exactly that, so some checks fail at random from scan to scan, the homepage most often because it can't be cached. Rescan, or ask Spacefast about cache keys that include `Accept`.
- **Brand search** needs time, links and a distinctive name.
- **DNS-AID** and **Web Bot Auth** need DNS records and request-signing keys, which a `*.space.fast` subdomain can't provide. A custom domain can.

## License

MIT
