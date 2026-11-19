---
title: 'Validators will compete for your transaction: what Constellation could change on Solana in 2027'
seo_title: 'Solana Constellation: what is going to change in 2027'
date: '2026-11-19'
tag: Consensus
description: >-
  Anza's plan for 2027. Under Solana Constellation, two or three validators
  share one slot, the fee sets the order, and Alpenglow still finalizes the
  block.
keywords:
  - Solana Constellation
  - Constellation 2027
  - Alpenglow
  - Breakpoint 2026
  - Solana validators
teaser: >-
  Anza's 2027 plan from Breakpoint. Two or three validators would share a slot
  and compete for your transaction. Alpenglow still finalizes the block.
image: /content/media/constellation-breakpoint-card.png
image_alt: 'Solana today: one leader builds the block. Constellation: three validators build it together.'
---

On 17 November 2026, Anza CEO Brennan Watt took the main stage at Breakpoint in London and walked through the changes Anza wants on Solana in 2027. Today, one leader builds the block. Constellation would put several validators on that job at the same time.

<figure class="cms-figure cms-figure-hero">
  <img src="/content/media/constellation-breakpoint-card.png" alt="Solana today: one leader builds the block. Constellation: three validators build it together." width="1280" height="720" decoding="async" fetchpriority="high" />
  <figcaption>Today, one leader. With Constellation, three validators build the block.</figcaption>
</figure>

## What Anza announced

- A simpler Solana protocol
- More room in each block, and cheaper transactions
- A faster handoff to the next leader, a schedule that takes into account where each validator is, and Rotor, the next way a block spreads across the network
- Constellation, a new way to build the block
- Transactions cheap enough that the chain itself could price something like an option

These are directions for next year. None of them is a finished release.

## How this would work

A slot is one validator's turn to build a block. Today that turn belongs to a single leader, and it lasts 200 milliseconds. The leader sees which transactions are waiting and decides which ones get in, and in what order.

Constellation hands the same turn to two or three validators at once. Each of them gathers transactions. The network then sorts those transactions by fee. No one gets to pick the order on their own. Your transaction gets in if at least one of them includes it.

Each validator locks in their block before they can see the others. That is what keeps it fair. Nobody can rewrite the order after looking at what the others collected.

On 14 November, Quentin Kniep and Roger Wattenhofer, the authors of this design, published a paper that sets the turn at 50 milliseconds. A fresh batch of transactions could be included four times as often as today. Confirmation stays where it is. Validators would keep voting with [Alpenglow](./alpenglow-mainnet-october-2026.html), about every 200 milliseconds. A payment becomes final in about 150 milliseconds, the same target Solana has now.

## In plain words

Picture a counter with one clerk on duty. Every letter has to go through that person. They choose what gets sent and what waits, and they can slide their own letter to the front.

Constellation puts two or three clerks behind that counter. Your letter goes out as soon as any one of them picks it up. Postage sets your place in line. Each clerk seals their stack before learning what the others took, so nobody can reshuffle the queue after a glance at a colleague.

## Easy to mix up

Alpenglow is how Solana reaches agreement. Once enough stake is behind a block, the network treats it as final. That has been the rule since 21 October. Constellation does not replace that vote. It comes first, and it decides who gets to put transactions into the block.

The name has already been used. In March 2026, Anza published a different design and called it Constellation too. That version still had a leader. Someone else only checked the leader's work. Breakpoint was about the November design. Several validators build the slot together.

## Still open

There is no release to install, and no date to turn this on. The November write-up is a research paper. Two practical questions are still unanswered: how the fees get split, and whether validators in different cities can build the same slot. For now, the two or three validators on a slot have to sit close together, in the same city. They need about 10 milliseconds to exchange a hash of the block. A validator who is far away still votes. They do not build blocks.

## What you would notice

**If you send SOL.** Nothing to set up. Any of the validators sharing the slot can take your transaction. The fee still decides who goes first.

**If you run a validator.** Nothing to install. When a date is set, location starts to matter: where the machine actually sits. You can vote from anywhere. Building blocks means being near the validators you share the turn with.

<div class="callout">
<strong>In short</strong>
        On stage at Breakpoint, Anza described Constellation as a plan:
        validators compete for your transaction. Two or three of them would
        build one slot, and the fee would set the order. Alpenglow would still
        make the block final. It is Anza's plan for 2027.
</div>

Sources:
 [Kniep and Wattenhofer, New Constellation, 14 November 2026](https://github.com/wattenhoferSOL/solanaMCP/blob/main/New%20Constellation%20v1.0.pdf) ·
 [Anza, the March Constellation post, 25 March 2026](https://www.anza.xyz/blog/constellation) ·
 [Open Solana Hub, Alpenglow on mainnet](./alpenglow-mainnet-october-2026.html)
