# Open Solana Hub – Content Admin

Production admin: **https://www.opensolanahub.com/admin/**

## Login

1. Open `/admin/`
2. Click **Login with GitHub**
3. Authorize the **Open Solana Hub CMS** OAuth App (AndrewInUA account)
4. Edit and publish — Decap commits Markdown to `main`

No local `npx serve` or `decap-server` needed for day-to-day use.

## Create a bilingual news post

1. In **News (EN)**, create a post. Set the **slug** carefully (e.g. `my-topic-august-2026`).
2. In **News (UK)**, create the Ukrainian version with the **same slug**.
3. Fill title, date, tag, meta description, teaser, and body.
4. Upload images via the media library (`content/news/media/`).
5. Click **Publish** — Decap commits to GitHub.

On the next Vercel deploy (automatic after the commit), `npm run build` generates:

- `news/{slug}.html` and `uk/news/{slug}.html`
- Cards on the news indexes and homepage
- Sitemap entries for new slugs

Existing handcrafted HTML posts are left alone and stay on the indexes below CMS cards.

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

## Undo / scope

- Admin UI: `admin/`
- Drafts & media: `content/news/`
- OAuth proxy: `api/auth.js`, `api/callback.js`
- HTML generator: `scripts/build-news.mjs`
