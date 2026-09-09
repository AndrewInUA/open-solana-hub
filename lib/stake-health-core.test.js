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
  mystakeUrl,
  TONE_COPY,
  HOW_TO_READ,
  TELEGRAM_CTA,
  votingHistoryFromCredits,
  votingFromCredits,
  summarizeRecentPicture,
  telegramBotUrl,
  telegramBotUsername,
  DEFAULT_TELEGRAM_BOT_USERNAME,
  TELEGRAM_BOT_URL,
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
});

describe("telegram copy", () => {
  it("status includes verdict, fiat, mystake link, and disclaimer", () => {
    const rates = { perSol: { USD: 150 }, source: "CoinGecko", stale: false, at: Date.now() };
    const view = buildHealthView(
      [acc({ validatorName: "AndrewInUA", delegatedSol: 12.5 })],
      new Map([["Vote111111111111111111111111111111111AAA", overlay()]]),
      { currentEpoch: 842 }
    );
    view.rates = rates;
    const wallet = "3QPGLackJy5LKctYYoPGmA4P8ncyE197jdxr1zP2ho8K";
    const text = messages.formatStatus(view, { fiat: "USD", wallet });
    assert.match(text, /<b>OK<\/b>/);
    assert.match(text, /12\.5000 SOL/);
    assert.match(text, /≈ /);
    assert.match(text, /Education only/);
    assert.match(text, /Recent voting over the last 5 finished epochs/);
    assert.match(text, /no unhealthy days/);
    assert.equal(text.includes(mystakeUrl(wallet)), true);
    assert.match(text, /\?wallet=/);
    assert.doesNotMatch(text, /seed phrase|private key/i);
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
    assert.match(text, /Recent voting/);
    assert.equal(text.includes(mystakeUrl(wallet)), true);
    assert.ok(text.split("\n").length < 28);
  });

  it("empty wallet does not invent a last-epoch reward of 0", () => {
    const view = buildHealthView([], null, { currentEpoch: 842 });
    view.rates = { perSol: { USD: 150 }, source: "CoinGecko", stale: false, at: Date.now() };
    assert.equal(view.overall.lastEpochSol, null);
    const text = messages.formatStatus(view, { fiat: "USD", wallet: "3QPGLackJy5LKctYYoPGmA4P8ncyE197jdxr1zP2ho8K" });
    assert.doesNotMatch(text, /Last epoch/);
  });

  it("start copy uses shared How to read this and never asks for a seed", () => {
    const start = messages.startMessage();
    assert.match(start, /public key/);
    assert.match(start, /never move SOL/i);
    assert.ok(start.includes(TONE_COPY.ok.body));
    assert.ok(start.includes(TONE_COPY.watch.body));
    assert.ok(start.includes(TONE_COPY.risk.body));
    assert.match(messages.seedWarning(), /Never send a seed/);
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
});
