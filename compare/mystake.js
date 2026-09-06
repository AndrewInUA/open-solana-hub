/**
 * Stake health – client overlay on Validator Transparency.
 *
 * Lookup:
 *   1. Production dashboard `/api/my-stake` (Helius-backed stake scan + last-epoch rewards)
 *   2. If that fails, or the pasted key is a stake account, public Solana RPC
 *      (getAccountInfo / getProgramAccounts on the Stake program)
 *
 * Health:
 *   Join each vote account to `/api/rpc`, `/api/ratings`, and `/api/snapshots`
 *   and score OK / Watch / Risk in the same voice as the Hub.
 */

const THEME_KEY = "vtd-theme";
const FIAT_KEY = "vtd-fiat";
const RATE_CACHE_KEY = "vtd-sol-fiat";
const RATE_TTL_MS = 15 * 60 * 1000;
const DASHBOARD_API = "https://validator-transparency-dashboard.vercel.app";
const STAKE_PROGRAM = "Stake11111111111111111111111111111111111111";
const PUBKEY_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const U64_MAX = 18446744073709551615n;
const LAMPORTS_PER_SOL = 1e9;
const PUBLIC_RPCS = [
  "https://api.mainnet-beta.solana.com",
  "https://solana.drpc.org",
  "https://1rpc.io/solana"
];

function apiBase() {
  const h = window.location.hostname;
  if (h === "localhost" || h === "127.0.0.1") return DASHBOARD_API;
  if (h.includes("validator-transparency-dashboard")) return "";
  return DASHBOARD_API;
}

const MY_STAKE_API = `${apiBase()}/api/my-stake`;

function $(id) {
  return document.getElementById(id);
}

function shortKey(k) {
  if (!k) return "–";
  return k.length > 12 ? `${k.slice(0, 4)}…${k.slice(-4)}` : k;
}

function fmtSol(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return "–";
  if (v === 0) return "0";
  if (Math.abs(v) >= 1000) return v.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (Math.abs(v) >= 1) return v.toFixed(4);
  return v.toFixed(6).replace(/0+$/, "").replace(/\.$/, "");
}

function fmtPct(v, digits = 1) {
  const n = Number(v);
  return Number.isFinite(n) ? `${n.toFixed(digits)}%` : "–";
}

const FIATS = [
  { code: "USD", symbol: "$", locales: ["en-US"] },
  { code: "EUR", symbol: "€", locales: ["de", "fr", "it", "es", "nl", "pt-PT", "fi", "ie", "at", "be", "el"] },
  { code: "UAH", symbol: "₴", locales: ["uk", "uk-UA"] },
  { code: "GBP", symbol: "£", locales: ["en-GB", "en-IE"] },
  { code: "PLN", symbol: "zł", locales: ["pl"] },
  { code: "CAD", symbol: "CA$", locales: ["en-CA", "fr-CA"] },
  { code: "BRL", symbol: "R$", locales: ["pt-BR"] }
];

const STATIC_USD_FX = {
  USD: 1,
  EUR: 0.86,
  UAH: 41.5,
  GBP: 0.74,
  PLN: 3.71,
  CAD: 1.38,
  BRL: 5.11
};

let fiatRates = null;
let lastView = null;

function fiatByCode(code) {
  return FIATS.find(f => f.code === code) || FIATS[0];
}

function localeDefaultFiat() {
  let lang = "";
  try {
    lang = String(navigator.language || "").toLowerCase();
  } catch {
    lang = "";
  }
  for (const f of FIATS) {
    if (f.locales.some(loc => lang === loc.toLowerCase() || lang.startsWith(`${loc.toLowerCase()}-`))) {
      return f.code;
    }
  }
  if (lang.startsWith("uk")) return "UAH";
  if (lang.startsWith("pl")) return "PLN";
  if (lang.startsWith("pt")) return "BRL";
  if (lang.startsWith("en-gb")) return "GBP";
  if (lang.startsWith("en-ca") || lang.startsWith("fr-ca")) return "CAD";
  const euro = ["de", "fr", "it", "es", "nl", "fi", "el", "sk", "sl", "et", "lv", "lt"];
  if (euro.some(p => lang === p || lang.startsWith(`${p}-`))) return "EUR";
  return "USD";
}

function currentFiat() {
  try {
    const saved = localStorage.getItem(FIAT_KEY);
    if (saved && FIATS.some(f => f.code === saved)) return saved;
  } catch {
    /* ignore */
  }
  return localeDefaultFiat();
}

function setFiat(code) {
  const next = FIATS.some(f => f.code === code) ? code : "USD";
  try {
    localStorage.setItem(FIAT_KEY, next);
  } catch {
    /* ignore */
  }
  syncFiatSelect();
  if (lastView) {
    renderOverall(lastView.overall);
    renderStakes(lastView.rows, lastView.pack);
  }
}

function syncFiatSelect() {
  const sel = $("fiat-select");
  if (sel && sel.value !== currentFiat()) sel.value = currentFiat();
}

function readRateCache() {
  try {
    const raw = localStorage.getItem(RATE_CACHE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (!parsed || !parsed.at || !parsed.perSol) return null;
    if (Date.now() - Number(parsed.at) > RATE_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeRateCache(pack) {
  try {
    localStorage.setItem(RATE_CACHE_KEY, JSON.stringify(pack));
  } catch {
    /* ignore */
  }
}

async function fetchJson(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function fetchSolFiatRates() {
  const cached = readRateCache();
  if (cached) {
    fiatRates = cached;
    return cached;
  }
  try {
    const codes = FIATS.map(f => f.code.toLowerCase()).join(",");
    const gecko = await fetchJson(
      `https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=${codes}`
    );
    const row = gecko?.solana || {};
    const perSol = {};
    for (const f of FIATS) {
      const n = Number(row[f.code.toLowerCase()]);
      if (Number.isFinite(n) && n > 0) perSol[f.code] = n;
    }
    if (Number.isFinite(perSol.USD)) {
      const pack = {
        at: Date.now(),
        perSol,
        source: "CoinGecko",
        stale: false
      };
      fiatRates = pack;
      writeRateCache(pack);
      return pack;
    }
  } catch {
    /* try USD + FX */
  }
  try {
    const geckoUsd = await fetchJson(
      "https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd"
    );
    const usd = Number(geckoUsd?.solana?.usd);
    if (!Number.isFinite(usd) || usd <= 0) throw new Error("no usd");
    let fx = { ...STATIC_USD_FX };
    let stale = true;
    let source = "CoinGecko + static FX";
    try {
      const live = await fetchJson("https://open.er-api.com/v6/latest/USD");
      if (live?.result === "success" && live.rates) {
        for (const f of FIATS) {
          const n = Number(live.rates[f.code]);
          if (Number.isFinite(n) && n > 0) fx[f.code] = n;
        }
        stale = false;
        source = "CoinGecko + exchangerate-api";
      }
    } catch {
      /* keep static FX */
    }
    const perSol = {};
    for (const f of FIATS) {
      const n = usd * Number(fx[f.code] || 0);
      if (Number.isFinite(n) && n > 0) perSol[f.code] = n;
    }
    const pack = { at: Date.now(), perSol, source, stale };
    fiatRates = pack;
    writeRateCache(pack);
    return pack;
  } catch {
    fiatRates = null;
    return null;
  }
}

function solToFiat(sol) {
  const n = Number(sol);
  const code = currentFiat();
  const rate = Number(fiatRates?.perSol?.[code]);
  if (!Number.isFinite(n) || !Number.isFinite(rate) || rate <= 0) return null;
  return { amount: n * rate, code, fiat: fiatByCode(code) };
}

function fmtFiat(sol) {
  const conv = solToFiat(sol);
  if (!conv || Math.abs(Number(sol)) < 1e-4) return "";
  const abs = Math.abs(conv.amount);
  let formatted;
  try {
    formatted = new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: conv.code,
      currencyDisplay: "narrowSymbol",
      maximumFractionDigits: abs >= 1000 ? 0 : abs >= 1 ? 0 : abs >= 0.01 ? 2 : 4
    }).format(abs);
  } catch {
    formatted = `${conv.fiat.symbol}${abs >= 1 ? abs.toFixed(0) : abs.toFixed(2)}`;
  }
  const sign = conv.amount < 0 ? "−" : "";
  return `≈ ${sign}${formatted}`;
}

function solWithFiat(sol, { signed = false } = {}) {
  const n = Number(sol);
  if (!Number.isFinite(n)) return { sol: "–", fiat: "" };
  const prefix = signed && n > 0 ? "+" : "";
  const fiat = fmtFiat(n);
  return {
    sol: `${prefix}${fmtSol(n)} SOL`,
    fiat
  };
}

function applyTheme(theme) {
  const t = theme === "dark" ? "dark" : "light";
  document.documentElement.setAttribute("data-theme", t);
  const label = $("theme-toggle-label");
  const btn = $("theme-toggle");
  if (label) label.textContent = t === "dark" ? "Light" : "Dark";
  if (btn) {
    btn.setAttribute("aria-pressed", t === "dark" ? "true" : "false");
    btn.setAttribute(
      "aria-label",
      t === "dark" ? "Switch to light theme" : "Switch to dark theme"
    );
  }
  try {
    localStorage.setItem(THEME_KEY, t);
  } catch {
    /* ignore */
  }
}

function currentTheme() {
  return document.documentElement.getAttribute("data-theme") === "dark"
    ? "dark"
    : "light";
}

function setError(text) {
  const el = $("error-line");
  if (!el) return;
  if (!text) {
    el.classList.add("hidden");
    el.textContent = "";
    return;
  }
  el.textContent = text;
  el.classList.remove("hidden");
}

function setStatus(text) {
  const el = $("status-line");
  if (el) el.textContent = text || "";
}

function profileHref(vote) {
  const u = new URL("./index.html", window.location.href);
  u.searchParams.set("vote", vote);
  return u.pathname + u.search;
}

function explorerHref(key) {
  return `https://explorer.solana.com/address/${encodeURIComponent(key)}`;
}

function isPubkey(value) {
  return PUBKEY_RE.test(String(value || "").trim());
}

function toneRank(tone) {
  if (tone === "risk") return 2;
  if (tone === "watch") return 1;
  return 0;
}

function worseTone(a, b) {
  return toneRank(a) >= toneRank(b) ? a : b;
}

function epochEarnedCredits(row) {
  if (!Array.isArray(row)) return null;
  const credits = Number(row[1]);
  const prevCredits = Number(row[2]);
  if (Number.isFinite(credits) && Number.isFinite(prevCredits)) {
    return Math.max(0, credits - prevCredits);
  }
  return Number.isFinite(credits) ? Math.max(0, credits) : null;
}

function votingFromCredits(credits) {
  const recentRows = Array.isArray(credits) ? credits.slice(-30) : [];
  const deltas = recentRows.map(epochEarnedCredits).filter(v => Number.isFinite(v));
  const maxD = deltas.length ? Math.max(...deltas, 1) : 1;
  const finishedRows = recentRows.length > 1 ? recentRows.slice(0, -1) : [];
  const series = finishedRows
    .map(row => {
      const d = epochEarnedCredits(row);
      return Number.isFinite(d) ? Math.round((d / maxD) * 10000) / 100 : null;
    })
    .filter(v => Number.isFinite(v));
  const last5 = series.slice(-5);
  if (!last5.length) return null;
  return Math.round((last5.reduce((s, x) => s + x, 0) / last5.length) * 100) / 100;
}

function deactivationIsOpen(epoch) {
  if (epoch === null || epoch === undefined || epoch === "") return true;
  try {
    const n = BigInt(String(epoch));
    return n >= U64_MAX / 2n;
  } catch {
    const n = Number(epoch);
    return !Number.isFinite(n) || n > 1e15;
  }
}

function stakeLifecycle({ vote, activationEpoch, deactivationEpoch, currentEpoch }) {
  if (!vote) return "inactive";
  const cur = Number(currentEpoch);
  const act = Number(activationEpoch);
  const deact = Number(deactivationEpoch);
  if (Number.isFinite(act) && Number.isFinite(cur) && act > cur) return "activating";
  if (!deactivationIsOpen(deactivationEpoch)) {
    if (Number.isFinite(deact) && Number.isFinite(cur) && deact <= cur) return "inactive";
    return "deactivating";
  }
  return "active";
}

function rpcUnavailableError() {
  return new Error(
    "Public Solana RPC blocked this browser lookup. Paste the wallet that owns the stake – the dashboard stake API is the reliable path."
  );
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

function parseStakeAccount(pubkey, account, currentEpoch) {
  const lamports = Number(account?.lamports || 0);
  const parsed = account?.data?.parsed;
  const info = parsed?.info || {};
  const meta = info.meta || {};
  const auth = meta.authorized || {};
  const delegation = info.stake?.delegation || null;
  const vote = delegation?.voter || null;
  const delegatedLamports = Number(delegation?.stake || 0);
  const activationEpoch = delegation ? delegation.activationEpoch : null;
  const deactivationEpoch = delegation ? delegation.deactivationEpoch : null;
  return {
    pubkey,
    vote,
    status: stakeLifecycle({
      vote,
      activationEpoch,
      deactivationEpoch,
      currentEpoch
    }),
    lamports,
    sol: lamports / LAMPORTS_PER_SOL,
    delegatedSol: delegatedLamports / LAMPORTS_PER_SOL,
    idleMevSol: Math.max(0, (lamports - delegatedLamports) / LAMPORTS_PER_SOL),
    staker: auth.staker || null,
    withdrawer: auth.withdrawer || null,
    activationEpoch,
    deactivationEpoch,
    rewards: [],
    validator: null,
    validatorName: null
  };
}

function ownerOf(account) {
  return String(account?.owner || account?.data?.program || "");
}

async function fetchEpoch() {
  const info = await rpcCall("getEpochInfo", []);
  return Number(info?.epoch);
}

async function attachRewards(accounts) {
  const keys = accounts.map(a => a.pubkey).filter(Boolean);
  if (!keys.length) return accounts;
  try {
    const rewards = await rpcCall("getInflationReward", [keys]);
    if (!Array.isArray(rewards)) return accounts;
    return accounts.map((acc, i) => {
      const r = rewards[i];
      if (!r || !Number.isFinite(Number(r.amount))) return acc;
      return {
        ...acc,
        rewards: [
          {
            epoch: r.epoch,
            amountSol: Number(r.amount) / LAMPORTS_PER_SOL,
            commission: r.commission,
            postBalanceSol: Number.isFinite(Number(r.postBalance))
              ? Number(r.postBalance) / LAMPORTS_PER_SOL
              : null
          }
        ]
      };
    });
  } catch {
    return accounts;
  }
}

async function resolveStakeAccount(pubkey) {
  const currentEpoch = await fetchEpoch().catch(() => null);
  const value = await rpcCall("getAccountInfo", [
    pubkey,
    { encoding: "jsonParsed" }
  ]);
  if (!value) {
    throw new Error("That address is not a funded account on mainnet.");
  }
  const owner = ownerOf(value);
  const program = value?.data?.program;
  if (owner !== STAKE_PROGRAM && program !== "stake") {
    return null;
  }
  const acc = parseStakeAccount(pubkey, value, currentEpoch);
  const [withRewards] = await attachRewards([acc]);
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
  const accounts = await attachRewards([...seen.values()]);
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
  const res = await fetch(`${MY_STAKE_API}?wallet=${encodeURIComponent(wallet)}`);
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.ok) {
    throw new Error(json.error || `Lookup failed (${res.status})`);
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
      throw new Error(
        "That stake account is not authorized by the wallet you entered."
      );
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
      if (/blocked this browser|RPC HTTP|unavailable/i.test(msg)) {
        throw err;
      }
      throw fallbackErr;
    }
  }
}

async function fetchRatings(vote) {
  const res = await fetch(
    `${DASHBOARD_API}/api/ratings?vote=${encodeURIComponent(vote)}`
  );
  if (!res.ok) return null;
  return res.json();
}

async function fetchLiveRpc(vote) {
  const res = await fetch(
    `${DASHBOARD_API}/api/rpc?vote=${encodeURIComponent(vote)}`
  );
  if (!res.ok) return null;
  return res.json();
}

async function fetchSnapshots(vote) {
  const res = await fetch(
    `${DASHBOARD_API}/api/snapshots?vote=${encodeURIComponent(vote)}&limit=40&include_all_stats=1`
  );
  if (!res.ok) return { snapshots: [], meta: null };
  const json = await res.json();
  return {
    snapshots: Array.isArray(json?.snapshots) ? json.snapshots : [],
    meta: json?.meta || null
  };
}

function pickName(ratings, fallback) {
  if (ratings?.display?.name) return String(ratings.display.name).trim();
  const sw = ratings?.sources?.stakewiz;
  if (sw && !sw.error && typeof sw.name === "string" && sw.name.trim()) {
    return sw.name.trim();
  }
  return fallback || null;
}

function stabilityFromHistory(snaps, meta, liveStatus, commission) {
  const n = Array.isArray(snaps) ? snaps.length : 0;
  let delinquent = 0;
  let commissionChanges = 0;
  for (let i = 0; i < n; i += 1) {
    if (snaps[i]?.status && snaps[i].status !== "healthy") delinquent += 1;
    if (
      i > 0 &&
      Number.isFinite(Number(snaps[i].commission)) &&
      Number.isFinite(Number(snaps[i - 1].commission)) &&
      Number(snaps[i].commission) !== Number(snaps[i - 1].commission)
    ) {
      commissionChanges += 1;
    }
  }
  const sample = Number(meta?.all_time?.sample_count);
  const allDelinquent = Number(meta?.all_time?.delinquent_count);
  const allChanges = Number(meta?.all_time?.commission_changes);
  const useAll = Number.isFinite(sample) && sample > 0;
  const signalSample = useAll ? sample : n;
  const signalDelinquent = useAll && Number.isFinite(allDelinquent) ? allDelinquent : delinquent;
  const signalChanges = useAll && Number.isFinite(allChanges) ? allChanges : commissionChanges;

  if (!signalSample) {
    return { score: null, label: "No history yet", sample: 0, delinquent: 0 };
  }

  let score = 100;
  if (liveStatus === "delinquent") score -= 40;
  score -= (signalDelinquent / signalSample) * 40;
  score -= Math.max(0, Math.min(20, signalChanges * 5));
  if (Number.isFinite(commission)) {
    if (commission >= 100) score -= 40;
    else if (commission >= 50) score -= 30;
    else if (commission > 10) score -= Math.max(0, Math.min(15, (commission - 10) * 1.5));
  }
  score = Math.max(0, Math.min(100, Math.round(score)));
  const label =
    score >= 85 ? "Strong" : score >= 70 ? "Good" : score >= 50 ? "Watch" : "Risk";
  return {
    score,
    label,
    sample: signalSample,
    delinquent: signalDelinquent
  };
}

async function loadOverlay(vote) {
  const [livePack, ratings, snapPack] = await Promise.all([
    fetchLiveRpc(vote).catch(() => null),
    fetchRatings(vote).catch(() => null),
    fetchSnapshots(vote).catch(() => ({ snapshots: [], meta: null }))
  ]);
  const me = livePack?.data || null;
  const status = String(livePack?.status || "").toLowerCase() || null;
  const commission = Number.isFinite(Number(me?.commission))
    ? Number(me.commission)
    : null;
  const votingPct = votingFromCredits(me?.epochCredits);
  return {
    vote,
    name: pickName(ratings, null),
    status,
    commission,
    votingPct,
    apyMedian: Number.isFinite(Number(ratings?.derived?.apy_median))
      ? Number(ratings.derived.apy_median)
      : null,
    ratings,
    livePack,
    stability: stabilityFromHistory(
      snapPack.snapshots,
      snapPack.meta,
      status,
      commission
    )
  };
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

function scoreStake(acc, overlay) {
  const reasons = [];
  const goods = [];
  let tone = "ok";
  const name = overlay?.name || acc.validatorName || (acc.vote ? shortKey(acc.vote) : null);
  const status = String(overlay?.status || acc.validator?.status || "").toLowerCase();
  const commission = Number.isFinite(Number(overlay?.commission))
    ? Number(overlay.commission)
    : Number(acc.validator?.commission);
  const voting = overlay?.votingPct;
  const stability = overlay?.stability;
  const lastReward = acc.rewards?.[0];

  if (!acc.vote) {
    return {
      tone: "watch",
      label: "Watch",
      headline: "This stake is not delegated",
      body: "The account exists, but it is not pointed at a validator, so it is not earning. That is normal for leftover rent or a closed delegation.",
      reasons: ["No validator vote account is attached to this stake."],
      goods,
      name,
      status: acc.status,
      commission,
      voting,
      stability
    };
  }

  if (acc.status === "deactivating") {
    tone = worseTone(tone, "watch");
    reasons.push(
      "This stake is cooling down (undelegating). It stops earning after the current epoch ends."
    );
  } else if (acc.status === "activating") {
    tone = worseTone(tone, "watch");
    reasons.push(
      "This stake is still activating. Rewards usually start after the next epoch."
    );
  } else if (acc.status === "inactive") {
    tone = worseTone(tone, "watch");
    reasons.push("This stake is not active right now.");
  }

  if (status === "delinquent") {
    tone = worseTone(tone, "risk");
    reasons.push(
      "The validator is marked delinquent – it has not been voting reliably. On Solana that usually means missed rewards, not lost SOL."
    );
  } else if (status === "healthy") {
    goods.push("Live status is healthy.");
  } else if (status && status !== "unknown") {
    tone = worseTone(tone, "watch");
    reasons.push(`Live status reads “${status}”, not a clear healthy.`);
  }

  if (Number.isFinite(commission)) {
    if (commission >= 100) {
      tone = worseTone(tone, "risk");
      reasons.push("Commission is 100%. The validator keeps every staking reward.");
    } else if (commission >= 50) {
      tone = worseTone(tone, "risk");
      reasons.push(
        `Commission is ${commission}%. Most rewards go to the validator, not to you.`
      );
    } else if (commission > 10) {
      tone = worseTone(tone, "watch");
      reasons.push(
        `Commission is ${commission}%, which is higher than typical low-fee validators.`
      );
    } else {
      goods.push(`Commission is ${commission}% – a modest fee on rewards.`);
    }
  }

  if (Number.isFinite(voting)) {
    if (voting < 80) {
      tone = worseTone(tone, "risk");
      reasons.push(
        `Recent voting consistency is ${voting.toFixed(1)}%, well below a typical healthy range.`
      );
    } else if (voting < 95) {
      tone = worseTone(tone, "watch");
      reasons.push(
        `Recent voting consistency is ${voting.toFixed(1)}% – worth a look, not a crisis on its own.`
      );
    } else {
      goods.push(`Recent voting looks steady (${voting.toFixed(1)}%).`);
    }
  }

  if (Number.isFinite(stability?.score) && stability.sample >= 8) {
    if (stability.score < 50) {
      tone = worseTone(tone, "risk");
      reasons.push(
        `Stability history is weak (${stability.score}/100) in the snapshots we store.`
      );
    } else if (stability.score < 70) {
      tone = worseTone(tone, "watch");
      reasons.push(`Stability history is mixed (${stability.score}/100).`);
    } else {
      goods.push(`Stability history looks solid (${stability.score}/100).`);
    }
  } else if ((stability?.delinquent || 0) > 0) {
    tone = worseTone(tone, "watch");
    reasons.push("Stored snapshots show at least one day that was not healthy.");
  }

  if (
    acc.status === "active" &&
    lastReward &&
    Number(lastReward.amountSol) === 0 &&
    Number(acc.delegatedSol) > 0.01
  ) {
    tone = worseTone(tone, "watch");
    reasons.push(
      "Last finished epoch paid 0 SOL to this stake. That can mean a missed vote window – or a fee that left nothing."
    );
  }

  const headlines = {
    ok: name ? `${name} looks fine` : "This stake looks fine",
    watch: name ? `${name} needs a look` : "This stake needs a look",
    risk: name ? `${name} has a risk signal` : "This stake has a risk signal"
  };
  const bodies = {
    ok: "Nothing in the live status, fee, or stored history says you need to act right now.",
    watch:
      "Not an emergency – one or more transparency signals are off. Open the validator profile if you want the full picture.",
    risk:
      "Something here is unhealthy or keeps most of the rewards. Read the notes, then decide in your wallet. We do not move SOL."
  };

  return {
    tone,
    label: tone === "ok" ? "OK" : tone === "risk" ? "Risk" : "Watch",
    headline: headlines[tone],
    body: bodies[tone],
    reasons,
    goods,
    name,
    status: status || acc.status,
    commission,
    voting,
    stability
  };
}

function lastSumFrom(active) {
  const last = (active || [])
    .map(r => Number(r.acc.rewards?.[0]?.amountSol))
    .filter(n => Number.isFinite(n));
  return last.length ? last.reduce((s, n) => s + n, 0) : null;
}

function scoreOverall(rows, pack) {
  const delegated = rows.filter(r => r.acc.vote);
  const active = rows.filter(
    r => r.acc.vote && (r.acc.status === "active" || r.acc.status === "activating")
  );

  const totalActiveSol = rows.reduce((s, r) => s + (Number(r.acc.delegatedSol) || 0), 0);

  if (!rows.length) {
    return {
      tone: "wait",
      kicker: "No stake found",
      headline: "No native stake on this address",
      body:
        "We did not find a stake account this address controls. Liquid staking tokens (JitoSOL, mSOL, and similar) will not show here – this page is for native stake only.",
      next: "If you expected a position, check you pasted the wallet that actually created the stake – or paste the stake account itself.",
      lastEpochSol: null,
      totalActiveSol: 0
    };
  }

  if (!delegated.length) {
    return {
      tone: "watch",
      kicker: "Watch",
      headline: "Stake accounts, but no active delegation",
      body: "There are stake accounts here, yet none are pointed at a validator. They are not earning.",
      next: "If you unstaked, wait for the cooldown. If you meant to be delegated, do that in your wallet.",
      lastEpochSol: null,
      totalActiveSol
    };
  }

  const scored = delegated;
  const idleN = rows.length - delegated.length;
  const worst = scored.reduce((w, r) => worseTone(w, r.health.tone), "ok");
  const riskN = scored.filter(r => r.health.tone === "risk").length;
  const watchN = scored.filter(r => r.health.tone === "watch").length;
  const okN = scored.filter(r => r.health.tone === "ok").length;
  const idleNote =
    idleN > 0
      ? ` ${idleN} other account${idleN === 1 ? "" : "s"} on this wallet ${
          idleN === 1 ? "is" : "are"
        } not delegated and do not change this verdict.`
      : "";
  const names = [
    ...new Set(delegated.map(r => r.health.name).filter(Boolean))
  ];
  const nameBit =
    names.length === 1
      ? names[0]
      : `${names.length || delegated.length} validators`;

  if (worst === "risk") {
    return {
      tone: "risk",
      kicker: "Risk",
      headline:
        riskN === 1
          ? "One stake needs attention"
          : `${riskN} stakes need attention`,
      body: `${nameBit} – at least one validator looks delinquent, keeps most rewards, or has a weak history. Your SOL stays in your stake account; this is about rewards and operator health, not a drained wallet.${idleNote}`,
      next: "Open the validator profile for the full picture. This is a checkup, not an instruction to unstake.",
      lastEpochSol: lastSumFrom(active),
      totalActiveSol
    };
  }
  if (worst === "watch") {
    return {
      tone: "watch",
      kicker: "Watch",
      headline: "Looks mostly fine – a few things to read",
      body: `${nameBit}. ${okN ? `${okN} stake${okN === 1 ? "" : "s"} look fine. ` : ""}${watchN} need a closer look (fee, cooldown, or a softer history). Nothing here is a command to move stake.${idleNote}`,
      next: "Skim the cards below. Come back after the next epoch if you like a routine.",
      lastEpochSol: lastSumFrom(active),
      totalActiveSol
    };
  }

  const lastSum = lastSumFrom(active);
  return {
    tone: "ok",
    kicker: "OK",
    headline:
      lastSum !== null
        ? `Last finished epoch: +${fmtSol(lastSum)} SOL`
        : `${nameBit} look healthy`,
    body: `${nameBit} look${names.length === 1 ? "s" : ""} fine in the live read and the snapshots we store. You do not need to do anything.${idleNote}`,
    next:
      pack?.currentEpoch != null
        ? `Epoch ${pack.currentEpoch} is in progress. Save this page and check again after it ends if you want.`
        : "Save this page and check again after the next epoch if you want.",
    lastEpochSol: lastSum,
    totalActiveSol
  };
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function signalChip(label, value, tone) {
  const chip = el("span", `signal${tone ? ` ${tone}` : ""}`);
  chip.append(el("em", "", label), document.createTextNode(value));
  return chip;
}

function renderOverall(v) {
  const card = $("verdict-card");
  if (!card || !v) {
    card?.classList.add("hidden");
    return;
  }
  card.classList.remove("hidden", "ok", "watch", "risk", "wait");
  card.classList.add(v.tone);
  $("verdict-kicker").textContent = v.kicker || "Verdict";
  $("verdict-headline").textContent = v.headline || "";
  $("verdict-body").textContent = v.body || "";
  const fiatLine = $("verdict-fiat");
  if (fiatLine) {
    const parts = [];
    if (Number.isFinite(Number(v.totalActiveSol)) && v.totalActiveSol > 0) {
      const line = solWithFiat(v.totalActiveSol);
      parts.push(line.fiat ? `${line.sol} · ${line.fiat}` : "");
    }
    if (Number.isFinite(Number(v.lastEpochSol)) && Math.abs(v.lastEpochSol) >= 1e-4) {
      const line = solWithFiat(v.lastEpochSol, { signed: true });
      parts.push(line.fiat ? `Last epoch ${line.sol} · ${line.fiat}` : "");
    }
    const text = parts.filter(Boolean).join(" · ");
    fiatLine.textContent = text;
    fiatLine.classList.toggle("hidden", !text);
  }
  $("verdict-next").textContent = v.next || "";
}

function renderStakeCard(row) {
  const { acc, health, overlay } = row;
    const article = el("article", `stake-card ${health.tone}`);
    const top = el("div", "stake-card-top");
    const left = el("div", "stake-card-who");
    const pill = el("span", `health-pill ${health.tone}`, health.label);
    const title = el("h3", "", health.headline);
    left.append(pill, title);

    if (acc.vote) {
      const a = document.createElement("a");
      a.className = "validator-link";
      a.href = profileHref(acc.vote);
      a.textContent = `Open ${health.name || shortKey(acc.vote)} on Validator Transparency`;
      left.append(a);
    }
    top.append(left);

    const amounts = el("div", "stake-amounts");
    amounts.append(
      kvMoney("Active", acc.delegatedSol),
      acc.rewards?.[0]
        ? kvMoney("Last epoch", acc.rewards[0].amountSol, { signed: true })
        : kv("Last epoch", "–"),
      kv("Stake status", acc.status || "–")
    );
    top.append(amounts);
    article.append(top);

    const signals = el("div", "signals");
    const liveStatus = overlay?.status || acc.validator?.status || "";
    if (liveStatus) {
      signals.append(
        signalChip(
          "Status",
          liveStatus === "healthy"
            ? "Healthy"
            : liveStatus === "delinquent"
              ? "Delinquent"
              : liveStatus,
          liveStatus === "delinquent" ? "risk" : liveStatus === "healthy" ? "ok" : ""
        )
      );
    }
    if (Number.isFinite(health.commission)) {
      signals.append(
        signalChip(
          "Commission",
          `${health.commission}%`,
          health.commission >= 50 ? "risk" : health.commission > 10 ? "watch" : "ok"
        )
      );
    }
    if (Number.isFinite(health.voting)) {
      signals.append(
        signalChip(
          "Recent voting",
          fmtPct(health.voting),
          health.voting < 80 ? "risk" : health.voting < 95 ? "watch" : "ok"
        )
      );
    }
    if (Number.isFinite(health.stability?.score)) {
      signals.append(
        signalChip(
          "Stability",
          `${health.stability.score}/100 · ${health.stability.label}`,
          health.stability.score < 50 ? "risk" : health.stability.score < 70 ? "watch" : "ok"
        )
      );
    }
    if (Number.isFinite(overlay?.apyMedian)) {
      signals.append(signalChip("APY context", fmtPct(overlay.apyMedian, 2)));
    }
    if (signals.childNodes.length) article.append(signals);

    const body = el("p", "stake-body", health.body);
    article.append(body);

    const bits = [...health.reasons, ...health.goods.slice(0, 2)];
    if (bits.length) {
      const ul = el("ul", "stake-notes");
      for (const bit of bits.slice(0, 4)) {
        ul.append(el("li", "", bit));
      }
      article.append(ul);
    }

    const meta = el("p", "stake-meta");
    const stakeLink = document.createElement("a");
    stakeLink.href = explorerHref(acc.pubkey);
    stakeLink.target = "_blank";
    stakeLink.rel = "noopener";
    stakeLink.textContent = `Stake ${shortKey(acc.pubkey)}`;
    meta.append(stakeLink);
    if (acc.vote) {
      meta.append(document.createTextNode(" · "));
      const voteLink = document.createElement("a");
      voteLink.href = explorerHref(acc.vote);
      voteLink.target = "_blank";
      voteLink.rel = "noopener";
      voteLink.textContent = `Vote ${shortKey(acc.vote)}`;
      meta.append(voteLink);
    }
    article.append(meta);
  return article;
}

function renderStakes(rows, pack) {
  const list = $("stakes-list");
  const card = $("stakes-card");
  const note = $("stakes-note");
  if (!list || !card) return;
  list.innerHTML = "";
  if (!rows.length) {
    card.classList.add("hidden");
    return;
  }
  card.classList.remove("hidden");

  const delegated = rows.filter(r => r.acc.vote);
  const idle = rows.filter(r => !r.acc.vote);
  for (const row of delegated) list.append(renderStakeCard(row));
  if (idle.length) {
    list.append(
      el(
        "p",
        "muted",
        idle.length === 1
          ? "One stake account is not delegated:"
          : `${idle.length} stake accounts are not delegated:`
      )
    );
    for (const row of idle) list.append(renderStakeCard(row));
  }

  const parts = [];
  if (Number.isFinite(Number(pack?.currentEpoch))) {
    parts.push(`Epoch ${pack.currentEpoch} is in progress.`);
  }
  if (pack?.truncated) {
    parts.push(`Showing ${pack.shown} of ${pack.accountCount} stake accounts.`);
  }
  if (pack?.source === "rpc_wallet" || pack?.source === "rpc_stake") {
    parts.push("Lookup used public Solana RPC (dashboard stake API was unavailable or this is a single stake account).");
  }
  if (note) note.textContent = parts.join(" ");
  const totalEl = $("stakes-total");
  if (totalEl) {
    const total = rows.reduce((s, r) => s + (Number(r.acc.delegatedSol) || 0), 0);
    const line = solWithFiat(total);
    totalEl.textContent = line.fiat ? `${line.sol} · ${line.fiat}` : line.sol;
  }
  const hint = $("fiat-hint");
  if (hint) {
    if (!fiatRates) {
      hint.textContent = "";
    } else {
      const ageMin = Math.max(0, Math.round((Date.now() - Number(fiatRates.at || 0)) / 60000));
      const age = ageMin <= 1 ? "just now" : `${ageMin} min ago`;
      hint.textContent = fiatRates.stale
        ? `Approx. ${fiatRates.source} · may be stale`
        : `Approx. ${fiatRates.source} · ${age}`;
    }
  }
}

function kv(label, value) {
  const wrap = el("div", "kv");
  wrap.append(el("span", "", label), el("strong", "", value));
  return wrap;
}

function kvMoney(label, sol, opts) {
  const line = solWithFiat(sol, opts);
  const wrap = el("div", "kv kv-money");
  wrap.append(el("span", "", label));
  const val = el("div", "kv-val");
  val.append(el("strong", "", line.sol));
  if (line.fiat) val.append(el("em", "fiat-approx", line.fiat));
  wrap.append(val);
  return wrap;
}

function hideResults() {
  lastView = null;
  $("verdict-card")?.classList.add("hidden");
  $("stakes-card")?.classList.add("hidden");
  $("verdict-fiat")?.classList.add("hidden");
}

function fillFiatSelect() {
  const sel = $("fiat-select");
  if (!sel) return;
  sel.innerHTML = "";
  for (const f of FIATS) {
    const opt = document.createElement("option");
    opt.value = f.code;
    opt.textContent = `${f.code} · ${f.symbol}`;
    sel.appendChild(opt);
  }
  sel.value = currentFiat();
  sel.addEventListener("change", () => setFiat(sel.value));
}

function shareUrl(wallet, stake) {
  const u = new URL(window.location.href);
  u.search = "";
  u.hash = "";
  if (wallet) u.searchParams.set("wallet", wallet);
  if (stake) u.searchParams.set("stake", stake);
  return u.toString();
}

async function loadLookup({ wallet, stake }) {
  setError("");
  hideResults();
  setStatus("Looking up native stake…");
  const btn = $("btn-lookup");
  if (btn) btn.disabled = true;
  try {
    const pack = await resolvePositions({ wallet, stake });
    const accounts = pack.accounts || [];
    setStatus(
      accounts.length
        ? `Found ${accounts.length} stake account${accounts.length === 1 ? "" : "s"}. Reading transparency signals…`
        : "Lookup finished."
    );
    const overlays = await loadOverlays(accounts.map(a => a.vote));
    const rows = accounts.map(acc => {
      const overlay = acc.vote ? overlays.get(acc.vote) : null;
      return { acc, overlay, health: scoreStake(acc, overlay) };
    });
    rows.sort((a, b) => {
      const t = toneRank(b.health.tone) - toneRank(a.health.tone);
      if (t) return t;
      return Number(b.acc.delegatedSol || 0) - Number(a.acc.delegatedSol || 0);
    });
    await fetchSolFiatRates().catch(() => null);
    const overall = scoreOverall(rows, pack);
    lastView = { rows, pack, overall };
    renderOverall(overall);
    renderStakes(rows, pack);
    setStatus(
      accounts.length
        ? `Found ${pack.accountCount || accounts.length} stake account${
            (pack.accountCount || accounts.length) === 1 ? "" : "s"
          }.`
        : "No native stake on this address."
    );
    const share = $("share-url");
    if (share) share.value = shareUrl(wallet || pack.wallet, stake);
  } catch (err) {
    setStatus("");
    setError(err.message || "Could not load this address.");
  } finally {
    if (btn) btn.disabled = false;
  }
}

function readForm() {
  return {
    wallet: String($("wallet-input")?.value || "").trim(),
    stake: String($("stake-input")?.value || "").trim()
  };
}

function validateForm({ wallet, stake }) {
  if (!wallet && !stake) {
    return "Paste a wallet address, or a stake account.";
  }
  if (wallet && !isPubkey(wallet)) {
    return "That wallet does not look like a Solana address.";
  }
  if (stake && !isPubkey(stake)) {
    return "That stake account does not look like a Solana address.";
  }
  return null;
}

function getInjected(name) {
  if (name === "phantom") return window.phantom?.solana || window.solana;
  if (name === "solflare") {
    return window.solflare || (window.solana?.isSolflare ? window.solana : null);
  }
  return null;
}

async function connectProvider(name) {
  const provider = getInjected(name);
  if (!provider?.connect) {
    throw new Error(
      name === "phantom"
        ? "Phantom is not installed in this browser."
        : "Solflare is not installed in this browser."
    );
  }
  const res = await provider.connect();
  const key =
    res?.publicKey?.toBase58?.() ||
    provider.publicKey?.toBase58?.() ||
    provider.publicKey?.toString?.();
  if (!key || !isPubkey(key)) {
    throw new Error("Wallet connected but no public key was returned.");
  }
  return String(key);
}

function showConnected(wallet) {
  const line = $("connected-wallet");
  const disc = $("btn-disconnect");
  if (line) line.textContent = wallet ? `Using ${wallet}` : "";
  if (disc) disc.classList.toggle("hidden", !wallet);
  if (wallet && $("wallet-input")) $("wallet-input").value = wallet;
}

async function onConnect(name) {
  setError("");
  setStatus("Connecting…");
  try {
    const wallet = await connectProvider(name);
    showConnected(wallet);
    await loadLookup({ wallet, stake: String($("stake-input")?.value || "").trim() });
  } catch (err) {
    setStatus("");
    setError(err.message || "Connect failed.");
  }
}

function boot() {
  applyTheme(
    (() => {
      try {
        const t = localStorage.getItem(THEME_KEY);
        if (t === "light" || t === "dark") return t;
      } catch {
        /* ignore */
      }
      return currentTheme();
    })()
  );

  $("theme-toggle")?.addEventListener("click", () => {
    applyTheme(currentTheme() === "dark" ? "light" : "dark");
  });
  $("btn-phantom")?.addEventListener("click", () => onConnect("phantom"));
  $("btn-solflare")?.addEventListener("click", () => onConnect("solflare"));
  $("btn-disconnect")?.addEventListener("click", () => {
    showConnected("");
    setStatus("");
    hideResults();
  });

  const submit = () => {
    const form = readForm();
    const bad = validateForm(form);
    if (bad) {
      setError(bad);
      return;
    }
    if (form.wallet) showConnected(form.wallet);
    loadLookup(form);
  };

  $("btn-lookup")?.addEventListener("click", submit);
  $("wallet-input")?.addEventListener("keydown", e => {
    if (e.key === "Enter") submit();
  });
  $("stake-input")?.addEventListener("keydown", e => {
    if (e.key === "Enter") submit();
  });
  fillFiatSelect();
  fetchSolFiatRates().catch(() => null);

  $("copy-share")?.addEventListener("click", async () => {
    const share = $("share-url");
    if (!share?.value) return;
    try {
      await navigator.clipboard.writeText(share.value);
      $("copy-share").textContent = "Copied";
      setTimeout(() => {
        if ($("copy-share")) $("copy-share").textContent = "Copy link";
      }, 1600);
    } catch {
      share.select();
    }
  });

  const q = new URLSearchParams(window.location.search);
  const wallet = (q.get("wallet") || "").trim();
  const stake = (q.get("stake") || "").trim();
  if (wallet && isPubkey(wallet)) $("wallet-input").value = wallet;
  if (stake && isPubkey(stake)) $("stake-input").value = stake;
  if ((wallet && isPubkey(wallet)) || (stake && isPubkey(stake))) {
    if (wallet) showConnected(wallet);
    loadLookup({
      wallet: isPubkey(wallet) ? wallet : "",
      stake: isPubkey(stake) ? stake : ""
    });
  }
}

boot();
