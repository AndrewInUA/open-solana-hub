#!/usr/bin/env node
/**
 * Inject CMS page YAML into static HTML (full editorial fields).
 *
 * Reads:  content/pages/{en,uk}/home.yml
 *         content/pages/{en,uk}/{slug}.yml
 * Patches marked regions in index.html / uk/index.html / page HTML files.
 *
 * Empty image fields clear the media slot. Empty text fields leave HTML alone
 * (except body: empty body clears the body slot).
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";
import { marked } from "marked";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

marked.setOptions({ gfm: true, breaks: false });

const CONTENT_PAGES = [
  "basics",
  "stay-safe",
  "first-steps",
  "ecosystem",
  "glossary",
  "compare-validators",
  "about",
];

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function readYaml(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const data = yaml.load(fs.readFileSync(filePath, "utf8"));
  return data && typeof data === "object" ? data : null;
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

function hasMarkers(html, startMarker) {
  return html.includes(startMarker);
}

function publicSrc(image) {
  if (!image) return "";
  const s = String(image).trim();
  if (!s) return "";
  if (
    s.startsWith("http://") ||
    s.startsWith("https://") ||
    s.startsWith("/")
  ) {
    return s;
  }
  return `/${s}`;
}

function renderFigure(image, alt, caption, className = "cms-figure") {
  const src = publicSrc(image);
  if (!src) return "";
  const altEsc = escapeHtml(alt || "");
  let html = `<figure class="${className}">\n        <img src="${escapeHtml(src)}" alt="${altEsc}" loading="lazy" decoding="async" />`;
  if (caption && String(caption).trim()) {
    html += `\n        <figcaption>${escapeHtml(String(caption).trim())}</figcaption>`;
  }
  html += `\n      </figure>`;
  return html;
}

function mdToInnerHtml(md) {
  if (md == null || String(md).trim() === "") return null;
  let html = marked.parse(String(md).trim(), { async: false }).trim();
  const single = html.match(/^<p>([\s\S]*)<\/p>$/i);
  if (single) return single[1];
  return html;
}

function mdToBlockHtml(md) {
  if (md == null || String(md).trim() === "") return "";
  return marked.parse(String(md).trim(), { async: false }).trim();
}

function patchText(html, startMarker, endMarker, value, { asMarkdown = false } = {}) {
  if (!hasMarkers(html, startMarker)) return html;
  if (value == null || String(value).trim() === "") return html;
  const inner = asMarkdown
    ? mdToInnerHtml(value)
    : escapeHtml(String(value).trim());
  if (inner == null) return html;
  return patchBetween(html, startMarker, endMarker, inner);
}

function patchMedia(html, startMarker, endMarker, image, alt, caption, className) {
  if (!hasMarkers(html, startMarker)) return html;
  return patchBetween(
    html,
    startMarker,
    endMarker,
    renderFigure(image, alt, caption, className)
  );
}

function looksLikeHtml(value) {
  const s = String(value).trim();
  return /^<[a-z][\s\S]*>/i.test(s);
}

function patchBody(html, value) {
  if (!hasMarkers(html, "<!-- cms-page-body-start -->")) return html;
  // Explicit empty string clears; null/undefined leaves alone
  if (value == null) return html;
  if (String(value).trim() === "") {
    return patchBetween(
      html,
      "<!-- cms-page-body-start -->",
      "<!-- cms-page-body-end -->",
      ""
    );
  }
  // Migrated pages store HTML; new edits may be Markdown.
  const inner = looksLikeHtml(value) ? String(value).trim() : mdToBlockHtml(value);
  return patchBetween(
    html,
    "<!-- cms-page-body-start -->",
    "<!-- cms-page-body-end -->",
    inner
  );
}

function buildHomepage(lang) {
  const data =
    readYaml(path.join(ROOT, "content", "pages", lang, "home.yml")) ||
    readYaml(path.join(ROOT, "content", "pages", lang, "homepage.yml"));
  if (!data) {
    console.log(`  · skip homepage ${lang} (no YAML)`);
    return;
  }

  const htmlPath =
    lang === "en"
      ? path.join(ROOT, "index.html")
      : path.join(ROOT, "uk", "index.html");
  let html = fs.readFileSync(htmlPath, "utf8");

  html = patchText(
    html,
    "<!-- cms-hero-title-start -->",
    "<!-- cms-hero-title-end -->",
    data.hero_title
  );
  html = patchText(
    html,
    "<!-- cms-hero-lead-start -->",
    "<!-- cms-hero-lead-end -->",
    data.hero_lead,
    { asMarkdown: true }
  );
  html = patchMedia(
    html,
    "<!-- cms-hero-media-start -->",
    "<!-- cms-hero-media-end -->",
    data.hero_image,
    data.hero_image_alt,
    data.hero_caption,
    "cms-figure cms-figure-hero"
  );
  html = patchText(
    html,
    "<!-- cms-section-title-start -->",
    "<!-- cms-section-title-end -->",
    data.section_title
  );
  html = patchText(
    html,
    "<!-- cms-section-body-start -->",
    "<!-- cms-section-body-end -->",
    data.section_body,
    { asMarkdown: true }
  );
  html = patchMedia(
    html,
    "<!-- cms-section-media-start -->",
    "<!-- cms-section-media-end -->",
    data.section_image,
    data.section_image_alt,
    data.section_caption,
    "cms-figure cms-figure-section"
  );

  html = patchText(
    html,
    "<!-- cms-learn-kicker-start -->",
    "<!-- cms-learn-kicker-end -->",
    data.learn_kicker
  );
  html = patchText(
    html,
    "<!-- cms-learn-title-start -->",
    "<!-- cms-learn-title-end -->",
    data.learn_title
  );
  html = patchText(
    html,
    "<!-- cms-learn-intro-start -->",
    "<!-- cms-learn-intro-end -->",
    data.learn_intro,
    { asMarkdown: true }
  );
  html = patchText(
    html,
    "<!-- cms-dashboard-kicker-start -->",
    "<!-- cms-dashboard-kicker-end -->",
    data.dashboard_kicker
  );
  html = patchText(
    html,
    "<!-- cms-dashboard-title-start -->",
    "<!-- cms-dashboard-title-end -->",
    data.dashboard_title
  );
  html = patchText(
    html,
    "<!-- cms-dashboard-body-start -->",
    "<!-- cms-dashboard-body-end -->",
    data.dashboard_body,
    { asMarkdown: true }
  );

  fs.writeFileSync(htmlPath, html);
  console.log(`  ✓ home ${lang}`);
}

function buildPage(lang, slug) {
  const data = readYaml(
    path.join(ROOT, "content", "pages", lang, `${slug}.yml`)
  );
  if (!data) {
    // Legacy path during transition
    const legacy = readYaml(
      path.join(ROOT, "content", "pages", lang, "guides", `${slug}.yml`)
    );
    if (!legacy) {
      console.log(`  · skip ${lang}/${slug} (no YAML)`);
      return;
    }
    return buildPageFromData(lang, slug, legacy);
  }
  return buildPageFromData(lang, slug, data);
}

function buildPageFromData(lang, slug, data) {
  const htmlPath =
    lang === "en"
      ? path.join(ROOT, `${slug}.html`)
      : path.join(ROOT, "uk", `${slug}.html`);
  if (!fs.existsSync(htmlPath)) {
    console.log(`  · skip missing ${path.relative(ROOT, htmlPath)}`);
    return;
  }

  let html = fs.readFileSync(htmlPath, "utf8");

  html = patchText(
    html,
    "<!-- cms-page-title-start -->",
    "<!-- cms-page-title-end -->",
    data.title
  );
  html = patchText(
    html,
    "<!-- cms-page-lead-start -->",
    "<!-- cms-page-lead-end -->",
    data.lead,
    { asMarkdown: true }
  );
  html = patchMedia(
    html,
    "<!-- cms-page-media-start -->",
    "<!-- cms-page-media-end -->",
    data.page_image,
    data.page_image_alt,
    data.page_image_caption,
    "cms-figure cms-figure-page"
  );
  html = patchBody(html, data.body);

  fs.writeFileSync(htmlPath, html);
  console.log(`  ✓ ${lang}/${slug}`);
}

function main() {
  console.log("Building pages from content/pages/…");
  for (const lang of ["en", "uk"]) {
    buildHomepage(lang);
    for (const slug of CONTENT_PAGES) buildPage(lang, slug);
  }
  console.log("Done pages.");
}

main();
