---
title: 'Alpenswitch is on public testnet: Solana is rehearsing the Alpenglow flip'
seo_title: 'Alpenswitch puts Alpenglow on public testnet'
date: '2026-09-24'
tag: Consensus
description: >-
  Alpenswitch is migrating Alpenglow onto Solana public testnet this week. What the two names mean,
  why September 28 is not a mainnet launch, and what changes for validators.
keywords:
  - Alpenswitch
  - Alpenglow
  - SIMD-0384
  - public testnet
teaser: >-
  Public testnet is running the TowerBFT-to-Alpenglow migration this week. Wallets on mainnet do
  not change, and September 28 is not the launch.
image: /content/media/alpenswitch-testnet-card.png
image_alt: 'Alpenswitch: a dark cluster crossing from stacked confirmations into one short agreement pulse'
---

This week Solana's **public testnet** is running the migration that moves a cluster
 from TowerBFT to Alpenglow. Anza said on September 22 that Alpenglow is coming to
 testnet this week, and that the rehearsal uses the same procedure later planned for
 devnet and mainnet-beta. A community cluster has already run Alpenglow for more than
 four months and practiced the switch. This is not a mainnet launch.

<figure class="cms-figure cms-figure-hero">
  <img src="/content/media/alpenswitch-testnet-card.png" alt="Alpenswitch: a dark cluster crossing from stacked confirmations into one short agreement pulse" width="1280" height="720" decoding="async" fetchpriority="high" />
  <figcaption>Public testnet is where the migration gets exercised. Mainnet still agrees on blocks with TowerBFT.</figcaption>
</figure>

## Two names for one change

**Alpenglow** ([SIMD-0326](https://github.com/solana-foundation/solana-improvement-documents/blob/main/proposals/0326-alpenglow.md))
 is the consensus upgrade. It replaces TowerBFT with a voting protocol called
 **Votor**. Votes move off the ledger into direct messages between validators.
 The target is finality in about **150 milliseconds**, down from about
 **12.8 seconds** on the TowerBFT path – the time it takes for confirmations to
 stack across 32 slots.

**Alpenswitch** ([SIMD-0384](https://github.com/solana-foundation/solana-improvement-documents/blob/main/proposals/0384-alpenglow-migration.md))
 is the migration procedure. At a migration boundary the
 cluster flips from TowerBFT to Alpenglow. If that flip fails, it falls back to
 TowerBFT. Public testnet is exercising that handoff now. Devnet and mainnet-beta
 are meant to run the same procedure later, each on its own schedule.

How Votor, the Validator Admission Ticket, and the still-closed mainnet gate
 looked in July is in the
 <a href="./alpenglow-consensus-status-july-2026.html" target="_blank" rel="noopener noreferrer">Alpenglow status note</a>.

## What "this week" means

Anza's announcement started activation on public testnet. At publish time, read
 the migration as **underway this week**, not as a finished flip with a recorded
 timestamp. The tracker can still list the testnet switch as pending while
 operators move. A line like "it landed at epoch N" is the wrong shape for this
 update.

The first pass is **Agave 4.3 only**. Firedancer and Frankendancer do not support
 this Alpenglow testnet migration. Operators on those clients need Agave for the
 rehearsal. That is a client-diversity gap for this test. Later clusters set
 their own client mix.

<div class="callout">
<strong>What September 28 actually is</strong>
Agave 4.3 is already installed on mainnet. It arrived on September 18 with the
 Alpenglow code inside and the switch still off. A feature gate is that switch:
 the software can sit on a validator before one ability is turned on.
September 28 is a tentative day on Anza's calendar for opening some of those
 Agave 4.3 switches on mainnet. It is a software date. It does not move mainnet
 onto Alpenglow. Operator notes still aim that consensus flip at a later release.
 Until the Alpenglow gate actually opens, mainnet keeps finalizing blocks with
 TowerBFT. How this client line got here is in the
 <a href="./agave-4-2-release-august-2026.html" target="_blank" rel="noopener noreferrer">Agave 4.2 note</a>.
</div>

## Finality and the clock are different levers

<a href="./solana-250ms-slots-september-2026.html" target="_blank" rel="noopener noreferrer">250ms slots</a> went live on mainnet at
 epoch 1037. That change shortened the slot, the window a leader has to produce
 a block. It did not change how long the network waits before a block is
 irreversible. Alpenglow is the other lever: how validators agree that a block
 can no longer be undone. A faster clock and faster finality both change how
 apps feel. They are separate switches.

<div class="article-analogy">
<strong>In plain terms</strong>
Finality is the moment a bank transfer becomes irreversible. TowerBFT is waiting
 through a stack of confirmations before the bank will treat the payment as done.
 Votor is a short, direct round of agreement among the validators who have to
 sign off – one conversation, where the old path was a pile of receipts.
</div>

Once Alpenglow is actually live on a cluster, apps on that cluster can feel
 finality much sooner. Execution does not change: the SVM, transaction formats,
 and fees stay as they are. Rotor, the later data-propagation piece, is not part
 of this testnet pass.

## What it means for…

### Validators

This rehearsal wants **Agave 4.3**. Read Anza's operator notes before the testnet
 gate, and do not assume Firedancer or Frankendancer can take this first
 migration. The community cluster already practiced the switch; public testnet is
 the formal pass of that same migration. September 28 may open some Agave 4.3
 gates on mainnet. It is not the day mainnet moves to Alpenglow.

### Delegators

No restake and no wallet migration. Stake on mainnet-beta is still under
 TowerBFT. The useful signal matches other client upgrades: prefer operators who
 say which version they run and how they plan the move. An operator who can
 explain the testnet rehearsal is the clearer read.

### Builders

Nothing in this week's testnet pass requires a mainnet program or wallet change.
 Do not ship mainnet UX that assumes ~150ms finality. On mainnet, finalized still
 means the TowerBFT wait. On a cluster that has completed Alpenswitch,
 confirmation and finality draw together, and vote transactions leave blocks, so
 indexers should re-baseline counts **after** that cluster has actually migrated,
 not on a calendar date. Slot duration and finality stay separate: keep the
 current slot time from the
 <a href="./solana-250ms-slots-september-2026.html" target="_blank" rel="noopener noreferrer">250ms slots</a> change, and do not treat
 150ms as a new slot length.

### Everyone else

If you hold or send SOL on mainnet, you do not configure anything, and this week
 does not make transfers finalize in 150ms. If you use apps pointed at public
 testnet, they can start to feel final much sooner once that cluster's migration
 is in effect. Wallets do not need a new flow on either cluster.

<div class="callout">
<strong>In one sentence</strong>
        Public testnet is rehearsing Alpenswitch, the move from TowerBFT to Alpenglow.
        Mainnet has not made that move. September 28 is a possible day for other
        Agave 4.3 switches, not the Alpenglow launch.
</div>

Sources:
 [Solana – Alpenglow](https://solana.com/upgrades/alpenglow) ·
 [SIMD-0326](https://github.com/solana-foundation/solana-improvement-documents/blob/main/proposals/0326-alpenglow.md) ·
 [SIMD-0384](https://github.com/solana-foundation/solana-improvement-documents/blob/main/proposals/0384-alpenglow-migration.md) ·
 [CoinDesk – public testnet finality test](https://www.coindesk.com/tech/2026/09/23/solana-starts-testing-upgrade-that-could-cut-finality-from-12-8-seconds-to-150-milliseconds) ·
 [ForkLog – activation on testnet](https://forklog.com/en/alpenglow-begins-activation-phase-in-solana-testnet/)
