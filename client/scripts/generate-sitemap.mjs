import fs from "node:fs/promises";
import path from "node:path";

function stripTrailingSlashes(value) {
  return String(value || "").trim().replace(/\/+$/, "");
}

function computeOrigin() {
  const explicit = stripTrailingSlashes(process.env.SITE_ORIGIN);
  if (explicit) return explicit;

  const webDomainRaw = String(process.env.WEB_DOMAIN || "").trim();
  if (!webDomainRaw) return "";

  if (webDomainRaw.startsWith("http://") || webDomainRaw.startsWith("https://")) {
    return stripTrailingSlashes(webDomainRaw);
  }

  const scheme =
    String(process.env.SITE_SCHEME || "").trim() ||
    (/^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(webDomainRaw) ? "http" : "https");

  return stripTrailingSlashes(`${scheme}://${webDomainRaw}`);
}

function safeHostFromOrigin(origin) {
  try {
    return new URL(origin).host;
  } catch {
    return "";
  }
}

function splitCsv(value) {
  return String(value || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

function toLoc(origin, pathname) {
  const p = String(pathname || "").trim();
  if (!origin || !p) return "";
  if (p.startsWith("/")) return `${origin}${p}`;
  return `${origin}/${p}`;
}

const origin = computeOrigin();
if (!origin) {
  console.log("[sitemap] SITE_ORIGIN is not set; skipping sitemap.xml generation.");
  process.exit(0);
}

const buildDir = path.resolve(process.cwd(), "build");
const outPath = path.join(buildDir, "sitemap.xml");
const robotsOutPath = path.join(buildDir, "robots.txt");
const robotsPublicPath = path.resolve(process.cwd(), "public", "robots.txt");

try {
  await fs.access(buildDir);
} catch {
  console.log(`[sitemap] build/ folder not found at ${buildDir}; skipping.`);
  process.exit(0);
}

const basePaths = ["/", "/события", "/команда", "/контакты"];

let slugs = [];
const sources = [
  String(process.env.SEO_EVENTS_JSON_URL || "").trim(),
  "http://minio:9000/orchestra-media/site/content/events.json",
  `${origin}/minio/orchestra-media/site/content/events.json`,
].filter(Boolean);

for (const url of sources) {
  try {
    const res = await fetch(url, { headers: { accept: "application/json" } });
    if (!res.ok) continue;
    const data = await res.json();
    const events = data && typeof data === "object" ? data.events : null;
    if (!Array.isArray(events)) continue;
    slugs = events
      .map((e) => (e && typeof e === "object" ? e.slug || e.id : ""))
      .map((x) => String(x || "").trim())
      .filter(Boolean);
    if (slugs.length) {
      console.log(`[sitemap] Loaded ${slugs.length} slugs from ${url}.`);
      break;
    }
  } catch {
    // ignore and try next
  }
}

if (!slugs.length) {
  slugs = splitCsv(process.env.SITEMAP_EVENT_SLUGS);
  if (slugs.length) {
    console.log(`[sitemap] Using ${slugs.length} slugs from SITEMAP_EVENT_SLUGS.`);
  } else {
    console.log("[sitemap] No event slugs found; sitemap will include only base pages.");
  }
}

const urls = [];
for (const p of basePaths) urls.push(toLoc(origin, p));
for (const slug of slugs) {
  urls.push(toLoc(origin, `/события/${encodeURIComponent(slug)}`));
}

const lastmod = new Date().toISOString();
const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .filter(Boolean)
  .map(
    (loc) => `  <url>
    <loc>${loc}</loc>
    <lastmod>${lastmod}</lastmod>
  </url>`
  )
  .join("\n")}
</urlset>
`;

await fs.writeFile(outPath, xml, "utf8");
console.log(`[sitemap] Wrote ${urls.length} URLs to ${outPath}.`);

// Ensure robots.txt in build references sitemap with absolute URL (better for Yandex)
// and includes Host directive (used by Yandex).
try {
  const baseRobots = await fs.readFile(robotsPublicPath, "utf8").catch(() => "");
  const host = safeHostFromOrigin(origin);
  const lines = String(baseRobots || "").trimEnd().split(/\r?\n/).filter(Boolean);

  // Remove existing Sitemap/Host directives to avoid duplicates.
  const filtered = lines.filter(
    (l) => !/^\s*sitemap\s*:/i.test(l) && !/^\s*host\s*:/i.test(l)
  );

  if (host) filtered.push(`Host: ${host}`);
  filtered.push(`Sitemap: ${origin}/sitemap.xml`);

  const robots = `${filtered.join("\n")}\n`;
  await fs.writeFile(robotsOutPath, robots, "utf8");
  console.log(`[robots] Wrote robots.txt to ${robotsOutPath}.`);
} catch {
  // ignore
}

