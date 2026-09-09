/**
 * Epoch digest cron.
 *
 * GET/POST /api/telegram-cron
 * Vercel cron hits this on a schedule. Also callable with
 * Authorization: Bearer $CRON_SECRET (or TELEGRAM_CRON_SECRET).
 *
 * Query: ?force=1 to send even if the epoch has not changed (ops/debug).
 */
const digest = require("../lib/telegram-digest");

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

function authorized(req) {
  const secret = process.env.CRON_SECRET || process.env.TELEGRAM_CRON_SECRET;
  const vercelCron = req.headers["x-vercel-cron"] === "1";
  const header = String(req.headers.authorization || "");
  const query = new URL(req.url, "http://localhost").searchParams.get("secret");
  if (secret) {
    return header === `Bearer ${secret}` || query === secret;
  }
  return vercelCron;
}

module.exports = async function telegramCron(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    json(res, 405, { ok: false, error: "method not allowed" });
    return;
  }

  if (!authorized(req)) {
    json(res, 401, { ok: false, error: "unauthorized" });
    return;
  }

  const url = new URL(req.url, "http://localhost");
  const force = url.searchParams.get("force") === "1";

  try {
    const result = await digest.runEpochDigest({ force });
    json(res, result.ok ? 200 : 503, result);
  } catch (err) {
    console.error("telegram cron", err);
    json(res, 500, { ok: false, error: err.message || "cron failed" });
  }
};
