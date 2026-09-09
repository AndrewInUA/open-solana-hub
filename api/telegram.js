/**
 * Telegram webhook for Stake health.
 *
 * POST /api/telegram
 * Env: TELEGRAM_BOT_TOKEN, optional TELEGRAM_WEBHOOK_SECRET
 */
const bot = require("../lib/telegram-bot");

function readBody(req) {
  if (req.body && typeof req.body === "object") return Promise.resolve(req.body);
  if (typeof req.body === "string") {
    try {
      return Promise.resolve(JSON.parse(req.body || "{}"));
    } catch {
      return Promise.resolve(null);
    }
  }
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", chunk => {
      raw += chunk;
      if (raw.length > 1e6) req.destroy();
    });
    req.on("end", () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

module.exports = async function telegramWebhook(req, res) {
  if (req.method === "GET") {
    json(res, 200, {
      ok: true,
      service: "open-solana-hub-telegram",
      hint: "POST Telegram updates here. See bot/README.md."
    });
    return;
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    json(res, 405, { ok: false, error: "method not allowed" });
    return;
  }

  if (!bot.botToken()) {
    json(res, 503, { ok: false, error: "TELEGRAM_BOT_TOKEN is not set" });
    return;
  }

  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (secret) {
    const got = req.headers["x-telegram-bot-api-secret-token"];
    if (got !== secret) {
      json(res, 401, { ok: false, error: "unauthorized" });
      return;
    }
  }

  let update;
  try {
    update = await readBody(req);
  } catch {
    json(res, 400, { ok: false, error: "invalid json" });
    return;
  }

  try {
    const result = await bot.handleUpdate(update);
    json(res, 200, { ok: true, ...result });
  } catch (err) {
    console.error("telegram webhook", err);
    // Always 200 to Telegram so it does not retry-spam, unless it is auth.
    json(res, 200, { ok: false, error: err.message || "handler failed" });
  }
};
