const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
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
  mystakeUrl
} = core;

function acc(partial) {
  return {
    pubkey: "Stake11111111111111111111111111111111AAA",
    vote: "Vote111111111111111111111111111111111AAA",
    status: "active",
    delegatedSol: 10,
    rewards: [{ amountSol: 0.01, epoch: 800 }],
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
  });
});

describe("telegram copy", () => {
  it("status includes verdict, fiat, mystake link, and disclaimer", () => {
    const rates = { perSol: { USD: 150 }, source: "CoinGecko", stale: false, at: Date.now() };
    const view = buildHealthView(
      [acc({ validatorName: "AndrewInUA", delegatedSol: 12.5 })],
      new Map([
        [
          "Vote111111111111111111111111111111111AAA",
          {
            name: "AndrewInUA",
            status: "healthy",
            commission: 0,
            votingPct: 99,
            stability: { score: 90, sample: 20, delinquent: 0 }
          }
        ]
      ]),
      { currentEpoch: 842 }
    );
    view.rates = rates;
    const text = messages.formatStatus(view, {
      fiat: "USD",
      wallet: "3QPGLackJy5LKctYYoPGmA4P8ncyE197jdxr1zP2ho8K"
    });
    assert.match(text, /<b>OK<\/b>/);
    assert.match(text, /12\.5000 SOL/);
    assert.match(text, /≈ /);
    assert.match(text, /Education only/);
    assert.equal(
      text.includes(mystakeUrl("3QPGLackJy5LKctYYoPGmA4P8ncyE197jdxr1zP2ho8K")),
      true
    );
    assert.doesNotMatch(text, /seed phrase|private key/i);
  });

  it("start copy never asks for a seed", () => {
    assert.match(messages.startMessage(), /public key/);
    assert.match(messages.startMessage(), /never move SOL/i);
    assert.match(messages.seedWarning(), /Never send a seed/);
  });
});
