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

function normalizePathname(p) {
  const s = String(p || "").trim();
  if (!s) return "/";
  return s.startsWith("/") ? s : `/${s}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function truncate(value, max) {
  const s = String(value || "").replace(/\s+/g, " ").trim();
  if (!s) return "";
  if (s.length <= max) return s;
  return `${s.slice(0, Math.max(0, max - 1)).trim()}…`;
}

function safeJson(x) {
  return JSON.stringify(x);
}

function toAbsolute(origin, pathname) {
  const o = stripTrailingSlashes(origin);
  const p = normalizePathname(pathname);
  if (!o) return "";
  return `${o}${p}`;
}

function buildMetaBlock({ title, description, canonicalUrl, ogImageUrl, jsonLd }) {
  const lines = [];
  lines.push(`<title>${escapeHtml(title)}</title>`);
  if (description) lines.push(`<meta name="description" content="${escapeHtml(description)}" />`);
  if (canonicalUrl) lines.push(`<link rel="canonical" href="${escapeHtml(canonicalUrl)}" />`);

  lines.push(`<meta property="og:type" content="website" />`);
  lines.push(`<meta property="og:locale" content="ru_RU" />`);
  lines.push(`<meta property="og:site_name" content="Дофамин" />`);
  lines.push(`<meta property="og:title" content="${escapeHtml(title)}" />`);
  if (description) lines.push(`<meta property="og:description" content="${escapeHtml(description)}" />`);
  if (canonicalUrl) lines.push(`<meta property="og:url" content="${escapeHtml(canonicalUrl)}" />`);
  if (ogImageUrl) lines.push(`<meta property="og:image" content="${escapeHtml(ogImageUrl)}" />`);

  lines.push(
    `<meta name="twitter:card" content="${ogImageUrl ? "summary_large_image" : "summary"}" />`
  );
  lines.push(`<meta name="twitter:title" content="${escapeHtml(title)}" />`);
  if (description) lines.push(`<meta name="twitter:description" content="${escapeHtml(description)}" />`);
  if (ogImageUrl) lines.push(`<meta name="twitter:image" content="${escapeHtml(ogImageUrl)}" />`);

  const jsonLdItems = Array.isArray(jsonLd) ? jsonLd : jsonLd ? [jsonLd] : [];
  for (const item of jsonLdItems) {
    lines.push(`<script type="application/ld+json">${safeJson(item)}</script>`);
  }

  // Minimal styling so snapshot text is readable before SPA loads.
  lines.push(`<style data-seo-snapshot>
  .seo-snapshot{max-width:980px;margin:0 auto;padding:24px 16px;font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;line-height:1.5}
  .seo-snapshot a{color:#7dd3fc}
  .seo-snapshot__muted{opacity:.8}
  .seo-snapshot__list{padding-left:18px}
  </style>`);

  return lines.join("\n");
}

function upsertHead(html, metaBlock) {
  let out = String(html);
  // Remove existing title/description/canonical/og/twitter/jsonld snapshot block to avoid duplicates.
  out = out
    .replace(/<title>[\s\S]*?<\/title>/i, "")
    .replace(/<meta\s+name=["']description["'][\s\S]*?>/gi, "")
    .replace(/<link\s+rel=["']canonical["'][\s\S]*?>/gi, "")
    .replace(/<meta\s+property=["']og:[^"']+["'][\s\S]*?>/gi, "")
    .replace(/<meta\s+name=["']twitter:[^"']+["'][\s\S]*?>/gi, "")
    .replace(/<script\s+type=["']application\/ld\+json["'][\s\S]*?<\/script>/gi, "")
    .replace(/<style\s+data-seo-snapshot[\s\S]*?<\/style>/gi, "");

  if (out.includes("</head>")) {
    out = out.replace("</head>", `${metaBlock}\n</head>`);
  }
  return out;
}

function upsertRoot(html, rootInnerHtml) {
  const marker = '<div id="root"></div>';
  if (html.includes(marker)) return html.replace(marker, `<div id="root">${rootInnerHtml}</div>`);
  // fallback for minified/altered spacing
  return html.replace(/<div\s+id=["']root["']\s*><\/div>/i, `<div id="root">${rootInnerHtml}</div>`);
}

async function loadEvents(origin) {
  const sources = [
    String(process.env.SEO_EVENTS_JSON_URL || "").trim(),
    "http://minio:9000/orchestra-media/site/content/events.json",
    origin ? `${stripTrailingSlashes(origin)}/minio/orchestra-media/site/content/events.json` : "",
  ].filter(Boolean);

  for (const url of sources) {
    try {
      const res = await fetch(url, { headers: { accept: "application/json" } });
      if (!res.ok) continue;
      const data = await res.json();
      const events = data && typeof data === "object" ? data.events : null;
      if (!Array.isArray(events)) continue;

      const normalized = events
        .map((e) => (e && typeof e === "object" ? e : null))
        .filter(Boolean)
        .map((e) => ({
          slug: String(e.slug || e.id || "").trim(),
          name: String(e.name || "").trim(),
          anonse: typeof e.anonse === "string" ? e.anonse : "",
          type: typeof e.type === "string" ? e.type : "",
          old: typeof e.old === "string" ? e.old : "",
          date: typeof e.date === "string" ? e.date : "",
          cardImage:
            typeof e.cardImage === "string"
              ? e.cardImage
              : typeof e.img === "string"
                ? e.img
                : "",
          ticketsCloudEventId:
            typeof e.ticketsCloudEventId === "string" ? e.ticketsCloudEventId.trim() : "",
          ticketsCloudToken:
            typeof e.ticketsCloudToken === "string" ? e.ticketsCloudToken.trim() : "",
          soon: Boolean(e.soon),
          cast: Array.isArray(e.cast) ? e.cast : undefined,
        }))
        .filter((e) => e.slug && e.name);

      if (normalized.length) return normalized;
    } catch {
      // ignore and try next
    }
  }

  // Fallback: keep at least your main plays in snapshots.
  return [
    {
      slug: "заклятие",
      name: "Заклятие",
      anonse: "",
      type: "комедия",
      old: "",
      date: "",
      cardImage: "",
      ticketsCloudEventId: "",
      ticketsCloudToken: "",
      soon: false,
    },
    {
      slug: "железнова",
      name: "Железнова",
      anonse: "",
      type: "драма",
      old: "",
      date: "",
      cardImage: "",
      ticketsCloudEventId: "",
      ticketsCloudToken: "",
      soon: false,
    },
  ];
}

function buildEventJsonLd({ origin, canonicalPath, title, description, ogImageUrl, event }) {
  const canonicalUrl = origin ? toAbsolute(origin, canonicalPath) : "";
  const cast = Array.isArray(event.cast) ? event.cast : null;

  const eventLd = {
    "@context": "https://schema.org",
    "@type": "TheaterEvent",
    name: title,
    description,
    inLanguage: "ru-RU",
    ...(canonicalUrl ? { url: canonicalUrl } : null),
    ...(ogImageUrl ? { image: [ogImageUrl] } : null),
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    eventStatus: "https://schema.org/EventScheduled",
    location: {
      "@type": "Place",
      name: "Театр «Дофамин»",
      address: {
        "@type": "PostalAddress",
        addressLocality: "Санкт-Петербург",
        addressCountry: "RU",
      },
    },
    organizer: {
      "@type": "TheaterGroup",
      name: "Театр «Дофамин»",
      ...(origin ? { url: origin } : null),
    },
    ...(cast && cast.length
      ? {
          performer: cast
            .map((x) => (x?.actor ? String(x.actor).trim() : ""))
            .filter(Boolean)
            .map((name) => ({ "@type": "Person", name })),
        }
      : null),
    ...((event.ticketsCloudEventId || event.ticketsCloudToken) && canonicalUrl
      ? {
          offers: {
            "@type": "Offer",
            url: canonicalUrl,
            availability: event.soon ? "https://schema.org/PreOrder" : "https://schema.org/InStock",
            priceCurrency: "RUB",
          },
        }
      : null),
  };

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Дофамин", item: origin ? `${origin}/` : undefined },
      {
        "@type": "ListItem",
        position: 2,
        name: "Спектакли",
        item: origin ? `${origin}/события` : undefined,
      },
      { "@type": "ListItem", position: 3, name: title, item: canonicalUrl || undefined },
    ],
  };

  return [breadcrumbLd, eventLd];
}

async function writeRouteHtml({ buildDir, templateHtml, routePath, headBlock, rootHtml }) {
  const p = normalizePathname(routePath);
  const outDir =
    p === "/" ? buildDir : path.join(buildDir, ...p.replace(/^\/+/, "").split("/").filter(Boolean));
  await fs.mkdir(outDir, { recursive: true });
  const outPath = path.join(outDir, "index.html");

  let html = templateHtml;
  html = upsertHead(html, headBlock);
  html = upsertRoot(html, rootHtml);

  await fs.writeFile(outPath, html, "utf8");
}

const origin = computeOrigin() || stripTrailingSlashes(process.env.SITE_ORIGIN);
const buildDir = path.resolve(process.cwd(), "build");
const templatePath = path.join(buildDir, "index.html");

try {
  await fs.access(templatePath);
} catch {
  console.log(`[seo-snapshots] build/index.html not found at ${templatePath}; skipping.`);
  process.exit(0);
}

const templateHtml = await fs.readFile(templatePath, "utf8");
const events = await loadEvents(origin);

const basePages = [
  {
    path: "/",
    title: "Дофамин — театр в Санкт-Петербурге",
    description: "Театр «Дофамин» в Санкт-Петербурге: спектакли (комедия, драма, трагедия), афиша и билеты онлайн.",
    root: `<main class="seo-snapshot">
      <h1>Театр «Дофамин»</h1>
      <p class="seo-snapshot__muted">Санкт-Петербург · спектакли · билеты онлайн</p>
      <p><a href="/события">Открыть афишу спектаклей</a></p>
    </main>`,
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "TheaterGroup",
      name: "Театр «Дофамин»",
      ...(origin ? { url: origin } : null),
      sameAs: ["https://vk.com/dofaminspb", "https://t.me/dofamintheatre"],
      address: {
        "@type": "PostalAddress",
        addressLocality: "Санкт-Петербург",
        addressCountry: "RU",
      },
    },
  },
  {
    path: "/события",
    title: "Спектакли и афиша — Дофамин",
    description: "Афиша театра «Дофамин»: спектакли, описание и ссылки на покупку билетов онлайн.",
    root: `<main class="seo-snapshot">
      <h1>Спектакли</h1>
      <p class="seo-snapshot__muted">Афиша театра «Дофамин»</p>
      <ul class="seo-snapshot__list">
        ${events
          .filter((e) => !e.soon)
          .map(
            (e) =>
              `<li><a href="/события/${encodeURIComponent(e.slug)}">${escapeHtml(e.name)}</a>${
                e.type ? ` — ${escapeHtml(String(e.type))}` : ""
              }</li>`
          )
          .join("\n")}
      </ul>
    </main>`,
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: "Афиша театра «Дофамин»",
      itemListElement: events
        .filter((e) => !e.soon)
        .map((e, idx) => ({
          "@type": "ListItem",
          position: idx + 1,
          name: e.name,
          url: origin ? `${origin}/события/${encodeURIComponent(e.slug)}` : undefined,
        })),
    },
  },
  {
    path: "/команда",
    title: "Команда — Театр «Дофамин»",
    description: "Актёры и команда театра «Дофамин».",
    root: `<main class="seo-snapshot">
      <h1>Команда</h1>
      <p class="seo-snapshot__muted">Актёры и команда театра «Дофамин»</p>
      <p><a href="/">На главную</a></p>
    </main>`,
  },
  {
    path: "/контакты",
    title: "Контакты — Театр «Дофамин»",
    description: "Контакты театра «Дофамин»: почта, Telegram, ВКонтакте и как нас найти.",
    root: `<main class="seo-snapshot">
      <h1>Контакты</h1>
      <ul class="seo-snapshot__list">
        <li><a href="https://t.me/dofamintheatre">Telegram: @dofamintheatre</a></li>
        <li><a href="https://vk.com/dofaminspb">ВКонтакте: vk.com/dofaminspb</a></li>
      </ul>
      <p><a href="/">На главную</a></p>
    </main>`,
  },
  // Legacy URLs (keep indexable but canonicalize to Russian paths)
  { path: "/events", canonicalTo: "/события" },
  { path: "/aboutus", canonicalTo: "/команда" },
  { path: "/contacts", canonicalTo: "/контакты" },
];

const pages = [];

for (const p of basePages) {
  if (p.canonicalTo) {
    const canonicalUrl = origin ? toAbsolute(origin, p.canonicalTo) : "";
    const headBlock = buildMetaBlock({
      title: "Дофамин — Театр",
      description: "",
      canonicalUrl,
      ogImageUrl: "",
      jsonLd: null,
    });
    pages.push({ routePath: p.path, headBlock, rootHtml: `<main class="seo-snapshot"><p>Перейти: <a href="${escapeHtml(p.canonicalTo)}">${escapeHtml(p.canonicalTo)}</a></p></main>` });
    continue;
  }

  const canonicalUrl = origin ? toAbsolute(origin, p.path) : "";
  const headBlock = buildMetaBlock({
    title: p.title,
    description: p.description,
    canonicalUrl,
    ogImageUrl: "",
    jsonLd: p.jsonLd || null,
  });
  pages.push({ routePath: p.path, headBlock, rootHtml: p.root || "" });
}

for (const e of events) {
  const canonicalPath = `/события/${e.slug}`;
  const title = `${e.name} — Театр «Дофамин»`;
  const description = truncate(
    [
      e.type ? String(e.type).trim() : "",
      e.old ? String(e.old).trim() : "",
      e.date ? String(e.date).trim() : "",
      e.anonse ? String(e.anonse).trim() : "",
    ]
      .filter(Boolean)
      .join(" · "),
    170
  );

  const canonicalUrl = origin ? toAbsolute(origin, canonicalPath) : "";
  const jsonLd = buildEventJsonLd({
    origin,
    canonicalPath,
    title: e.name,
    description: e.anonse ? truncate(e.anonse, 600) : description || "Спектакль театра «Дофамин».",
    ogImageUrl: "",
    event: e,
  });

  const headBlock = buildMetaBlock({
    title,
    description,
    canonicalUrl,
    ogImageUrl: "",
    jsonLd,
  });

  const rootHtml = `<main class="seo-snapshot">
    <h1>${escapeHtml(e.name)}</h1>
    <p class="seo-snapshot__muted">${escapeHtml(
      [e.type, e.old, e.date].filter(Boolean).join(" · ") || "Спектакль театра «Дофамин»"
    )}</p>
    ${e.anonse ? `<p>${escapeHtml(truncate(e.anonse, 900))}</p>` : ""}
    <p><a href="${escapeHtml(canonicalPath)}">Открыть страницу спектакля и купить билеты</a></p>
  </main>`;

  pages.push({ routePath: canonicalPath, headBlock, rootHtml });
  // Legacy path
  pages.push({
    routePath: `/events/${e.slug}`,
    headBlock: buildMetaBlock({
      title,
      description,
      canonicalUrl,
      ogImageUrl: "",
      jsonLd,
    }),
    rootHtml,
  });
}

for (const p of pages) {
  await writeRouteHtml({
    buildDir,
    templateHtml,
    routePath: p.routePath,
    headBlock: p.headBlock,
    rootHtml: p.rootHtml,
  });
}

console.log(`[seo-snapshots] Generated ${pages.length} HTML snapshots in ${buildDir}.`);

