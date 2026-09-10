/**
 * Epoch digest: when a new Solana epoch is detected, send a short
 * Stake health note to every linked chat.
 */
const store = require("./telegram-store");
const lookup = require("./stake-lookup");
const bot = require("./telegram-bot");
const msg = require("./telegram-messages");

function epochDigestTargets(subs, epoch, { force = false } = {}) {
  return (subs || []).filter(sub => {
    if (!sub?.wallet) return false;
    if (!store.isNotifyEnabled(sub)) return false;
    if (!force && Number(sub.lastEpochNotified) === epoch) return false;
    return true;
  });
}

async function runEpochDigest({ force = false } = {}) {
  if (!store.kvConfigured()) {
    return { ok: false, error: "KV not configured" };
  }
  if (!bot.botToken()) {
    return { ok: false, error: "TELEGRAM_BOT_TOKEN not set" };
  }

  let epoch;
  try {
    epoch = await lookup.fetchEpoch();
  } catch (err) {
    return { ok: false, error: `epoch lookup failed: ${err.message}` };
  }
  if (!Number.isFinite(epoch)) {
    return { ok: false, error: "epoch missing" };
  }

  const state = await store.getEpochState();
  if (!force && state.lastSeenEpoch == null) {
    await store.setEpochState({
      lastSeenEpoch: epoch,
      lastCompletedEpoch: epoch,
      initializedAt: new Date().toISOString()
    });
    return {
      ok: true,
      skipped: true,
      reason: "initialized current epoch without sending (avoid surprise spam)",
      epoch
    };
  }

  const newEpoch = force || (state.lastCompletedEpoch != null && epoch > Number(state.lastCompletedEpoch));
  if (!newEpoch && state.lastCompletedEpoch === epoch) {
    return { ok: true, skipped: true, reason: "same epoch", epoch };
  }

  await store.setEpochState({
    ...state,
    lastSeenEpoch: epoch,
    digestStartedAt: new Date().toISOString()
  });

  const linked = (await store.listSubs()).filter(s => s.wallet);
  const subs = linked.filter(s => store.isNotifyEnabled(s));
  let sent = 0;
  let skipped = linked.length - subs.length;
  let failed = 0;
  const errors = [];

  for (const sub of subs) {
    if (!force && Number(sub.lastEpochNotified) === epoch) {
      skipped += 1;
      continue;
    }
    try {
      const view = await lookup.loadStakeHealth(sub.wallet);
      const text = msg.formatDigest(view, {
        fiat: sub.fiat || "USD",
        wallet: sub.wallet,
        previousTone: sub.lastTone
      });
      const delivered = await bot.send(sub.chatId, text, { sub });
      sub.lastTone = view.overall?.tone || sub.lastTone;
      if (delivered) {
        sub.lastEpochNotified = epoch;
        sub.lastDigestAt = new Date().toISOString();
        sent += 1;
      } else {
        failed += 1;
      }
      await store.saveSub(sub);
    } catch (err) {
      failed += 1;
      errors.push({ chatId: sub.chatId, error: err.message });
      try {
        const delivered = await bot.send(sub.chatId, msg.lookupFailed(err), { sub });
        if (delivered) {
          sub.lastEpochNotified = epoch;
          await store.saveSub(sub);
        }
      } catch {
        /* still fail soft */
      }
    }
  }

  const remaining = subs.filter(s => Number(s.lastEpochNotified) !== epoch).length;
  if (remaining === 0) {
    await store.setEpochState({
      lastSeenEpoch: epoch,
      lastCompletedEpoch: epoch,
      completedAt: new Date().toISOString()
    });
  }

  return {
    ok: true,
    epoch,
    subscribers: linked.length,
    notified: subs.length,
    sent,
    skipped,
    failed,
    remaining,
    errors: errors.slice(0, 8)
  };
}

module.exports = { runEpochDigest, epochDigestTargets };
