/**
 * Production Stake health data path for Node (Telegram bot).
 *
 * Same sources as compare/mystake.js:
 *   1. Dashboard /api/my-stake
 *   2. Public Solana RPC fallback
 *   3. Last-epoch rewards from /api/my-stake (getInflationReward). Extra
 *      finished epochs may appear when further getInflationReward calls
 *      return amounts – never filled with 0.
 *   4. Overlays: /api/rpc, /api/ratings, /api/snapshots
 *   5. Fiat: CoinGecko (+ FX fallback) via stake-health-core
 */
const core = require("../compare/stake-health-core");

const {
  DASHBOARD_API,
  STAKE_PROGRAM,
  PUBLIC_RPCS,
  RATE_TTL_MS,
  OVERLAY_TTL_MS,
  parseStakeAccount,
  ownerOf,
  pickName,
  votingFromCredits,
  votingHistoryFromCredits,
  stabilityFromHistory,
  compactOverlay,
  buildHealthView,
  loadSolFiatRates,
  fetchRewardHistory,
  isPubkey
} = core;

let fiatCache = null;
const overlayCache = new Map();

async function fetchJson(url, init) {
  const res = await fetch(url, { cache: "no-store", ...init });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(json.error || `HTTP ${res.status}`);
    err.status = res.status;
    err.body = json;
    throw err;
  }
  return json;
}

function rpcUnavailableError() {
  return new Error("Public Solana RPC did not answer. Try again in a minute.");
}

async function rpcCall(method, params) {
  let lastErr = null;
  for (const url of PUBLIC_RPCS) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params })
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        lastErr = rpcUnavailableError();
        continue;
      }
      if (json.error) {
        lastErr = new Error(json.error.message || "RPC error");
        continue;
      }
      return json.result;
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr || rpcUnavailableError();
}

async function fetchEpoch() {
  const info = await rpcCall("getEpochInfo", []);
  return Number(info?.epoch);
}

async function attachRewards(accounts, currentEpoch) {
  try {
    return await fetchRewardHistory(rpcCall, accounts, currentEpoch);
  } catch {
    return accounts;
  }
}

async function resolveStakeAccount(pubkey) {
  const currentEpoch = await fetchEpoch().catch(() => null);
  const value = await rpcCall("getAccountInfo", [pubkey, { encoding: "jsonParsed" }]);
  if (!value) {
    throw new Error("That address is not a funded account on mainnet.");
  }
  const owner = ownerOf(value);
  const program = value?.data?.program;
  if (owner !== STAKE_PROGRAM && program !== "stake") {
    return null;
  }
  const acc = parseStakeAccount(pubkey, value, currentEpoch);
  const [withRewards] = await attachRewards([acc], currentEpoch);
  return {
    ok: true,
    wallet: withRewards.withdrawer || withRewards.staker || pubkey,
    currentEpoch,
    rpc_source: "public_rpc",
    truncated: false,
    accountCount: 1,
    shown: 1,
    source: "rpc_stake",
    accounts: [withRewards]
  };
}

async function resolveWalletViaRpc(wallet) {
  const currentEpoch = await fetchEpoch().catch(() => null);
  const seen = new Map();
  for (const offset of [44, 12]) {
    try {
      const rows = await rpcCall("getProgramAccounts", [
        STAKE_PROGRAM,
        {
          encoding: "jsonParsed",
          filters: [{ memcmp: { offset, bytes: wallet } }]
        }
      ]);
      if (!Array.isArray(rows)) continue;
      for (const row of rows) {
        const key = row.pubkey;
        if (!key || seen.has(key)) continue;
        seen.set(key, parseStakeAccount(key, row.account, currentEpoch));
      }
    } catch {
      /* GPA is often rate-limited; my-stake is the primary path */
    }
  }
  const parsed = [...seen.values()];
  const accounts = await attachRewards(parsed, currentEpoch);
  return {
    ok: true,
    wallet,
    currentEpoch,
    rpc_source: "public_rpc",
    truncated: false,
    accountCount: accounts.length,
    shown: accounts.length,
    source: "rpc_wallet",
    accounts
  };
}

async function fetchMyStake(wallet) {
  const json = await fetchJson(
    `${DASHBOARD_API}/api/my-stake?wallet=${encodeURIComponent(wallet)}`
  );
  if (!json.ok) {
    throw new Error(json.error || "Lookup failed");
  }
  return { ...json, source: "my-stake" };
}

async function resolvePositions({ wallet, stake }) {
  if (stake && !wallet) {
    try {
      const asStake = await resolveStakeAccount(stake);
      if (asStake) return asStake;
    } catch (err) {
      throw new Error(
        err.message ||
          "Could not read that stake account. Paste the wallet that owns it instead."
      );
    }
    throw new Error(
      "That does not look like a native stake account. If you have the wallet that created it, paste that too."
    );
  }

  if (stake && wallet) {
    let pack = null;
    try {
      pack = await fetchMyStake(wallet);
    } catch {
      pack = null;
    }
    const match = (pack?.accounts || []).find(a => a.pubkey === stake);
    if (match) {
      return {
        ...pack,
        accountCount: 1,
        shown: 1,
        truncated: false,
        accounts: [match]
      };
    }
    const asStake = await resolveStakeAccount(stake);
    if (!asStake) {
      throw new Error("We could not find that stake account on mainnet.");
    }
    const acc = asStake.accounts[0];
    if (
      acc.staker &&
      acc.withdrawer &&
      acc.staker !== wallet &&
      acc.withdrawer !== wallet
    ) {
      throw new Error("That stake account is not authorized by the wallet you entered.");
    }
    return { ...asStake, wallet };
  }

  try {
    const pack = await fetchMyStake(wallet);
    if ((pack.accounts || []).length) return pack;
    const maybeStake = await resolveStakeAccount(wallet).catch(() => null);
    if (maybeStake) return maybeStake;
    return pack;
  } catch (err) {
    const maybeStake = await resolveStakeAccount(wallet).catch(() => null);
    if (maybeStake) return maybeStake;
    try {
      return await resolveWalletViaRpc(wallet);
    } catch (fallbackErr) {
      const msg = String(fallbackErr?.message || "");
      if (/did not answer|RPC HTTP|unavailable/i.test(msg)) {
        throw err;
      }
      throw fallbackErr;
    }
  }
}

async function fetchRatings(vote) {
  try {
    return await fetchJson(`${DASHBOARD_API}/api/ratings?vote=${encodeURIComponent(vote)}`);
  } catch {
    return null;
  }
}

async function fetchLiveRpc(vote) {
  try {
    return await fetchJson(`${DASHBOARD_API}/api/rpc?vote=${encodeURIComponent(vote)}`);
  } catch {
    return null;
  }
}

async function fetchSnapshots(vote) {
  try {
    const json = await fetchJson(
      `${DASHBOARD_API}/api/snapshots?vote=${encodeURIComponent(vote)}&limit=1&include_all_stats=1`
    );
    return {
      snapshots: Array.isArray(json?.snapshots) ? json.snapshots : [],
      meta: json?.meta || null
    };
  } catch {
    return { snapshots: [], meta: null };
  }
}

function readOverlayCache(vote) {
  const hit = overlayCache.get(vote);
  if (!hit || Date.now() - hit.at > OVERLAY_TTL_MS) return null;
  return hit.data;
}

function writeOverlayCache(vote, data) {
  overlayCache.set(vote, { at: Date.now(), data: compactOverlay(data) });
}

async function loadOverlay(vote) {
  const cached = readOverlayCache(vote);
  if (cached) return cached;
  const [livePack, ratings, snapPack] = await Promise.all([
    fetchLiveRpc(vote),
    fetchRatings(vote),
    fetchSnapshots(vote)
  ]);
  const me = livePack?.data || null;
  const status = String(livePack?.status || "").toLowerCase() || null;
  const commission = Number.isFinite(Number(me?.commission))
    ? Number(me.commission)
    : null;
  const out = compactOverlay({
    vote,
    name: pickName(ratings, null),
    status,
    commission,
    votingPct: votingFromCredits(me?.epochCredits),
    votingHistory: (() => {
      const history = votingHistoryFromCredits(me?.epochCredits);
      return history.count ? history : null;
    })(),
    apyMedian: Number.isFinite(Number(ratings?.derived?.apy_median))
      ? Number(ratings.derived.apy_median)
      : null,
    stability: stabilityFromHistory(snapPack.snapshots, snapPack.meta, status, commission)
  });
  writeOverlayCache(vote, out);
  return out;
}

async function loadOverlays(votes) {
  const unique = [...new Set(votes.filter(Boolean))];
  const map = new Map();
  await Promise.all(
    unique.map(async vote => {
      try {
        map.set(vote, await loadOverlay(vote));
      } catch {
        map.set(vote, { vote, name: null, status: null, stability: { score: null } });
      }
    })
  );
  return map;
}

async function fetchSolFiatRates() {
  if (fiatCache && Date.now() - Number(fiatCache.at) < RATE_TTL_MS) {
    return fiatCache;
  }
  const pack = await loadSolFiatRates(fetchJson);
  if (pack) fiatCache = pack;
  return pack;
}

/**
 * Full Stake health checkup for one wallet (same join as mystake.js).
 * Overlays fail soft: we still return stake totals and a weaker verdict.
 */
async function loadStakeHealth(wallet) {
  const key = String(wallet || "").trim();
  if (!isPubkey(key)) {
    throw new Error("That does not look like a Solana address.");
  }
  const fiatP = fetchSolFiatRates().catch(() => null);
  const pack = await resolvePositions({ wallet: key, stake: "" });
  let accounts = pack.accounts || [];
  if (accounts.length && pack.source === "my-stake") {
    try {
      accounts = await fetchRewardHistory(rpcCall, accounts, pack.currentEpoch);
      pack.accounts = accounts;
    } catch {
      /* keep last-epoch rewards from /api/my-stake */
    }
  }
  let overlays = null;
  if (accounts.some(a => a.vote)) {
    try {
      overlays = await loadOverlays(accounts.map(a => a.vote));
    } catch {
      overlays = null;
    }
  }
  const rates = await fiatP;
  const view = buildHealthView(accounts, overlays, pack);
  return { pack, rates, ...view };
}

module.exports = {
  fetchEpoch,
  fetchSolFiatRates,
  resolvePositions,
  loadStakeHealth,
  rpcCall
};
