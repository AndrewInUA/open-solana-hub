/**
 * Short Telegram copy for Stake health. Mirrors mystake.html voice.
 */
const core = require("../compare/stake-health-core");

const { shortKey, moneyLine, mystakeUrl, FIAT_CODES, fmtPct, HOW_TO_READ, summarizeRecentPicture } = core;

const DISCLAIMER = "Education only – not financial advice.";

function esc(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function kickerLabel(tone) {
  if (tone === "risk") return "Risk";
  if (tone === "watch") return "Watch";
  if (tone === "wait") return "No stake found";
  return "OK";
}

function howToRead() {
  return HOW_TO_READ.map(item => `<b>${esc(item.label)}</b> – ${esc(item.text)}`).join("\n");
}

function startMessage() {
  return [
    "<b>Stake health</b> – for people who already staked SOL.",
    "",
    "Link a <b>wallet public key</b> only. Never send a seed phrase or private key. We only read public chain data. We never move SOL.",
    "",
    "Commands:",
    "/wallet &lt;address&gt; – save your wallet",
    "/status – checkup now (OK / Watch / Risk + ≈ fiat)",
    "/currency – approximate local fiat (USD, EUR, UAH, GBP, PLN, CAD, BRL)",
    "/stop – unlink and stop epoch notes",
    "",
    "Buttons under this chat do the same: Status, Currency, Wallet, Help, Stop.",
    "",
    "After a wallet is linked you get a short note when a new Solana epoch starts.",
    "",
    `Full page: ${mystakeUrl()}`,
    "",
    howToRead(),
    "",
    DISCLAIMER
  ].join("\n");
}

function helpMessage() {
  return [
    "Use the buttons under the chat, or the same slash commands.",
    "",
    "<b>Status</b> – checkup now (OK / Watch / Risk + ≈ fiat)",
    "<b>Currency</b> – approximate local fiat (USD, EUR, UAH, GBP, PLN, CAD, BRL)",
    "<b>Wallet</b> – link a Solana public key",
    "<b>Help</b> – this note",
    "<b>Stop</b> – unlink and stop epoch notes",
    "",
    "/wallet &lt;address&gt;",
    "/status",
    "/currency USD  (or EUR, UAH, GBP, PLN, CAD, BRL)",
    "/unlink  – same as Stop",
    "",
    "Native stake only. Liquid-staking tokens (JitoSOL, mSOL, …) do not appear here.",
    "",
    DISCLAIMER
  ].join("\n");
}

function seedWarning() {
  return [
    "Stop – that looks like a seed phrase.",
    "",
    "Never send a seed or private key to this bot, a website, or a stranger. We only need the <b>public</b> wallet address (32–44 characters).",
    "",
    "If you pasted a seed anywhere, treat that wallet as burned and move funds from a new wallet you created offline."
  ].join("\n");
}

function fiatPicker(current) {
  return [
    `Approximate fiat is <b>${esc(current)}</b> (same spirit as the site’s CoinGecko converter).`,
    "",
    `Send /currency ${FIAT_CODES.join(" | ")}`,
    "Example: /currency EUR"
  ].join("\n");
}

function linkedMessage(wallet, fiat) {
  return [
    `Saved <code>${esc(wallet)}</code>.`,
    `Approx. fiat: ${esc(fiat)}. Epoch notes are on. Send /status for a checkup now.`,
    "",
    DISCLAIMER
  ].join("\n");
}

function unlinkedMessage() {
  return "Wallet unlinked. You will not get epoch notes. Send /start if you want to link again.";
}

function noWalletMessage() {
  return "No wallet linked yet. Send /wallet and your Solana public key (not a seed).";
}

function stakeLines(rows, rates, fiat, { max = 4 } = {}) {
  const delegated = rows.filter(r => r.acc.vote);
  const idle = rows.filter(r => !r.acc.vote);
  const lines = [];
  for (const row of delegated.slice(0, max)) {
    const name = row.health.name || shortKey(row.acc.vote);
    const amt = moneyLine(row.acc.delegatedSol, rates, fiat);
    const last = row.acc.rewards?.[0]
      ? moneyLine(row.acc.rewards[0].amountSol, rates, fiat, { signed: true })
      : null;
    const bits = [`${esc(name)} · ${row.health.label}`, esc(amt)];
    if (last) bits.push(`last ${esc(last)}`);
    if (Number.isFinite(row.health.commission)) bits.push(`fee ${row.health.commission}%`);
    if (Number.isFinite(row.health.voting)) bits.push(`vote ${fmtPct(row.health.voting)}`);
    lines.push(bits.join(" · "));
  }
  if (delegated.length > max) {
    lines.push(`…and ${delegated.length - max} more on the full page.`);
  }
  if (idle.length) {
    lines.push(
      idle.length === 1
        ? "One leftover stake account is not delegated (not earning)."
        : `${idle.length} leftover stake accounts are not delegated (not earning).`
    );
  }
  return lines;
}

function formatStatus(view, { fiat, wallet, kind = "status" } = {}) {
  const { overall, rows, pack, rates } = view;
  const kicker = kickerLabel(overall.tone);
  const parts = [];

  if (kind === "digest") {
    const epoch = pack?.currentEpoch;
    parts.push(epoch != null ? `<b>Epoch ${esc(epoch)}</b> – Stake health note` : "<b>Stake health</b> – epoch note");
    parts.push("");
  }

  parts.push(`<b>${esc(kicker)}</b> – ${esc(overall.headline)}`);
  parts.push("");
  parts.push(esc(overall.body));

  const money = [];
  if (Number.isFinite(Number(overall.totalActiveSol)) && overall.totalActiveSol > 0) {
    money.push(`Active: ${esc(moneyLine(overall.totalActiveSol, rates, fiat))}`);
  }
  if (overall.lastEpochSol != null && Number.isFinite(Number(overall.lastEpochSol))) {
    money.push(`Last epoch: ${esc(moneyLine(overall.lastEpochSol, rates, fiat, { signed: true }))}`);
  }
  if (money.length) {
    parts.push("");
    parts.push(money.join("\n"));
  }

  const history = summarizeRecentPicture(rows);
  if (history.lines.length) {
    parts.push("");
    parts.push(history.lines.slice(0, 2).map(esc).join("\n"));
  }

  const stakes = stakeLines(rows, rates, fiat);
  if (stakes.length && !(rows.filter(r => r.acc.vote).length === 1 && !rows.some(r => !r.acc.vote))) {
    parts.push("");
    parts.push(stakes.join("\n"));
  } else if (stakes.length === 1 && rows.filter(r => r.acc.vote).length === 1) {
    parts.push("");
    parts.push(stakes[0]);
  }

  const next =
    kind === "digest"
      ? digestNext(overall, pack)
      : telegramNext(overall, pack);
  if (next) {
    parts.push("");
    parts.push(esc(next));
  }

  if (pack?.truncated) {
    parts.push("");
    parts.push(`Showing ${pack.shown} of ${pack.accountCount} stake accounts.`);
  }

  const page = mystakeUrl(wallet || pack?.wallet);
  parts.push("");
  parts.push(`Full picture: ${page}`);
  parts.push("");
  parts.push(DISCLAIMER);
  return parts.join("\n");
}

function telegramNext(overall, pack) {
  if (overall.tone === "ok" && pack?.currentEpoch != null) {
    return `Epoch ${pack.currentEpoch} is in progress. Check again after it ends if you want.`;
  }
  if (overall.tone === "ok") {
    return "Check again after the next epoch if you want.";
  }
  if (overall.tone === "watch") {
    return "Skim the notes. Come back after the next epoch if you like a routine.";
  }
  if (overall.tone === "risk") {
    return "Open the full page for the picture. This is a checkup, not an instruction to unstake.";
  }
  return overall.next || "";
}

function digestNext(overall, pack) {
  if (overall.tone === "risk") {
    return "Open the full page if you want the signals. We do not move SOL.";
  }
  if (overall.tone === "watch") {
    return "Not an alarm. Recheck after this epoch if you like a routine.";
  }
  if (pack?.currentEpoch != null) {
    return `Epoch ${pack.currentEpoch} just needs no action from these signals.`;
  }
  return "No action needed from these signals.";
}

function formatDigest(view, { fiat, wallet, previousTone }) {
  const extra = [];
  if (previousTone && previousTone !== view.overall.tone) {
    extra.push(
      `Tone changed: ${kickerLabel(previousTone)} → ${kickerLabel(view.overall.tone)}.`
    );
  }
  const body = formatStatus(view, { fiat, wallet, kind: "digest" });
  if (!extra.length) return body;
  return body.replace(
    "\n\nEducation only",
    `\n\n${esc(extra.join(" "))}\n\nEducation only`
  );
}

function lookupFailed(err) {
  const msg = String(err?.message || "Lookup failed");
  return [
    "Could not load stake data just now. The dashboard or RPC may be busy – try /status again in a minute.",
    "",
    `<i>${esc(msg)}</i>`,
    "",
    DISCLAIMER
  ].join("\n");
}

function storeMissing() {
  return "This bot is running without subscription storage (Vercel KV). Commands that save a wallet are paused until KV_REST_API_URL and KV_REST_API_TOKEN are set.";
}

module.exports = {
  DISCLAIMER,
  startMessage,
  helpMessage,
  seedWarning,
  fiatPicker,
  linkedMessage,
  unlinkedMessage,
  noWalletMessage,
  formatStatus,
  formatDigest,
  lookupFailed,
  storeMissing,
  kickerLabel
};
