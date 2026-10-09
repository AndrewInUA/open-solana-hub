---
title: 'Solana''s clock just halved: 200ms slots are live, and an epoch now lasts about a day'
seo_title: 'How fast is Solana now? 200ms slots, an epoch about a day'
date: '2026-10-09'
tag: Consensus
description: >-
  How fast is Solana now? Slots are 200ms from epoch 1053, 9 October 2026. An epoch
  lasts about a day. Capacity per second stays the same.
keywords:
  - how fast is Solana now
  - Solana 200ms slots
  - Solana slot time
  - Solana epoch
  - SIMD-0525
teaser: >-
  Epoch 1053 cut the slot to 200ms, half the original clock. Confirmations arrive sooner,
  staking rewards land about once a day, and the network's capacity per second stays the same.
image: /content/media/solana-200ms-slots-card.png?v=4
image_alt: 'Two clocks on Solana: a slot is 200ms, and an epoch lasts about a day'
---

On 9 October 2026, Solana mainnet entered **epoch 1053** and its clock ticked
 over to a **200-millisecond slot**. The chain's own timestamp puts the first
 slot of that epoch,
 [slot 454,896,000](https://explorer.solana.com/block/454896000), at about
 14:41 UTC. [Anza confirmed the switch](https://x.com/anza_xyz/status/2108568843178422694)
 minutes later. A slot is the short turn one validator, the leader, gets to
 produce a block. That turn is now half the original 400ms, so the network
 schedules twice as many slots every second as it did at launch.

<figure class="cms-figure cms-figure-hero">
  <img src="/content/media/solana-200ms-slots-card.png?v=4" alt="Two clocks on Solana: a slot is 200ms, and an epoch lasts about a day" width="1280" height="720" decoding="async" fetchpriority="high" />
  <figcaption>A slot is the 200ms turn in which a leader produces a block. An epoch is 432,000 slots: about a day.</figcaption>
</figure>

An epoch is the other clock, and it is the one you feel on a calendar. An epoch
 is always 432,000 slots. Count them at 400ms and you get 48 hours. Count them at
 200ms and you get 24 hours, **about a day**. Staking rewards pay out once per
 epoch, so they now arrive about daily. At the 250ms step, from 18 September
 until 9 October, an epoch was about 30 hours.

This is the last of four cuts under
 [SIMD-0525](https://github.com/solana-foundation/solana-improvement-documents/blob/main/proposals/0525-reduce-slot-times.md):
 400, then 350, then 300, then the
 [250ms step in September](./solana-250ms-slots-september-2026.html), and now 200.
 The slot-time roadmap that
 [Agave 4.2](./agave-4-2-release-august-2026.html) shipped behind feature gates
 is complete.

<div class="callout">
<strong>By the numbers</strong>
<ul>
<li><strong>200ms</strong> – one slot, half the original 400ms</li>
<li><strong>0.8 seconds</strong> – one leader's turn of four slots, down from 1.6</li>
<li><strong>5 slots a second</strong> – up from 2.5 at launch</li>
<li><strong>About a day</strong> – one epoch of 432,000 slots, down from about two</li>
<li><strong>30 seconds</strong> – how long a transaction's blockhash stays fresh, down from 60</li>
<li><strong>50 million CUs</strong> – the compute cap for one block, half the 400ms figure</li>
</ul>
</div>

## Why a shorter slot matters

Picture the network as a relay. Each leader holds the baton for four slots in a
 row. Each of those slots is a turn to produce a block. At the original 400ms, a turn lasted
 1.6 seconds. At 250ms it was one second. At 200ms it lasts **0.8 seconds**.
 Shorter turns mean the chain you see is fresher, and one leader has less time
 to delay, reorder, or quietly leave out transactions before the baton moves on.

The four cuts, each one taking effect at the start of an epoch:

- **350ms** – 21 August 2026, epoch 1020
- **300ms** – 28 August 2026, epoch 1024
- **250ms** – 18 September 2026, epoch 1037
- **200ms** – 9 October 2026, epoch 1053

Every step followed the same two-beat rhythm written into SIMD-0525: the switch
 flips on at one epoch boundary, and the shorter slot starts governing blocks at
 the next. For this final step the switch turned on at epoch 1052 and the 200ms
 slots began at 1053. That one-epoch pause gives every validator notice before
 the network starts enforcing the smaller per-slot limits.
 [The Solana Foundation tracker](https://solana.com/upgrades/reduced-slot-times)
 records the same dates. "Final" means final for this proposal. Other upgrades
 keep their own calendars.

## Twice the beats, the same amount of work

Here is the part worth getting right. Five slots a second sounds like more
 throughput. It is the same throughput, cut into smaller pieces. SIMD-0525
 shrinks the compute and data allowed in each block by the same proportion as
 the slot. Mainnet's block limit at the 400ms baseline has been
 100 million compute units since July; scaled to 200ms, one block holds
 **50 million**. Half the slot, half the block, twice as many blocks: the work
 the network can do each second comes out about where it was. The same applies
 to data: a block carries at most 16,384 data shreds now, against 32,768 at 400ms.

<div class="article-analogy">
<strong>In plain terms</strong>
Think of the lift in a busy office. It used to arrive every 25 seconds. Now it
 arrives every 20. Each ride carries the same number of people, and over an hour
 about the same number move between floors. What changes is the wait by the
 doors. People get moving sooner.
</div>

That wait is latency, and it is what you gain. Wallets, exchanges, and trading
 bots see the latest state sooner. A confirmation still counts the same number
 of slots, and each slot is shorter, so it lands sooner on the clock.
 [Alpenglow](./alpenglow-consensus-status-july-2026.html) is a separate upgrade, and it is still off. Its target is finality of about 150ms: the moment a block can no longer be undone. The 200ms figure is the slot, the turn in which a leader produces a block.

One more clock gets shorter. A transaction carries a recent blockhash, a stamp
 that proves it was built against the live chain. That stamp stays valid for
 150 blocks. With a block every 200ms, that is about **30 seconds**,
 against 37.5 seconds at 250ms and 60 seconds at 400ms. Hardware wallets,
 multisig flows, and anything that waits for a person to press approve now have
 less slack before the stamp goes stale.

Epoch length comes from the same arithmetic. SIMD-0525's table gives 24 hours at
 200ms, 30 hours at 250ms, and 48 hours at 400ms, and it says plainly that real
 epochs can run a little off those figures. Anza's post puts it as an epoch
 "about a day instead of two". The first full epoch on this clock will show
 the exact length. Over a year, the amount of new SOL stays the same:
 SIMD-0525 raises `slots_per_year` so annual inflation holds steady.

## What it means for…

### Validators

A leader's turn is 0.8 seconds. Replay, voting, and block packing have less
 real time than they did at 250ms, and far less than at 400ms. Epochs come
 around about once a day, so reward cycles and epoch-boundary chores do too.
 The switch itself was a feature gate already in the client; operators on an
 older client show up in skip statistics. Block skip rate was the check before
 every step of this rollout. Keep an eye on it at
 [solana.com/200ms](https://solana.com/200ms).

<div class="callout">
<strong>Validators pay more in vote fees</strong>
A vote still costs the same, and a validator sends one for every slot.
 Twice the slots per day means about **double** the vote bill of the original
 400ms clock, and about a quarter more than at 250ms. Smaller validators feel it
 most: they vote constantly and rarely lead, so they earn back less of those
 fees. This lasts until
 <a href="./alpenglow-consensus-status-july-2026.html">Alpenglow</a> replaces
 vote transactions, on its own schedule.
</div>

### Delegators

Your stake stays where it is. Rewards follow the same annual rate and now land
 about once a day instead of every two. Favour validators who publish their
 client version and keep skip rates low on the tighter clock. The apps you use
 feel snappier. The network's total capacity per second stays about where it was.

### Builders

Read `getBlockTime` or the current slot duration whenever you turn slots into
 clock time. Blockhash expiry is about 30 seconds, so retry logic and any signing
 flow that waits on a person should plan for less time. The limit on a single
 transaction stays as it is; the block it fits into holds 50 million CUs.
 Indexers keep the same block format and take in about twice as many blocks per
 day as on the original 400ms clock. Design screens for updates that arrive a
 bit sooner.

### Everyone else

If you hold or send SOL, this is something you feel rather than do. Transfers
 and swaps should confirm a little sooner than they did at 250ms, and apps should
 look less "one beat behind". Two clocks are worth
 keeping straight: a slot of 200ms, and an epoch of about a day.

<div class="callout">
<strong>In one sentence</strong>
        Solana now runs on a 200ms slot and an epoch of about a day: confirmations
        arrive sooner, staking rewards land daily, the network's capacity per second
        stays the same, and the SIMD-0525 roadmap is finished.
</div>

Sources:
 [Anza – 200ms slots live, 9 October 2026](https://x.com/anza_xyz/status/2108568843178422694) ·
 [SIMD-0525](https://github.com/solana-foundation/solana-improvement-documents/blob/main/proposals/0525-reduce-slot-times.md) ·
 [Solana Foundation – Reduced slot times](https://solana.com/upgrades/reduced-slot-times) ·
 [Live 200ms board](https://solana.com/200ms)
