---
title: 'Solana''s clock just sped up: 250ms slots are live on mainnet'
seo_title: 'Solana 250ms slots are live on mainnet'
date: '2026-09-19'
tag: Consensus
description: >-
  Solana 250ms slots went live on mainnet at epoch 1037 on 18 September 2026. What SIMD-0525
  changes for confirmations — and why throughput does not jump.
keywords:
  - Solana 250ms slots
  - SIMD-0525
  - reduced slot times
  - epoch 1037
teaser: >-
  Epoch 1037 activated 250ms slots – the third cut from 400ms toward 200ms. Wallets feel snappier;
  throughput does not jump. One step remains.
image: /content/media/solana-250ms-slots-card.png
image_alt: 'Solana 250ms slots: glowing blocks packing tighter along a dark timeline'
---

On September 18, 2026, Solana mainnet crossed into **epoch 1037** and started
 producing blocks on a 250-millisecond clock. Anza confirmed the activation.
 This is the third 50ms cut under
 [SIMD-0525](https://github.com/solana-foundation/solana-improvement-documents/blob/main/proposals/0525-reduce-slot-times.md),
 the slot-time roadmap [Agave 4.2](./agave-4-2-release-august-2026.html) shipped
 behind feature gates. One step remains – 200ms – and it has no mainnet date yet.

<figure class="cms-figure cms-figure-hero">
  <img src="/content/media/solana-250ms-slots-card.png" alt="Solana 250ms slots: glowing blocks packing tighter along a dark timeline" width="1280" height="720" decoding="async" fetchpriority="high" />
  <figcaption>250ms slots are now the mainnet clock. The last planned step is 200ms, only if skip rates stay healthy.</figcaption>
</figure>

## What a slot actually is

A slot is the short window in which a designated validator – the leader – may add a block.
 Solana still gives that leader four consecutive slots. At 400ms, that window lasted
 1.6 seconds. At 250ms it lasts **one second**. Users see a fresher chain. A single
 leader also has less wall-clock time to delay, reorder, or selectively include
 transactions before the next leader takes over.

The network originally targeted 400ms. Feature gates then stepped it down:

- **350ms** – August 19, start of epoch 1019
- **300ms** – August 25, start of epoch 1023
- **250ms** – September 18, start of epoch 1037
- **200ms** – live on devnet and testnet; mainnet only if skip rates stay acceptable

Each gate becomes active at one epoch boundary and only starts governing block
 production at the next. That lag lets Turbine and shred filters pick up the new
 per-slot limits before leaders have to meet them.

## Faster clock, same workload ceiling

This is the part that is easy to get wrong. The network now targets four slots a
 second, up from about 3.3 at 300ms. That is **not** more transactions per second.
 Under SIMD-0525, the compute and data allowed in each slot shrink by the same
 proportion as the slot itself. At 250ms, the max block compute budget is
 37.5 million CUs, down from 60 million at 400ms – so the per-second budget stays
 about where it was.

What *does* change is latency. Wallets, DEX UIs, and market makers see state sooner.
 Any confirmation or finality threshold that is counted in slots takes less
 real time. Epochs are still a fixed 432,000 slots, but they now last about
 **30 hours** instead of 48 hours at 400ms (and 36 hours at 300ms). Stake rewards
 show up more often because epochs are shorter. They are not larger over a year:
 SIMD-0525 raises `slots_per_year` so annual inflation stays the same.

A recent blockhash is still valid for 150 slots. At a 250ms clock that is about
 **38 seconds** of real time, down from about 60 seconds at the original 400ms
 target. Offline signing, and any flow that waits for someone to click approve,
 has less slack.

## What it means for…

### Validators

Watch skip rates. That is the metric that decides whether 200ms gets a mainnet
 date. Leader windows are one second; replay, voting, and block packing have less
 real time than they did at 400ms. Shorter epochs mean reward cycles and
 operator tasks come around faster. The 250ms switch itself was a feature gate
 already in Agave 4.2, not a new binary on the day – but operators on stale
 clients still show up in skip stats.

### Delegators

No restaking, no wallet migration. The practical signal is still operator
 discipline: prefer validators who publish their client version and keep skip
 rates down as the clock tightens. Faster slots improve the apps you use. They
 do not, by themselves, raise the network's transaction ceiling, and they do not
 increase annual inflation.

### Builders

Do not hardcode a slot duration when you convert slots to time. Use
 `getBlockTime` or the current slot duration. Blockhash expiry is tighter, so
 retry logic and signing that waits on a person need to assume less wait.
 Indexers do not need a new format, but they ingest more blocks per day than at
 the original 400ms clock. Design UX for snappier updates – not for a hidden
 throughput bump that is not there.

### Everyone else

If you hold or send SOL, the change is mostly something you feel: transfers and
 swaps should confirm a bit sooner, and apps should look less "one beat behind."
 You do not configure anything. The 200ms step is still unscheduled. It proceeds
 only if 250ms holds up under real traffic.

## Same week, related upgrades

Two other [Agave 4.2](./agave-4-2-release-august-2026.html) upgrades landed the
 same week. **Transaction v1** activated at epoch 1035 on September 15, raising
 max transaction size from 1,232 to 4,096 bytes. **Agave 4.3** reached mainnet on
 September 18 with the full [Alpenglow](./alpenglow-consensus-status-july-2026.html)
 codebase still feature-gated off. That consensus flip is expected around a later
 4.4 release, not in 4.3.

<div class="callout">
<strong>In one sentence</strong>
        Solana's mainnet clock is now 250ms: confirmations and epochs got quicker,
        capacity did not magically grow, and 200ms waits on skip rates.
</div>

Sources:
 [SIMD-0525](https://github.com/solana-foundation/solana-improvement-documents/blob/main/proposals/0525-reduce-slot-times.md) ·
 [Solana Foundation – Reduced slot times](https://solana.com/upgrades/reduced-slot-times) ·
 [CoinDesk – 250ms slots, same capacity](https://www.coindesk.com/tech/2026/09/18/solana-speeds-up-blocks-by-17-but-transaction-capacity-stays-the-same)
