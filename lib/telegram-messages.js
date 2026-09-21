/**
 * Short Telegram copy for Stake health. Mirrors mystake.html voice.
 */
const core = require("../compare/stake-health-core");

const { moneyLines, mystakeUrl, compareUrl, storyContextFromView, FIAT_CODES, HOW_TO_READ, TONE_COPY, toneBadge, fiatFreshnessCopy, worseTone } = core;

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
    "/wallet &lt;address&gt; – add a wallet (up to 5)",
    "/status – how much is staked, last epoch, last epochs' rewards, OK / Watch / Risk",
    "/currency – approximate local fiat (USD, EUR, UAH, GBP, PLN, CAD, BRL)",
    "Unlink – drop one wallet (asks first)",
    "Stop – drop all wallets (asks first)",
    "",
    "Buttons under this chat do the same: Status, Stake story, Your validator, Turn notes on / off, Currency, Wallet, Help, Unlink, Stop.",
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
    "<b>Wallet</b> – add a Solana public key (up to 5). Send another key to add it",
    "<b>Help</b> – this note",
    "<b>Unlink</b> – drop one wallet. Tap the wallet, then confirm",
    "<b>Stop</b> – drop all wallets and stop epoch notes. Asks first",
    "",
    "You control epoch notes with Turn notes on / off.",
    "",
    "/wallet &lt;address&gt;  – add (does not replace)",
    "/status",
    "/currency USD  (or EUR, UAH, GBP, PLN, CAD, BRL)",
    "/unlink  – pick a wallet to drop (asks first)",
    "/stop  – drop all (asks first)",
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

function linkedMessage(wallet, fiat, notifyOn = true, wallets = null) {
  const list = Array.isArray(wallets) && wallets.length ? wallets : [wallet];
  const extra =
    list.length > 1
      ? `Watching ${list.length} wallets. Send another public key to add one more (up to 5).`
      : "Send another public key to add a second wallet. Unlink drops one after you confirm.";
  return [
    `Saved <code>${esc(wallet)}</code>.`,
    extra,
    `Approx. fiat: ${esc(fiat)}. Epoch notes are ${notifyOn ? "on" : "off"}. Send /status for a checkup now.`,
    "You control epoch notes with Turn notes on / off.",
    "",
    DISCLAIMER
  ].join("\n");
}

function linkedFromPageMessage(wallet, fiat, notifyOn = true, wallets = null) {
  const list = Array.isArray(wallets) && wallets.length ? wallets : [wallet];
  const extra =
    list.length > 1
      ? `Watching ${list.length} wallets.`
      : "Send another public key if you want to watch a second wallet.";
  return [
    "Linked this wallet from Stake health.",
    `<code>${esc(wallet)}</code>`,
    extra,
    `Approx. fiat: ${esc(fiat)}. Epoch notes are ${notifyOn ? "on" : "off"}.`,
    "You control epoch notes with Turn notes on / off.",
    "",
    DISCLAIMER
  ].join("\n");
}

function alreadyWatchingMessage(wallet, wallets) {
  const n = (wallets || []).length || 1;
  return [
    `Already watching <code>${esc(wallet)}</code>.`,
    n > 1 ? `This chat has ${n} wallets.` : "Send another public key to add a second wallet.",
    "",
    DISCLAIMER
  ].join("\n");
}

function walletListMessage(wallets) {
  const list = wallets || [];
  if (!list.length) {
    return "No wallet linked yet. Send a Solana <b>public</b> key to add one. Never a seed.";
  }
  const lines = list.map((w, i) => `${i + 1}. <code>${esc(w)}</code>`);
  return [
    `Watching ${list.length} wallet${list.length === 1 ? "" : "s"}:`,
    "",
    ...lines,
    "",
    "Send another public key to add it (up to 5). Unlink drops one. Stop drops all. Both ask first."
  ].join("\n");
}

function walletFullMessage(wallets) {
  return [
    `Already watching ${wallets.length} wallets – that is the cap.`,
    "Unlink drops one. Stop drops all. Both ask first.",
    "",
    DISCLAIMER
  ].join("\n");
}

function shortWallet(wallet) {
  const key = String(wallet || "").trim();
  if (key.length <= 12) return key;
  return `${key.slice(0, 4)}…${key.slice(-4)}`;
}

function unlinkPickerMessage(wallets) {
  const list = wallets || [];
  const lines = list.map((w, i) => `${i + 1}. <code>${esc(w)}</code>`);
  return [
    "Tap a wallet to drop it. Nothing is dropped yet.",
    "",
    ...lines,
    "",
    "Drop all stops epoch notes too."
  ].join("\n");
}

function confirmDropOneMessage(wallet, remainingCount) {
  const last = Number(remainingCount) <= 1;
  return [
    "Drop this wallet?",
    `<code>${esc(wallet)}</code>`,
    "",
    last
      ? "This is the last one. Epoch notes stop until you link again."
      : "The other wallets stay. Epoch notes stay on.",
    "Nothing is dropped until you tap Drop it."
  ].join("\n");
}

function confirmDropAllMessage(wallets) {
  const n = (wallets || []).length || 0;
  return [
    n > 1
      ? `Drop all ${n} wallets on this chat and stop epoch notes?`
      : "Drop this wallet and stop epoch notes?",
    "",
    "Nothing is dropped until you tap Drop all."
  ].join("\n");
}

function keptWalletsMessage() {
  return "Kept. Nothing was dropped.";
}

function unlinkedOneMessage(wallet, remaining) {
  if (!remaining.length) {
    return "Dropped that wallet. None left. Send a public key to add one.";
  }
  return [
    `Dropped <code>${esc(wallet)}</code>.`,
    `Still watching ${remaining.length} wallet${remaining.length === 1 ? "" : "s"}.`
  ].join("\n");
}

function notifyToggled(on) {
  return on
    ? "Epoch notes are on. You will get a short checkup when a new Solana epoch starts. /status still works anytime."
    : "Epoch notes are off. You will not get epoch notes. /status still works anytime. Tap Turn notes on to get them again.";
}

function unlinkedMessage() {
  return "Wallets unlinked. You will not get epoch notes. Send /start if you want to link again.";
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

function walletPageLinks({ wallet, stake, vote, votes, prefer } = {}) {
  const lines = [`<code>${esc(wallet)}</code>`];
  const voteList = [
    ...(vote ? [vote] : []),
    ...((votes || []).map(item => (typeof item === "string" ? item : item?.vote)).filter(Boolean))
  ].filter((item, i, all) => all.indexOf(item) === i);

  if (prefer === "validator") {
    if (voteList.length) {
      for (const item of voteList) {
        lines.push(`<a href="${esc(compareUrl(item))}">Your validator</a>`);
      }
      return lines;
    }
    lines.push("No validator on file yet for this wallet.");
    lines.push(`<a href="${esc(mystakeUrl(wallet, stake, { story: true }))}">Stake story</a>`);
    return lines;
  }

  lines.push(...fullStoryLines({ wallet, stake, vote: voteList.length === 1 ? voteList[0] : null }));
  return lines;
}

function multiWalletPagesMessage(wallets, contexts = {}, { kind } = {}) {
  const intro =
    kind === "validator"
      ? "Your validator for each wallet:"
      : "Last epoch, then last epochs' rewards on Stake health.";
  const lines = [intro];
  for (const wallet of wallets || []) {
    const ctx = contexts[wallet] || {};
    lines.push("");
    lines.push(
      ...walletPageLinks({
        wallet,
        stake: ctx.stake,
        vote: ctx.vote,
        votes: ctx.votes,
        prefer: kind
      })
    );
  }
  lines.push("", DISCLAIMER);
  return lines.join("\n");
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

function formatWalletBlock(view, { fiat, wallet }) {
  const kicker = kickerLabel(view.overall.tone);
  const lines = moneyLines(view.overall.money, view.rates, fiat);
  const story = storyContextFromView(view, wallet);
  const healthLine = view.overall.tone === "ok" ? TONE_COPY.ok.body : view.overall.body;
  return [
    `<b>${esc(kicker)}</b> – ${esc(view.overall.headline)}`,
    `<code>${esc(wallet)}</code>`,
    lines.length ? lines.map(esc).join("\n") : "",
    healthLine ? esc(healthLine) : "",
    ...fullStoryLines({
      wallet: story.wallet,
      stake: story.stake,
      vote: story.vote
    })
  ]
    .filter(Boolean)
    .join("\n");
}

function formatMultiStatus(entries, { fiat, kind = "status" } = {}) {
  const ok = (entries || []).filter(e => e.view);
  const parts = [];
  if (kind === "digest") {
    const epoch = ok[0]?.view?.pack?.currentEpoch;
    parts.push(
      epoch != null
        ? `<b>Epoch ${esc(epoch)}</b> – Stake health note`
        : "<b>Stake health</b> – epoch note"
    );
    parts.push("");
  }
  parts.push(`<b>${(entries || []).length} wallets</b>`);
  for (const entry of entries || []) {
    parts.push("");
    if (entry.error) {
      parts.push(`Could not load <code>${esc(entry.wallet)}</code> just now.`);
      continue;
    }
    parts.push(formatWalletBlock(entry.view, { fiat, wallet: entry.wallet }));
  }
  parts.push("");
  parts.push(DISCLAIMER);
  return parts.join("\n");
}

function combinedTone(entries) {
  return (entries || []).reduce((tone, entry) => {
    const next = entry?.view?.overall?.tone;
    return next ? worseTone(tone, next) : tone;
  }, "ok");
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
  linkedFromPageMessage,
  alreadyWatchingMessage,
  walletListMessage,
  walletFullMessage,
  shortWallet,
  unlinkPickerMessage,
  confirmDropOneMessage,
  confirmDropAllMessage,
  keptWalletsMessage,
  unlinkedOneMessage,
  notifyToggled,
  unlinkedMessage,
  noWalletMessage,
  formatStatus,
  formatDigest,
  formatMultiStatus,
  combinedTone,
  fullStoryMessage,
  fullStoryLines,
  walletPageLinks,
  multiWalletPagesMessage,
  validatorMessage,
  lookupFailed,
  storeMissing,
  kickerLabel
};
