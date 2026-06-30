# Open Solana Hub

One place to **learn Solana** and **assess validators** – plain-English education for newcomers plus the open Validator Transparency Dashboard for delegators, researchers, and operators.

> Solana in simple terms.

## Structure

| Path | What it is |
|------|------------|
| `/` | Hub home – two entry points: learn or compare |
| `/basics.html` | Blockchain, SOL, wallets – no jargon |
| `/stay-safe.html` | Seed phrases, scam patterns, realistic expectations |
| `/first-steps.html` | Wallet → test transaction → compare → optional staking |
| `/ecosystem.html` | Validators, staking, apps – light overview |
| `/about.html` | Who built this and how the parts fit together |
| `/compare/` | **Validator Transparency Dashboard** – stability history, commission risk, voting consistency, APY context, pool splits, A-vs-B compare |

## How data works

The Hub front-end is fully static. The Compare section reads live data from the
production dashboard backend at
[`validator-transparency-dashboard.vercel.app`](https://validator-transparency-dashboard.vercel.app)
(`/api/snapshots`, `/api/ratings`, `/api/network-stats`, `/api/rpc`, …), which owns
the Supabase snapshot history and the daily full-network collection cron.

That deployment keeps working independently – existing `?vote=` links and the
hackathon URL are unaffected by this repo.

## Local preview

```bash
npx serve .
# open http://localhost:3000
```

## Deploy

Import the repo on [Vercel](https://vercel.com) as a static site (no build command).

## Origins

This project merges two previously separate repos:

- [open-solana-guide](https://github.com/AndrewInUA/open-solana-guide) – the learning pages
- [validator-transparency-dashboard](https://github.com/AndrewInUA/validator-transparency-dashboard) – the comparison tool (still the live API backend)

## Author

Built by [AndrewInUA](https://andrewinua.com/) – education and open tooling, not financial advice.
