/**
 * Shared Stake health scoring, copy, and fiat helpers.
 *
 * Loaded by:
 *   - compare/mystake.js (browser) as window.StakeHealth
 *   - the Telegram bot (Node) via require()
 *
 * Keep verdict semantics here so the website and bot stay aligned.
 * DOM, wallet connect, and Telegram formatting stay in their callers.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  if (typeof root === "object" && root) {
    root.StakeHealth = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const DASHBOARD_API = "https://validator-transparency-dashboard.vercel.app";
  const MYSTAKE_PAGE = "https://www.opensolanahub.com/compare/mystake.html";
  const STAKE_PROGRAM = "Stake11111111111111111111111111111111111111";
  const PUBKEY_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
  const U64_MAX = 18446744073709551615n;
  const LAMPORTS_PER_SOL = 1e9;
  const RATE_TTL_MS = 15 * 60 * 1000;
  const OVERLAY_TTL_MS = 10 * 60 * 1000;
  const PUBLIC_RPCS = [
    "https://api.mainnet-beta.solana.com",
    "https://solana.drpc.org",
    "https://1rpc.io/solana"
  ];

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

  const FIAT_CODES = FIATS.map(f => f.code);

  /**
   * Shared OK / Watch / Risk voice for the page, How to read this, and Telegram.
   * Education only – not financial advice.
   */
  const TONE_COPY = {
    ok: {
      label: "OK",
      body: "Everything looks fine. You don’t need to do anything right now."
    },
    watch: {
      label: "Watch",
      body: "Something’s a bit off – worth a look, not an emergency."
    },
    risk: {
      label: "Risk",
      body: "This needs attention before you decide anything. Open the validator profile."
    }
  };

  const HOW_TO_READ = [
    { label: "OK", text: TONE_COPY.ok.body },
    { label: "Watch", text: TONE_COPY.watch.body },
    { label: "Risk", text: TONE_COPY.risk.body }
  ];

  const DEFAULT_TELEGRAM_BOT_USERNAME = "stake_health_bot";
  const TELEGRAM_BOT_URL = `https://t.me/${DEFAULT_TELEGRAM_BOT_USERNAME}`;

  const TELEGRAM_CTA = {
    kicker: "Telegram",
    headline: "Get epoch checkups in Telegram",
    body:
      "Same plain-English OK / Watch / Risk notes when a new Solana epoch starts. Public key only – we never move SOL.",
    steps: "/start → /wallet → /status",
    username: DEFAULT_TELEGRAM_BOT_USERNAME,
    url: TELEGRAM_BOT_URL,
    fallback: "Telegram bot coming – ask for the link."
  };

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

  function fiatByCode(code) {
    return FIATS.find(f => f.code === code) || FIATS[0];
  }

  function isFiatCode(code) {
    return FIATS.some(f => f.code === String(code || "").toUpperCase());
  }

  function normalizeFiat(code) {
    const next = String(code || "").toUpperCase();
    return isFiatCode(next) ? next : "USD";
  }

  function localeDefaultFiat(langHint) {
    const lang = String(langHint || "").toLowerCase();
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

  function isPubkey(value) {
    return PUBKEY_RE.test(String(value || "").trim());
  }

  function looksLikeSeedPhrase(text) {
    const words = String(text || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    if (words.length < 8) return false;
    return words.every(w => /^[a-zA-Z]+$/.test(w));
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

  function votingHistoryFromCredits(credits) {
    const recentRows = Array.isArray(credits) ? credits.slice(-30) : [];
    const deltas = recentRows.map(epochEarnedCredits).filter(v => Number.isFinite(v));
    const maxD = deltas.length ? Math.max(...deltas, 1) : 1;
    const finishedRows = recentRows.length > 1 ? recentRows.slice(0, -1) : [];
    const epochs = finishedRows
      .map(row => {
        const epoch = Number(row[0]);
        const d = epochEarnedCredits(row);
        const pct = Number.isFinite(d) ? Math.round((d / maxD) * 10000) / 100 : null;
        return Number.isFinite(epoch) && Number.isFinite(pct) ? { epoch, pct } : null;
      })
      .filter(Boolean);
    const last5 = epochs.slice(-5);
    const avg5 = last5.length
      ? Math.round((last5.reduce((s, x) => s + x.pct, 0) / last5.length) * 100) / 100
      : null;
    const pcts = epochs.map(e => e.pct);
    return {
      epochs: epochs.slice(-8),
      count: epochs.length,
      avg5,
      min: pcts.length ? Math.min(...pcts) : null,
      max: pcts.length ? Math.max(...pcts) : null
    };
  }

  function votingFromCredits(credits) {
    const history = votingHistoryFromCredits(credits);
    return history.avg5;
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

  function ownerOf(account) {
    return String(account?.owner || account?.data?.program || "");
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
      return {
        score: null,
        label: "No history yet",
        sample: 0,
        delinquent: 0,
        commissionChanges: 0
      };
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
      delinquent: signalDelinquent,
      commissionChanges: signalChanges
    };
  }

  function compactOverlay(o) {
    if (!o) return null;
    return {
      vote: o.vote,
      name: o.name || null,
      status: o.status || null,
      commission: o.commission,
      votingPct: o.votingPct,
      votingHistory: o.votingHistory || null,
      apyMedian: o.apyMedian,
      stability: o.stability || { score: null }
    };
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

    return {
      tone,
      label: tone === "ok" ? "OK" : tone === "risk" ? "Risk" : "Watch",
      headline: headlines[tone],
      body: TONE_COPY[tone].body,
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

  function situationHeadline(rows, names, nameBit) {
    const active = rows.filter(r => r.acc.status === "active");
    const activating = rows.filter(r => r.acc.status === "activating");
    const deactivating = rows.filter(r => r.acc.status === "deactivating");
    if (names.length === 1) {
      const name = names[0];
      if (activating.length && !active.length && !deactivating.length) {
        return `Your stake on ${name} is still activating.`;
      }
      if (deactivating.length && !active.length && !activating.length) {
        return `Your stake on ${name} is cooling down.`;
      }
      if (active.length) return `Your stake is active on ${name}.`;
      return `Your stake is on ${name}.`;
    }
    if (names.length > 1 || (nameBit && String(nameBit).includes("validator"))) {
      return `Your stake is split across ${nameBit}.`;
    }
    return `Your stake is on ${nameBit}.`;
  }

  function overallCommLine(scored) {
    const comms = scored
      .map(r => r.health.commission)
      .filter(n => Number.isFinite(n));
    if (!comms.length) return "We do not have a recent commission reading.";
    const same = comms.every(c => c === comms[0]);
    return same
      ? `Commission ${comms[0]}%.`
      : `Commission differs (${[...new Set(comms)].join("% / ")}%).`;
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
        headline: "These stake accounts have no validator – they are not earning.",
        body: "There are stake accounts here, yet none are pointed at a validator. They are not earning.",
        next: "If you unstaked, wait for the cooldown. If you meant to be delegated, do that in your wallet.",
        lastEpochSol: null,
        totalActiveSol
      };
    }

    const scored = delegated;
    const idleN = rows.length - delegated.length;
    const worst = scored.reduce((w, r) => worseTone(w, r.health.tone), "ok");
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

    const lastSum = lastSumFrom(active);
    const commLine = overallCommLine(scored);
    const headline = situationHeadline(delegated, names, nameBit);

    if (worst === "risk") {
      return {
        tone: "risk",
        kicker: "Risk",
        headline,
        body: `${commLine} ${TONE_COPY.risk.body}${idleNote}`.replace(/\s+/g, " ").trim(),
        next: "Open the validator profile for the full picture. This is a checkup, not an instruction to unstake.",
        lastEpochSol: lastSum,
        totalActiveSol
      };
    }
    if (worst === "watch") {
      return {
        tone: "watch",
        kicker: "Watch",
        headline,
        body: `${commLine} ${TONE_COPY.watch.body}${idleNote}`.replace(/\s+/g, " ").trim(),
        next: "Skim the cards below. Come back after the next epoch if you like a routine.",
        lastEpochSol: lastSum,
        totalActiveSol
      };
    }

    return {
      tone: "ok",
      kicker: "OK",
      headline,
      body: `${commLine} ${TONE_COPY.ok.body}${idleNote}`.replace(/\s+/g, " ").trim(),
      next:
        pack?.currentEpoch != null
          ? `Epoch ${pack.currentEpoch} is in progress. Save this page and check again after it ends if you want.`
          : "Save this page and check again after the next epoch if you want.",
      lastEpochSol: lastSum,
      totalActiveSol
    };
  }

  function overlayFromMap(overlays, vote) {
    if (!overlays || !vote) return null;
    if (typeof overlays.get === "function") return overlays.get(vote) || null;
    return overlays[vote] || null;
  }

  function buildHealthView(accounts, overlays, pack) {
    const rows = (accounts || []).map(acc => {
      const overlay = acc.vote ? overlayFromMap(overlays, acc.vote) : null;
      return { acc, overlay, health: scoreStake(acc, overlay) };
    });
    rows.sort((a, b) => {
      const t = toneRank(b.health.tone) - toneRank(a.health.tone);
      if (t) return t;
      return Number(b.acc.delegatedSol || 0) - Number(a.acc.delegatedSol || 0);
    });
    const overall = scoreOverall(rows, pack);
    return { rows, pack, overall };
  }

  function solToFiat(sol, rates, code) {
    const n = Number(sol);
    const useCode = normalizeFiat(code);
    const rate = Number(rates?.perSol?.[useCode]);
    if (!Number.isFinite(n) || !Number.isFinite(rate) || rate <= 0) return null;
    return { amount: n * rate, code: useCode, fiat: fiatByCode(useCode) };
  }

  function fmtFiat(sol, rates, code) {
    const conv = solToFiat(sol, rates, code);
    if (!conv) return "";
    const abs = Math.abs(conv.amount);
    const digits = abs >= 1 ? 0 : abs >= 0.01 ? 2 : abs >= 0.0001 ? 4 : 6;
    let formatted;
    try {
      formatted = new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: conv.code,
        currencyDisplay: "narrowSymbol",
        maximumFractionDigits: digits,
        minimumFractionDigits: abs >= 0.01 || abs === 0 ? Math.min(2, digits) : digits
      }).format(abs);
    } catch {
      formatted = `${conv.fiat.symbol}${abs.toFixed(digits)}`;
    }
    const sign = conv.amount < 0 ? "−" : "";
    return `≈ ${sign}${formatted}`;
  }

  function solWithFiat(sol, rates, code, { signed = false } = {}) {
    const n = Number(sol);
    if (!Number.isFinite(n)) return { sol: "–", fiat: "" };
    const prefix = signed && n > 0 ? "+" : "";
    const fiat = fmtFiat(n, rates, code);
    return {
      sol: `${prefix}${fmtSol(n)} SOL`,
      fiat
    };
  }

  function moneyLine(sol, rates, code, opts) {
    const line = solWithFiat(sol, rates, code, opts);
    return line.fiat ? `${line.sol} · ${line.fiat}` : line.sol;
  }

  function mystakeUrl(wallet, stake) {
    const u = new URL(MYSTAKE_PAGE);
    if (wallet) u.searchParams.set("wallet", wallet);
    if (stake) u.searchParams.set("stake", stake);
    return u.toString();
  }

  function telegramBotUsername(raw) {
    const username = String(raw || "")
      .trim()
      .replace(/^@/, "");
    if (/^[A-Za-z0-9_]{5,32}$/.test(username)) return username;
    return DEFAULT_TELEGRAM_BOT_USERNAME;
  }

  function telegramBotUrl(raw) {
    return `https://t.me/${telegramBotUsername(raw)}`;
  }

  function rangePct(min, max) {
    if (!Number.isFinite(min) || !Number.isFinite(max)) return "";
    const digits = Number.isInteger(min) && Number.isInteger(max) ? 0 : 1;
    if (min === max) return fmtPct(min, digits);
    return `${fmtPct(min, digits).replace("%", "")}–${fmtPct(max, digits)}`;
  }

  function votingLineFromHistory(history) {
    if (!history || !Number.isFinite(history.avg5) || !history.count) return null;
    const n = Math.min(5, history.count);
    const range = rangePct(history.min, history.max);
    const rangeBit = range ? ` (range ${range})` : "";
    return `Recent voting over the last ${n} finished epoch${
      n === 1 ? "" : "s"
    }: ${fmtPct(history.avg5)}${rangeBit}.`;
  }

  function stabilityLineFromHistory(stability, { pluralValidators = false } = {}) {
    if (!stability || !stability.sample) return null;
    const who = pluralValidators ? "Your validators" : "This validator";
    const del = Number(stability.delinquent) || 0;
    const unhealthy =
      del === 0
        ? "no unhealthy days in stored snapshots"
        : `${del} unhealthy day${del === 1 ? "" : "s"} in stored snapshots`;
    const ch = Number(stability.commissionChanges);
    const fee = Number.isFinite(ch)
      ? ch === 0
        ? "; commission stayed put"
        : `; commission changed ${ch} time${ch === 1 ? "" : "s"}`
      : "";
    const n = stability.sample;
    return `${who}: ${unhealthy}${fee} (${n} snapshot${n === 1 ? "" : "s"}).`;
  }

  /**
   * Newcomer-scannable history (finished voting epochs + snapshot meta).
   * Shared by mystake.html and Telegram so neither is “last epoch only”.
   */
  function summarizeRecentPicture(rows) {
    const delegated = (rows || []).filter(r => r.acc?.vote);
    const byVote = [];
    const seen = new Set();
    for (const row of delegated) {
      const vote = row.acc.vote;
      if (!vote || seen.has(vote)) continue;
      seen.add(vote);
      byVote.push(row);
    }
    if (!byVote.length) {
      return { lines: [], sparks: [], count: 0 };
    }

    const histories = byVote
      .map(r => r.overlay?.votingHistory)
      .filter(h => h && Number.isFinite(h.avg5) && h.count);
    const stabilities = byVote
      .map(r => r.health?.stability || r.overlay?.stability)
      .filter(s => s && s.sample);

    const lines = [];

    if (histories.length === 1) {
      const line = votingLineFromHistory(histories[0]);
      if (line) lines.push(line);
    } else if (histories.length > 1) {
      const avgs = histories.map(h => h.avg5).filter(Number.isFinite);
      const mins = histories.map(h => h.min).filter(Number.isFinite);
      const maxs = histories.map(h => h.max).filter(Number.isFinite);
      if (avgs.length) {
        const lo = Math.min(...avgs);
        const hi = Math.max(...avgs);
        const span = mins.length && maxs.length ? rangePct(Math.min(...mins), Math.max(...maxs)) : "";
        const avgBit =
          lo === hi ? fmtPct(lo) : `${fmtPct(lo).replace("%", "")}–${fmtPct(hi)}`;
        lines.push(
          `Recent voting across ${histories.length} validators over the last few epochs: about ${avgBit}${
            span ? ` (range ${span})` : ""
          }.`
        );
      }
    }

    if (stabilities.length === 1) {
      const line = stabilityLineFromHistory(stabilities[0], { pluralValidators: false });
      if (line) lines.push(line);
    } else if (stabilities.length > 1) {
      const sample = Math.max(...stabilities.map(s => Number(s.sample) || 0));
      const delinquent = Math.max(...stabilities.map(s => Number(s.delinquent) || 0));
      const changes = stabilities
        .map(s => Number(s.commissionChanges))
        .filter(Number.isFinite);
      const combined = {
        sample,
        delinquent,
        commissionChanges: changes.length ? Math.max(...changes) : undefined
      };
      const line = stabilityLineFromHistory(combined, { pluralValidators: true });
      if (line) lines.push(line);
    }

    const sparks = byVote
      .filter(r => (r.overlay?.votingHistory?.epochs || []).length)
      .slice(0, 3)
      .map(r => ({
        name: r.health?.name || shortKey(r.acc.vote),
        tone: r.health?.tone || "ok",
        epochs: r.overlay.votingHistory.epochs
      }));

    return { lines, sparks, count: byVote.length };
  }

  function howToReadLines() {
    return HOW_TO_READ.map(item => `${item.label} – ${item.text}`);
  }

  async function loadSolFiatRates(fetchJsonImpl) {
    const fetchJson = fetchJsonImpl;
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
        return {
          at: Date.now(),
          perSol,
          source: "CoinGecko",
          stale: false
        };
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
      return { at: Date.now(), perSol, source, stale };
    } catch {
      return null;
    }
  }

  return {
    DASHBOARD_API,
    MYSTAKE_PAGE,
    STAKE_PROGRAM,
    PUBKEY_RE,
    U64_MAX,
    LAMPORTS_PER_SOL,
    RATE_TTL_MS,
    OVERLAY_TTL_MS,
    PUBLIC_RPCS,
    FIATS,
    FIAT_CODES,
    STATIC_USD_FX,
    TONE_COPY,
    HOW_TO_READ,
    TELEGRAM_CTA,
    DEFAULT_TELEGRAM_BOT_USERNAME,
    TELEGRAM_BOT_URL,
    shortKey,
    fmtSol,
    fmtPct,
    fiatByCode,
    isFiatCode,
    normalizeFiat,
    localeDefaultFiat,
    isPubkey,
    looksLikeSeedPhrase,
    toneRank,
    worseTone,
    epochEarnedCredits,
    votingFromCredits,
    votingHistoryFromCredits,
    deactivationIsOpen,
    stakeLifecycle,
    ownerOf,
    parseStakeAccount,
    pickName,
    stabilityFromHistory,
    compactOverlay,
    scoreStake,
    lastSumFrom,
    situationHeadline,
    overallCommLine,
    scoreOverall,
    buildHealthView,
    solToFiat,
    fmtFiat,
    solWithFiat,
    moneyLine,
    mystakeUrl,
    telegramBotUsername,
    telegramBotUrl,
    summarizeRecentPicture,
    howToReadLines,
    loadSolFiatRates
  };
});
