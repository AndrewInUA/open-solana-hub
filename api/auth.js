/**
 * Decap CMS → GitHub OAuth start.
 * Opens GitHub authorize; callback returns to /api/callback.
 *
 * Env: GITHUB_CLIENT_ID, OAUTH_REDIRECT_URI (optional; defaults to this host /api/callback)
 */
module.exports = function auth(req, res) {
  const clientId = process.env.GITHUB_CLIENT_ID;
  if (!clientId) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.end("Missing GITHUB_CLIENT_ID. Set it in Vercel project env vars.");
    return;
  }

  const host = req.headers["x-forwarded-host"] || req.headers.host;
  const proto = (req.headers["x-forwarded-proto"] || "https").split(",")[0].trim();
  const redirectUri =
    process.env.OAUTH_REDIRECT_URI || `${proto}://${host}/api/callback`;

  const url = new URL("https://github.com/login/oauth/authorize");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("scope", "repo,user");
  url.searchParams.set("redirect_uri", redirectUri);

  res.statusCode = 302;
  res.setHeader("Location", url.toString());
  res.end();
};
