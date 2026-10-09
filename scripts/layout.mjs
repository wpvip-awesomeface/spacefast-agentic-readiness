// Where things live in this template, for the setup scripts.
export const LAYOUT = {
  siteRoots: [".well-known", "api", "functions", "raw", "index.html", "about.html", "contact.html", "privacy.html", "llms.txt", "robots.txt", "sitemap.xml", "_redirects", "_headers"],
  skillsDir: ".well-known/agent-skills",
  skillSource: () => "raw/skill.txt", // served at /.well-known/agent-skills/<slug>/SKILL.md by _redirects
  sitemap: "sitemap.xml",
};
