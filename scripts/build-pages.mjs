#!/usr/bin/env node
/**
 * Inject CMS page YAML (media + key text) into static HTML.
 *
 * Reads:  content/pages/{en,uk}/homepage.yml
 *         content/pages/{en,uk}/guides/*.yml
 * Patches marked regions in index.html / uk/index.html / guide HTML files.
 *
 * Empty image fields clear the media slot (no broken placeholders).
 * Missing YAML or empty text fields leave existing HTML text alone.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";
import { marked } from "marked";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

marked.setOptions({ gfm: true, breaks: false });

const GUIDE_PAGES = [
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

function buildHomepage(lang) {
  const data = readYaml(
    path.join(ROOT, "content", "pages", lang, "homepage.yml")
  );
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

  fs.writeFileSync(htmlPath, html);
  console.log(`  ✓ homepage ${lang}`);
}

function buildGuide(lang, slug) {
  const data = readYaml(
    path.join(ROOT, "content", "pages", lang, "guides", `${slug}.yml`)
  );
  if (!data) {
    console.log(`  · skip ${lang}/${slug} (no YAML)`);
    return;
  }

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

  fs.writeFileSync(htmlPath, html);
  console.log(`  ✓ ${lang}/${slug}`);
}

function main() {
  console.log("Building pages from content/pages/…");
  for (const lang of ["en", "uk"]) {
    buildHomepage(lang);
    for (const slug of GUIDE_PAGES) buildGuide(lang, slug);
  }
  console.log("Done pages.");
}

main();
