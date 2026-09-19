#!/usr/bin/env node
/**
 * Build CMS Markdown → live HTML news pages, indexes, homepage cards, sitemap.
 *
 * Reads:  content/news/en/*.md, content/news/uk/*.md
 * Writes: news/{slug}.html, uk/news/{slug}.html
 * Patches: news/index.html, uk/news/index.html, index.html, uk/index.html, sitemap.xml
 *
 * All editorial posts live in content/news/{en,uk}/*.md and are rebuilt here.
 * Index / homepage lists are filled between <!-- cms-news-start/end --> markers.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";
import { marked } from "marked";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SITE = "https://www.opensolanahub.com";

const TAG_UK = {
  Clients: "Клієнти",
  Consensus: "Консенсус",
  Governance: "Голосування",
  Ecosystem: "Екосистема",
};

const MONTH_EN = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const MONTH_EN_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
const MONTH_UK = [
  "січня",
  "лютого",
  "березня",
  "квітня",
  "травня",
  "червня",
  "липня",
  "серпня",
  "вересня",
  "жовтня",
  "листопада",
  "грудня",
];
const MONTH_UK_SHORT = [
  "січ",
  "лют",
  "бер",
  "кві",
  "тра",
  "чер",
  "лип",
  "серп",
  "вер",
  "жов",
  "лис",
  "гру",
];

marked.setOptions({ gfm: true, breaks: false });

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Posts with an `image` get a large Twitter/OG card; the rest fall back to the logo.
function socialCard(post) {
  if (!post.image) {
    return {
      image: `${SITE}/assets/open-solana-hub-logo.png`,
      card: "summary",
      alt: "Open Solana Hub",
      width: 512,
      height: 512,
      type: "image/png",
    };
  }
  const src = post.image.startsWith("http")
    ? post.image
    : `${SITE}${post.image.startsWith("/") ? "" : "/"}${post.image}`;
  const lower = post.image.toLowerCase();
  const type = lower.endsWith(".jpg") || lower.endsWith(".jpeg") ? "image/jpeg" : "image/png";
  return {
    image: src,
    card: "summary_large_image",
    alt: post.imageAlt || post.title,
    width: post.imageWidth || 1280,
    height: post.imageHeight || 720,
    type,
  };
}

function socialImageMetas(social) {
  const lines = [
    `  <meta property="og:image" content="${escapeHtml(social.image)}" />`,
    `  <meta property="og:image:type" content="${social.type}" />`,
    `  <meta property="og:image:width" content="${social.width}" />`,
    `  <meta property="og:image:height" content="${social.height}" />`,
  ];
  if (social.alt) {
    const alt = escapeHtml(social.alt);
    lines.push(`  <meta property="og:image:alt" content="${alt}" />`);
    lines.push(`  <meta name="twitter:image:alt" content="${alt}" />`);
  }
  return lines.join("\n");
}

function parseDate(raw) {
  // gray-matter may yield a Date for YAML dates, or a string "YYYY-MM-DD".
  let y;
  let m;
  let d;
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    y = raw.getUTCFullYear();
    m = raw.getUTCMonth() + 1;
    d = raw.getUTCDate();
  } else {
    const s = String(raw).trim();
    const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
      y = Number(isoMatch[1]);
      m = Number(isoMatch[2]);
      d = Number(isoMatch[3]);
    } else {
      const parsed = new Date(s);
      if (Number.isNaN(parsed.getTime())) {
        y = 1970;
        m = 1;
        d = 1;
      } else {
        y = parsed.getUTCFullYear();
        m = parsed.getUTCMonth() + 1;
        d = parsed.getUTCDate();
      }
    }
  }
  const iso = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  return { iso, y, m, d, date: new Date(Date.UTC(y, m - 1, d)) };
}

function formatDateEnLong({ y, m, d }) {
  return `${MONTH_EN[m - 1]} ${d}, ${y}`;
}
function formatDateEnShort({ y, m, d }) {
  return `${MONTH_EN_SHORT[m - 1]} ${d}, ${y}`;
}
function formatDateUkLong({ y, m, d }) {
  return `${d} ${MONTH_UK[m - 1]} ${y}`;
}
function formatDateUkShort({ y, m, d }) {
  return `${d} ${MONTH_UK_SHORT[m - 1]} ${y}`;
}

function parseKeywords(data) {
  if (Array.isArray(data.keywords)) {
    return data.keywords.map((k) => String(k).trim()).filter(Boolean);
  }
  if (typeof data.keywords === "string" && data.keywords.trim()) {
    return data.keywords
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean);
  }
  return [];
}

function parseEvent(data) {
  const e = data.event;
  if (!e || typeof e !== "object" || !e.name) return null;
  return {
    name: String(e.name),
    start: e.start ? String(e.start).slice(0, 10) : "",
    end: e.end ? String(e.end).slice(0, 10) : "",
    venue: e.venue ? String(e.venue) : "",
    city: e.city ? String(e.city) : "",
    country: e.country ? String(e.country) : "",
    organizer: e.organizer ? String(e.organizer) : "",
    superEvent: e.super_event ? String(e.super_event) : "",
    superStart: e.super_start ? String(e.super_start).slice(0, 10) : "",
    superEnd: e.super_end ? String(e.super_end).slice(0, 10) : "",
  };
}

const X_SHARE_ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="13" height="13" aria-hidden="true"><path fill="currentColor" d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.74l7.73-8.835L1.254 2.25H8.08l4.253 5.622L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>';

function shareHtml(post, url, lang, { end = false } = {}) {
  const intent = `https://x.com/intent/tweet?text=${encodeURIComponent(post.seoTitle || post.title)}&url=${encodeURIComponent(url)}&via=Andrew_In_UA`;
  const xLabel = lang === "uk" ? "Поділитися в X" : "Share on X";
  const copyLabel = lang === "uk" ? "Копіювати посилання" : "Copy link";
  const copiedLabel = lang === "uk" ? "Скопійовано" : "Copied";
  const cls = end ? "article-share article-share-end" : "article-share";
  return `<div class="${cls}">
        <a class="article-share-x" href="${escapeHtml(intent)}">${X_SHARE_ICON}<span>${xLabel}</span></a>
        <button type="button" class="article-share-copy" data-share-url="${escapeHtml(url)}" data-label="${escapeHtml(copyLabel)}" data-copied="${escapeHtml(copiedLabel)}"><span data-share-label>${copyLabel}</span></button>
      </div>`;
}

function articleTagMetas(post) {
  const lines = [`  <meta property="article:section" content="${escapeHtml(post.tag)}" />`];
  if (post.keywords.length) {
    lines.push(`  <meta name="keywords" content="${escapeHtml(post.keywords.join(", "))}" />`);
  }
  for (const k of post.keywords) {
    lines.push(`  <meta property="article:tag" content="${escapeHtml(k)}" />`);
  }
  return lines.join("\n");
}

function articleJsonLd(post, { url, lang }) {
  const social = socialCard(post);
  const data = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: post.seoTitle || post.title,
    description: post.description,
    url,
    image: {
      "@type": "ImageObject",
      url: social.image,
      width: social.width,
      height: social.height,
      caption: social.alt || post.title,
    },
    datePublished: post.date.iso,
    dateModified: post.date.iso,
    inLanguage: lang,
    articleSection: post.tag,
    isPartOf: { "@type": "WebSite", name: "Open Solana Hub", url: `${SITE}/` },
    author: {
      "@type": "Person",
      name: "Andrii (AndrewInUA)",
      url: "https://andrewinua.com/",
    },
    publisher: {
      "@type": "Organization",
      name: "Open Solana Hub",
      url: `${SITE}/`,
      logo: {
        "@type": "ImageObject",
        url: `${SITE}/assets/open-solana-hub-logo.png`,
      },
    },
  };
  if (post.keywords.length) data.keywords = post.keywords;
  if (post.event) {
    const about = { "@type": "Event", name: post.event.name };
    if (post.event.start) about.startDate = post.event.start;
    if (post.event.end) about.endDate = post.event.end;
    if (post.event.venue || post.event.city) {
      about.location = {
        "@type": "Place",
        name: post.event.venue || post.event.city,
      };
      if (post.event.city || post.event.country) {
        about.location.address = { "@type": "PostalAddress" };
        if (post.event.city) about.location.address.addressLocality = post.event.city;
        if (post.event.country) about.location.address.addressCountry = post.event.country;
      }
    }
    if (post.event.organizer) {
      about.organizer = { "@type": "Organization", name: post.event.organizer };
    }
    if (post.event.superEvent) {
      const superEvent = { "@type": "Event", name: post.event.superEvent };
      if (post.event.superStart) superEvent.startDate = post.event.superStart;
      if (post.event.superEnd) superEvent.endDate = post.event.superEnd;
      about.superEvent = superEvent;
    }
    data.about = about;
  }
  return JSON.stringify(data, null, 2)
    .split("\n")
    .map((line, i) => (i === 0 ? line : `  ${line}`))
    .join("\n");
}

function readPosts(lang) {
  const dir = path.join(ROOT, "content", "news", lang);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .map((file) => {
      const slug = file.replace(/\.md$/, "");
      const raw = fs.readFileSync(path.join(dir, file), "utf8");
      const { data, content } = matter(raw);
      const date = parseDate(data.date || "1970-01-01");
      return {
        slug,
        lang,
        title: String(data.title || slug),
        seoTitle: String(data.seo_title || data.title || slug),
        description: String(data.description || data.teaser || ""),
        teaser: String(data.teaser || data.description || ""),
        tag: String(data.tag || "Ecosystem"),
        image: data.image ? String(data.image) : "",
        imageAlt: data.image_alt ? String(data.image_alt) : "",
        imageWidth: Number(data.image_width) || 0,
        imageHeight: Number(data.image_height) || 0,
        keywords: parseKeywords(data),
        event: parseEvent(data),
        date,
        body: content.trim(),
      };
    })
    .sort((a, b) => b.date.iso.localeCompare(a.date.iso));
}

function bodyToHtml(markdown) {
  let html = marked.parse(markdown || "", { async: false });
  // First <p> becomes the lead
  html = html.replace(/<p>/, '<p class="prose-lead">');
  return html.trim();
}

function renderArticleEn(post) {
  const { slug, title, seoTitle, description, tag, date, body } = post;
  const url = `${SITE}/news/${slug}.html`;
  const ukUrl = `${SITE}/uk/news/${slug}.html`;
  const dateLong = formatDateEnLong(date);
  const bodyHtml = bodyToHtml(body);
  const titleEsc = escapeHtml(title);
  const seoTitleEsc = escapeHtml(seoTitle);
  const descEsc = escapeHtml(description);
  const tagEsc = escapeHtml(tag);
  const social = socialCard(post);

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="light dark" />
  <meta name="description" content="${descEsc}" />
  <title>${seoTitleEsc} | Open Solana Hub</title>
  <meta name="robots" content="index,follow,max-image-preview:large" />
  <link rel="canonical" href="${url}" />
  <link rel="alternate" hreflang="en" href="${url}" />
  <link rel="alternate" hreflang="uk" href="${ukUrl}" />
  <link rel="alternate" hreflang="x-default" href="${url}" />
  <meta property="og:type" content="article" />
  <meta property="og:locale" content="en_US" />
  <meta property="og:locale:alternate" content="uk_UA" />
  <meta property="og:title" content="${seoTitleEsc}" />
  <meta property="og:description" content="${descEsc}" />
  <meta property="og:url" content="${url}" />
  <meta property="og:site_name" content="Open Solana Hub" />
${socialImageMetas(social)}
  <meta property="article:published_time" content="${date.iso}" />
${articleTagMetas(post)}
  <meta name="twitter:card" content="${social.card}" />
  <meta name="twitter:title" content="${seoTitleEsc}" />
  <meta name="twitter:description" content="${descEsc}" />
  <meta name="twitter:image" content="${social.image}" />
  <script type="application/ld+json">
  ${articleJsonLd(post, { url, lang: "en" })}
  </script>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="../styles.css?v=8" />
  <link rel="icon" href="../assets/open-solana-hub-logo.png" type="image/png" />
  <script src="../site.js?v=6" defer></script>
</head>
<body>
  <header class="site-header">
    <div class="site-header-inner">
      <div class="brand">
        <a href="../index.html" class="brand-logo-link" aria-label="Open Solana Hub">
          <img src="../assets/open-solana-hub-logo.svg" alt="" class="brand-logo" width="40" height="40" />
        </a>
        <a href="../index.html" class="brand-text-link">
          <span class="brand-text">
            <span class="brand-title">Open Solana Hub</span>
            <span class="brand-tag">Solana in simple terms</span>
          </span>
        </a>
      </div>
      <nav class="site-nav" aria-label="Main">
        <a href="../index.html">Home</a>
        <a href="../basics.html">Basics</a>
        <a href="../stay-safe.html">Stay safe</a>
        <a href="../first-steps.html">First steps</a>
        <a href="../ecosystem.html">Ecosystem</a>
        <a href="../glossary.html">Glossary</a>
        <a href="../compare-validators.html">Validator assessment</a>
        <a href="./index.html" class="active">News</a>
        <a href="../about.html">About</a>
      </nav>
      <div class="header-actions">
        <nav class="lang-switch" aria-label="Language">
          <a href="../uk/news/${slug}.html" lang="uk" hreflang="uk">UA</a>
          <span class="lang-sep" aria-hidden="true">·</span>
          <a href="./${slug}.html" class="active" lang="en" hreflang="en">EN</a>
        </nav>
        <button type="button" id="theme-toggle" class="theme-btn" aria-label="Toggle theme">☀</button>
        <a class="btn btn-primary" href="../compare/">Assess validators</a>
        <a class="btn btn-primary" href="../compare/mystake.html">Stake health</a>
      </div>
    </div>
  </header>

  <main class="wrap">
    <article class="prose-panel prose">
      <a class="article-back" href="./index.html">← All Solana news</a>
      <h1>${titleEsc}</h1>
      <div class="article-meta">
        <time datetime="${date.iso}">${dateLong}</time>
        <span class="news-tag">${tagEsc}</span>
      </div>
${shareHtml(post, url, "en")}
      ${bodyHtml}

${shareHtml(post, url, "en", { end: true })}
      <div class="path-row">
        <a class="btn btn-primary" href="./index.html">More Solana news</a>
        <a class="btn btn-ghost" href="../ecosystem.html">How staking works</a>
      </div>
    </article>
  </main>

  <footer class="wrap site-footer">
    <div class="footer-brand">
      <a href="../index.html" class="footer-logo-link" aria-label="Open Solana Hub">
        <img src="../assets/open-solana-hub-logo.svg" alt="" width="40" height="40" />
      </a>
      <div class="footer-brand-text">
        <a href="../index.html" class="footer-title-link"><strong>Open Solana Hub</strong></a>
        <span>Built by AndrewInUA</span>
      </div>
    </div>
    <div class="footer-links">
      <a href="../compare/">Validator Transparency</a>
      <a href="./index.html">Solana news</a>
      <a href="https://andrewinua.com/" target="_blank" rel="noopener">AndrewInUA validator</a>
      <a href="https://github.com/AndrewInUA" target="_blank" rel="noopener">GitHub</a>
      <a href="https://t.me/AndrewInUA" target="_blank" rel="noopener">Telegram</a>
    </div>
    <p class="footer-note">Education only – not financial advice.</p>
  </footer>
</body>
</html>
`;
}

function renderArticleUk(post) {
  const { slug, title, seoTitle, description, tag, date, body } = post;
  const url = `${SITE}/uk/news/${slug}.html`;
  const enUrl = `${SITE}/news/${slug}.html`;
  const dateLong = formatDateUkLong(date);
  const bodyHtml = bodyToHtml(body);
  const titleEsc = escapeHtml(title);
  const seoTitleEsc = escapeHtml(seoTitle);
  const descEsc = escapeHtml(description);
  const tagLabel = escapeHtml(TAG_UK[tag] || tag);
  const social = socialCard(post);

  return `<!doctype html>
<html lang="uk">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="light dark" />
  <meta name="description" content="${descEsc}" />
  <title>${seoTitleEsc} | Open Solana Hub</title>
  <meta name="robots" content="index,follow,max-image-preview:large" />
  <link rel="canonical" href="${url}" />
  <link rel="alternate" hreflang="en" href="${enUrl}" />
  <link rel="alternate" hreflang="uk" href="${url}" />
  <link rel="alternate" hreflang="x-default" href="${enUrl}" />
  <meta property="og:type" content="article" />
  <meta property="og:locale" content="uk_UA" />
  <meta property="og:locale:alternate" content="en_US" />
  <meta property="og:title" content="${seoTitleEsc}" />
  <meta property="og:description" content="${descEsc}" />
  <meta property="og:url" content="${url}" />
  <meta property="og:site_name" content="Open Solana Hub" />
${socialImageMetas(social)}
  <meta property="article:published_time" content="${date.iso}" />
${articleTagMetas(post)}
  <meta name="twitter:card" content="${social.card}" />
  <meta name="twitter:title" content="${seoTitleEsc}" />
  <meta name="twitter:description" content="${descEsc}" />
  <meta name="twitter:image" content="${social.image}" />
  <script type="application/ld+json">
  ${articleJsonLd(post, { url, lang: "uk" })}
  </script>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="../../styles.css?v=8" />
  <link rel="icon" href="../../assets/open-solana-hub-logo.png" type="image/png" />
  <script src="../../site.js?v=6" defer></script>
</head>
<body>
  <header class="site-header">
    <div class="site-header-inner">
      <div class="brand">
        <a href="../index.html" class="brand-logo-link" aria-label="Open Solana Hub">
          <img src="../../assets/open-solana-hub-logo.svg" alt="" class="brand-logo" width="40" height="40" />
        </a>
        <a href="../index.html" class="brand-text-link">
          <span class="brand-text">
            <span class="brand-title">Open Solana Hub</span>
            <span class="brand-tag">Про Солану українською</span>
          </span>
        </a>
      </div>
      <nav class="site-nav" aria-label="Головне">
        <a href="../index.html">Головна</a>
        <a href="../basics.html">Основи</a>
        <a href="../stay-safe.html">Безпека</a>
        <a href="../first-steps.html">Перші кроки</a>
        <a href="../ecosystem.html">Екосистема</a>
        <a href="../glossary.html">Словник</a>
        <a href="../compare-validators.html">Оцінка валідаторів</a>
        <a href="./index.html" class="active">Новини</a>
        <a href="../about.html">Про проєкт</a>
      </nav>
      <div class="header-actions">
        <nav class="lang-switch" aria-label="Мова">
          <a href="../../news/${slug}.html" lang="en" hreflang="en">EN</a>
          <span class="lang-sep" aria-hidden="true">·</span>
          <a href="./${slug}.html" class="active" lang="uk" hreflang="uk">UA</a>
        </nav>
        <button type="button" id="theme-toggle" class="theme-btn" aria-label="Змінити тему">☀</button>
        <a class="btn btn-primary" href="../../compare/">Оцінити валідаторів</a>
        <a class="btn btn-primary" href="../../compare/mystake.html">Як там мій стейк?</a>
      </div>
    </div>
  </header>

  <main class="wrap">
    <article class="prose-panel prose">
      <a class="article-back" href="./index.html">← Усі новини Solana</a>
      <h1>${titleEsc}</h1>
      <div class="article-meta">
        <time datetime="${date.iso}">${dateLong}</time>
        <span class="news-tag">${tagLabel}</span>
      </div>
${shareHtml(post, url, "uk")}
      ${bodyHtml}

${shareHtml(post, url, "uk", { end: true })}
      <div class="path-row">
        <a class="btn btn-primary" href="./index.html">Більше новин Solana</a>
        <a class="btn btn-ghost" href="../ecosystem.html">Як працює стейкінг</a>
      </div>
    </article>
  </main>

  <footer class="wrap site-footer">
    <div class="footer-brand">
      <a href="../index.html" class="footer-logo-link" aria-label="Open Solana Hub">
        <img src="../../assets/open-solana-hub-logo.svg" alt="" width="40" height="40" />
      </a>
      <div class="footer-brand-text">
        <a href="../index.html" class="footer-title-link"><strong>Open Solana Hub</strong></a>
        <span>Незалежний освітній проєкт · Створено AndrewInUA</span>
      </div>
    </div>
    <div class="footer-links">
      <a href="../../compare/">Validator Transparency</a>
      <a href="./index.html">Новини Solana</a>
      <a href="https://andrewinua.com/" target="_blank" rel="noopener">Валідатор AndrewInUA</a>
      <a href="https://github.com/AndrewInUA" target="_blank" rel="noopener">GitHub</a>
      <a href="https://t.me/AndrewInUA" target="_blank" rel="noopener">Telegram</a>
    </div>
    <p class="footer-note">Лише для навчання – не фінансова порада.</p>
  </footer>
</body>
</html>
`;
}

function newsThumb(post) {
  if (!post.image) return "";
  const alt = escapeHtml(post.imageAlt || post.title);
  return `          <img class="news-card-thumb" src="${escapeHtml(post.image)}" alt="${alt}" width="320" height="180" loading="lazy" decoding="async" />
`;
}

function newsCardEn(post, hrefPrefix = "./") {
  const dateShort = formatDateEnShort(post.date);
  const mediaClass = post.image ? " news-card-has-media" : "";
  return `      <li>
        <a class="news-card${mediaClass}" href="${hrefPrefix}${post.slug}.html">
${newsThumb(post)}          <span class="news-card-body">
          <span class="news-meta">
            <time class="news-date" datetime="${post.date.iso}">${dateShort}</time>
            <span class="news-tag">${escapeHtml(post.tag)}</span>
          </span>
          <span class="news-title">${escapeHtml(post.title)}</span>
          <span class="news-teaser">${escapeHtml(post.teaser)}</span>
          </span>
        </a>
      </li>`;
}

function newsCardUk(post, hrefPrefix = "./") {
  const dateShort = formatDateUkShort(post.date);
  const tagLabel = TAG_UK[post.tag] || post.tag;
  const mediaClass = post.image ? " news-card-has-media" : "";
  return `      <li>
        <a class="news-card${mediaClass}" href="${hrefPrefix}${post.slug}.html">
${newsThumb(post)}          <span class="news-card-body">
          <span class="news-meta">
            <time class="news-date" datetime="${post.date.iso}">${dateShort}</time>
            <span class="news-tag">${escapeHtml(tagLabel)}</span>
          </span>
          <span class="news-title">${escapeHtml(post.title)}</span>
          <span class="news-teaser">${escapeHtml(post.teaser)}</span>
          </span>
        </a>
      </li>`;
}

function patchBetween(html, startMarker, endMarker, inner) {
  const start = html.indexOf(startMarker);
  const end = html.indexOf(endMarker);
  if (start === -1 || end === -1 || end < start) {
    throw new Error(`Markers missing: ${startMarker} … ${endMarker}`);
  }
  return (
    html.slice(0, start + startMarker.length) +
    "\n" +
    inner +
    "\n      " +
    html.slice(end)
  );
}

function ensureMarkers(filePath, listSelectorHint) {
  let html = fs.readFileSync(filePath, "utf8");
  if (html.includes("<!-- cms-news-start -->")) return html;

  // Inject markers just inside the first <ul class="news-list">
  const ulOpen = html.indexOf('<ul class="news-list">');
  if (ulOpen === -1) {
    throw new Error(`No news-list in ${filePath} (${listSelectorHint})`);
  }
  const afterUl = ulOpen + '<ul class="news-list">'.length;
  const insert =
    "\n      <!-- cms-news-start -->\n      <!-- cms-news-end -->\n";
  html = html.slice(0, afterUl) + insert + html.slice(afterUl);
  fs.writeFileSync(filePath, html);
  console.log(`  + markers added to ${path.relative(ROOT, filePath)}`);
  return html;
}

function updateNewsIndex(filePath, posts, lang) {
  let html = ensureMarkers(filePath, lang);
  const cards =
    lang === "en"
      ? posts.map((p) => newsCardEn(p)).join("\n")
      : posts.map((p) => newsCardUk(p)).join("\n");

  html = patchBetween(html, "<!-- cms-news-start -->", "<!-- cms-news-end -->", cards);

  // Update "Last updated" / "Оновлено" if we have CMS posts
  if (posts.length) {
    const latest = posts[0].date;
    if (lang === "en") {
      html = html.replace(
        /Last updated <time datetime="[^"]*">[^<]*<\/time>/,
        `Last updated <time datetime="${latest.iso}">${formatDateEnLong(latest)}</time>`
      );
    } else {
      html = html.replace(
        /Оновлено <time datetime="[^"]*">[^<]*<\/time>/,
        `Оновлено <time datetime="${latest.iso}">${formatDateUkLong(latest)}</time>`
      );
    }
  }

  fs.writeFileSync(filePath, html);
}

function updateHomepage(filePath, posts, lang, hrefPrefix) {
  let html = ensureMarkers(filePath, `homepage-${lang}`);
  // Inject CMS cards above handcrafted ones (same pattern as news indexes).
  const cards = posts.length
    ? lang === "en"
      ? posts.map((p) => newsCardEn(p, hrefPrefix)).join("\n")
      : posts.map((p) => newsCardUk(p, hrefPrefix)).join("\n")
    : "";

  html = patchBetween(html, "<!-- cms-news-start -->", "<!-- cms-news-end -->", cards);

  if (posts.length) {
    const latest = posts[0].date;
    if (lang === "en") {
      html = html.replace(
        /Updated <time datetime="[^"]*">[^<]*<\/time>/,
        `Updated <time datetime="${latest.iso}">${formatDateEnShort(latest)}</time>`
      );
    } else {
      html = html.replace(
        /Оновлено <time datetime="[^"]*">[^<]*<\/time>/,
        `Оновлено <time datetime="${latest.iso}">${formatDateUkShort(latest)}</time>`
      );
    }
  }

  fs.writeFileSync(filePath, html);
}

function sitemapEntry(enPath, ukPath, lastmod) {
  return `  <url>
    <loc>${SITE}${enPath}</loc>
    <xhtml:link rel="alternate" hreflang="en" href="${SITE}${enPath}" />
    <xhtml:link rel="alternate" hreflang="uk" href="${SITE}${ukPath}" />
    <xhtml:link rel="alternate" hreflang="x-default" href="${SITE}${enPath}" />
    <lastmod>${lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>${SITE}${ukPath}</loc>
    <xhtml:link rel="alternate" hreflang="en" href="${SITE}${enPath}" />
    <xhtml:link rel="alternate" hreflang="uk" href="${SITE}${ukPath}" />
    <xhtml:link rel="alternate" hreflang="x-default" href="${SITE}${enPath}" />
    <lastmod>${lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>`;
}

function updateSitemap(enPosts, ukPosts) {
  const sitemapPath = path.join(ROOT, "sitemap.xml");
  let xml = fs.readFileSync(sitemapPath, "utf8");

  const slugs = new Set([
    ...enPosts.map((p) => p.slug),
    ...ukPosts.map((p) => p.slug),
  ]);

  const bySlug = new Map();
  for (const p of enPosts) bySlug.set(p.slug, { ...bySlug.get(p.slug), en: p });
  for (const p of ukPosts) bySlug.set(p.slug, { ...bySlug.get(p.slug), uk: p });

  const blocks = [];
  for (const slug of [...slugs].sort()) {
    const pair = bySlug.get(slug);
    const lastmod = (pair.en || pair.uk).date.iso;
    // Skip if already present as a handcrafted entry outside the CMS block
    const cmsStartIdx = xml.indexOf("<!-- cms-sitemap-start -->");
    const handcraftedRegion = cmsStartIdx === -1 ? xml : xml.slice(0, cmsStartIdx);
    if (handcraftedRegion.includes(`/news/${slug}.html`)) continue;
    blocks.push(
      sitemapEntry(`/news/${slug}.html`, `/uk/news/${slug}.html`, lastmod)
    );
  }

  const markerStart = "<!-- cms-sitemap-start -->";
  const markerEnd = "<!-- cms-sitemap-end -->";
  if (!xml.includes(markerStart)) {
    xml = xml.replace(
      "</urlset>",
      `  ${markerStart}\n  ${markerEnd}\n</urlset>`
    );
  }
  xml = patchBetween(
    xml,
    markerStart,
    markerEnd,
    blocks.length ? blocks.join("\n") : ""
  );
  fs.writeFileSync(sitemapPath, xml);
  console.log(`  ✓ sitemap CMS block (${blocks.length} slug(s))`);
}

function writeArticles(posts, lang) {
  for (const post of posts) {
    const outDir =
      lang === "en"
        ? path.join(ROOT, "news")
        : path.join(ROOT, "uk", "news");
    const outPath = path.join(outDir, `${post.slug}.html`);
    const html = lang === "en" ? renderArticleEn(post) : renderArticleUk(post);
    fs.writeFileSync(outPath, html);
    console.log(`  ✓ ${path.relative(ROOT, outPath)}`);
  }
}

function main() {
  console.log("Building news from content/news/…");
  const en = readPosts("en");
  const uk = readPosts("uk");
  console.log(`  ${en.length} EN markdown, ${uk.length} UK markdown`);

  writeArticles(en, "en");
  writeArticles(uk, "uk");

  updateNewsIndex(path.join(ROOT, "news", "index.html"), en, "en");
  updateNewsIndex(path.join(ROOT, "uk", "news", "index.html"), uk, "uk");
  console.log("  ✓ news indexes patched");

  // Always refresh homepage CMS slots (clears stale cards when MD is removed).
  updateHomepage(path.join(ROOT, "index.html"), en, "en", "./news/");
  if (fs.existsSync(path.join(ROOT, "uk", "index.html"))) {
    updateHomepage(path.join(ROOT, "uk", "index.html"), uk, "uk", "./news/");
  }
  console.log("  ✓ homepage news slots patched");

  updateSitemap(en, uk);
  console.log("Done.");
}

main();
