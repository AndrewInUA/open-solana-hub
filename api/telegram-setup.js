/**
 * One-time webhook registration.
 *
 * GET /api/telegram-setup
 * Auth: Bearer TELEGRAM_WEBHOOK_SECRET (or ?secret=)
 *
 * Registers https://<this-host>/api/telegram with Telegram.
 */
const bot = require("../lib/telegram-bot");

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

function authorized(req) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET || process.env.CRON_SECRET;
  if (!secret) return false;
  const header = String(req.headers.authorization || "");
  const query = new URL(req.url, "http://localhost").searchParams.get("secret");
  return header === `Bearer ${secret}` || query === secret;
}

module.exports = async function telegramSetup(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    json(res, 405, { ok: false, error: "method not allowed" });
    return;
  }

  if (!bot.botToken()) {
    json(res, 503, { ok: false, error: "TELEGRAM_BOT_TOKEN is not set" });
    return;
  }

  if (!authorized(req)) {
    json(res, 401, { ok: false, error: "unauthorized" });
    return;
  }

  const host = req.headers["x-forwarded-host"] || req.headers.host;
  const proto = (req.headers["x-forwarded-proto"] || "https").split(",")[0].trim();
  const url = new URL(req.url, "http://localhost");
  const hookUrl = url.searchParams.get("url") || `${proto}://${host}/api/telegram`;
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;

  try {
    const set = await bot.setWebhook(hookUrl, secret);
    const commands = await bot.setMyCommands();
    const info = await bot.getWebhookInfo();
    json(res, 200, { ok: true, hookUrl, set, commands, info });
  } catch (err) {
    json(res, 502, { ok: false, error: err.message });
  }
};
