/**
 * Liquid-staking tokens held by a wallet.
 *
 * GET /api/liquid-stake?wallet=<public key>
 *
 * Names widely held pool tokens (JitoSOL, mSOL, and similar). This does not
 * score them. Native stake keeps the health flag.
 */
const core = require("../compare/stake-health-core");
const lookup = require("../lib/stake-lookup");

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "public, s-maxage=30, stale-while-revalidate=30");
  res.end(JSON.stringify(body));
}

function walletFrom(req) {
  if (req.query?.wallet) return String(req.query.wallet).trim();
  try {
    const url = new URL(req.url || "", "https://www.opensolanahub.com");
    return String(url.searchParams.get("wallet") || "").trim();
  } catch {
    return "";
  }
}

module.exports = async function liquidStake(req, res) {
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
  const wallet = walletFrom(req);
  if (!core.isPubkey(wallet)) {
    json(res, 400, { ok: false, error: "Pass a wallet public key" });
    return;
  }
  try {
    const tokens = await lookup.fetchLiquidStake(wallet);
    json(res, 200, { ok: true, tokens });
  } catch (err) {
    json(res, 502, { ok: false, error: err.message || "Could not read liquid staking tokens" });
  }
};
