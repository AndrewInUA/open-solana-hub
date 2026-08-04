/**
 * Decap CMS → GitHub OAuth callback.
 * Exchanges ?code= for an access token and posts it to window.opener
 * in the format Decap expects.
 *
 * Env: GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, OAUTH_REDIRECT_URI (optional)
 */
module.exports = async function callback(req, res) {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.end(
      "Missing GITHUB_CLIENT_ID or GITHUB_CLIENT_SECRET. Set them in Vercel project env vars."
    );
    return;
  }

  const url = new URL(req.url, "http://localhost");
  const code = url.searchParams.get("code");
  const oauthError = url.searchParams.get("error");

  if (oauthError) {
    res.statusCode = 400;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end(
      `<!doctype html><html><body><p>GitHub OAuth error: ${escapeHtml(
        oauthError
      )}</p></body></html>`
    );
    return;
  }

  if (!code) {
    res.statusCode = 400;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.end("Missing OAuth code");
    return;
  }

  const host = req.headers["x-forwarded-host"] || req.headers.host;
  const proto = (req.headers["x-forwarded-proto"] || "https").split(",")[0].trim();
  const redirectUri =
    process.env.OAUTH_REDIRECT_URI || `${proto}://${host}/api/callback`;

  let tokenResponse;
  try {
    tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
      }),
    });
  } catch (err) {
    res.statusCode = 502;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.end(`Token exchange failed: ${err.message}`);
    return;
  }

  const data = await tokenResponse.json();
  if (!data.access_token) {
    res.statusCode = 502;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end(
      `<!doctype html><html><body><p>GitHub did not return a token.</p><pre>${escapeHtml(
        JSON.stringify(data, null, 2)
      )}</pre></body></html>`
    );
    return;
  }

  const payload = JSON.stringify({
    token: data.access_token,
    provider: "github",
  });

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Logging in…</title>
</head>
<body>
  <p>Authentication complete. You can close this window.</p>
  <script>
    (function () {
      var payload = ${JSON.stringify(payload)};
      function receiveMessage(e) {
        window.opener.postMessage(
          "authorization:github:success:" + payload,
          e.origin
        );
        window.removeEventListener("message", receiveMessage, false);
      }
      window.addEventListener("message", receiveMessage, false);
      window.opener.postMessage("authorizing:github", "*");
    })();
  </script>
</body>
</html>`;

  res.statusCode = 200;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.end(html);
};

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
