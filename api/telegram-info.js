/**
 * Public Telegram bot link for the Stake health page.
 *
 * GET /api/telegram-info
 * Optional env TELEGRAM_BOT_USERNAME (no @) overrides the public default
 * stake_health_bot. Never returns the bot token.
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
    username,
    url,
    fallback: core.TELEGRAM_CTA.fallback
  });
};
