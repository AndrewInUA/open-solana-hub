/**
 * Public Telegram bot link for the Stake health page.
 *
 * GET /api/telegram-info
 * Env: TELEGRAM_BOT_USERNAME (no @). Never returns the bot token.
 */
const core = require("../compare/stake-health-core");

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=60");
  res.end(JSON.stringify(body));
}

module.exports = async function telegramInfo(req, res) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET, HEAD");
    json(res, 405, { ok: false, error: "method not allowed" });
    return;
  }

  const username = core.telegramBotUsername(process.env.TELEGRAM_BOT_USERNAME);
  const url = core.telegramBotUrl(username);
  json(res, 200, {
    ok: true,
    username: url ? username : null,
    url: url || null,
    fallback: core.TELEGRAM_CTA.fallback
  });
};
