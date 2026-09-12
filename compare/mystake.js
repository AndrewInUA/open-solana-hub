/**
 * Stake health – client overlay on Validator Transparency.
 *
 * Scoring, fiat, and copy live in stake-health-core.js (shared with the Telegram bot).
 *
 * Lookup:
 *   1. Production dashboard `/api/my-stake` (Helius-backed stake scan + last-epoch rewards)
 *   2. If that fails, or the pasted key is a stake account, public Solana RPC
 *      (getAccountInfo / getProgramAccounts on the Stake program)
 *   3. Extra payouts: Hub `/api/inflation-rewards` (same getInflationReward
 *      path as the Telegram bot), then public RPC. Last epoch is the number
 *      we stand behind. Extra finished epochs appear only as a consecutive
 *      run from last epoch – a gappy list never reaches the page.
 *
 * Health:
 *   Join each vote account to `/api/rpc`, `/api/ratings`, and `/api/snapshots`
 *   and score OK / Watch / Risk in the same voice as the Hub. Your validator
 *   is the operator profile: voting, stability, and fee history.
 */

const {
  DASHBOARD_API,
  STAKE_PROGRAM,
  PUBLIC_RPCS,
  FIATS,
  RATE_TTL_MS,
  OVERLAY_TTL_MS,
  HOW_TO_READ,
  TELEGRAM_CTA,
  TELEGRAM_BOT_URL,
  shortKey,
  fmtSol,
  localeDefaultFiat: localeDefaultFiatFromLang,
  isPubkey,
  votingFromCredits,
  votingHistoryFromCredits,
  parseStakeAccount,
  ownerOf,
  pickName,
  stabilityFromHistory,
  compactOverlay,
  buildHealthView,
  loadSolFiatRates,
  solWithFiat: solWithFiatCore,
  fiatFreshnessCopy,
  fetchRewardHistory,
  mergeRewardsByEpoch,
  moneyStory,
  summarizeAccountRewards,
  rewardsWindowLabel,
  formatRewardEpochLine,
  telegramBotUrl,
  telegramBotUsername,
  isTelegramBotUrl,
  safeTelegramBotUrl
} = window.StakeHealth;

const THEME_KEY = "vtd-theme";
const FIAT_KEY = "vtd-fiat";
const RATE_CACHE_KEY = "vtd-sol-fiat";
const OVERLAY_CACHE_KEY = "vtd-overlay-cache-v2";

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

let fiatRates = null;
let lastView = null;
let rewardsPending = false;

const HUB_ORIGIN = "https://www.opensolanahub.com";

function needsExtraRewardHistory(accounts) {
  return (accounts || []).some(
    acc => acc?.pubkey && !Number.isFinite(Number(acc.rewardCoverage?.attempted))
  );
}

function localeDefaultFiat() {
  let lang = "";
  try {
    lang = String(navigator.language || "").toLowerCase();
  } catch {
    lang = "";
  }
  return localeDefaultFiatFromLang(lang);
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
  const pack = await loadSolFiatRates(fetchJson);
  if (pack) {
    fiatRates = pack;
    writeRateCache(pack);
    return pack;
  }
  fiatRates = null;
  return null;
}

function solWithFiat(sol, opts) {
  return solWithFiatCore(sol, fiatRates, currentFiat(), opts);
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

function setBusy(busy) {
  for (const id of ["btn-lookup", "btn-phantom", "btn-solflare"]) {
    const el = $(id);
    if (el) el.disabled = !!busy;
  }
  $("status-line")?.classList.toggle("busy", !!busy);
}

function profileHref(vote) {
  const u = new URL("./index.html", window.location.href);
  u.searchParams.set("vote", vote);
  return u.pathname + u.search;
}

function explorerHref(key) {
  return `https://explorer.solana.com/address/${encodeURIComponent(key)}`;
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

function applyRewardPack(accounts, packAccounts) {
  const byKey = new Map((packAccounts || []).map(a => [a.pubkey, a]));
  return (accounts || []).map(acc => {
    const hit = byKey.get(acc.pubkey);
    if (!hit) return acc;
    return {
      ...acc,
      rewards: mergeRewardsByEpoch(acc.rewards, hit.rewards),
      rewardCoverage: hit.rewardCoverage || acc.rewardCoverage
    };
  });
}

async function fetchInflationRewardPack(accounts, currentEpoch) {
  const body = JSON.stringify({
    currentEpoch,
    accounts: accounts.map(a => ({
      pubkey: a.pubkey,
      activationEpoch: a.activationEpoch,
      rewards: a.rewards
    }))
  });
  const urls = ["/api/inflation-rewards"];
  if (window.location.origin !== HUB_ORIGIN) {
    urls.push(`${HUB_ORIGIN}/api/inflation-rewards`);
  }
  for (const url of urls) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body
      });
      if (!res.ok) continue;
      const json = await res.json();
      if (json?.ok && Array.isArray(json.accounts)) return json.accounts;
    } catch {
      /* try the next URL, then public RPC */
    }
  }
  return null;
}

async function enrichRewardHistory(accounts, currentEpoch) {
  if (!accounts?.length) return accounts;
  try {
    const packAccounts = await fetchInflationRewardPack(accounts, currentEpoch);
    if (packAccounts) return applyRewardPack(accounts, packAccounts);
  } catch {
    /* static previews have no Hub API – fall back to public RPC */
  }
  try {
    return await fetchRewardHistory(rpcCall, accounts, currentEpoch);
  } catch {
    return accounts;
  }
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
  // limit=1 is enough: include_all_stats returns all-time stability counts.
  // A 40-row window was ~7s; one row + all-time meta is the same history, faster.
  const res = await fetch(
    `${DASHBOARD_API}/api/snapshots?vote=${encodeURIComponent(vote)}&limit=1&include_all_stats=1`
  );
  if (!res.ok) return { snapshots: [], meta: null };
  const json = await res.json();
  return {
    snapshots: Array.isArray(json?.snapshots) ? json.snapshots : [],
    meta: json?.meta || null
  };
}

function readOverlayCache(vote) {
  try {
    const raw = sessionStorage.getItem(`${OVERLAY_CACHE_KEY}:${vote}`);
    const parsed = raw ? JSON.parse(raw) : null;
    if (!parsed || !parsed.at || Date.now() - Number(parsed.at) > OVERLAY_TTL_MS) {
      return null;
    }
    return parsed.data || null;
  } catch {
    return null;
  }
}

function writeOverlayCache(vote, data) {
  try {
    sessionStorage.setItem(
      `${OVERLAY_CACHE_KEY}:${vote}`,
      JSON.stringify({ at: Date.now(), data: compactOverlay(data) })
    );
  } catch {
    /* ignore quota */
  }
}

async function loadOverlay(vote) {
  const cached = readOverlayCache(vote);
  if (cached) return cached;
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
  const votingHistory = votingHistoryFromCredits(me?.epochCredits);
  const votingPct = votingHistory.avg5 ?? votingFromCredits(me?.epochCredits);
  const out = compactOverlay({
    vote,
    name: pickName(ratings, null),
    status,
    commission,
    votingPct,
    votingHistory: votingHistory.count ? votingHistory : null,
    apyMedian: Number.isFinite(Number(ratings?.derived?.apy_median))
      ? Number(ratings.derived.apy_median)
      : null,
    stability: stabilityFromHistory(
      snapPack.snapshots,
      snapPack.meta,
      status,
      commission
    )
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
    $("full-stake-story")?.classList.add("hidden");
    return;
  }
  card.classList.remove("hidden", "ok", "watch", "risk", "wait");
  card.classList.add(v.tone);
  $("verdict-kicker").textContent = v.kicker || "Verdict";
  $("verdict-headline").textContent = v.headline || "";
  const story = $("verdict-money-story");
  const amounts = $("verdict-amounts");
  const fiatHost = $("verdict-fiat");
  const money = v.money;
  const storyText = moneyStory(money, fiatRates, currentFiat());
  if (story) {
    story.textContent = storyText;
    story.classList.toggle("hidden", !storyText);
  }
  if (amounts) {
    amounts.innerHTML = "";
    if (Number.isFinite(Number(v.totalActiveSol)) && v.totalActiveSol > 0) {
      amounts.appendChild(kvMoney("Active stake", v.totalActiveSol));
    }
    if (v.lastEpochSol != null && Number.isFinite(Number(v.lastEpochSol))) {
      amounts.appendChild(kvMoney("Last epoch", v.lastEpochSol, { signed: true }));
    }
    if (money?.showCumulative && Number.isFinite(Number(money.cumulativeSol))) {
      amounts.appendChild(
        kvMoney(money.windowLabel || "Consecutive payouts", money.cumulativeSol)
      );
    }
    const showMoney = Boolean(amounts.childElementCount) || Boolean(storyText);
    amounts.classList.toggle("hidden", !amounts.childElementCount);
    fiatHost?.classList.toggle("hidden", !showMoney);
    if (showMoney) renderFiatHint();
  }
  $("verdict-body").textContent = v.body || "";
  $("verdict-next").textContent = v.next || "";
  renderFullStakeStory(lastView);
}

function renderFullStakeStory(view) {
  const host = $("full-stake-story");
  const amounts = $("full-stake-story-amounts");
  const accountsHost = $("full-stake-story-accounts");
  const lead = $("full-stake-story-lead");
  const note = $("full-stake-story-note");
  const validatorLinks = $("your-validator-links");
  if (!host || !accountsHost) return;
  const rows = view?.rows || [];
  const money = view?.overall?.money;
  const hasMoney =
    (Number.isFinite(Number(money?.activeSol)) && money.activeSol > 0) ||
    Number.isFinite(Number(money?.lastEpochSol)) ||
    (money?.showCumulative && Number.isFinite(Number(money?.cumulativeSol)));
  if (!hasMoney) {
    host.classList.add("hidden");
    return;
  }
  host.classList.remove("hidden");
  const windowLabel = rewardsWindowLabel(money) || "Consecutive payouts";
  const kickerEl = host.querySelector(".verdict-kicker");
  const titleEl = host.querySelector("h2");
  if (money?.showCumulative) {
    if (kickerEl) kickerEl.textContent = "Consecutive payouts";
    if (titleEl) titleEl.textContent = "Consecutive payouts";
  } else {
    if (kickerEl) kickerEl.textContent = "Last payout";
    if (titleEl) titleEl.textContent = "Last epoch";
  }
  if (lead) {
    const n = Number(money?.recordedCount || money?.windowSize);
    lead.textContent =
      money?.showCumulative && Number.isFinite(n) && n > 1
        ? "Last epoch, and the earlier payouts in this unbroken run – not lifetime history."
        : rewardsPending
          ? "Last epoch is in. Reading consecutive payouts we could follow…"
          : "The latest finished payout.";
  }
  if (amounts) {
    amounts.innerHTML = "";
    if (Number.isFinite(Number(money?.activeSol)) && money.activeSol > 0) {
      amounts.appendChild(kvMoney("Active stake", money.activeSol));
    }
    if (money?.lastEpochSol != null && Number.isFinite(Number(money.lastEpochSol))) {
      amounts.appendChild(kvMoney("Last epoch", money.lastEpochSol, { signed: true }));
    }
    if (money?.showCumulative && Number.isFinite(Number(money.cumulativeSol))) {
      amounts.appendChild(kvMoney(windowLabel, money.cumulativeSol));
    }
  }
  accountsHost.innerHTML = "";
  const delegated = rows.filter(r => r.acc?.vote || Number(r.acc?.delegatedSol) > 0);
  const repeatAccountMoney = delegated.length > 1;
  for (const row of delegated) {
    const acc = row.acc;
    const m = row.money || summarizeAccountRewards(acc, view?.pack?.currentEpoch);
    const rewardRows = (m.rewardRows || []).filter(r => r.recorded);
    if (!repeatAccountMoney && rewardRows.length <= 1) continue;
    const block = el("div", "full-stake-account");
    const title =
      row.health?.name ||
      (acc.vote ? shortKey(acc.vote) : acc.pubkey ? `Stake ${shortKey(acc.pubkey)}` : "Stake");
    if (repeatAccountMoney) block.append(el("h3", "", title));
    if (repeatAccountMoney) {
      const rowAmounts = el("div", "verdict-amounts");
      rowAmounts.append(kvMoney("Active", acc.delegatedSol));
      if (m.lastEpochSol != null) {
        rowAmounts.append(kvMoney("Last epoch", m.lastEpochSol, { signed: true }));
      }
      if (m.showCumulative && Number.isFinite(Number(m.cumulativeSol))) {
        rowAmounts.append(kvMoney(rewardsWindowLabel(m) || "Consecutive payouts", m.cumulativeSol));
      }
      block.append(rowAmounts);
    }
    if (rewardRows.length > 1) {
      const listHead = el("p", "epoch-reward-heading", rewardsWindowLabel(m) || windowLabel);
      const list = el("ul", "epoch-reward-list");
      for (const r of rewardRows) {
        const line = formatRewardEpochLine(r);
        if (!line) continue;
        list.append(el("li", "", line));
      }
      if (list.childNodes.length) block.append(listHead, list);
    }
    if (block.childNodes.length) accountsHost.append(block);
  }
  if (note) {
    if (money?.showCumulative) {
      note.textContent = "Sum of this consecutive run – not lifetime history.";
    } else if (rewardsPending) {
      note.textContent = "Reading consecutive payouts we could follow – not lifetime history.";
    } else {
      note.textContent = "";
    }
  }
  if (validatorLinks) {
    validatorLinks.innerHTML = "";
    const votes = [];
    const seen = new Set();
    for (const row of rows) {
      const vote = row?.acc?.vote;
      if (!vote || seen.has(vote)) continue;
      seen.add(vote);
      votes.push({
        vote,
        name: row.health?.name || row.overlay?.name || shortKey(vote)
      });
    }
    const shown = votes.slice(0, 3);
    for (const v of shown) {
      const a = document.createElement("a");
      a.className = shown.length === 1 ? "copy-btn secondary" : "copy-btn secondary";
      a.href = profileHref(v.vote);
      a.textContent = votes.length === 1 ? "Your validator" : `Your validator – ${v.name}`;
      validatorLinks.append(a);
    }
    if (votes.length > 3) {
      validatorLinks.append(el("p", "muted", "More validators are on the stake cards below."));
    }
    $("your-validator")?.classList.toggle("hidden", !votes.length);
  }
  focusFullStakeStory();
}

function focusFullStakeStory() {
  const hash = String(window.location.hash || "").replace(/^#/, "");
  if (hash !== "full-stake-story" && hash !== "stake-story") return;
  requestAnimationFrame(() => {
    $("full-stake-story")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

function renderStakeCard(row, { compact = false, showValidatorLink = true } = {}) {
  const { acc, health, overlay } = row;
  const article = el("article", `stake-card ${health.tone}`);
  const money = row.money || summarizeAccountRewards(acc, lastView?.pack?.currentEpoch);

  if (!compact) {
    const top = el("div", "stake-card-top");
    const left = el("div", "stake-card-who");
    const pill = el("span", `health-pill ${health.tone}`, health.label);
    const title = el("h3", "", health.headline);
    left.append(pill, title);
    const storyText = moneyStory({ ...money, stakeCount: 1 }, fiatRates, currentFiat());
    if (storyText) left.append(el("p", "money-story", storyText));
    top.append(left);

    const amounts = el("div", "stake-amounts");
    amounts.append(kvMoney("Active", acc.delegatedSol));
    if (money.lastEpochSol != null) {
      amounts.append(kvMoney("Last epoch", money.lastEpochSol, { signed: true }));
    } else {
      amounts.append(kv("Last epoch", "–"));
    }
    if (money.showCumulative && Number.isFinite(Number(money.cumulativeSol))) {
      amounts.append(kvMoney(money.windowLabel || "Consecutive payouts", money.cumulativeSol));
    }
    amounts.append(kv("Stake status", acc.status || "–"));
    top.append(amounts);
    article.append(top);
  }

  const signalsBlock = el("div", "signals-block");
  signalsBlock.append(el("div", "verdict-kicker", "Signals"));
  if (acc.vote && showValidatorLink) {
    const a = document.createElement("a");
    a.className = "validator-link";
    a.href = profileHref(acc.vote);
    a.textContent = `Your validator – ${health.name || shortKey(acc.vote)}`;
    signalsBlock.append(a);
  }
  const signals = el("div", "signals");
  const liveStatus = overlay?.status || acc.validator?.status || "";
  if (liveStatus) {
    signals.append(
      signalChip(
        "Validator",
        liveStatus === "healthy"
          ? "Voting"
          : liveStatus === "delinquent"
            ? "Missing votes"
            : liveStatus,
        liveStatus === "delinquent" ? "risk" : liveStatus === "healthy" ? "ok" : ""
      )
    );
  }
  if (Number.isFinite(health.commission)) {
    signals.append(
      signalChip(
        "Validator's cut",
        `${health.commission}%`,
        health.commission >= 50 ? "risk" : health.commission > 10 ? "watch" : "ok"
      )
    );
  }
  if (signals.childNodes.length) signalsBlock.append(signals);
  if (signalsBlock.childNodes.length > 1) article.append(signalsBlock);

    if (!compact) {
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
    } else if (health.reasons.length) {
      const ul = el("ul", "stake-notes");
      for (const bit of health.reasons.slice(0, 4)) {
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
  const compact = delegated.length === 1 && idle.length === 0;
  const uniqueVotes = [...new Set(delegated.map(r => r.acc.vote).filter(Boolean))];
  const showValidatorLink = uniqueVotes.length > 1;
  card.classList.toggle("single-stake", compact);
  const kicker = $("stakes-kicker");
  if (kicker) kicker.textContent = compact ? "This stake" : "Your stakes";
  for (const row of delegated) list.append(renderStakeCard(row, { compact, showValidatorLink }));
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
  if (!compact && Number.isFinite(Number(pack?.currentEpoch))) {
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
    if (compact) {
      totalEl.textContent = "";
    } else {
      const total = rows.reduce((s, r) => s + (Number(r.acc.delegatedSol) || 0), 0);
      const line = solWithFiat(total);
      totalEl.textContent = line.fiat ? `${line.sol} · ${line.fiat}` : line.sol;
    }
  }
  renderFiatHint();
}

function renderFiatHint() {
  const hint = $("fiat-hint");
  if (hint) hint.textContent = fiatFreshnessCopy(fiatRates, currentFiat());
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
  rewardsPending = false;
  $("verdict-card")?.classList.add("hidden");
  $("stakes-card")?.classList.add("hidden");
  $("full-stake-story")?.classList.add("hidden");
  $("verdict-amounts")?.classList.add("hidden");
  $("verdict-money-story")?.classList.add("hidden");
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

function paintLookup(accounts, pack, overlays) {
  const view = buildHealthView(accounts, overlays, pack);
  lastView = view;
  renderOverall(view.overall);
  renderStakes(view.rows, pack);
  focusFullStakeStory();
  return view.rows;
}

async function loadLookup({ wallet, stake }) {
  setError("");
  setBusy(true);
  setStatus("Looking up your stake on-chain…");
  const fiatP = fetchSolFiatRates().catch(() => null);
  try {
    const pack = await resolvePositions({ wallet, stake });
    let accounts = pack.accounts || [];
    let overlays = null;
    rewardsPending = needsExtraRewardHistory(accounts);
    const paint = () => paintLookup(accounts, pack, overlays);
    paint();
    fiatP.then(() => {
      if (lastView?.pack === pack) paint();
    });
    rewardsPending = needsExtraRewardHistory(accounts);
    const enrichP = rewardsPending
      ? enrichRewardHistory(accounts, pack.currentEpoch)
          .then(next => {
            accounts = next;
            pack.accounts = next;
            rewardsPending = false;
            if (lastView?.pack === pack) paint();
          })
          .catch(() => {
            rewardsPending = false;
            if (lastView?.pack === pack) paint();
          })
      : Promise.resolve();
    setStatus(
      accounts.length
        ? `Found ${accounts.length} stake account${accounts.length === 1 ? "" : "s"}. Reading transparency signals…`
        : "No native stake on this address."
    );
    const share = $("share-url");
    if (share) share.value = shareUrl(wallet || pack.wallet, stake);
    if (!accounts.some(a => a.vote)) {
      await enrichP;
      return;
    }
    overlays = await loadOverlays(accounts.map(a => a.vote));
    paint();
    await enrichP;
    if (lastView?.pack === pack) paint();
    setStatus(
      `Found ${pack.accountCount || accounts.length} stake account${
        (pack.accountCount || accounts.length) === 1 ? "" : "s"
      }.`
    );
  } catch (err) {
    setStatus("");
    setError(err.message || "Could not load this address.");
  } finally {
    setBusy(false);
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

function fillHowToRead() {
  const ul = $("how-list");
  if (!ul || !HOW_TO_READ?.length) return;
  ul.innerHTML = "";
  for (const item of HOW_TO_READ) {
    const li = document.createElement("li");
    if (item.tone) li.dataset.tone = item.tone;
    const strong = document.createElement("strong");
    strong.textContent = item.label;
    li.append(strong, document.createTextNode(` – ${item.text}`));
    ul.append(li);
  }
  const leftover = document.createElement("li");
  leftover.textContent =
    "Stake accounts with no validator are leftovers – they are not earning. They do not change the health label at the top.";
  ul.append(leftover);
  const moneyNote = document.createElement("li");
  moneyNote.textContent =
    "Last epoch is the latest payout. Your validator is this operator’s profile: voting, stability, and fee history.";
  ul.append(moneyNote);
}

function applyTelegramLink(url) {
  const safe = safeTelegramBotUrl(url);
  const open = $("telegram-open");
  const fallback = $("telegram-fallback");
  const nav = $("nav-telegram");
  const card = $("telegram-card");
  card?.classList.remove("hidden");
  if (open) {
    open.href = safe;
    open.target = "_blank";
    open.rel = "noopener noreferrer";
    open.removeAttribute("hidden");
    open.classList.remove("hidden");
    open.textContent = `Open @${telegramBotUsername(safe)}`;
  }
  if (nav) {
    nav.href = safe;
    nav.target = "_blank";
    nav.rel = "noopener noreferrer";
    nav.removeAttribute("hidden");
    nav.classList.remove("hidden");
  }
  fallback?.classList.add("hidden");
}

function fillTelegramCta() {
  const kicker = $("telegram-kicker");
  const headline = $("telegram-headline");
  const body = $("telegram-body");
  const steps = $("telegram-steps");
  const fallback = $("telegram-fallback");
  if (kicker) kicker.textContent = TELEGRAM_CTA.kicker;
  if (headline) headline.textContent = TELEGRAM_CTA.headline;
  if (body) body.textContent = TELEGRAM_CTA.body;
  if (steps) {
    steps.innerHTML = "";
    const strong = document.createElement("strong");
    strong.textContent = TELEGRAM_CTA.steps;
    steps.append(strong, document.createTextNode(" – public key only. We never move SOL."));
  }
  if (fallback) fallback.textContent = TELEGRAM_CTA.fallback;
  applyTelegramLink(TELEGRAM_BOT_URL);
  fetch("/api/telegram-info", { cache: "no-store" })
    .then(res => (res.ok ? res.json() : null))
    .then(json => {
      const candidate = json?.url || telegramBotUrl(json?.username);
      applyTelegramLink(isTelegramBotUrl(candidate) ? candidate : TELEGRAM_BOT_URL);
    })
    .catch(() => {
      applyTelegramLink(TELEGRAM_BOT_URL);
    });
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
  fillHowToRead();
  fillTelegramCta();
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
