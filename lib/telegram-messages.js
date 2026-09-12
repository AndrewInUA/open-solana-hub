/**
 * Short Telegram copy for Stake health. Mirrors mystake.html voice.
 */
const core = require("../compare/stake-health-core");

const { moneyLines, mystakeUrl, compareUrl, storyContextFromView, FIAT_CODES, HOW_TO_READ, TONE_COPY, toneBadge, fiatFreshnessCopy } = core;

const DISCLAIMER = "Education only – not financial advice.";

function esc(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function kickerLabel(tone) {
  if (tone === "wait") return "No stake found";
  return toneBadge(tone) || "OK";
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
    "/status – how much is staked, last epoch, last epochs' rewards, OK / Watch / Risk",
    "/currency – approximate local fiat (USD, EUR, UAH, GBP, PLN, CAD, BRL)",
    "/stop – unlink and stop epoch notes",
    "",
    "Buttons under this chat do the same: Status, Stake story, Your validator, Turn notes on / off, Currency, Wallet, Help, Stop.",
    "",
    "You control epoch notes with Turn notes on / off.",
    "",
    `<a href="${esc(mystakeUrl(null, null, { story: true }))}">Stake story</a> – last epoch, then last epochs' rewards on Stake health.`,
    `<a href="${esc(compareUrl())}">Your validator</a> – this operator’s voting, stability, and fee history.`,
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
    "<b>Status</b> – how much is staked, last epoch, last epochs' rewards, OK / Watch / Risk",
    "<b>Stake story</b> – last epoch, then last epochs' rewards on Stake health",
    "<b>Your validator</b> – this operator’s voting, stability, and fee history",
    "<b>Turn notes on</b> / <b>Turn notes off</b> – tap to start or stop epoch notes. Notes default on after you link a wallet",
    "<b>Currency</b> – approximate local fiat (USD, EUR, UAH, GBP, PLN, CAD, BRL)",
    "<b>Wallet</b> – link a Solana public key",
    "<b>Help</b> – this note",
    "<b>Stop</b> – unlink and stop epoch notes",
    "",
    "You control epoch notes with Turn notes on / off.",
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

function linkedMessage(wallet, fiat, notifyOn = true) {
  return [
    `Saved <code>${esc(wallet)}</code>.`,
    `Approx. fiat: ${esc(fiat)}. Epoch notes are ${notifyOn ? "on" : "off"}. Send /status for a checkup now.`,
    "You control epoch notes with Turn notes on / off.",
    "",
    DISCLAIMER
  ].join("\n");
}

function notifyToggled(on) {
  return on
    ? "Epoch notes are on. You will get a short checkup when a new Solana epoch starts. /status still works anytime."
    : "Epoch notes are off. You will not get epoch notes. /status still works anytime. Tap Turn notes on to get them again.";
}

function unlinkedMessage() {
  return "Wallet unlinked. You will not get epoch notes. Send /start if you want to link again.";
}

function noWalletMessage() {
  return "No wallet linked yet. Send /wallet and your Solana public key (not a seed).";
}

function fullStoryLines({ wallet, stake, vote } = {}) {
  const lines = [
    `<a href="${esc(mystakeUrl(wallet, stake, { story: true }))}">Stake story</a>`
  ];
  if (vote) {
    lines.push(`<a href="${esc(compareUrl(vote))}">Your validator</a>`);
  }
  return lines;
}

function fullStoryMessage({ wallet, stake, vote } = {}) {
  if (!wallet) return noWalletMessage();
  const parts = [
    "Last epoch, then last epochs' rewards on Stake health.",
    "",
    ...fullStoryLines({ wallet, stake, vote }),
    "",
    DISCLAIMER
  ];
  return parts.join("\n");
}

function validatorMessage({ wallet, vote, votes } = {}) {
  if (!wallet) return noWalletMessage();
  if (vote) {
    return [
      "Your validator – this operator’s voting, stability, and fee history.",
      "",
      `<a href="${esc(compareUrl(vote))}">Your validator</a>`,
      "",
      DISCLAIMER
    ].join("\n");
  }
  const extra =
    Array.isArray(votes) && votes.length > 1
      ? "You have more than one validator. Open Stake health and use Your validator there."
      : "No vote account on file yet. Stake story still opens Stake health.";
  return [
    extra,
    "",
    `<a href="${esc(mystakeUrl(wallet, null, { story: true }))}">Stake story</a>`,
    "",
    DISCLAIMER
  ].join("\n");
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

  const story = storyContextFromView(view, wallet || pack?.wallet);
  parts.push("");
  parts.push(...fullStoryLines({
    wallet: story.wallet,
    stake: story.stake,
    vote: story.vote
  }));
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
    return "Open Stake story for last epoch, then last epochs' rewards.";
  }
  return overall.next || "";
}

function digestNext(overall, pack) {
  if (overall.tone === "risk") {
    return "Open Stake story for last epoch, then last epochs' rewards.";
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
  notifyToggled,
  unlinkedMessage,
  noWalletMessage,
  formatStatus,
  formatDigest,
  fullStoryMessage,
  fullStoryLines,
  validatorMessage,
  lookupFailed,
  storeMissing,
  kickerLabel
};
