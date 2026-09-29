/**
 * Approximate SOL price in the currencies Stake health already shows.
 *
 * GET /api/sol-fiat
 *
 * The page cannot always reach CoinGecko itself, so it asks the Hub.
 * Same pack as the native checkup: perSol, source, and whether it is stale.
 */
const core = require("../compare/stake-health-core");

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=120");
  res.end(JSON.stringify(body));
}

async function fetchJson(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

module.exports = async function solFiat(req, res) {
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
    const pack = await core.loadSolFiatRates(fetchJson);
    if (!pack?.perSol || !Number.isFinite(Number(pack.perSol.USD))) {
      json(res, 502, { ok: false, error: "Could not load a SOL price" });
      return;
    }
    json(res, 200, {
      ok: true,
      at: pack.at,
      perSol: pack.perSol,
      source: pack.source,
      stale: !!pack.stale
    });
  } catch (err) {
    json(res, 502, { ok: false, error: err.message || "Could not load a SOL price" });
  }
};
