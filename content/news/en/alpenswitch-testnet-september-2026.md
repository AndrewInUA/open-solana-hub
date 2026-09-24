---
title: 'Alpenswitch is on public testnet: Solana is rehearsing the Alpenglow flip'
seo_title: 'Alpenglow on Solana public testnet: Alpenswitch explained'
date: '2026-09-24'
tag: Consensus
description: >-
  Alpenswitch is moving Solana public testnet from TowerBFT to Alpenglow this week, toward about
  150ms finality. September 28 is not an Alpenglow mainnet launch.
keywords:
  - Alpenswitch
  - Alpenglow testnet
  - Solana 150ms finality
  - SIMD-0384
teaser: >-
  Public testnet is running the TowerBFT-to-Alpenglow migration this week. Anza's note also
  carries a September 28 mark that is easy to misread. Wallets on mainnet do not change.
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

**Alpenglow** (<a href="https://github.com/solana-foundation/solana-improvement-documents/blob/main/proposals/0326-alpenglow.md" target="_blank" rel="noopener noreferrer" data-new-tab="on">SIMD-0326</a>)
 is the consensus upgrade. It replaces TowerBFT with a voting protocol called
 **Votor**. Votes move off the ledger into direct messages between validators.
 The target is finality in about **150 milliseconds**, down from about
 **12.8 seconds** on the TowerBFT path – the time it takes for confirmations to
 stack across 32 slots.

**Alpenswitch** (<a href="https://github.com/solana-foundation/solana-improvement-documents/blob/main/proposals/0384-alpenglow-migration.md" target="_blank" rel="noopener noreferrer" data-new-tab="on">SIMD-0384</a>)
 is the migration procedure. At a migration boundary the
 cluster flips from TowerBFT to Alpenglow. If that flip fails, it falls back to
 TowerBFT. Public testnet is exercising that handoff now. Devnet and mainnet-beta
 are meant to run the same procedure later, each on its own schedule.

How Votor, the Validator Admission Ticket, and the still-closed mainnet gate
 looked in July is in the
 <a href="./alpenglow-consensus-status-july-2026.html" target="_blank" rel="noopener noreferrer" data-new-tab="on">Alpenglow status note</a>.

## What Anza announced

On September 22 Anza said Alpenglow is coming to public testnet this week. The
 note was specific about the procedure: testnet runs the same migration that
 devnet and mainnet-beta will run later. The community cluster has already been
 on Alpenglow for more than four months and has rehearsed that handoff.

Read the testnet move as **underway this week**. The public tracker can still
 list it as pending while operators get ready. There is no finished "it flipped
 at epoch N" time to report yet.

The first pass is **Agave 4.3 only**. Firedancer and Frankendancer do not support
 this Alpenglow testnet migration, so operators on those clients need Agave for
 the rehearsal. Later clusters will set their own client mix.

The same Anza schedule has a second date, and that is the line people are
 mixing up with this testnet news. **September 28** is listed as a tentative day
 to turn on Agave 4.3 feature gates on mainnet. It sits on the release calendar
 beside the testnet announcement. It is a different item.

<div class="callout">
<strong>What that September 28 mark means</strong>
Agave 4.3 is already installed on mainnet. It arrived on September 18 with the
 Alpenglow code inside and the switch still off. A feature gate is that switch:
 the software can sit on a validator before one ability is turned on.
September 28 is the tentative day on that calendar for opening some of those
 switches. It does not move mainnet onto Alpenglow. Operator notes still aim the
 consensus flip at a later release. Until the Alpenglow gate actually opens,
 mainnet keeps finalizing blocks with TowerBFT. How this client line got here
 is in the
 <a href="./agave-4-2-release-august-2026.html" target="_blank" rel="noopener noreferrer" data-new-tab="on">Agave 4.2 note</a>.
</div>

## Finality and the clock are different levers

<a href="./solana-250ms-slots-september-2026.html" target="_blank" rel="noopener noreferrer" data-new-tab="on">250ms slots</a> went live on mainnet at
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
 the formal pass of that same migration. The September 28 mark above may open
 some Agave 4.3 gates on mainnet. It is not the day mainnet moves to Alpenglow.

### Delegators

Your stake stays where it is. This week's rehearsal is on public testnet, so the
 SOL you already delegated on mainnet-beta is still under TowerBFT and does not
 move. The part worth watching is the operator: a validator who says which client
 they run, and how they plan to meet Alpenglow, is easier to read than one who
 goes quiet when the client changes.

### Builders

Nothing in this week's testnet pass requires a mainnet program or wallet change.
 Do not ship mainnet UX that assumes ~150ms finality. On mainnet, finalized still
 means the TowerBFT wait. On a cluster that has completed Alpenswitch,
 confirmation and finality draw together, and vote transactions leave blocks, so
 indexers should re-baseline counts **after** that cluster has actually migrated,
 not on a calendar date. Slot duration and finality stay separate: keep the
 current slot time from the
 <a href="./solana-250ms-slots-september-2026.html" target="_blank" rel="noopener noreferrer" data-new-tab="on">250ms slots</a> change, and do not treat
 150ms as a new slot length.

### Everyone else

If you hold or send SOL on mainnet, you do not configure anything, and this week
 does not make transfers finalize in 150ms. If you use apps pointed at public
 testnet, they can start to feel final much sooner once that cluster's migration
 is in effect. Wallets do not need a new flow on either cluster.

<div class="callout">
<strong>In one sentence</strong>
        Public testnet is rehearsing Alpenswitch, the move from TowerBFT to Alpenglow.
        The September 28 line on Anza's schedule is a possible day for other Agave 4.3
        switches. Mainnet has not moved to Alpenglow.
</div>

Sources:
 <a href="https://solana.com/upgrades/alpenglow" target="_blank" rel="noopener noreferrer" data-new-tab="on">Solana – Alpenglow</a> ·
 <a href="https://github.com/solana-foundation/solana-improvement-documents/blob/main/proposals/0326-alpenglow.md" target="_blank" rel="noopener noreferrer" data-new-tab="on">SIMD-0326</a> ·
 <a href="https://github.com/solana-foundation/solana-improvement-documents/blob/main/proposals/0384-alpenglow-migration.md" target="_blank" rel="noopener noreferrer" data-new-tab="on">SIMD-0384</a> ·
 <a href="https://www.coindesk.com/tech/2026/09/23/solana-starts-testing-upgrade-that-could-cut-finality-from-12-8-seconds-to-150-milliseconds" target="_blank" rel="noopener noreferrer" data-new-tab="on">CoinDesk – public testnet finality test</a> ·
 <a href="https://forklog.com/en/alpenglow-begins-activation-phase-in-solana-testnet/" target="_blank" rel="noopener noreferrer" data-new-tab="on">ForkLog – activation on testnet</a>
