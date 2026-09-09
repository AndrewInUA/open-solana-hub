/**
 * Telegram update handler for Stake health.
 */
const core = require("../compare/stake-health-core");
const store = require("./telegram-store");
const lookup = require("./stake-lookup");
const msg = require("./telegram-messages");

const { isPubkey, looksLikeSeedPhrase, normalizeFiat, isFiatCode, localeDefaultFiat } = core;

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
  unlink: "stop"
};

const BOT_COMMANDS = [
  { command: "start", description: "What this bot does" },
  { command: "wallet", description: "Link a Solana public key" },
  { command: "status", description: "Checkup now" },
  { command: "currency", description: "Approximate local fiat" },
  { command: "stop", description: "Unlink and stop epoch notes" },
  { command: "help", description: "Commands" }
];

function mainKeyboard() {
  return {
    keyboard: [
      [{ text: "Status" }, { text: "Currency" }],
      [{ text: "Wallet" }, { text: "Help" }],
      [{ text: "Stop" }]
    ],
    resize_keyboard: true,
    is_persistent: true,
    input_field_placeholder: "Public key only – never a seed"
  };
}

async function send(chatId, text, extra) {
  const payload = {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    reply_markup: mainKeyboard(),
    ...(extra || {})
  };
  if (!payload.reply_markup) payload.reply_markup = mainKeyboard();
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

async function saveWallet(chatId, from, wallet) {
  const sub = await ensureSub(chatId, from);
  sub.wallet = wallet;
  sub.awaiting = null;
  sub.updatedAt = new Date().toISOString();
  if (!sub.createdAt) sub.createdAt = sub.updatedAt;
  await store.saveSub(sub);
  return sub;
}

async function sendStatus(chatId, sub) {
  if (!sub?.wallet) {
    await send(chatId, msg.noWalletMessage());
    return;
  }
  try {
    const view = await lookup.loadStakeHealth(sub.wallet);
    await send(chatId, msg.formatStatus(view, { fiat: sub.fiat, wallet: sub.wallet }));
    sub.lastTone = view.overall?.tone || sub.lastTone;
    sub.updatedAt = new Date().toISOString();
    await store.saveSub(sub).catch(() => null);
  } catch (err) {
    await send(chatId, msg.lookupFailed(err));
  }
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

  if (command === "start") {
    sub.awaiting = "wallet";
    await store.saveSub(sub);
    await send(chatId, msg.startMessage());
    await send(chatId, "Send your Solana wallet public key to link it.");
    return;
  }

  if (command === "help") {
    await send(chatId, msg.helpMessage());
    return;
  }

  if (command === "stop" || command === "unlink") {
    await store.deleteSub(chatId);
    await send(chatId, msg.unlinkedMessage());
    return;
  }

  if (command === "currency" || command === "fiat") {
    if (!arg) {
      sub.awaiting = "fiat";
      await store.saveSub(sub);
      await send(chatId, msg.fiatPicker(sub.fiat));
      return;
    }
    if (!isFiatCode(arg)) {
      await send(chatId, msg.fiatPicker(sub.fiat));
      return;
    }
    sub.fiat = normalizeFiat(arg);
    sub.awaiting = null;
    await store.saveSub(sub);
    await send(chatId, `Approx. fiat set to <b>${sub.fiat}</b>. Amounts show as ≈ ${sub.fiat} under SOL.`);
    return;
  }

  if (command === "wallet") {
    if (!arg) {
      sub.awaiting = "wallet";
      await store.saveSub(sub);
      await send(chatId, "Send the Solana <b>public</b> wallet address. Never a seed or private key.");
      return;
    }
    if (!isPubkey(arg)) {
      await send(chatId, "That does not look like a Solana address. Paste the public key only.");
      return;
    }
    sub = await saveWallet(chatId, from, arg);
    await send(chatId, msg.linkedMessage(sub.wallet, sub.fiat));
    return;
  }

  if (command === "status") {
    await sendStatus(chatId, sub);
    return;
  }

  if (sub.awaiting === "fiat") {
    if (isFiatCode(text)) {
      sub.fiat = normalizeFiat(text);
      sub.awaiting = null;
      await store.saveSub(sub);
      await send(chatId, `Approx. fiat set to <b>${sub.fiat}</b>.`);
      return;
    }
    await send(chatId, msg.fiatPicker(sub.fiat));
    return;
  }

  if (isPubkey(text)) {
    sub = await saveWallet(chatId, from, text);
    await send(chatId, msg.linkedMessage(sub.wallet, sub.fiat));
    return;
  }

  if (sub.awaiting === "wallet") {
    await send(chatId, "That does not look like a Solana public key. Example: a 32–44 character address. Never a seed.");
    return;
  }

  await send(chatId, msg.helpMessage());
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
  botToken,
  parseCommand,
  mainKeyboard,
  BOT_COMMANDS,
  COMMAND_ALIASES
};
