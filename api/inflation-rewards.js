/**
 * Cumulative stake inflation rewards for Stake health.
 *
 * POST /api/inflation-rewards
 * Body: { currentEpoch, accounts: [{ pubkey, activationEpoch }] }
 *
 * Uses the same public Solana RPC path as the Telegram bot. Caps at 16
 * finished epochs (from activation when that span fits). Failures and nulls
 * skip an amount – never filled with 0. The page lists those epochs as
 * “No reward recorded”.
 */
const core = require("../compare/stake-health-core");
const lookup = require("../lib/stake-lookup");

const MAX_ACCOUNTS = 40;

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "public, s-maxage=20, stale-while-revalidate=40");
  res.end(JSON.stringify(body));
}

function readBody(req) {
  if (req.body && typeof req.body === "object") return Promise.resolve(req.body);
  if (typeof req.body === "string") {
    try {
      return Promise.resolve(JSON.parse(req.body || "{}"));
    } catch {
      return Promise.resolve(null);
    }
  }
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", chunk => {
      raw += chunk;
      if (raw.length > 1e6) req.destroy();
    });
    req.on("end", () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

function parseAccounts(raw) {
  if (Array.isArray(raw)) {
    return raw
      .map(row => {
        if (typeof row === "string") return { pubkey: row.trim(), activationEpoch: null };
        const pubkey = String(row?.pubkey || "").trim();
        return { pubkey, activationEpoch: row?.activationEpoch ?? null };
      })
      .filter(row => core.isPubkey(row.pubkey))
      .slice(0, MAX_ACCOUNTS);
  }
  if (typeof raw === "string") {
    return raw
      .split(",")
      .map(s => s.trim())
      .filter(core.isPubkey)
      .slice(0, MAX_ACCOUNTS)
      .map(pubkey => ({ pubkey, activationEpoch: null }));
  }
  return [];
}

module.exports = async function inflationRewards(req, res) {
  cors(res);
  if (req.method === "OPTIONS") {
    json(res, 200, { ok: true });
    return;
  }

  let body = {};
  if (req.method === "POST") {
    try {
      body = (await readBody(req)) || {};
    } catch {
      json(res, 400, { ok: false, error: "Invalid JSON" });
      return;
    }
  } else if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET, HEAD, POST, OPTIONS");
    json(res, 405, { ok: false, error: "method not allowed" });
    return;
  }

  const query = req.query || {};
  const accounts = parseAccounts(body.accounts || query.accounts);
  if (!accounts.length) {
    json(res, 400, {
      ok: false,
      error: "Pass stake account pubkeys as accounts[]"
    });
    return;
  }

  let currentEpoch = Number(body.currentEpoch || query.currentEpoch);
  if (!Number.isFinite(currentEpoch)) {
    try {
      currentEpoch = await lookup.fetchEpoch();
    } catch (err) {
      json(res, 502, { ok: false, error: err.message || "Could not read epoch" });
      return;
    }
  }

  try {
    const enriched = await core.fetchRewardHistory(
      lookup.rpcCall,
      accounts,
      currentEpoch
    );
    json(res, 200, {
      ok: true,
      currentEpoch,
      maxEpochs: core.MAX_REWARD_HISTORY_EPOCHS,
      accounts: enriched.map(a => ({
        pubkey: a.pubkey,
        rewards: a.rewards,
        rewardCoverage: a.rewardCoverage
      }))
    });
  } catch (err) {
    json(res, 502, { ok: false, error: err.message || "Reward lookup failed" });
  }
};
