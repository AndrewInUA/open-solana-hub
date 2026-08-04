# Open Solana Hub – Content Admin

Production admin: **https://www.opensolanahub.com/admin/**

## Login

1. Open `/admin/`
2. Click **Login with GitHub**
3. Authorize the **Open Solana Hub CMS** OAuth App (AndrewInUA account)
4. Edit and publish — Decap commits to `main`

No local `npx serve` or `decap-server` needed for day-to-day use.

## What you can edit

| Collection | What it controls |
|------------|------------------|
| **News (EN)** / **News (UK)** | Full news articles (Markdown → HTML on build) |
| **Homepage (EN)** / **Homepage (UK)** | Hero title & lead, “What is Solana?” text, hero + section images |
| **Guides (EN)** / **Guides (UK)** | Title, lead, and page image for Basics, Stay safe, First steps, Ecosystem, Glossary, Validator assessment, About |

The interactive **Validator Transparency Dashboard** (`/compare/`) is not CMS-edited — it is a live data tool.

Decap is **not** a Figma-like page builder. You edit structured fields (text + images). Layout, navigation, and most body copy on guide pages stay in the HTML templates on purpose.

## Media library

1. In the admin sidebar, open **Media**.
2. Upload photos/graphics (PNG, JPG, WebP, SVG, etc.).
3. Files are stored under `content/media/` and served at `/content/media/...`.
4. Reuse the same upload on Homepage, Guides, and inside News article bodies.

Tip: prefer wide images (~1600px) for the homepage hero; keep file size reasonable for visitors on mobile.

## Add a photo to the homepage

1. Login → **Homepage (EN)** (and the same for **Homepage (UK)** if you want parity).
2. Upload or pick an image in **Hero image** (under the CTAs) and/or **Section image** (under “What is Solana?”).
3. Fill **alt** text (accessibility) and optional **caption**.
4. Click **Publish**.
5. Wait for the Vercel deploy (~1–2 minutes). The live homepage will show the image.

Same idea for a guide: open **Guides (EN)** → pick the page → set **Page image** → Publish.

## Create a bilingual news post

1. In **News (EN)**, create a post. Set the **slug** carefully (e.g. `my-topic-august-2026`).
2. In **News (UK)**, create the Ukrainian version with the **same slug**.
3. Fill title, date, tag, meta description, teaser, and body.
4. Insert images from the Media library into the body as needed.
5. Click **Publish** — Decap commits to GitHub.

On the next Vercel deploy, `npm run build` generates:

- `news/{slug}.html` and `uk/news/{slug}.html`
- Cards on the news indexes and homepage
- Sitemap entries for new slugs
- Homepage / guide media & text from `content/pages/`

Existing handcrafted HTML news posts are left alone and stay on the indexes below CMS cards.

## EN + UK parity

Edit both language collections when you change text or add images. The CMS does not auto-translate or copy images between EN and UK — use the same Media file in both if you want matching photos.

## One-time setup (GitHub OAuth + Vercel env)

If login fails with a missing client id / secret, complete this once:

### A. Create a GitHub OAuth App

1. Open https://github.com/settings/developers → **OAuth Apps** → **New OAuth App**
2. Application name: `Open Solana Hub CMS`
3. Homepage URL: `https://www.opensolanahub.com`
4. Authorization callback URL: `https://www.opensolanahub.com/api/callback`
5. Register → copy **Client ID** and generate a **Client secret**

### B. Set Vercel environment variables

In the Vercel project for this repo → **Settings** → **Environment Variables** (Production):

| Name | Value |
|------|--------|
| `GITHUB_CLIENT_ID` | Client ID from step A |
| `GITHUB_CLIENT_SECRET` | Client secret from step A |
| `OAUTH_REDIRECT_URI` | `https://www.opensolanahub.com/api/callback` |

Redeploy after saving env vars.

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
npm run build:pages  # homepage/guides only
```

## Undo / scope

- Admin UI: `admin/` (script loads after `#nc-root` — do not move it into `<head>`)
- News drafts: `content/news/`
- Page fields: `content/pages/`
- Media: `content/media/`
- OAuth proxy: `api/auth.js`, `api/callback.js`
- Build: `scripts/build-news.mjs`, `scripts/build-pages.mjs`
