#!/usr/bin/env node
// Recompute the sha256 digest in .well-known/agent-skills/index.json after you edit SKILL.md.
// Usage: node scripts/skill-digest.mjs [slug]   (defaults to the only skill folder)
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { LAYOUT } from "./layout.mjs";
import { refreshSkillDigest } from "./setup.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const dir = join(ROOT, LAYOUT.skillsDir);
const slug = process.argv[2] || readdirSync(dir).find((n) => statSync(join(dir, n)).isDirectory());
refreshSkillDigest(slug);
console.log("digest updated for " + slug);
