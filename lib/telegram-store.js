/**
 * Durable chat_id ↔ wallet store.
 *
 * Uses Vercel KV / Upstash Redis REST (KV_REST_API_URL + KV_REST_API_TOKEN).
 * Same env names Vercel KV injects automatically.
 */
const PREFIX = "osh:tg:";

function kvConfigured() {
  return Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

async function redis(command) {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) {
    const err = new Error(
      "Subscription storage is not configured. Set KV_REST_API_URL and KV_REST_API_TOKEN (Vercel KV / Upstash)."
    );
    err.code = "KV_MISSING";
    throw err;
  }
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(command)
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.error) {
    throw new Error(json.error || `KV HTTP ${res.status}`);
  }
  return json.result;
}

function subKey(chatId) {
  return `${PREFIX}sub:${chatId}`;
}

function parseJson(raw) {
  if (!raw) return null;
  if (typeof raw === "object") return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function getSub(chatId) {
  const raw = await redis(["GET", subKey(chatId)]);
  return parseJson(raw);
}

async function saveSub(sub) {
  const chatId = String(sub.chatId);
  await redis(["SADD", `${PREFIX}chats`, chatId]);
  await redis(["SET", subKey(chatId), JSON.stringify(sub)]);
  return sub;
}

async function deleteSub(chatId) {
  const id = String(chatId);
  await redis(["DEL", subKey(id)]);
  await redis(["SREM", `${PREFIX}chats`, id]);
}

async function listChatIds() {
  const ids = await redis(["SMEMBERS", `${PREFIX}chats`]);
  return Array.isArray(ids) ? ids.map(String) : [];
}

async function listSubs() {
  const ids = await listChatIds();
  const out = [];
  for (const id of ids) {
    const sub = await getSub(id);
    if (sub) out.push(sub);
  }
  return out;
}

async function getEpochState() {
  const raw = await redis(["GET", `${PREFIX}epoch`]);
  return parseJson(raw) || { lastSeenEpoch: null, lastCompletedEpoch: null };
}

async function setEpochState(state) {
  await redis(["SET", `${PREFIX}epoch`, JSON.stringify(state)]);
  return state;
}

const MAX_WALLETS = 5;
const WALLET_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

function isWalletKey(value) {
  return WALLET_RE.test(String(value || "").trim());
}

/** One or more public keys on this chat. Old records only have `wallet`. */
function linkedWallets(sub) {
  const raw = [
    ...(Array.isArray(sub?.wallets) ? sub.wallets : []),
    sub?.wallet
  ];
  const out = [];
  for (const item of raw) {
    const key = String(item || "").trim();
    if (!isWalletKey(key) || out.includes(key)) continue;
    out.push(key);
  }
  return out;
}

function applyWallets(sub, wallets) {
  const list = linkedWallets({ wallets, wallet: null });
  sub.wallets = list;
  sub.wallet = list[0] || null;
  return sub;
}

function addWallet(sub, wallet) {
  const key = String(wallet || "").trim();
  if (!isWalletKey(key)) return { ok: false, reason: "bad", sub };
  const list = linkedWallets(sub);
  if (list.includes(key)) return { ok: false, reason: "duplicate", sub, wallets: list };
  if (list.length >= MAX_WALLETS) return { ok: false, reason: "full", sub, wallets: list };
  list.push(key);
  applyWallets(sub, list);
  return { ok: true, reason: "added", sub, wallets: list };
}

function removeWallet(sub, wallet) {
  const key = String(wallet || "").trim();
  const list = linkedWallets(sub).filter(item => item !== key);
  applyWallets(sub, list);
  return { ok: true, sub, wallets: list };
}

function emptySub(chatId) {
  return {
    chatId: String(chatId),
    wallet: null,
    wallets: [],
    fiat: "USD",
    awaiting: null,
    createdAt: new Date().toISOString(),
    lastTone: null,
    lastEpochNotified: null,
    lastDigestAt: null,
    notifyEpoch: true,
    lastStake: null,
    lastVote: null,
    lastVoteCount: 0
  };
}

/** Epoch notes default on (legacy chats without the field stay subscribed). */
function isNotifyEnabled(sub) {
  return !sub || sub.notifyEpoch !== false;
}

function notifyLabel(sub) {
  return isNotifyEnabled(sub) ? "Turn notes off" : "Turn notes on";
}

async function getOrCreateSub(chatId) {
  return (await getSub(chatId)) || emptySub(chatId);
}

module.exports = {
  kvConfigured,
  getSub,
  saveSub,
  deleteSub,
  listSubs,
  listChatIds,
  getEpochState,
  setEpochState,
  getOrCreateSub,
  emptySub,
  isNotifyEnabled,
  notifyLabel,
  MAX_WALLETS,
  linkedWallets,
  applyWallets,
  addWallet,
  removeWallet
};
