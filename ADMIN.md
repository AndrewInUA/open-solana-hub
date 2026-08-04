# Open Solana Hub – Content Admin

Production admin: **https://www.opensolanahub.com/admin/**

## Login

1. Open `/admin/`
2. Click **Login with GitHub**
3. Authorize the **Open Solana Hub CMS** OAuth App (AndrewInUA account)
4. Edit and publish — Decap commits to `main`

No local `npx serve` or `decap-server` needed for day-to-day use.

## Whole picture: admin → live URL

Collections mirror the site navigation (EN + UK).

| Admin collection / entry | Live URL (EN) | Live URL (UK) |
|--------------------------|---------------|---------------|
| **Pages (EN)** → Home | `/` (`index.html`) | — |
| **Pages (UK)** → Головна | — | `/uk/` |
| **Pages** → Basics / Основи | `/basics.html` | `/uk/basics.html` |
| **Pages** → Stay safe / Безпека | `/stay-safe.html` | `/uk/stay-safe.html` |
| **Pages** → First steps / Перші кроки | `/first-steps.html` | `/uk/first-steps.html` |
| **Pages** → Ecosystem / Екосистема | `/ecosystem.html` | `/uk/ecosystem.html` |
| **Pages** → Glossary / Словник | `/glossary.html` | `/uk/glossary.html` |
| **Pages** → Validator assessment / Оцінка валідаторів | `/compare-validators.html` | `/uk/compare-validators.html` |
| **Pages** → About / Про проєкт | `/about.html` | `/uk/about.html` |
| **News (EN)** / **News (UK)** | `/news/{slug}.html` | `/uk/news/{slug}.html` |
| **Media** | `/content/media/...` | same |

### Not in the CMS (by design)

| Area | Why |
|------|-----|
| **Validator Transparency Dashboard** (`/compare/`) | Live data app (API, charts, directory). Edit code/backend, not Decap. |
| **Nav, footer, SEO shell** (canonical, FAQ JSON-LD, language switch) | Layout chrome — kept in HTML templates so design stays consistent. |
| **Homepage guide cards / suggested path** | Structural links to pages; titles of those pages are edited under each Pages entry. |
| **Brand-new site sections** (new nav items) | File list is fixed to the current nav. Ask a developer to add a page file + HTML shell if you need a new section. |

## How to edit a page body

1. Login → **Pages (EN)** or **Pages (UK)**
2. Open the nav-named entry (e.g. **Basics**)
3. Edit **Title**, **Lead**, optional **Page image**
4. Edit **Body** — full article content (headings, lists, links, media)
   - Existing pages were migrated as **HTML** so the live text is already there: change wording inside the tags, or add Markdown blocks for new sections
   - Insert images from **Media**
5. **Publish** → wait for Vercel (~1–2 min) → hard-refresh the live page

Bottom “Next / Back” buttons stay in the template (site navigation), not in the body field.

### Homepage

Under **Home** / **Головна** you can edit:

- Hero title, lead, optional hero image
- “What is Solana?” title, body, optional image
- Learn section kicker / title / intro
- Dashboard blurb kicker / title / body

News cards on the homepage come from the **News** collections automatically.

## News

All four existing posts are in the CMS (`content/news/en|uk/*.md`).

1. **News (EN)** → New post (or open an existing one)
2. Set **slug** carefully (URL path) — use the **same slug** in **News (UK)** for bilingual pairs
3. Fill title, date, tag, meta description, teaser, body
4. **Publish**

Build generates article HTML, news index cards, homepage cards, and sitemap entries.

## Media library

1. Sidebar → **Media**
2. Upload PNG / JPG / WebP / SVG
3. Files live in `content/media/` → served as `/content/media/...`
4. Reuse on any Page or inside News bodies

## EN + UK parity

Edit both language collections when you change text or images. The CMS does not auto-translate.

## After publish

1. Wait for the Vercel deploy to finish
2. Hard-refresh `/admin/` (and the public page) so you see the latest entries
3. Local/CI build: `npm run build` runs `build-news` then `build-pages`

## One-time setup (GitHub OAuth + Vercel env)

If login fails with a missing client id / secret:

### A. GitHub OAuth App

1. https://github.com/settings/developers → **OAuth Apps** → **New OAuth App**
2. Name: `Open Solana Hub CMS`
3. Homepage URL: `https://www.opensolanahub.com`
4. Callback URL: `https://www.opensolanahub.com/api/callback`
5. Copy **Client ID** and generate a **Client secret**

### B. Vercel env (Production)

| Name | Value |
|------|--------|
| `GITHUB_CLIENT_ID` | from step A |
| `GITHUB_CLIENT_SECRET` | from step A |
| `OAUTH_REDIRECT_URI` | `https://www.opensolanahub.com/api/callback` |

Redeploy after saving.

## Local trial (optional)

```bash
# terminal 1
npx serve .

# terminal 2 — only if admin/config.yml has local_backend: true
npx decap-server
```

Production config has `local_backend: false` and uses the Vercel OAuth proxy.

```bash
npm run build        # news + pages
npm run build:news   # news only
npm run build:pages  # pages only
```

## Repo map

| Path | Role |
|------|------|
| `admin/` | Decap UI (`index.html` loads script **after** `#nc-root` — do not move it into `<head>`) |
| `admin/config.yml` | Collections: Pages EN/UK, News EN/UK, Media |
| `content/pages/{en,uk}/` | Home + each nav page YAML (title, lead, image, **body**) |
| `content/news/{en,uk}/` | News Markdown (frontmatter + body) |
| `content/media/` | Uploaded media |
| `api/auth.js`, `api/callback.js` | OAuth proxy |
| `scripts/build-news.mjs` | MD → news HTML, indexes, homepage cards, sitemap |
| `scripts/build-pages.mjs` | YAML → inject title/lead/body/images into HTML shells |
| `scripts/migrate-to-cms.mjs` | One-shot importer (already run; keep for reference) |
