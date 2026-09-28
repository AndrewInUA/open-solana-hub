/**
 * Approximate time left in the current epoch.
 *
 * GET /api/epoch-clock
 *
 * The public Solana RPC refuses this call from the Stake health page, so the
 * page asks the Hub. Remaining slots times the latest sample's slot length.
 * The copy says "about" because the finish moves if slot time changes.
 */
const lookup = require("../lib/stake-lookup");

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "public, s-maxage=30, stale-while-revalidate=30");
  res.end(JSON.stringify(body));
}

module.exports = async function epochClock(req, res) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
    res.statusCode = 204;
    res.end();
    return;
  }
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET, HEAD, OPTIONS");
    json(res, 405, { ok: false, error: "method not allowed" });
    return;
  }
  try {
    const clock = await lookup.fetchEpochClock();
    if (!clock?.epochRemaining) {
      json(res, 502, { ok: false, error: "Could not estimate time left in this epoch" });
      return;
    }
    json(res, 200, {
      ok: true,
      epoch: Number.isFinite(clock.epoch) ? clock.epoch : null,
      epochRemaining: clock.epochRemaining
    });
  } catch (err) {
    json(res, 502, { ok: false, error: err.message || "Could not read the epoch clock" });
  }
};
