/**
 * Short Telegram copy for Stake health. Mirrors mystake.html voice.
 */
const core = require("../compare/stake-health-core");

const { moneyLines, mystakeUrl, FIAT_CODES, HOW_TO_READ, TONE_COPY, fiatFreshnessCopy } = core;

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
    "/status – stake size, last-epoch and recent rewards, OK / Watch / Risk",
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
    "<b>Status</b> – stake size, last-epoch and recent rewards, OK / Watch / Risk",
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
    `Approximate local currency is <b>${esc(current)}</b>. ≈ amounts under SOL use CoinGecko (then FX).`,
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

function formatStatus(view, { fiat, wallet, kind = "status" } = {}) {
  const { overall, pack, rates } = view;
  const kicker = kickerLabel(overall.tone);
  const parts = [];

  if (kind === "digest") {
    const epoch = pack?.currentEpoch;
    parts.push(epoch != null ? `<b>Epoch ${esc(epoch)}</b> – Stake health note` : "<b>Stake health</b> – epoch note");
    parts.push("");
  }

  parts.push(`<b>${esc(kicker)}</b> – ${esc(overall.headline)}`);

  const lines = moneyLines(overall.money, rates, fiat);
  if (lines.length) {
    parts.push("");
    parts.push(lines.map(esc).join("\n"));
    const fresh = fiatFreshnessCopy(rates, fiat);
    if (fresh) parts.push(esc(fresh));
  }

  const healthLine =
    overall.tone === "ok" ? TONE_COPY.ok.body : overall.body;
  if (healthLine) {
    parts.push("");
    parts.push(esc(healthLine));
  }

  const next =
    kind === "digest"
      ? digestNext(overall, pack)
      : overall.tone === "ok"
        ? ""
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
