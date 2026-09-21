/**
 * Telegram update handler for Stake health.
 */
const core = require("../compare/stake-health-core");
const store = require("./telegram-store");
const lookup = require("./stake-lookup");
const msg = require("./telegram-messages");

const { isPubkey, isTelegramStartPayload, looksLikeSeedPhrase, normalizeFiat, isFiatCode, localeDefaultFiat } = core;

const API = "https://api.telegram.org";

function botToken() {
  return process.env.TELEGRAM_BOT_TOKEN || "";
}

async function telegram(method, payload) {
  const token = botToken();
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not set");
  const res = await fetch(`${API}/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const json = await res.json().catch(() => ({}));
  if (!json.ok) {
    const err = new Error(json.description || `Telegram ${method} failed`);
    err.status = json.error_code;
    throw err;
  }
  return json.result;
}

const COMMAND_ALIASES = {
  start: "start",
  help: "help",
  status: "status",
  wallet: "wallet",
  currency: "currency",
  fiat: "currency",
  stop: "stop",
  unlink: "unlink",
  notify: "notify"
};

const BOT_COMMANDS = [
  { command: "start", description: "What this bot does" },
  { command: "wallet", description: "Add a Solana public key" },
  { command: "status", description: "Checkup now" },
  { command: "currency", description: "Approximate local fiat" },
  { command: "unlink", description: "Drop one wallet (asks first)" },
  { command: "stop", description: "Drop all wallets (asks first)" },
  { command: "help", description: "Commands" }
];

const AWAIT_UNLINK_PICK = "unlink_pick";
const AWAIT_STOP = "stop_confirm";
const AWAIT_UNLINK_PREFIX = "unlink:";

function mainKeyboard(sub) {
  return {
    keyboard: [
      [{ text: "Status" }, { text: "Stake story" }],
      [{ text: "Your validator" }, { text: store.notifyLabel(sub) }],
      [{ text: "Currency" }, { text: "Wallet" }],
      [{ text: "Help" }, { text: "Unlink" }, { text: "Stop" }]
    ],
    resize_keyboard: true,
    is_persistent: true,
    input_field_placeholder: "Public key only – never a seed"
  };
}

function confirmDropOneKeyboard() {
  return {
    keyboard: [[{ text: "Keep it" }, { text: "Drop it" }]],
    resize_keyboard: true,
    one_time_keyboard: true
  };
}

function confirmDropAllKeyboard() {
  return {
    keyboard: [[{ text: "Keep them" }, { text: "Drop all" }]],
    resize_keyboard: true,
    one_time_keyboard: true
  };
}

function unlinkPickerKeyboard(wallets) {
  return {
    keyboard: [
      ...(wallets || []).map((wallet, i) => [
        { text: `${i + 1} · ${msg.shortWallet(wallet)}` }
      ]),
      [{ text: "Keep them" }, { text: "Drop all" }]
    ],
    resize_keyboard: true
  };
}

function isKeepReply(text) {
  return /^(keep( (it|them|all))?|no|cancel)$/i.test(String(text || "").trim());
}

function isDropOneReply(text) {
  return /^(drop it|yes|confirm)$/i.test(String(text || "").trim());
}

function isDropAllReply(text) {
  return /^(drop all)$/i.test(String(text || "").trim());
}

function unlinkTarget(awaiting) {
  const raw = String(awaiting || "");
  if (!raw.startsWith(AWAIT_UNLINK_PREFIX)) return null;
  const key = raw.slice(AWAIT_UNLINK_PREFIX.length).trim();
  return isPubkey(key) ? key : null;
}

function pickWalletFromText(text, wallets) {
  const list = wallets || [];
  const raw = String(text || "").trim();
  if (!raw || !list.length) return null;
  if (list.includes(raw)) return raw;
  const numbered = raw.match(/^(\d+)\b/);
  if (numbered) {
    const wallet = list[Number(numbered[1]) - 1];
    if (wallet) return wallet;
  }
  return list.find(wallet => raw === msg.shortWallet(wallet)) || null;
}

async function send(chatId, text, extra) {
  const rest = { ...(extra || {}) };
  const sub = rest.sub;
  delete rest.sub;
  const payload = {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    ...rest,
    reply_markup: rest.reply_markup || mainKeyboard(sub)
  };
  try {
    return await telegram("sendMessage", payload);
  } catch (err) {
    // Fail soft: blocked bots, chat gone, parse errors.
    console.error("telegram send failed", chatId, err.message);
    if (/can't parse entities/i.test(err.message || "")) {
      try {
        return await telegram("sendMessage", {
          chat_id: chatId,
          text: String(text).replace(/<[^>]+>/g, ""),
          disable_web_page_preview: true,
          reply_markup: payload.reply_markup
        });
      } catch (err2) {
        console.error("telegram plain send failed", chatId, err2.message);
      }
    }
    return null;
  }
}

function parseCommand(text) {
  const raw = String(text || "").trim();
  if (/^turn notes off$/i.test(raw)) {
    return { command: "notify", arg: "off" };
  }
  if (/^turn notes on$/i.test(raw)) {
    return { command: "notify", arg: "on" };
  }
  if (/^notify:\s*(on|off)$/i.test(raw) || /^notify$/i.test(raw)) {
    return { command: "notify", arg: "" };
  }
  if (
    /^stake story$/i.test(raw) ||
    /^full story$/i.test(raw) ||
    /^\/(?:stake|full)[_-]?story(?:@[\w]+)?$/i.test(raw)
  ) {
    return { command: "story", arg: "" };
  }
  if (/^your validator$/i.test(raw) || /^\/your[_-]?validator(?:@[\w]+)?$/i.test(raw)) {
    return { command: "validator", arg: "" };
  }
  const slash = raw.match(/^\/([a-zA-Z0-9_]+)(?:@[\w]+)?(?:\s+([\s\S]*))?$/);
  if (slash) {
    const command = slash[1].toLowerCase();
    return { command: COMMAND_ALIASES[command] || command, arg: String(slash[2] || "").trim() };
  }
  const labeled = raw.match(/^([A-Za-z]+)(?:\s+([\s\S]*))?$/);
  if (labeled) {
    const alias = COMMAND_ALIASES[labeled[1].toLowerCase()];
    if (alias) return { command: alias, arg: String(labeled[2] || "").trim() };
  }
  return { command: null, arg: raw };
}

function defaultFiatFromUser(from) {
  const lang = from?.language_code || "";
  return localeDefaultFiat(lang);
}

async function ensureSub(chatId, from) {
  const existing = await store.getSub(chatId);
  if (existing) return existing;
  const sub = store.emptySub(chatId);
  sub.fiat = defaultFiatFromUser(from);
  return sub;
}

async function saveWallet(chatId, from, wallet, { notesOn } = {}) {
  const sub = await ensureSub(chatId, from);
  const result = store.addWallet(sub, wallet);
  if (result.ok) {
    sub.awaiting = null;
    if (notesOn || sub.notifyEpoch == null) sub.notifyEpoch = true;
    sub.updatedAt = new Date().toISOString();
    if (!sub.createdAt) sub.createdAt = sub.updatedAt;
    await store.saveSub(sub);
  }
  return result;
}

function rememberStory(sub, view, wallet) {
  const ctx = core.storyContextFromView(view, wallet || sub?.wallet);
  sub.lastStake = ctx.stake || null;
  sub.lastVote = ctx.vote || null;
  sub.lastVoteCount = ctx.votes.length;
  return ctx;
}

function rememberStories(sub, entries) {
  const ok = (entries || []).filter(e => e.view);
  if (!ok.length) return;
  rememberStory(sub, ok[0].view, ok[0].wallet);
  sub.lastVoteCount = Math.max(
    ...ok.map(e => storyContextFromViewSafe(e.view, e.wallet).votes.length),
    ok.length > 1 ? 2 : 0
  );
}

function storyContextFromViewSafe(view, wallet) {
  try {
    return core.storyContextFromView(view, wallet);
  } catch {
    return { wallet, stake: null, vote: null, votes: [] };
  }
}

async function loadWalletViews(wallets) {
  const entries = [];
  for (const wallet of wallets) {
    try {
      entries.push({ wallet, view: await lookup.loadStakeHealth(wallet) });
    } catch (err) {
      entries.push({ wallet, error: err });
    }
  }
  return entries;
}

function statusText(entries, sub, kind = "status") {
  const fiat = sub.fiat || "USD";
  const ok = entries.filter(e => e.view);
  if (ok.length === 1 && entries.length === 1) {
    return msg.formatStatus(ok[0].view, { fiat, wallet: ok[0].wallet, kind });
  }
  return msg.formatMultiStatus(entries, { fiat, kind });
}

async function sendStatus(chatId, sub) {
  const wallets = store.linkedWallets(sub);
  if (!wallets.length) {
    await send(chatId, msg.noWalletMessage(), { sub });
    return;
  }
  const entries = await loadWalletViews(wallets);
  const ok = entries.filter(e => e.view);
  if (!ok.length) {
    await send(chatId, msg.lookupFailed(entries[0]?.error), { sub });
    return;
  }
  rememberStories(sub, entries);
  await send(chatId, statusText(entries, sub), { sub });
  sub.lastTone = msg.combinedTone(ok);
  sub.updatedAt = new Date().toISOString();
  await store.saveSub(sub).catch(() => null);
}

async function sendStory(chatId, sub) {
  const wallets = store.linkedWallets(sub);
  if (!wallets.length) {
    await send(chatId, msg.noWalletMessage(), { sub });
    return;
  }
  if (wallets.length === 1) {
    await send(
      chatId,
      msg.fullStoryMessage({
        wallet: wallets[0],
        stake: sub.lastStake,
        vote: sub.lastVote
      }),
      { sub }
    );
    return;
  }
  const lines = ["Last epoch, then last epochs' rewards on Stake health.", ""];
  for (const wallet of wallets) {
    lines.push(...msg.fullStoryLines({ wallet }));
  }
  lines.push("", msg.DISCLAIMER);
  await send(chatId, lines.join("\n"), { sub });
}

async function sendValidator(chatId, sub) {
  const wallets = store.linkedWallets(sub);
  if (!wallets.length) {
    await send(chatId, msg.noWalletMessage(), { sub });
    return;
  }
  if (wallets.length > 1) {
    const lines = [
      "You are watching more than one wallet. Open Stake health for each:",
      ""
    ];
    for (const wallet of wallets) {
      lines.push(...msg.fullStoryLines({ wallet }));
    }
    lines.push("", msg.DISCLAIMER);
    await send(chatId, lines.join("\n"), { sub });
    return;
  }
  const votes =
    Number(sub.lastVoteCount) > 1 ? new Array(Number(sub.lastVoteCount)).fill({}) : [];
  await send(
    chatId,
    msg.validatorMessage({
      wallet: wallets[0],
      vote: sub.lastVote,
      votes
    }),
    { sub }
  );
}

async function toggleNotify(chatId, sub, arg) {
  const want = String(arg || "").trim().toLowerCase();
  if (want === "on") sub.notifyEpoch = true;
  else if (want === "off") sub.notifyEpoch = false;
  else sub.notifyEpoch = !store.isNotifyEnabled(sub);
  sub.updatedAt = new Date().toISOString();
  if (!sub.createdAt) sub.createdAt = sub.updatedAt;
  await store.saveSub(sub);
  await send(chatId, msg.notifyToggled(store.isNotifyEnabled(sub)), { sub });
}

async function handleText(chat, from, text) {
  const chatId = chat.id;
  if (looksLikeSeedPhrase(text)) {
    await send(chatId, msg.seedWarning());
    return;
  }

  if (!store.kvConfigured()) {
    const { command } = parseCommand(text);
    if (command === "start" || command === "help") {
      await send(chatId, msg.startMessage() + "\n\n" + msg.storeMissing());
      return;
    }
    await send(chatId, msg.storeMissing());
    return;
  }

  const { command, arg } = parseCommand(text);
  let sub = await ensureSub(chatId, from);
  const reply = t => send(chatId, t, { sub });

  if (command === "start") {
    const fromPage = isTelegramStartPayload(arg);
    if (fromPage) {
      const result = await saveWallet(chatId, from, String(arg).trim(), { notesOn: true });
      sub = result.sub;
      if (result.reason === "full") {
        await send(chatId, msg.walletFullMessage(result.wallets), { sub });
        return;
      }
      if (result.reason === "duplicate") {
        await send(
          chatId,
          msg.alreadyWatchingMessage(String(arg).trim(), store.linkedWallets(sub)),
          { sub }
        );
        await sendStatus(chatId, sub);
        return;
      }
      await send(
        chatId,
        msg.linkedFromPageMessage(
          String(arg).trim(),
          sub.fiat,
          store.isNotifyEnabled(sub),
          store.linkedWallets(sub)
        ),
        { sub }
      );
      await sendStatus(chatId, sub);
      return;
    }
    sub.awaiting = "wallet";
    if (sub.notifyEpoch == null) sub.notifyEpoch = true;
    await store.saveSub(sub);
    await reply(msg.startMessage());
    const existing = store.linkedWallets(sub);
    await reply(
      existing.length
        ? msg.walletListMessage(existing)
        : "Send your Solana wallet public key to link it."
    );
    return;
  }

  if (command === "help") {
    await reply(msg.helpMessage());
    return;
  }

  if (command === "notify") {
    await toggleNotify(chatId, sub, arg);
    return;
  }

  async function askConfirmOne(wallet) {
    sub.awaiting = `${AWAIT_UNLINK_PREFIX}${wallet}`;
    sub.updatedAt = new Date().toISOString();
    await store.saveSub(sub);
    await send(chatId, msg.confirmDropOneMessage(wallet, store.linkedWallets(sub).length), {
      sub,
      reply_markup: confirmDropOneKeyboard()
    });
  }

  async function askConfirmAll() {
    const list = store.linkedWallets(sub);
    if (!list.length) {
      await send(chatId, msg.noWalletMessage(), { sub });
      return;
    }
    sub.awaiting = AWAIT_STOP;
    sub.updatedAt = new Date().toISOString();
    await store.saveSub(sub);
    await send(chatId, msg.confirmDropAllMessage(list), {
      sub,
      reply_markup: confirmDropAllKeyboard()
    });
  }

  async function beginUnlink(wanted) {
    const list = store.linkedWallets(sub);
    if (!list.length) {
      await send(chatId, msg.noWalletMessage(), { sub });
      return;
    }
    if (wanted) {
      if (!isPubkey(wanted)) {
        sub.awaiting = AWAIT_UNLINK_PICK;
        sub.updatedAt = new Date().toISOString();
        await store.saveSub(sub);
        await send(chatId, msg.unlinkPickerMessage(list), {
          sub,
          reply_markup: unlinkPickerKeyboard(list)
        });
        return;
      }
      if (!list.includes(wanted)) {
        await reply("That wallet is not on this chat.");
        return;
      }
      await askConfirmOne(wanted);
      return;
    }
    if (list.length === 1) {
      await askConfirmOne(list[0]);
      return;
    }
    sub.awaiting = AWAIT_UNLINK_PICK;
    sub.updatedAt = new Date().toISOString();
    await store.saveSub(sub);
    await send(chatId, msg.unlinkPickerMessage(list), {
      sub,
      reply_markup: unlinkPickerKeyboard(list)
    });
  }

  async function dropOne(wallet) {
    store.removeWallet(sub, wallet);
    sub.awaiting = null;
    sub.updatedAt = new Date().toISOString();
    await store.saveSub(sub);
    await send(chatId, msg.unlinkedOneMessage(wallet, store.linkedWallets(sub)), { sub });
  }

  async function keepWallets() {
    sub.awaiting = null;
    sub.updatedAt = new Date().toISOString();
    await store.saveSub(sub);
    await send(chatId, msg.keptWalletsMessage(), { sub });
  }

  const pendingOne = unlinkTarget(sub.awaiting);
  if (sub.awaiting === AWAIT_STOP) {
    if (isDropAllReply(text)) {
      await store.deleteSub(chatId);
      await send(chatId, msg.unlinkedMessage(), { sub: store.emptySub(chatId) });
      return;
    }
    if (isKeepReply(text)) {
      await keepWallets();
      return;
    }
    if (command == null) {
      await send(chatId, msg.confirmDropAllMessage(store.linkedWallets(sub)), {
        sub,
        reply_markup: confirmDropAllKeyboard()
      });
      return;
    }
    sub.awaiting = null;
    await store.saveSub(sub);
  } else if (sub.awaiting === AWAIT_UNLINK_PICK) {
    if (isKeepReply(text)) {
      await keepWallets();
      return;
    }
    if (isDropAllReply(text)) {
      await askConfirmAll();
      return;
    }
    const picked = pickWalletFromText(text, store.linkedWallets(sub));
    if (picked) {
      await askConfirmOne(picked);
      return;
    }
    if (command == null) {
      await send(chatId, msg.unlinkPickerMessage(store.linkedWallets(sub)), {
        sub,
        reply_markup: unlinkPickerKeyboard(store.linkedWallets(sub))
      });
      return;
    }
    sub.awaiting = null;
    await store.saveSub(sub);
  } else if (pendingOne) {
    if (isDropOneReply(text)) {
      await dropOne(pendingOne);
      return;
    }
    if (isKeepReply(text)) {
      await keepWallets();
      return;
    }
    if (isDropAllReply(text)) {
      await askConfirmAll();
      return;
    }
    if (command == null) {
      await send(
        chatId,
        msg.confirmDropOneMessage(pendingOne, store.linkedWallets(sub).length),
        { sub, reply_markup: confirmDropOneKeyboard() }
      );
      return;
    }
    sub.awaiting = null;
    await store.saveSub(sub);
  }

  if (command === "stop") {
    await askConfirmAll();
    return;
  }

  if (command === "unlink") {
    await beginUnlink(arg);
    return;
  }

  if (command === "currency" || command === "fiat") {
    if (!arg) {
      sub.awaiting = "fiat";
      await store.saveSub(sub);
      await reply(msg.fiatPicker(sub.fiat));
      return;
    }
    if (!isFiatCode(arg)) {
      await reply(msg.fiatPicker(sub.fiat));
      return;
    }
    sub.fiat = normalizeFiat(arg);
    sub.awaiting = null;
    await store.saveSub(sub);
    await reply(`Approx. fiat set to <b>${sub.fiat}</b>. Amounts show as ≈ ${sub.fiat} under SOL.`);
    return;
  }

  if (command === "wallet") {
    if (!arg) {
      sub.awaiting = "wallet";
      await store.saveSub(sub);
      await reply(msg.walletListMessage(store.linkedWallets(sub)));
      return;
    }
    if (!isPubkey(arg)) {
      await reply("That does not look like a Solana address. Paste the public key only.");
      return;
    }
    const result = await saveWallet(chatId, from, arg);
    sub = result.sub;
    if (result.reason === "full") {
      await send(chatId, msg.walletFullMessage(result.wallets), { sub });
      return;
    }
    if (result.reason === "duplicate") {
      await send(chatId, msg.alreadyWatchingMessage(arg, result.wallets), { sub });
      return;
    }
    await send(
      chatId,
      msg.linkedMessage(arg, sub.fiat, store.isNotifyEnabled(sub), store.linkedWallets(sub)),
      { sub }
    );
    return;
  }

  if (command === "status") {
    await sendStatus(chatId, sub);
    return;
  }

  if (command === "story") {
    await sendStory(chatId, sub);
    return;
  }

  if (command === "validator") {
    await sendValidator(chatId, sub);
    return;
  }

  if (sub.awaiting === "fiat") {
    if (isFiatCode(text)) {
      sub.fiat = normalizeFiat(text);
      sub.awaiting = null;
      await store.saveSub(sub);
      await reply(`Approx. fiat set to <b>${sub.fiat}</b>.`);
      return;
    }
    await reply(msg.fiatPicker(sub.fiat));
    return;
  }

  if (isPubkey(text)) {
    const result = await saveWallet(chatId, from, text);
    sub = result.sub;
    if (result.reason === "full") {
      await send(chatId, msg.walletFullMessage(result.wallets), { sub });
      return;
    }
    if (result.reason === "duplicate") {
      await send(chatId, msg.alreadyWatchingMessage(text, result.wallets), { sub });
      return;
    }
    await send(
      chatId,
      msg.linkedMessage(text, sub.fiat, store.isNotifyEnabled(sub), store.linkedWallets(sub)),
      { sub }
    );
    return;
  }

  if (sub.awaiting === "wallet") {
    await reply("That does not look like a Solana public key. Example: a 32–44 character address. Never a seed.");
    return;
  }

  await reply(msg.helpMessage());
}

let commandsSynced = false;

async function ensureCommands() {
  if (commandsSynced) return;
  try {
    await setMyCommands();
    commandsSynced = true;
  } catch (err) {
    console.error("setMyCommands failed", err.message);
  }
}

async function handleUpdate(update) {
  const message = update?.message || update?.edited_message;
  if (!message?.chat?.id) return { ignored: true };
  if (message.chat.type !== "private") {
    return { ignored: true, reason: "private chats only" };
  }
  const text = String(message.text || message.caption || "").trim();
  if (!text) return { ignored: true };
  await ensureCommands();
  await handleText(message.chat, message.from, text);
  return { ok: true };
}

async function setWebhook(url, secret) {
  const payload = {
    url,
    secret_token: secret || undefined,
    allowed_updates: ["message"],
    drop_pending_updates: false
  };
  return telegram("setWebhook", payload);
}

async function getWebhookInfo() {
  return telegram("getWebhookInfo", {});
}

async function setMyCommands() {
  return telegram("setMyCommands", { commands: BOT_COMMANDS });
}

module.exports = {
  handleUpdate,
  send,
  telegram,
  setWebhook,
  getWebhookInfo,
  setMyCommands,
  sendStatus,
  sendStory,
  sendValidator,
  rememberStory,
  rememberStories,
  botToken,
  parseCommand,
  mainKeyboard,
  BOT_COMMANDS,
  COMMAND_ALIASES,
  pickWalletFromText,
  isKeepReply,
  isDropOneReply,
  isDropAllReply,
  unlinkTarget
};
