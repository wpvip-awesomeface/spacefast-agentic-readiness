#!/usr/bin/env node
// Rebrand the template from the "Acme Guides" sample to your own site in one pass.
// It swaps the site name, URL, contact email and postal address everywhere they appear,
// renames the agent skill folder, recomputes the skill digest and refreshes sitemap dates.
// Your content (guides, pages, API data) is yours to edit afterwards; AGENTS.md explains how.
//
//   node scripts/setup.mjs --name "My Site" --url https://example.com --email hi@example.com \
//     --street "1 Main St" --city Portland --region OR --postal 97201 --country US --country-name "United States"
//   node scripts/setup.mjs --config site.json      (same keys, as JSON)
//   add --dry-run to see what would change without writing anything.

import { readFileSync, writeFileSync, readdirSync, statSync, renameSync, existsSync } from "node:fs";
import { join, relative, extname } from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { LAYOUT } from "./layout.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SAMPLE = {
  name: "Acme Guides",
  url: "https://acme-guides.example",
  slug: "acme-guides",
  email: "hello@acme-guides.example",
  street: "123 Example Street",
  city: "Springfield",
  region: "OR",
  postal: "97477",
  country: "US",
  countryName: "United States",
};
const TEXT = new Set([".html", ".css", ".js", ".mjs", ".json", ".txt", ".md", ".xml", ".svg", ""]);

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const key = a.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    if (key === "dryRun") { out.dryRun = true; continue; }
    out[key] = argv[++i];
  }
  if (out.config) Object.assign(out, JSON.parse(readFileSync(out.config, "utf8")), { config: undefined });
  return out;
}

function fail(msg) {
  console.error("setup: " + msg);
  process.exit(1);
}

function validate(o) {
  const v = { ...o };
  for (const k of ["name", "url", "email"]) if (!v[k] || !String(v[k]).trim()) fail("--" + k + " is required");
  let u;
  try { u = new URL(v.url); } catch { fail("--url must be a full URL like https://example.com"); }
  if (u.protocol !== "https:" && u.hostname !== "localhost") fail("--url must use https");
  v.url = u.origin;
  v.host = u.host;
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.email)) fail("--email does not look like an email address");
  v.slug = (v.slug || v.name).toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
  if (!v.slug) fail("could not make a slug from the name; pass --slug");
  for (const k of ["street", "city", "region", "postal", "country", "countryName"]) v[k] = v[k] == null ? "" : String(v[k]).trim();
  if (v.country && !/^[A-Z]{2}$/.test(v.country)) fail("--country must be a 2-letter code like US or GB");
  return v;
}

function walk(dir, files = []) {
  if (!existsSync(dir)) return files;
  if (statSync(dir).isFile()) return TEXT.has(extname(dir)) ? [...files, dir] : files;
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".git") continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, files);
    else if (TEXT.has(extname(name))) files.push(p);
  }
  return files;
}

// Ordered: longer, more specific strings first so shorter ones can't clobber them.
function replacements(v) {
  const s = SAMPLE;
  const host = new URL(s.url).host;
  const pairs = [
    [s.url, v.url],
    [s.email, v.email],
    ["did:web:" + host, "did:web:" + v.host.replace(":", "%3A")],
    ["urn:air:" + host, "urn:air:" + v.host],
    [host, v.host],
    [s.name + " API", v.name + " API"],
    [s.name, v.name],
    ["/agent-skills/" + s.slug, "/agent-skills/" + v.slug],
    [":skill:" + s.slug, ":skill:" + v.slug],
    [s.slug, v.slug, '"name": "', '"'],
    [s.slug, v.slug, "name: ", "\n"],
    [s.slug, v.slug, 'SERVER_SLUG = "', '"'],
  ];
  // Postal address: the contact page block and the JSON-LD fields.
  if (v.street) pairs.push([s.street, v.street]);
  if (v.city || v.region || v.postal) pairs.push([`${s.city}, ${s.region} ${s.postal}`, [v.city && v.city + ",", v.region, v.postal].filter(Boolean).join(" ")]);
  if (v.countryName) pairs.push(["<br>\n" + s.countryName + "\n", "<br>\n" + v.countryName + "\n"]);
  for (const [k, field] of [["city", "addressLocality"], ["region", "addressRegion"], ["postal", "postalCode"], ["country", "addressCountry"]]) {
    if (v[k]) pairs.push([s[k], v[k], `"${field}": "`, '"']);
  }
  return pairs;
}

const escHtml = (t) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const escJson = (t) => JSON.stringify(t).slice(1, -1);
// A pair is [from, to] or [from, to, before, after]: before/after are literal context that must
// surround the value (e.g. a JSON key), and only the value itself gets escaped.
const swap = (text, pairs, esc) =>
  pairs.reduce((acc, [from, to, pre = "", post = ""]) => acc.split(pre + esc(from) + post).join(pre + esc(to) + post), text);

// Replace with the escaping each file type needs: JSON-escaped in .json/.js and inside <script>
// blocks, HTML-escaped in the rest of .html/.xml/.svg, raw in Markdown and text.
function rewrite(text, ext, pairs, v) {
  let out;
  if (ext === ".json" || ext === ".js" || ext === ".mjs") out = swap(text, pairs, escJson);
  else if (ext === ".html" || ext === ".xml" || ext === ".svg") {
    out = text.split(/(<script\b[\s\S]*?<\/script>)/).map((part, i) => swap(part, pairs, i % 2 ? escJson : escHtml)).join("");
  } else out = swap(text, pairs, (t) => t);
  // A blank region drops the JSON-LD field instead of keeping the sample value.
  if (!v.region && (v.city || v.street)) out = out.replace(/\n\s*"addressRegion": "[^"]*",/g, "");
  return out;
}

function main() {
  const v = validate(parseArgs(process.argv.slice(2)));
  const dry = !!parseArgs(process.argv.slice(2)).dryRun;
  const pairs = replacements(v);
  const files = LAYOUT.siteRoots.flatMap((r) => walk(join(ROOT, r)));
  let changed = 0;
  for (const f of files) {
    const before = readFileSync(f, "utf8");
    const after = rewrite(before, extname(f), pairs, v);
    if (after !== before) {
      changed++;
      if (!dry) writeFileSync(f, after);
      console.log((dry ? "would update " : "updated ") + relative(ROOT, f));
    }
  }
  // Rename the skill folder and recompute its digest (agent-skills discovery v0.2.0).
  const skillsDir = join(ROOT, LAYOUT.skillsDir);
  const from = join(skillsDir, SAMPLE.slug), to = join(skillsDir, v.slug);
  if (v.slug !== SAMPLE.slug && existsSync(from)) {
    if (!dry) renameSync(from, to);
    console.log((dry ? "would rename " : "renamed ") + relative(ROOT, from) + " -> " + relative(ROOT, to));
  }
  if (!dry) refreshSkillDigest(v.slug);
  if (!dry) refreshSitemapDates();
  console.log(`\n${dry ? "Dry run: " : ""}${changed} file(s) ${dry ? "would change" : "changed"}. Next: replace the sample content (see AGENTS.md), then run the tests.`);
}

export function refreshSkillDigest(slug) {
  const skillFile = join(ROOT, LAYOUT.skillSource(slug));
  const index = join(ROOT, LAYOUT.skillsDir, "index.json");
  if (!existsSync(skillFile) || !existsSync(index)) return;
  const digest = "sha256:" + createHash("sha256").update(readFileSync(skillFile)).digest("hex");
  const data = JSON.parse(readFileSync(index, "utf8"));
  for (const s of data.skills || []) s.digest = digest;
  writeFileSync(index, JSON.stringify(data, null, 2) + "\n");
}

function refreshSitemapDates() {
  const p = join(ROOT, LAYOUT.sitemap);
  if (!existsSync(p)) return;
  const today = new Date().toISOString().slice(0, 10);
  writeFileSync(p, readFileSync(p, "utf8").replace(/<lastmod>[^<]*<\/lastmod>/g, `<lastmod>${today}</lastmod>`));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
