#!/usr/bin/env node
/**
 * One-shot migration: extract live HTML page bodies + news into CMS content files,
 * add cms-page-body markers, flatten guides → content/pages/{lang}/*.yml,
 * rename homepage.yml → home.yml.
 *
 * Page bodies are stored as HTML (lossless). News bodies as Markdown (+ HTML callouts).
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const PAGES = [
  "basics",
  "stay-safe",
  "first-steps",
  "ecosystem",
  "glossary",
  "compare-validators",
  "about",
];

const NEWS_SLUGS = [
  "agave-4-2-release-august-2026",
  "alpenglow-consensus-status-july-2026",
  "solana-onchain-governance-sgp",
  "firedancer-live-on-mainnet",
];

function decodeEntities(s) {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function stripTags(html) {
  return decodeEntities(String(html).replace(/<[^>]+>/g, ""));
}

function collapseBlank(s) {
  return s.replace(/\n{3,}/g, "\n\n").trim();
}

function normalizeBodyHtml(html) {
  let s = html.trim();
  // Drop redundant inline styles (CSS .prose strong already handles color)
  s = s.replace(/<strong\s+style="[^"]*">/gi, "<strong>");
  // Tidy indentation for YAML readability
  s = s
    .split("\n")
    .map((line) => line.replace(/^\s+/, (m) => (m.length >= 4 ? "  " : m.replace(/^\s+/, ""))))
    .join("\n");
  return collapseBlank(s) + "\n";
}

function htmlInlineToMd(html) {
  let s = html;
  s = s.replace(/<a\s+([^>]*?)>([\s\S]*?)<\/a>/gi, (_, attrs, text) => {
    const href = (attrs.match(/href="([^"]*)"/i) || [])[1] || "";
    return `[${stripTags(text).trim()}](${href})`;
  });
  s = s.replace(/<strong(?:\s[^>]*)?>([\s\S]*?)<\/strong>/gi, (_, t) => `**${stripTags(t).trim()}**`);
  s = s.replace(/<em>([\s\S]*?)<\/em>/gi, (_, t) => `*${stripTags(t).trim()}*`);
  s = s.replace(/<code>([\s\S]*?)<\/code>/gi, (_, t) => `\`${stripTags(t).trim()}\``);
  s = s.replace(/<br\s*\/?>/gi, " ");
  s = s.replace(/<[^>]+>/g, "");
  return decodeEntities(s).replace(/[ \t]+/g, " ").trim();
}

/** News HTML → Markdown; preserve callout blocks as raw HTML. */
function newsHtmlToMarkdown(html) {
  const blocks = [];
  let s = html.trim();

  s = s.replace(/<div class="callout">([\s\S]*?)<\/div>/gi, (_, inner) => {
    const i = blocks.length;
    // Normalize callout inner: keep structure, drop heavy indentation
    const clean = `<div class="callout">\n${inner.trim()}\n</div>`;
    blocks.push(clean);
    return `\n\n%%BLOCK${i}%%\n\n`;
  });

  s = s.replace(/<strong\s+style="[^"]*">/gi, "<strong>");
  s = s.replace(/<h2>([\s\S]*?)<\/h2>/gi, (_, t) => `\n\n## ${stripTags(t).trim()}\n\n`);
  s = s.replace(/<h3>([\s\S]*?)<\/h3>/gi, (_, t) => `\n\n### ${stripTags(t).trim()}\n\n`);
  s = s.replace(/<blockquote>([\s\S]*?)<\/blockquote>/gi, (_, inner) => {
    const text = htmlInlineToMd(inner.replace(/<\/?p>/gi, "\n").trim());
    return "\n\n" + text.split("\n").map((l) => `> ${l.trim()}`).filter((l) => l !== "> ").join("\n") + "\n\n";
  });
  s = s.replace(/<ul>([\s\S]*?)<\/ul>/gi, (_, inner) => {
    const items = [...inner.matchAll(/<li>([\s\S]*?)<\/li>/gi)].map(
      (m) => `- ${htmlInlineToMd(m[1])}`
    );
    return "\n\n" + items.join("\n") + "\n\n";
  });
  s = s.replace(/<p(?:\s[^>]*)?>([\s\S]*?)<\/p>/gi, (_, inner) => `\n\n${htmlInlineToMd(inner)}\n\n`);
  s = s.replace(/<br\s*\/?>/gi, " ");
  s = s.replace(/<\/?(?:div|span)(?:\s[^>]*)?>/gi, "");

  s = decodeEntities(s);
  s = collapseBlank(s);

  for (let i = 0; i < blocks.length; i++) {
    s = s.replace(`%%BLOCK${i}%%`, blocks[i]);
  }
  return s.trim() + "\n";
}

function extractBetween(html, startMarker, endMarker) {
  const start = html.indexOf(startMarker);
  const end = html.indexOf(endMarker);
  if (start === -1 || end === -1 || end < start) return "";
  return html.slice(start + startMarker.length, end).trim();
}

function extractPageBodyHtml(html) {
  const mediaEnd = "<!-- cms-page-media-end -->";
  const mediaIdx = html.indexOf(mediaEnd);
  if (mediaIdx === -1) throw new Error("cms-page-media-end missing");
  const afterMedia = html.slice(mediaIdx + mediaEnd.length);
  const articleEnd = afterMedia.indexOf("</article>");
  if (articleEnd === -1) throw new Error("</article> missing");
  const region = afterMedia.slice(0, articleEnd);
  const pathMatches = [...region.matchAll(/<div class="path-row"[^>]*>/g)];
  if (!pathMatches.length) return region.trim();
  const last = pathMatches[pathMatches.length - 1];
  return region.slice(0, last.index).trim();
}

function ensureBodyMarkers(html) {
  if (html.includes("<!-- cms-page-body-start -->")) return html;
  const mediaEnd = "<!-- cms-page-media-end -->";
  const mediaIdx = html.indexOf(mediaEnd);
  if (mediaIdx === -1) throw new Error("cms-page-media-end missing");
  const afterMediaPos = mediaIdx + mediaEnd.length;
  const afterMedia = html.slice(afterMediaPos);
  const articleEndRel = afterMedia.indexOf("</article>");
  const region = afterMedia.slice(0, articleEndRel);
  const pathMatches = [...region.matchAll(/<div class="path-row"[^>]*>/g)];
  if (!pathMatches.length) throw new Error("no path-row for body end marker");
  const last = pathMatches[pathMatches.length - 1];
  const bodyEndAbs = afterMediaPos + last.index;
  return (
    html.slice(0, afterMediaPos) +
    "\n      <!-- cms-page-body-start -->\n" +
    html.slice(afterMediaPos, bodyEndAbs) +
    "\n      <!-- cms-page-body-end -->\n      " +
    html.slice(bodyEndAbs)
  );
}

function readExistingGuideYaml(lang, slug) {
  const p = path.join(ROOT, "content", "pages", lang, "guides", `${slug}.yml`);
  if (!fs.existsSync(p)) return {};
  return yaml.load(fs.readFileSync(p, "utf8")) || {};
}

function htmlPath(lang, slug) {
  return lang === "en"
    ? path.join(ROOT, `${slug}.html`)
    : path.join(ROOT, "uk", `${slug}.html`);
}

function dumpYaml(data) {
  // Use literal block for body so HTML is preserved
  const { body, ...rest } = data;
  let out = yaml.dump(rest, { lineWidth: 100, noRefs: true, quotingType: '"' });
  if (body != null) {
    const lines = String(body).replace(/\n$/, "").split("\n");
    out += "body: |\n";
    for (const line of lines) out += `  ${line}\n`;
  }
  return out;
}

function migratePage(lang, slug) {
  const file = htmlPath(lang, slug);
  let html = fs.readFileSync(file, "utf8");
  const existing = readExistingGuideYaml(lang, slug);

  const titleRaw = extractBetween(
    html,
    "<!-- cms-page-title-start -->",
    "<!-- cms-page-title-end -->"
  );
  const title = (titleRaw || existing.title || slug).replace(/\s+/g, " ").trim();
  const leadHtml = extractBetween(
    html,
    "<!-- cms-page-lead-start -->",
    "<!-- cms-page-lead-end -->"
  );
  const leadMd = leadHtml ? htmlInlineToMd(leadHtml) : String(existing.lead || "");
  const bodyHtml = normalizeBodyHtml(extractPageBodyHtml(html));

  const data = {
    title,
    lead: leadMd,
    page_image: existing.page_image || "",
    page_image_alt: existing.page_image_alt || "",
    page_image_caption: existing.page_image_caption || "",
    body: bodyHtml,
  };

  const outDir = path.join(ROOT, "content", "pages", lang);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, `${slug}.yml`), dumpYaml(data));
  console.log(`  ✓ ${lang}/${slug}.yml (${bodyHtml.length} chars HTML body)`);

  html = ensureBodyMarkers(html);
  fs.writeFileSync(file, html);
}

function extractHomeSection(html, headingId) {
  const h2Re = new RegExp(`<h2 id="${headingId}">([\\s\\S]*?)<\\/h2>`);
  const h2 = html.match(h2Re);
  const title = h2 ? stripTags(h2[1]).trim() : "";
  const searchFrom = h2 ? h2.index : 0;
  const before = html.slice(Math.max(0, searchFrom - 200), searchFrom);
  const km = before.match(/hub-block-kicker">([^<]+)</);
  const kicker = km ? km[1].trim() : "";
  let intro = "";
  if (h2) {
    const after = html.slice(h2.index + h2[0].length);
    const pm = after.match(/<p>([\s\S]*?)<\/p>/);
    if (pm) intro = htmlInlineToMd(pm[1]);
  }
  return { kicker, title, intro };
}

function ensureHomeMarkers(html) {
  if (html.includes("<!-- cms-learn-title-start -->")) return html;
  html = html.replace(
    /(aria-labelledby="learn-heading">\s*<span class="hub-block-kicker">)([^<]+)(<\/span>)/,
    `$1<!-- cms-learn-kicker-start -->$2<!-- cms-learn-kicker-end -->$3`
  );
  html = html.replace(
    /(<h2 id="learn-heading">)([\s\S]*?)(<\/h2>)/,
    `$1<!-- cms-learn-title-start -->\n$2\n      <!-- cms-learn-title-end -->$3`
  );
  html = html.replace(
    /(<!-- cms-learn-title-end --><\/h2>\s*<p>)([\s\S]*?)(<\/p>)/,
    `$1<!-- cms-learn-intro-start -->\n$2\n      <!-- cms-learn-intro-end -->$3`
  );
  html = html.replace(
    /(aria-labelledby="dashboard-heading">\s*<span class="hub-block-kicker">)([^<]+)(<\/span>)/,
    `$1<!-- cms-dashboard-kicker-start -->$2<!-- cms-dashboard-kicker-end -->$3`
  );
  html = html.replace(
    /(<h2 id="dashboard-heading">)([\s\S]*?)(<\/h2>)/,
    `$1<!-- cms-dashboard-title-start -->\n$2\n      <!-- cms-dashboard-title-end -->$3`
  );
  html = html.replace(
    /(<!-- cms-dashboard-title-end --><\/h2>\s*<p>)([\s\S]*?)(<\/p>)/,
    `$1<!-- cms-dashboard-body-start -->\n$2\n      <!-- cms-dashboard-body-end -->$3`
  );
  return html;
}

function migrateHome(lang) {
  const src = path.join(ROOT, "content", "pages", lang, "homepage.yml");
  const dest = path.join(ROOT, "content", "pages", lang, "home.yml");
  const data = fs.existsSync(src)
    ? yaml.load(fs.readFileSync(src, "utf8"))
    : fs.existsSync(dest)
      ? yaml.load(fs.readFileSync(dest, "utf8"))
      : {};

  const htmlPathHome =
    lang === "en" ? path.join(ROOT, "index.html") : path.join(ROOT, "uk", "index.html");
  let html = fs.readFileSync(htmlPathHome, "utf8");
  const learn = extractHomeSection(html, "learn-heading");
  const dash = extractHomeSection(html, "dashboard-heading");

  const out = {
    hero_title: data.hero_title || "",
    hero_lead: data.hero_lead || "",
    hero_image: data.hero_image || "",
    hero_image_alt: data.hero_image_alt || "",
    hero_caption: data.hero_caption || "",
    section_title: data.section_title || "",
    section_body: data.section_body || "",
    section_image: data.section_image || "",
    section_image_alt: data.section_image_alt || "",
    section_caption: data.section_caption || "",
    learn_kicker: data.learn_kicker || learn.kicker || "",
    learn_title: data.learn_title || learn.title || "",
    learn_intro: data.learn_intro || learn.intro || "",
    dashboard_kicker: data.dashboard_kicker || dash.kicker || "",
    dashboard_title: data.dashboard_title || dash.title || "",
    dashboard_body: data.dashboard_body || dash.intro || "",
  };

  fs.writeFileSync(dest, yaml.dump(out, { lineWidth: 100, noRefs: true }));
  console.log(`  ✓ ${lang}/home.yml`);
  html = ensureHomeMarkers(html);
  fs.writeFileSync(htmlPathHome, html);
  if (fs.existsSync(src)) fs.unlinkSync(src);
}

function extractNewsArticle(lang, slug) {
  const file =
    lang === "en"
      ? path.join(ROOT, "news", `${slug}.html`)
      : path.join(ROOT, "uk", "news", `${slug}.html`);
  if (!fs.existsSync(file)) return null;
  const html = fs.readFileSync(file, "utf8");

  const title = (html.match(/<h1>([\s\S]*?)<\/h1>/) || [])[1];
  const titleText = title ? stripTags(title).trim() : slug;
  const time = (html.match(/<time datetime="([^"]+)">/) || [])[1] || "1970-01-01";
  const tag = (html.match(/<span class="news-tag">([^<]+)<\/span>/) || [])[1] || "Ecosystem";
  const desc =
    (html.match(/<meta name="description" content="([^"]*)"/) || [])[1] || "";

  const indexFile =
    lang === "en"
      ? path.join(ROOT, "news", "index.html")
      : path.join(ROOT, "uk", "news", "index.html");
  const indexHtml = fs.readFileSync(indexFile, "utf8");
  const cardRe = new RegExp(
    `href="[^"]*${slug}\\.html"[\\s\\S]*?<span class="news-teaser">([\\s\\S]*?)<\\/span>`,
    "i"
  );
  const teaserMatch = indexHtml.match(cardRe);
  const teaser = teaserMatch ? stripTags(teaserMatch[1]).trim() : desc;

  const metaIdx = html.indexOf("article-meta");
  const metaEnd = html.indexOf("</div>", metaIdx);
  const afterMeta = html.slice(metaEnd + 6);
  const articleEnd = afterMeta.indexOf("</article>");
  const region = afterMeta.slice(0, articleEnd);
  const pathMatches = [...region.matchAll(/<div class="path-row"/g)];
  const bodyHtml = pathMatches.length
    ? region.slice(0, pathMatches[pathMatches.length - 1].index).trim()
    : region.trim();

  const TAG_FROM_UK = {
    Клієнти: "Clients",
    Консенсус: "Consensus",
    Голосування: "Governance",
    Екосистема: "Ecosystem",
  };

  return {
    slug,
    title: titleText,
    date: time,
    tag: TAG_FROM_UK[tag] || tag,
    description: decodeEntities(desc),
    teaser,
    body: newsHtmlToMarkdown(bodyHtml),
  };
}

function writeNewsMd(lang, post) {
  const dir = path.join(ROOT, "content", "news", lang);
  fs.mkdirSync(dir, { recursive: true });
  const front = {
    title: post.title,
    date: post.date,
    tag: post.tag,
    description: post.description,
    teaser: post.teaser,
  };
  const md =
    "---\n" +
    yaml.dump(front, { lineWidth: 100, noRefs: true }).trim() +
    "\n---\n\n" +
    post.body.trim() +
    "\n";
  fs.writeFileSync(path.join(dir, `${post.slug}.md`), md);
  console.log(`  ✓ news/${lang}/${post.slug}.md`);
}

function stripHandcraftedNewsCards() {
  const files = [
    path.join(ROOT, "news", "index.html"),
    path.join(ROOT, "uk", "news", "index.html"),
    path.join(ROOT, "index.html"),
    path.join(ROOT, "uk", "index.html"),
  ];
  for (const file of files) {
    if (!fs.existsSync(file)) continue;
    let html = fs.readFileSync(file, "utf8");
    const endMarker = "<!-- cms-news-end -->";
    const endIdx = html.indexOf(endMarker);
    if (endIdx === -1) continue;
    const after = html.slice(endIdx + endMarker.length);
    const ulClose = after.indexOf("</ul>");
    if (ulClose === -1) continue;
    const between = after.slice(0, ulClose).replace(/<li>[\s\S]*?<\/li>/g, "");
    html =
      html.slice(0, endIdx + endMarker.length) + between + after.slice(ulClose);
    fs.writeFileSync(file, html);
    console.log(`  ✓ cleared handcrafted cards in ${path.relative(ROOT, file)}`);
  }
}

function removeOldGuidesDirs() {
  for (const lang of ["en", "uk"]) {
    const dir = path.join(ROOT, "content", "pages", lang, "guides");
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
      console.log(`  ✓ removed ${path.relative(ROOT, dir)}`);
    }
  }
}

function main() {
  console.log("Migrating pages…");
  for (const lang of ["en", "uk"]) {
    migrateHome(lang);
    for (const slug of PAGES) migratePage(lang, slug);
  }

  console.log("Migrating news…");
  for (const lang of ["en", "uk"]) {
    for (const slug of NEWS_SLUGS) {
      const post = extractNewsArticle(lang, slug);
      if (post) writeNewsMd(lang, post);
    }
  }

  console.log("Clearing handcrafted news index duplicates…");
  stripHandcraftedNewsCards();

  console.log("Removing old guides/ folders…");
  removeOldGuidesDirs();

  console.log("Done migration.");
}

main();
