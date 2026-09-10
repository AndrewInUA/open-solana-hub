const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const core = require("../compare/stake-health-core");
const messages = require("./telegram-messages");

const {
  scoreStake,
  scoreOverall,
  buildHealthView,
  worseTone,
  isPubkey,
  looksLikeSeedPhrase,
  localeDefaultFiat,
  normalizeFiat,
  fmtFiat,
  moneyLine,
  fiatFreshnessCopy,
  mystakeUrl,
  compareUrl,
  storyContextFromView,
  TONE_COPY,
  HOW_TO_READ,
  TELEGRAM_CTA,
  votingHistoryFromCredits,
  votingFromCredits,
  summarizeRecentPicture,
  rewardEpochsToFetch,
  fetchRewardHistory,
  summarizeAccountRewards,
  moneyStory,
  moneyLines,
  MAX_REWARD_HISTORY_EPOCHS,
  telegramBotUrl,
  telegramBotUsername,
  DEFAULT_TELEGRAM_BOT_USERNAME,
  TELEGRAM_BOT_URL,
  isTelegramBotUrl,
  safeTelegramBotUrl,
  howToReadLines,
  stabilityFromHistory
} = core;

function overlay(partial) {
  return {
    name: "AndrewInUA",
    status: "healthy",
    commission: 0,
    votingPct: 99,
    votingHistory: {
      epochs: [
        { epoch: 838, pct: 98.5 },
        { epoch: 839, pct: 99.1 },
        { epoch: 840, pct: 99.4 },
        { epoch: 841, pct: 99.0 }
      ],
      count: 12,
      avg5: 99.0,
      min: 98.5,
      max: 99.4
    },
    stability: { score: 92, label: "Strong", sample: 30, delinquent: 0, commissionChanges: 0 },
    ...partial
  };
}

function acc(partial) {
  return {
    pubkey: "Stake11111111111111111111111111111111AAA",
    vote: "Vote111111111111111111111111111111111AAA",
    status: "active",
    delegatedSol: 10,
    activationEpoch: 800,
    rewards: [{ amountSol: 0.01, epoch: 841 }],
    ...partial
  };
}

describe("pubkey and seed guards", () => {
  it("accepts a typical base58 wallet", () => {
    assert.equal(isPubkey("3QPGLackJy5LKctYYoPGmA4P8ncyE197jdxr1zP2ho8K"), true);
  });

  it("rejects seeds and short strings", () => {
    assert.equal(isPubkey("not-a-key"), false);
    assert.equal(
      looksLikeSeedPhrase(
        "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"
      ),
      true
    );
    assert.equal(looksLikeSeedPhrase("3QPGLackJy5LKctYYoPGmA4P8ncyE197jdxr1zP2ho8K"), false);
  });
});

describe("fiat helpers", () => {
  it("defaults locale fiat", () => {
    assert.equal(localeDefaultFiat("uk-UA"), "UAH");
    assert.equal(localeDefaultFiat("de-DE"), "EUR");
    assert.equal(localeDefaultFiat("en-US"), "USD");
  });

  it("formats approx fiat like the site", () => {
    const rates = { perSol: { USD: 200, EUR: 180 }, source: "CoinGecko", stale: false, at: Date.now() };
    const line = fmtFiat(10, rates, "USD");
    assert.match(line, /^≈ /);
    assert.equal(moneyLine(10, rates, "USD"), `10.0000 SOL · ${line}`);
    assert.equal(normalizeFiat("eur"), "EUR");
  });

  it("FX freshness copy names the currency and source, never a health signal", () => {
    const now = Date.now();
    const fresh = fiatFreshnessCopy(
      { perSol: { USD: 150 }, source: "CoinGecko", stale: false, at: now - 11 * 60 * 1000 },
      "USD",
      now
    );
    assert.equal(fresh, "Approximate USD from CoinGecko – 11 min ago");
    assert.equal(fresh.includes("—"), false);
    const stale = fiatFreshnessCopy(
      { perSol: { UAH: 6000 }, source: "CoinGecko + static FX", stale: true, at: now },
      "uah",
      now
    );
    assert.equal(stale, "Approximate UAH from CoinGecko + static FX – may be stale");
    assert.equal(fiatFreshnessCopy(null, "USD"), "");
    assert.doesNotMatch(fresh, /signal|validator|health/i);
  });
});

describe("verdict semantics (shared with mystake.js)", () => {
  it("OK when healthy, modest commission, solid voting and stability", () => {
    const health = scoreStake(acc(), {
      name: "AndrewInUA",
      status: "healthy",
      commission: 5,
      votingPct: 99,
      stability: { score: 90, label: "Strong", sample: 20, delinquent: 0 }
    });
    assert.equal(health.tone, "ok");
    assert.equal(health.label, "OK");
    assert.match(health.headline, /looks fine/);
    assert.equal(health.body, TONE_COPY.ok.body);
  });

  it("Watch for activating stake and elevated commission", () => {
    const health = scoreStake(acc({ status: "activating" }), {
      name: "Example",
      status: "healthy",
      commission: 12,
      votingPct: 96,
      stability: { score: 88, sample: 20, delinquent: 0 }
    });
    assert.equal(health.tone, "watch");
    assert.equal(health.label, "Watch");
    assert.equal(health.body, TONE_COPY.watch.body);
  });

  it("Risk for delinquent or 100% commission", () => {
    const delinquent = scoreStake(acc(), {
      name: "Bad",
      status: "delinquent",
      commission: 0,
      votingPct: 99,
      stability: { score: 90, sample: 20, delinquent: 0 }
    });
    assert.equal(delinquent.tone, "risk");
    const keepAll = scoreStake(acc(), {
      name: "Fee",
      status: "healthy",
      commission: 100,
      votingPct: 99,
      stability: { score: 90, sample: 20, delinquent: 0 }
    });
    assert.equal(keepAll.tone, "risk");
    assert.equal(keepAll.body, TONE_COPY.risk.body);
    assert.equal(worseTone("ok", "watch"), "watch");
    assert.equal(worseTone("watch", "risk"), "risk");
  });

  it("overall wait / watch / risk match the site copy", () => {
    const empty = scoreOverall([], {});
    assert.equal(empty.tone, "wait");
    assert.match(empty.body, /Liquid staking/);

    const idle = buildHealthView([acc({ vote: null, delegatedSol: 0 })], null, { currentEpoch: 800 });
    assert.equal(idle.overall.tone, "watch");
    assert.match(idle.overall.headline, /no validator/);

    const rows = buildHealthView(
      [acc({ validatorName: "AndrewInUA" })],
      new Map([
        [
          "Vote111111111111111111111111111111111AAA",
          {
            name: "AndrewInUA",
            status: "healthy",
            commission: 0,
            votingPct: 99.2,
            stability: { score: 92, sample: 30, delinquent: 0 }
          }
        ]
      ]),
      { currentEpoch: 842 }
    );
    assert.equal(rows.overall.tone, "ok");
    assert.equal(rows.overall.kicker, "OK");
    assert.match(rows.overall.headline, /AndrewInUA/);
    assert.match(rows.overall.next, /Epoch 842/);
    assert.ok(rows.overall.body.includes(TONE_COPY.ok.body));
  });

  it("How to read this matches the shared tone bodies", () => {
    assert.equal(HOW_TO_READ.length, 3);
    assert.equal(HOW_TO_READ[0].text, TONE_COPY.ok.body);
    assert.equal(HOW_TO_READ[1].text, TONE_COPY.watch.body);
    assert.equal(HOW_TO_READ[2].text, TONE_COPY.risk.body);
    const blob = [
      TONE_COPY.ok.body,
      TONE_COPY.watch.body,
      TONE_COPY.risk.body,
      TELEGRAM_CTA.body,
      TELEGRAM_CTA.steps,
      TELEGRAM_CTA.fallback,
      ...howToReadLines(),
      messages.startMessage(),
      messages.helpMessage(),
      messages.seedWarning(),
      messages.lookupFailed(new Error("busy")),
      messages.fiatPicker("USD"),
      messages.notifyToggled(true),
      messages.notifyToggled(false),
      messages.fullStoryMessage({ wallet: "3QPGLackJy5LKctYYoPGmA4P8ncyE197jdxr1zP2ho8K" }),
      messages.validatorMessage({ wallet: "3QPGLackJy5LKctYYoPGmA4P8ncyE197jdxr1zP2ho8K", vote: "Vote111111111111111111111111111111111AAA" }),
      fiatFreshnessCopy({ perSol: { USD: 1 }, source: "CoinGecko", stale: false, at: Date.now() }, "USD")
    ].join("\n");
    assert.equal(blob.includes("—"), false);
    assert.equal(blob.includes("--"), false);
    assert.doesNotMatch(blob, / \- /);
    assert.match(TONE_COPY.watch.body, /bit off – worth a look/);
    assert.match(howToReadLines()[0], /^OK – /);
  });
});

describe("stake money picture (shared with mystake.js)", () => {
  it("fetches from activation when the span fits the MVP cap", () => {
    const range = rewardEpochsToFetch({
      activationEpoch: 1028,
      currentEpoch: 1032,
      maxEpochs: 16
    });
    assert.deepEqual(range.epochs, [1031, 1030, 1029, 1028]);
    assert.equal(range.fromActivation, true);
  });

  it("uses a recent window when activation is older than the cap", () => {
    const range = rewardEpochsToFetch({
      activationEpoch: 100,
      currentEpoch: 1032,
      maxEpochs: 16
    });
    assert.equal(range.epochs.length, 16);
    assert.equal(range.epochs[0], 1031);
    assert.equal(range.epochs[15], 1016);
    assert.equal(range.fromActivation, false);
  });

  it("does not treat a missing last epoch as 0 SOL earned", () => {
    const summary = summarizeAccountRewards(
      acc({ rewards: [], activationEpoch: 840 }),
      842
    );
    assert.equal(summary.lastEpochSol, null);
    assert.equal(summary.cumulativeSol, null);
    assert.equal(summary.showCumulative, false);
  });

  it("labels a full window since activation and a partial window honestly", () => {
    const since = summarizeAccountRewards(
      acc({
        activationEpoch: 840,
        rewards: [
          { amountSol: 0.01, epoch: 841 },
          { amountSol: 0.008, epoch: 840 }
        ],
        rewardCoverage: {
          attempted: 2,
          ok: 2,
          failed: 0,
          fromActivation: true
        }
      }),
      842
    );
    assert.equal(since.fromActivation, true);
    assert.equal(since.showCumulative, true);
    assert.equal(since.windowLabel, "Since activation");
    assert.ok(Math.abs(since.cumulativeSol - 0.018) < 1e-9);

    const windowed = summarizeAccountRewards(
      acc({
        activationEpoch: 100,
        rewards: [
          { amountSol: 0.01, epoch: 841 },
          { amountSol: 0.008, epoch: 840 }
        ],
        rewardCoverage: {
          attempted: 16,
          ok: 16,
          failed: 0,
          fromActivation: false
        }
      }),
      842
    );
    assert.equal(windowed.fromActivation, false);
    assert.equal(windowed.windowLabel, "Recent rewards (last 2 epochs)");
    assert.match(moneyStory(windowed, { perSol: { USD: 150 } }, "USD"), /not the full time since you delegated/);
  });

  it("sums getInflationReward rows and never fills a failed epoch with 0", async () => {
    async function rpc(_method, params) {
      const epoch = params[1].epoch;
      if (epoch === 840) throw new Error("busy");
      if (epoch === 841) {
        return [{ amount: 1e9, epoch: 841, postBalance: 11e9, commission: 0 }];
      }
      return [null];
    }
    const [out] = await fetchRewardHistory(
      rpc,
      [acc({ pubkey: "Stake11111111111111111111111111111111AAA", activationEpoch: 838, rewards: [] })],
      842
    );
    assert.equal(
      out.rewards.some(r => r.epoch === 841 && r.amountSol === 1),
      true
    );
    assert.equal(out.rewards.some(r => r.epoch === 840), false);
    assert.equal(out.rewardCoverage.failed > 0, true);
    assert.equal(out.rewardCoverage.fromActivation, false);
    const summary = summarizeAccountRewards(out, 842);
    assert.equal(summary.lastEpochSol, 1);
    assert.equal(summary.fromActivation, false);
  });

  it("money story and telegram lines stay on Approx. copy, with en dashes", () => {
    const rates = { perSol: { USD: 150 }, source: "CoinGecko", stale: false, at: Date.now() };
    const money = summarizeAccountRewards(
      acc({
        delegatedSol: 12.5,
        activationEpoch: 840,
        rewards: [
          { amountSol: 0.01, epoch: 841 },
          { amountSol: 0.02, epoch: 840 }
        ],
        rewardCoverage: { attempted: 2, ok: 2, failed: 0, fromActivation: true }
      }),
      842
    );
    const story = moneyStory({ ...money, stakeCount: 1 }, rates, "USD");
    assert.match(story, /You hold/);
    assert.match(story, /Last epoch/);
    assert.match(story, /since this stake activated/);
    assert.equal(story.includes("—"), false);
    const lines = moneyLines({ ...money, stakeCount: 1 }, rates, "USD");
    assert.equal(lines[0].startsWith("Active:"), true);
    assert.equal(lines[1].startsWith("Last epoch:"), true);
    assert.equal(lines[2].startsWith("Since activation:"), true);
    assert.equal(MAX_REWARD_HISTORY_EPOCHS, 16);
    assert.equal(core.REWARD_RPC_CONCURRENCY, 16);
  });
});

describe("recent-picture history (shared with mystake.js)", () => {
  it("averages finished epoch credits and drops the in-progress last row", () => {
    const credits = [
      [800, 100, 0],
      [801, 200, 100],
      [802, 300, 200],
      [803, 350, 300]
    ];
    const history = votingHistoryFromCredits(credits);
    assert.equal(history.count, 3);
    assert.equal(history.epochs.length, 3);
    assert.equal(history.avg5, votingFromCredits(credits));
    assert.equal(history.max, 100);
    assert.ok(history.epochs.every(e => e.epoch !== 803));
  });

  it("summarizes voting + snapshot history in two newcomer lines", () => {
    const view = buildHealthView(
      [acc({ validatorName: "AndrewInUA" })],
      new Map([["Vote111111111111111111111111111111111AAA", overlay()]]),
      { currentEpoch: 842 }
    );
    const picture = summarizeRecentPicture(view.rows);
    assert.equal(picture.lines.length, 2);
    assert.match(picture.lines[0], /Recent voting over the last 5 finished epochs/);
    assert.match(picture.lines[0], /99\.0%/);
    assert.match(picture.lines[1], /no unhealthy days/);
    assert.match(picture.lines[1], /commission stayed put/);
    assert.equal(picture.sparks.length, 1);
  });

  it("counts unique validators, not stake accounts, in the recent picture", () => {
    const view = buildHealthView(
      [
        acc({ pubkey: "Stake11111111111111111111111111111111AAA" }),
        acc({ pubkey: "Stake11111111111111111111111111111111BBB", delegatedSol: 4 })
      ],
      new Map([["Vote111111111111111111111111111111111AAA", overlay()]]),
      { currentEpoch: 842 }
    );
    const picture = summarizeRecentPicture(view.rows);
    assert.equal(picture.count, 1);
    assert.equal(picture.sparks.length, 1);
    assert.doesNotMatch(picture.lines.join(" "), /2 validators/);
    assert.match(picture.lines[0], /Recent voting over the last 5 finished epochs/);
  });

  it("counts all-time commission changes from snapshot meta", () => {
    const st = stabilityFromHistory([], {
      all_time: { sample_count: 40, delinquent_count: 0, commission_changes: 2 }
    }, "healthy", 5);
    assert.equal(st.sample, 40);
    assert.equal(st.commissionChanges, 2);
    assert.equal(st.delinquent, 0);
  });
});

describe("telegram bot URL helper", () => {
  it("defaults to the public stake_health_bot username", () => {
    assert.equal(DEFAULT_TELEGRAM_BOT_USERNAME, "stake_health_bot");
    assert.equal(TELEGRAM_BOT_URL, "https://t.me/stake_health_bot");
    assert.equal(TELEGRAM_CTA.url, TELEGRAM_BOT_URL);
    assert.equal(telegramBotUsername(""), "stake_health_bot");
    assert.equal(telegramBotUsername("@stake_health_bot"), "stake_health_bot");
    assert.equal(telegramBotUrl(), "https://t.me/stake_health_bot");
    assert.equal(telegramBotUrl(""), "https://t.me/stake_health_bot");
    assert.equal(telegramBotUrl("ab"), "https://t.me/stake_health_bot");
  });

  it("honors a valid override and strips @", () => {
    assert.equal(telegramBotUsername("@OpenSolanaHubBot"), "OpenSolanaHubBot");
    assert.equal(telegramBotUrl("OpenSolanaHubBot"), "https://t.me/OpenSolanaHubBot");
    assert.equal(telegramBotUrl("@OpenSolanaHubBot"), "https://t.me/OpenSolanaHubBot");
  });

  it("only accepts https://t.me/<username> bot URLs", () => {
    assert.equal(isTelegramBotUrl("https://t.me/stake_health_bot"), true);
    assert.equal(isTelegramBotUrl("https://t.me/OpenSolanaHubBot"), true);
    assert.equal(isTelegramBotUrl("#"), false);
    assert.equal(isTelegramBotUrl(""), false);
    assert.equal(isTelegramBotUrl("mystake.html"), false);
    assert.equal(isTelegramBotUrl("/compare/mystake.html"), false);
    assert.equal(isTelegramBotUrl("https://www.opensolanahub.com/compare/mystake.html"), false);
    assert.equal(
      isTelegramBotUrl(
        "https://open-solana-iy48o3vjb-andrews-projects-13f823a7.vercel.app/compare/mystake.html#"
      ),
      false
    );
    assert.equal(isTelegramBotUrl("https://t.me/stake_health_bot/extra"), false);
    assert.equal(isTelegramBotUrl("https://t.me/stake_health_bot?start=1"), false);
    assert.equal(isTelegramBotUrl("http://t.me/stake_health_bot"), false);
    assert.equal(telegramBotUrl("https://t.me/stake_health_bot"), "https://t.me/stake_health_bot");
  });

  it("never turns #, relative, or mystake URLs into a Telegram href", () => {
    const bad = [
      "#",
      "",
      "/compare/mystake.html",
      "./mystake.html",
      "mystake.html#",
      "https://www.opensolanahub.com/compare/mystake.html",
      "https://open-solana-iy48o3vjb-andrews-projects-13f823a7.vercel.app/compare/mystake.html#"
    ];
    for (const value of bad) {
      assert.equal(safeTelegramBotUrl(value), TELEGRAM_BOT_URL);
      assert.equal(telegramBotUrl(value), TELEGRAM_BOT_URL);
      assert.equal(isTelegramBotUrl(value), false);
    }
  });
});

describe("telegram copy", () => {
  it("status leads with money, includes last-epoch + cumulative, and links mystake", () => {
    const rates = { perSol: { USD: 150 }, source: "CoinGecko", stale: false, at: Date.now() };
    const view = buildHealthView(
      [
        acc({
          validatorName: "AndrewInUA",
          delegatedSol: 12.5,
          activationEpoch: 840,
          rewards: [
            { amountSol: 0.01, epoch: 841 },
            { amountSol: 0.02, epoch: 840 }
          ],
          rewardCoverage: { attempted: 2, ok: 2, failed: 0, fromActivation: true }
        })
      ],
      new Map([["Vote111111111111111111111111111111111AAA", overlay()]]),
      { currentEpoch: 842 }
    );
    view.rates = rates;
    const wallet = "3QPGLackJy5LKctYYoPGmA4P8ncyE197jdxr1zP2ho8K";
    const text = messages.formatStatus(view, { fiat: "USD", wallet });
    assert.match(text, /<b>OK<\/b>/);
    assert.match(text, /12\.5000 SOL/);
    assert.match(text, /Last epoch:/);
    assert.match(text, /Since activation:/);
    assert.match(text, /≈ /);
    assert.match(text, /Education only/);
    assert.match(text, /Full story/);
    assert.equal(text.includes(mystakeUrl(wallet)), true);
    assert.match(text, /#full-stake-story/);
    assert.match(text, /\?wallet=/);
    assert.match(text, /Your validator/);
    assert.doesNotMatch(text, /href="[^"]*vote=[^"]*">Full story/);
    assert.equal(text.includes(compareUrl("Vote111111111111111111111111111111111AAA")), true);
    assert.match(text, /\?vote=/);
    assert.doesNotMatch(text, /seed phrase|private key/i);
    assert.doesNotMatch(text, /Recent voting over the last/);
    const okLine = text.split("\n").find(line => line.includes("<b>OK</b>"));
    assert.ok(okLine);
    assert.doesNotMatch(okLine, /CoinGecko|≈ fiat/i);
    const geckoIdx = text.indexOf("CoinGecko");
    const activeIdx = text.indexOf("Active:");
    const sinceIdx = text.indexOf("Since activation:");
    assert.ok(activeIdx >= 0);
    assert.ok(sinceIdx > activeIdx);
    assert.ok(geckoIdx > sinceIdx);
    assert.match(text, /Approximate USD from CoinGecko/);
    assert.ok(text.split("\n").length < 24);
  });

  it("digest stays short and still links mystake with wallet", () => {
    const view = buildHealthView(
      [acc({ validatorName: "AndrewInUA", delegatedSol: 12.5 })],
      new Map([["Vote111111111111111111111111111111111AAA", overlay()]]),
      { currentEpoch: 842 }
    );
    view.rates = { perSol: { USD: 150 }, source: "CoinGecko", stale: false, at: Date.now() };
    const wallet = "3QPGLackJy5LKctYYoPGmA4P8ncyE197jdxr1zP2ho8K";
    const text = messages.formatDigest(view, { fiat: "USD", wallet, previousTone: "watch" });
    assert.match(text, /Epoch 842/);
    assert.match(text, /Tone changed: Watch → OK/);
    assert.match(text, /Last epoch:/);
    assert.doesNotMatch(text, /Recent voting over the last/);
    assert.match(text, /Full story/);
    assert.equal(text.includes(mystakeUrl(wallet)), true);
    assert.match(text, /#full-stake-story/);
    assert.match(text, /Your validator/);
    assert.doesNotMatch(text, /href="[^"]*vote=[^"]*">Full story/);
    assert.ok(text.split("\n").length < 24);
  });

  it("two validators keep Telegram to one Full story page link, not a vote dump", () => {
    const view = buildHealthView(
      [
        acc({ vote: "Vote111111111111111111111111111111111AAA", validatorName: "AndrewInUA" }),
        acc({
          pubkey: "Stake11111111111111111111111111111111BBB",
          vote: "Vote111111111111111111111111111111111BBB",
          validatorName: "OtherVal"
        })
      ],
      new Map([
        ["Vote111111111111111111111111111111111AAA", overlay()],
        ["Vote111111111111111111111111111111111BBB", overlay({ name: "OtherVal" })]
      ]),
      { currentEpoch: 842 }
    );
    const wallet = "3QPGLackJy5LKctYYoPGmA4P8ncyE197jdxr1zP2ho8K";
    const ctx = storyContextFromView(view, wallet);
    assert.equal(ctx.vote, null);
    assert.equal(ctx.votes.length, 2);
    const text = messages.formatStatus(view, { fiat: "USD", wallet });
    assert.match(text, /Full story/);
    assert.equal(text.includes(mystakeUrl(wallet)), true);
    assert.equal(text.includes(compareUrl("Vote111111111111111111111111111111111AAA")), false);
    assert.equal(text.includes(compareUrl("Vote111111111111111111111111111111111BBB")), false);
  });

  it("Full story button copy deep-links without a new RPC pull", () => {
    const wallet = "3QPGLackJy5LKctYYoPGmA4P8ncyE197jdxr1zP2ho8K";
    const stake = "Stake11111111111111111111111111111111AAA";
    const vote = "Vote111111111111111111111111111111111AAA";
    const text = messages.fullStoryMessage({ wallet, stake, vote });
    assert.match(text, /Full story/);
    assert.match(text, /stake money picture/);
    assert.ok(text.includes(mystakeUrl(wallet, stake, { story: true }).replace(/&/g, "&amp;")));
    assert.match(text, /#full-stake-story/);
    assert.match(text, /Your validator/);
    assert.equal(text.includes(compareUrl(vote)), true);
    assert.doesNotMatch(text, /href="[^"]*vote=[^"]*">Full story/);
    assert.match(text, /Education only/);
    assert.doesNotMatch(messages.fullStoryMessage({}), /Full story/);
    const validatorOnly = messages.validatorMessage({ wallet, vote });
    assert.match(validatorOnly, /Your validator/);
    assert.doesNotMatch(validatorOnly, />Full story</);
    assert.equal(validatorOnly.includes(compareUrl(vote)), true);
  });

  it("empty wallet does not invent a last-epoch reward of 0", () => {
    const view = buildHealthView([], null, { currentEpoch: 842 });
    view.rates = { perSol: { USD: 150 }, source: "CoinGecko", stale: false, at: Date.now() };
    assert.equal(view.overall.lastEpochSol, null);
    const text = messages.formatStatus(view, { fiat: "USD", wallet: "3QPGLackJy5LKctYYoPGmA4P8ncyE197jdxr1zP2ho8K" });
    assert.doesNotMatch(text, /Last epoch/);
    assert.doesNotMatch(text, /CoinGecko/);
  });

  it("start copy uses shared How to read this and never asks for a seed", () => {
    const start = messages.startMessage();
    assert.match(start, /public key/);
    assert.match(start, /never move SOL/i);
    assert.ok(start.includes(TONE_COPY.ok.body));
    assert.ok(start.includes(TONE_COPY.watch.body));
    assert.ok(start.includes(TONE_COPY.risk.body));
    assert.match(start, /Status, Full story, Your validator, Notify, Currency, Wallet, Help, Stop/);
    assert.match(start, /You control epoch notes with the Notify button/);
    assert.match(start, /Full story/);
    assert.match(start, /Your validator/);
    assert.doesNotMatch(start, /Risk \+ ≈/);
    assert.doesNotMatch(messages.helpMessage(), /Risk \+ ≈/);
    assert.match(messages.helpMessage(), /You control epoch notes with the Notify button/);
    assert.match(messages.helpMessage(), /Full story/);
    assert.match(messages.helpMessage(), /Your validator/);
    assert.match(messages.fiatPicker("EUR"), /Approximate local currency is <b>EUR<\/b>/);
    assert.match(messages.fiatPicker("EUR"), /CoinGecko/);
    assert.match(messages.seedWarning(), /Never send a seed/);
    assert.match(messages.helpMessage(), /buttons under the chat/i);
    assert.match(messages.notifyToggled(true), /Epoch notes are on/);
    assert.match(messages.notifyToggled(false), /Epoch notes are off/);
    assert.match(messages.notifyToggled(false), /\/status still works/);
    assert.equal(messages.notifyToggled(true).includes("—"), false);
  });

  it("Stake health page never pairs CoinGecko with a Signals heading", () => {
    const html = fs.readFileSync(path.join(__dirname, "../compare/mystake.html"), "utf8");
    const js = fs.readFileSync(path.join(__dirname, "../compare/mystake.js"), "utf8");
    const verdict = html.slice(html.indexOf('id="verdict-card"'), html.indexOf('id="stakes-card"'));
    const stakesHead = html.slice(html.indexOf('id="stakes-card"'), html.indexOf('id="stakes-list"'));
    assert.match(verdict, /id="fiat-control"/);
    assert.match(verdict, /id="fiat-hint"/);
    assert.match(verdict, /id="fiat-select"/);
    assert.doesNotMatch(stakesHead, /fiat-control|fiat-hint|fiat-select/);
    assert.match(js, /compact \? "This stake"/);
    assert.doesNotMatch(js, /kicker\.textContent = compact \? "Signals"/);
    assert.match(js, /signals-block/);
    assert.match(js, /"Signals"/);
    assert.match(js, /fiatFreshnessCopy/);
    assert.match(js, /moneyStory/);
    assert.match(js, /enrichRewardHistory/);
    assert.match(html, /id="verdict-money-story"/);
    assert.match(html, /id="full-stake-story"/);
    assert.match(html, /What this stake earned/);
    assert.match(html, /Your validator opens Validator Transparency/);
    assert.doesNotMatch(html, /Full story opens Validator Transparency/);
    assert.match(js, /renderFullStakeStory/);
    assert.doesNotMatch(js, /function renderFullStory/);
    assert.match(js, /showValidatorLink/);
    assert.match(js, /Your validator/);
    assert.match(html, /Recent voting picture/);
    const verdictIdx = html.indexOf('id="verdict-card"');
    const storyIdx = html.indexOf('id="full-stake-story"');
    const stakesIdx = html.indexOf('id="stakes-card"');
    const historyIdx = html.indexOf('id="history-card"');
    assert.ok(verdictIdx > 0 && storyIdx > verdictIdx && stakesIdx > storyIdx && historyIdx > stakesIdx);
    assert.doesNotMatch(js, /placeFiatControl/);
    assert.doesNotMatch(js, /Approx\. \$\{fiatRates\.source\}/);
  });
});

describe("telegram reply keyboard and command menu", () => {
  const bot = require("../lib/telegram-bot");

  it("maps slash commands, Menu names, and button labels to the same handlers", () => {
    assert.deepEqual(bot.parseCommand("/status"), { command: "status", arg: "" });
    assert.deepEqual(bot.parseCommand("/status@stake_health_bot"), { command: "status", arg: "" });
    assert.deepEqual(bot.parseCommand("Status"), { command: "status", arg: "" });
    assert.deepEqual(bot.parseCommand("currency EUR"), { command: "currency", arg: "EUR" });
    assert.deepEqual(bot.parseCommand("/currency EUR"), { command: "currency", arg: "EUR" });
    assert.deepEqual(bot.parseCommand("Wallet"), { command: "wallet", arg: "" });
    assert.deepEqual(bot.parseCommand("Help"), { command: "help", arg: "" });
    assert.deepEqual(bot.parseCommand("Stop"), { command: "stop", arg: "" });
    assert.deepEqual(bot.parseCommand("/unlink"), { command: "stop", arg: "" });
    assert.deepEqual(bot.parseCommand("Unlink"), { command: "stop", arg: "" });
    assert.deepEqual(bot.parseCommand("Notify: On"), { command: "notify", arg: "" });
    assert.deepEqual(bot.parseCommand("Notify: Off"), { command: "notify", arg: "" });
    assert.deepEqual(bot.parseCommand("Notify"), { command: "notify", arg: "" });
    assert.deepEqual(bot.parseCommand("/notify"), { command: "notify", arg: "" });
    assert.deepEqual(bot.parseCommand("/notify off"), { command: "notify", arg: "off" });
    assert.deepEqual(bot.parseCommand("Full story"), { command: "story", arg: "" });
    assert.deepEqual(bot.parseCommand("/fullstory"), { command: "story", arg: "" });
    assert.deepEqual(bot.parseCommand("/full_story@stake_health_bot"), { command: "story", arg: "" });
    assert.deepEqual(bot.parseCommand("Your validator"), { command: "validator", arg: "" });
    assert.deepEqual(bot.parseCommand("/your_validator"), { command: "validator", arg: "" });
    assert.equal(bot.parseCommand("3QPGLackJy5LKctYYoPGmA4P8ncyE197jdxr1zP2ho8K").command, null);
    assert.equal(bot.parseCommand("#").command, null);
  });

  it("keeps a persistent newcomer keyboard and BotFather menu list", () => {
    const kb = bot.mainKeyboard();
    assert.equal(kb.resize_keyboard, true);
    assert.equal(kb.is_persistent, true);
    assert.match(kb.input_field_placeholder, /Public key only – never a seed/);
    const labels = kb.keyboard.flat().map(b => b.text);
    assert.deepEqual(labels, [
      "Status",
      "Full story",
      "Your validator",
      "Notify: On",
      "Currency",
      "Wallet",
      "Help",
      "Stop"
    ]);
    assert.deepEqual(
      bot.mainKeyboard({ notifyEpoch: false }).keyboard.flat().map(b => b.text),
      [
        "Status",
        "Full story",
        "Your validator",
        "Notify: Off",
        "Currency",
        "Wallet",
        "Help",
        "Stop"
      ]
    );
    assert.deepEqual(
      bot.BOT_COMMANDS.map(c => c.command),
      ["start", "wallet", "status", "currency", "stop", "help"]
    );
    assert.equal(JSON.stringify(kb).includes("—"), false);
  });
});

describe("telegram epoch notify flag", () => {
  const store = require("../lib/telegram-store");
  const digest = require("../lib/telegram-digest");

  it("defaults on, treats missing field as on, and can turn off", () => {
    assert.equal(store.emptySub("1").notifyEpoch, true);
    assert.equal(store.isNotifyEnabled({}), true);
    assert.equal(store.isNotifyEnabled({ notifyEpoch: true }), true);
    assert.equal(store.isNotifyEnabled({ notifyEpoch: false }), false);
    assert.equal(store.notifyLabel({ notifyEpoch: true }), "Notify: On");
    assert.equal(store.notifyLabel({ notifyEpoch: false }), "Notify: Off");
  });

  it("epoch cron skips notify-off chats and still sends to notify-on", () => {
    const subs = [
      { chatId: "1", wallet: "3QPGLackJy5LKctYYoPGmA4P8ncyE197jdxr1zP2ho8K", notifyEpoch: true },
      { chatId: "2", wallet: "3QPGLackJy5LKctYYoPGmA4P8ncyE197jdxr1zP2ho8K", notifyEpoch: false },
      { chatId: "3", wallet: null, notifyEpoch: true },
      { chatId: "4", wallet: "3QPGLackJy5LKctYYoPGmA4P8ncyE197jdxr1zP2ho8K" }
    ];
    const targets = digest.epochDigestTargets(subs, 842);
    assert.deepEqual(
      targets.map(s => s.chatId),
      ["1", "4"]
    );
  });
});

describe("telegram-info public endpoint", () => {
  function callInfo(username) {
    const prev = process.env.TELEGRAM_BOT_USERNAME;
    if (username === undefined) delete process.env.TELEGRAM_BOT_USERNAME;
    else process.env.TELEGRAM_BOT_USERNAME = username;
    const handler = require("../api/telegram-info");
    return new Promise((resolve, reject) => {
      const res = {
        statusCode: 0,
        headers: {},
        body: "",
        setHeader(k, v) {
          this.headers[k] = v;
        },
        end(s) {
          this.body = s;
          try {
            resolve({ status: this.statusCode, json: JSON.parse(s) });
          } catch (err) {
            reject(err);
          }
        }
      };
      handler({ method: "GET" }, res).catch(reject);
    }).finally(() => {
      if (prev === undefined) delete process.env.TELEGRAM_BOT_USERNAME;
      else process.env.TELEGRAM_BOT_USERNAME = prev;
    });
  }

  it("returns a t.me URL from TELEGRAM_BOT_USERNAME and never a token", async () => {
    process.env.TELEGRAM_BOT_TOKEN = "secret-token-should-not-leak";
    const { status, json } = await callInfo("@OpenSolanaHubBot");
    assert.equal(status, 200);
    assert.equal(json.ok, true);
    assert.equal(json.username, "OpenSolanaHubBot");
    assert.equal(json.url, "https://t.me/OpenSolanaHubBot");
    assert.equal(JSON.stringify(json).includes("secret-token-should-not-leak"), false);
  });

  it("defaults to stake_health_bot when username is unset", async () => {
    const { status, json } = await callInfo("");
    assert.equal(status, 200);
    assert.equal(json.username, "stake_health_bot");
    assert.equal(json.url, "https://t.me/stake_health_bot");
    assert.equal(JSON.stringify(json).includes("TELEGRAM_BOT_TOKEN"), false);
  });

  it("ignores mystake or hash-like env and keeps stake_health_bot", async () => {
    for (const raw of ["#", "/compare/mystake.html", "https://www.opensolanahub.com/compare/mystake.html"]) {
      const { json } = await callInfo(raw);
      assert.equal(json.username, "stake_health_bot");
      assert.equal(json.url, "https://t.me/stake_health_bot");
      assert.equal(isTelegramBotUrl(json.url), true);
    }
  });
});

describe("mystake.html static contract", () => {
  const html = fs.readFileSync(path.join(__dirname, "../compare/mystake.html"), "utf8");
  const pageJs = fs.readFileSync(path.join(__dirname, "../compare/mystake.js"), "utf8");
  const coreJs = fs.readFileSync(path.join(__dirname, "../compare/stake-health-core.js"), "utf8");
  const telegramJs = fs.readFileSync(path.join(__dirname, "../lib/telegram-messages.js"), "utf8");

  it("hardcodes the Telegram bot and newcomer OK copy", () => {
    assert.match(html, /id="nav-telegram"[^>]*href="https:\/\/t\.me\/stake_health_bot"/);
    assert.match(html, /id="telegram-open"[^>]*href="https:\/\/t\.me\/stake_health_bot"/);
    assert.match(html, /id="nav-telegram"[^>]*target="_blank"/);
    assert.match(html, /id="telegram-open"[^>]*target="_blank"/);
    assert.match(html, /rel="noopener noreferrer"/);
    assert.match(html, /Everything looks fine/);
    assert.match(html, /id="telegram-card"/);
    assert.doesNotMatch(html, /href="#"/);
    assert.match(html, /src="\.\/assets\/stake-health-logo\.svg"/);
    assert.match(html, /href="\.\/assets\/stake-health-logo\.png"/);
    assert.ok(fs.existsSync(path.join(__dirname, "../compare/assets/stake-health-logo.svg")));
    assert.ok(fs.existsSync(path.join(__dirname, "../compare/assets/stake-health-logo.png")));
  });

  it("page JS only applies a t.me URL and never a hash href", () => {
    assert.match(pageJs, /safeTelegramBotUrl/);
    assert.match(pageJs, /isTelegramBotUrl\(candidate\)/);
    assert.doesNotMatch(pageJs, /href\s*=\s*["']#["']/);
    assert.ok(coreJs.includes("/^https:\\/\\/t\\.me\\/[A-Za-z0-9_]{5,32}$/"));
  });

  it("Stake health + Telegram user copy uses en dashes, not em dashes", () => {
    const visibleHtml = html.replace(/<style[\s\S]*?<\/style>/gi, "");
    for (const blob of [visibleHtml, coreJs, telegramJs, pageJs]) {
      assert.equal(blob.includes("—"), false);
    }
    assert.doesNotMatch(visibleHtml, / [^\S\r\n]*- [^\S\r\n]/);
    assert.match(messages.DISCLAIMER, /Education only – not financial advice/);
    assert.match(howToReadLines()[1], / – /);
  });
});

describe("inflation-rewards public endpoint", () => {
  it("rejects empty account lists without inventing rewards", async () => {
    const handler = require("../api/inflation-rewards");
    const { status, json } = await new Promise((resolve, reject) => {
      const res = {
        statusCode: 0,
        headers: {},
        body: "",
        setHeader(k, v) {
          this.headers[k] = v;
        },
        end(s) {
          this.body = s;
          try {
            resolve({ status: this.statusCode, json: JSON.parse(s) });
          } catch (err) {
            reject(err);
          }
        }
      };
      handler({ method: "GET", query: {} }, res).catch(reject);
    });
    assert.equal(status, 400);
    assert.equal(json.ok, false);
    assert.doesNotMatch(JSON.stringify(json), /amountSol/);
  });
});
