# Stake health Telegram bot

Plain-English **OK / Watch / Risk** notes for people who already staked SOL. Same data and verdicts as [Stake health](https://www.opensolanahub.com/compare/mystake.html). Education only – not financial advice.

The bot **never** asks for a seed or private key and **never** moves SOL. It stores `chat_id` ↔ public wallet only.

## What it does

| Command | Action |
|---------|--------|
| `/start` | Intro + how to link a wallet |
| `/wallet <address>` | Save the public key for this chat |
| `/status` | On-demand checkup (verdict, stakes, ≈ fiat) |
| `/currency` or `/fiat` | Preferred approx. fiat: USD, EUR, UAH, GBP, PLN, CAD, BRL |
| `/stop` or `/unlink` | Remove the link and stop epoch notes |

A Vercel cron calls `/api/telegram-cron`. When a **new Solana epoch** is detected, each linked chat gets one short digest (tone, notable change if the previous tone differed, stake total ≈ fiat, 1–2 history lines from recent voting/snapshots, one-line next step, link back to mystake with `?wallet=`).

## How website sync is maintained

Do not add a parallel scoring model in the bot.

| Piece | Shared path |
|-------|-------------|
| Verdicts & copy | [`compare/stake-health-core.js`](../compare/stake-health-core.js) — `scoreStake` / `scoreOverall` / `TONE_COPY` / `summarizeRecentPicture` / fiat helpers. The page loads this file first; the bot `require`s it. |
| Stake resolution | Dashboard [`/api/my-stake`](https://validator-transparency-dashboard.vercel.app/api/my-stake) (same production API as the site). Public RPC fallback if that fails. |
| Overlays | `/api/rpc`, `/api/ratings`, `/api/snapshots?limit=1&include_all_stats=1`, joined by vote pubkey — same as `compare/mystake.js`. |
| Fiat | CoinGecko SOL price, then CoinGecko USD + exchangerate-api / static FX — `loadSolFiatRates` in the core. Marked ≈. |

If you change OK / Watch / Risk rules, change them in **`stake-health-core.js` only**. `npm test` checks those semantics.

## 1. BotFather

1. Open [@BotFather](https://t.me/BotFather) → `/newbot`
2. Name it (e.g. `Open Solana Hub Stake health`) and pick a username
3. Copy the **token** — that is `TELEGRAM_BOT_TOKEN`
4. Optional: `/setdescription` — “Plain-English checkup for native Solana stake. Public key only. We never move SOL.”
5. Optional: `/setcommands`

```
start - What this bot does
wallet - Link a Solana public key
status - Checkup now
currency - Approximate local fiat
stop - Unlink and stop epoch notes
help - Commands
```

## 2. Storage (Vercel KV / Upstash)

Subscriptions need a small Redis. In the [Vercel](https://vercel.com) project: **Storage → Create Database → KV** (Upstash). Vercel injects:

- `KV_REST_API_URL`
- `KV_REST_API_TOKEN`

No extra npm package — the bot talks to the REST API with `fetch`.

## 3. Environment variables

Set these on the Hub Vercel project (Production). Never commit secrets.

| Name | Required | Purpose |
|------|----------|---------|
| `TELEGRAM_BOT_TOKEN` | yes | From BotFather |
| `TELEGRAM_BOT_USERNAME` | recommended | Bot username **without** `@` (e.g. `OpenSolanaHubBot`). Used by `/api/telegram-info` so [Stake health](https://www.opensolanahub.com/compare/mystake.html) can link to `https://t.me/<username>`. If unset, the page shows “Telegram bot coming — ask for the link.” |
| `TELEGRAM_WEBHOOK_SECRET` | strongly recommended | Random string; Telegram sends it as `X-Telegram-Bot-Api-Secret-Token` |
| `KV_REST_API_URL` | yes (to save wallets) | Vercel KV |
| `KV_REST_API_TOKEN` | yes | Vercel KV |
| `CRON_SECRET` | recommended | Vercel sends `Authorization: Bearer <CRON_SECRET>` to cron paths. Also used as `TELEGRAM_CRON_SECRET` if you prefer that name. |

Copy from [`.env.example`](../.env.example). Redeploy after saving.

## 4. Deploy

This lives in the Hub repo as serverless routes (same Vercel project as the static site):

- `POST /api/telegram` — webhook
- `GET /api/telegram-cron` — epoch check (see `crons` in [`vercel.json`](../vercel.json), once daily at 08:00 UTC so Hobby deploys succeed; a Solana epoch is ~2 days)
- `GET /api/telegram-setup` — registers the webhook once

Hobby cron is at most once per day; that is still enough (a Solana epoch is ~2 days). The job **initializes** the current epoch on first run without messaging anyone, then sends on the next epoch change. Per-chat `lastEpochNotified` avoids duplicates if a run is retried.

After the first deploy with env vars set:

```bash
# Replace HOST and SECRET
curl -sS "https://www.opensolanahub.com/api/telegram-setup?secret=YOUR_TELEGRAM_WEBHOOK_SECRET"
```

That calls Telegram `setWebhook` for `https://<host>/api/telegram`. Confirm `info.url` in the JSON.

Manual epoch run (does not wait for a new epoch if `force=1`):

```bash
curl -sS -H "Authorization: Bearer $CRON_SECRET" \
  "https://www.opensolanahub.com/api/telegram-cron"
```

## 5. Local checks

```bash
npm test                 # shared verdict + message tests (no Telegram token)
npx serve .              # Stake health page still loads core + mystake.js
```

There is no long-running Node process. Do not run a polling bot next to this webhook.

## Privacy

Stored per chat: Telegram `chat_id`, public wallet, fiat code, last verdict tone, last notified epoch. No seeds, no private keys, no SOL transfers.
