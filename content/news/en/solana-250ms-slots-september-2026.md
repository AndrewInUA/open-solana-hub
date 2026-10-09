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
  throughput does not jump. The last step, 200ms, landed on 9 October.
image: /content/media/solana-250ms-slots-card.png
image_alt: 'Solana 250ms slots: glowing blocks packing tighter along a dark timeline'
---

On September 18, 2026, Solana mainnet crossed into **epoch 1037** and started
 producing blocks on a 250-millisecond clock. Anza confirmed the activation.
 This is the third 50ms cut under
 [SIMD-0525](https://github.com/solana-foundation/solana-improvement-documents/blob/main/proposals/0525-reduce-slot-times.md),
 the slot-time roadmap [Agave 4.2](./agave-4-2-release-august-2026.html) shipped
 behind feature gates. The last step, 200ms, has since landed at
 [epoch 1053 on 9 October](./solana-200ms-slots-october-2026.html).

<figure class="cms-figure cms-figure-hero">
  <img src="/content/media/solana-250ms-slots-card.png" alt="Solana 250ms slots: glowing blocks packing tighter along a dark timeline" width="1280" height="720" decoding="async" fetchpriority="high" />
  <figcaption>250ms slots became the mainnet clock on 18 September. The last step, 200ms, followed on 9 October.</figcaption>
</figure>

## What a slot actually is

A slot is the short window in which a designated validator – the leader – may add a block.
 Solana still gives that leader four consecutive slots. At 400ms, that window lasted
 1.6 seconds. At 250ms it lasts **one second**. Users see a fresher chain. A single
 leader also has less wall-clock time to delay, reorder, or selectively include
 transactions before the next leader takes over.

The network originally targeted 400ms. Feature gates then stepped it down:

- **350ms** – 21 August 2026, epoch 1020
- **300ms** – 28 August 2026, epoch 1024
- **250ms** – 18 September 2026, epoch 1037
- **200ms** – 9 October 2026, epoch 1053

Each gate becomes active at one epoch boundary and only starts governing block
 production at the next. That lag lets Turbine and shred filters pick up the new
 per-slot limits before leaders have to meet them.

## Faster clock, same workload ceiling

This is the part that is easy to get wrong. At 250ms the network targets four slots a
 second, up from about 3.3 at 300ms. That is **not** more transactions per second.
 Under SIMD-0525, the compute and data allowed in each slot shrink by the same
 proportion as the slot itself. Mainnet’s block limit at the 400ms baseline has
 been 100 million CUs since July, so at 250ms the max block budget is
 62.5 million CUs. The per-second budget stays about where it was.

<div class="article-analogy">
<strong>In plain terms</strong>
Think of the lift in a busy office. It used to arrive every 30 seconds. Now it
 arrives every 25. Each trip still carries the same number of people, and over
 an hour about the same number still move between floors. The queue by the
 doors eases, people get moving sooner, and a bottleneck is less likely to form
 in the lobby.
</div>

That wait is latency. Wallets, DEX UIs, and market makers see state sooner.
 Any confirmation or finality threshold that is counted in slots takes less
 real time. Epochs are still a fixed 432,000 slots, and at 250ms they last about
 **30 hours** instead of 48 hours at 400ms (and 36 hours at 300ms). Stake rewards
 show up more often because epochs are shorter. They are not larger over a year:
 SIMD-0525 raises `slots_per_year` so annual inflation stays the same.

A recent blockhash stays valid for 150 blocks. At a 250ms clock that is about
 **37.5 seconds** of real time, down from 60 seconds at the original 400ms
 target. Offline signing, and any flow that waits for someone to click approve,
 has less slack.

## What it means for…

### Validators

Watch skip rates. That was the check before each shorter step, including the
 200ms cut that followed on 9 October. Leader windows are one second; replay, voting, and block packing have less
 real time than they did at 400ms. Shorter epochs mean reward cycles and
 operator tasks come around faster. The 250ms switch itself was a feature gate
 already in Agave 4.2, not a new binary on the day – but operators on stale
 clients still show up in skip stats.

<div class="callout">
<strong>Validators pay more in vote fees</strong>
A vote still costs the same, but there are more slots per hour, so validators
 send more votes and pay more per day – about 1.6× the original 400ms clock
 at 250ms, and about double that original clock once 200ms landed on 9 October. Smaller validators feel it more: they vote constantly
 and rarely lead, so they recoup less of those fees. This lasts until
 <a href="./alpenglow-consensus-status-july-2026.html">Alpenglow</a> replaces vote
 transactions. That flip is not switched on yet – expected closer to a later 4.4
 release.
</div>

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
 You do not configure anything. The 200ms step has since landed, on 9 October.

## Same week, related upgrades

Two other [Agave 4.2](./agave-4-2-release-august-2026.html) upgrades landed the
 same week. **Transaction v1** activated at epoch 1035 on September 15, raising
 max transaction size from 1,232 to 4,096 bytes. **Agave 4.3** reached mainnet on
 September 18 with the full [Alpenglow](./alpenglow-consensus-status-july-2026.html)
 codebase still feature-gated off. That consensus flip is expected around a later
 4.4 release, not in 4.3.

<div class="callout">
<strong>In one sentence</strong>
        On 18 September Solana's mainnet clock moved to 250ms: confirmations and epochs
        got quicker, capacity did not magically grow, and the last step, 200ms, followed on 9 October.
</div>

Sources:
 [SIMD-0525](https://github.com/solana-foundation/solana-improvement-documents/blob/main/proposals/0525-reduce-slot-times.md) ·
 [Solana Foundation – Reduced slot times](https://solana.com/upgrades/reduced-slot-times) ·
 [CoinDesk – 250ms slots, same capacity](https://www.coindesk.com/tech/2026/09/18/solana-speeds-up-blocks-by-17-but-transaction-capacity-stays-the-same)
