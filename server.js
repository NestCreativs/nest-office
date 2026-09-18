/**
 * Nest Creativs Office: a private, local, extensible tool platform.
 *
 * Zero dependencies: uses only Node's built-in modules, so it runs
 * the moment Node.js is installed (no `npm install` required).
 *
 * How it works:
 *   - Serves the dashboard from /public
 *   - Auto-discovers every tool folder inside /tools (each with a tool.json)
 *   - Serves each tool's UI at /tools/<id>/ui.html (shown in the dashboard)
 *   - Routes /api/<id>/... to that tool's optional api.js backend
 *
 * To add a new tool: copy tools/_template into a new folder. That's it.
 */

const http = require("http");
const fs = require("fs");
const path = require("path");
const url = require("url");
const crypto = require("crypto");

const PORT = process.env.PORT || 4600;
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, "public");
const TOOLS_DIR = path.join(ROOT, "tools");

// ---------------------------------------------------------------------------
// Password gate (single shared password from the APP_PASSWORD env var).
// When APP_PASSWORD is not set the gate is disabled, so local development
// still works with no setup. On the host, set APP_PASSWORD to turn it on.
// ---------------------------------------------------------------------------
const APP_PASSWORD = process.env.APP_PASSWORD || "";
const AUTH_ENABLED = APP_PASSWORD.length > 0;
const COOKIE_NAME = "nc_auth";
const COOKIE_MAX_AGE = 5 * 365 * 24 * 60 * 60; // ~5 years, in seconds

// A stateless token: a hash of the password. It stays valid until the
// password changes (which rotates the token and logs everyone out).
function authToken() {
  return crypto.createHash("sha256").update("nestcreativs:" + APP_PASSWORD).digest("hex");
}
function parseCookies(req) {
  const out = {};
  const raw = req.headers.cookie || "";
  for (const part of raw.split(";")) {
    const i = part.indexOf("=");
    if (i > -1) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}
function isAuthed(req) {
  if (!AUTH_ENABLED) return true;
  const tok = parseCookies(req)[COOKIE_NAME];
  if (!tok) return false;
  const a = Buffer.from(tok);
  const b = Buffer.from(authToken());
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
function isSecure(req) {
  const proto = req.headers["x-forwarded-proto"] || "";
  return proto.split(",")[0].trim() === "https" || !!(req.socket && req.socket.encrypted);
}
function authCookie(value, maxAge, secure) {
  let c = `${COOKIE_NAME}=${value}; HttpOnly; Path=/; Max-Age=${maxAge}; SameSite=Lax`;
  if (secure) c += "; Secure";
  return c;
}
function loginPage(error) {
  return `<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Nest Creativs Office</title>
<style>
  :root { --bg:#080d12; --surface:#0d1621; --surface-2:#0f2038; --border:#1b3050; --text:#fff; --muted:#8ba3c4; --accent:#0066ff; }
  * { box-sizing:border-box; }
  body { margin:0; min-height:100vh; display:grid; place-items:center; background:
      radial-gradient(120% 120% at 0% 0%, rgba(0,102,255,.16), transparent 55%), var(--bg);
    color:var(--text); font:15px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif; padding:20px; }
  .card { width:100%; max-width:360px; background:var(--surface); border:1px solid var(--border);
    border-radius:16px; padding:30px 26px; box-shadow:0 18px 60px rgba(0,0,0,.45); }
  .logo { width:56px; height:56px; margin:0 auto 14px; display:block; }
  h1 { font-size:19px; margin:0 0 4px; text-align:center; }
  p.sub { margin:0 0 22px; text-align:center; color:var(--muted); font-size:13.5px; }
  label { display:block; font-size:13px; color:var(--muted); margin:0 0 6px; }
  input { width:100%; padding:11px 13px; border:1px solid var(--border); border-radius:10px;
    background:var(--surface-2); color:var(--text); outline:none; font:inherit; }
  input:focus { border-color:var(--accent); }
  button { width:100%; margin-top:16px; padding:11px 16px; border:none; border-radius:10px;
    background:var(--accent); color:#fff; font:inherit; font-weight:600; cursor:pointer; }
  button:hover { filter:brightness(1.06); }
  .err { margin-top:14px; color:#ff8b8b; font-size:13px; text-align:center; }
</style>
</head>
<body>
  <form class="card" method="POST" action="/login">
    <svg class="logo" viewBox="0 0 100 100" fill="none"><g fill="#2352ff">
      <polygon points="27,24 39,24 39,76 27,76"/><polygon points="61,24 73,24 73,76 61,76"/>
      <polygon points="27,24 39,24 73,76 61,76"/><polygon points="41,57 41,71 52,64"/></g></svg>
    <h1>Nest Creativs Office</h1>
    <p class="sub">Enter the password to continue.</p>
    <label for="password">Password</label>
    <input id="password" name="password" type="password" autocomplete="current-password" autofocus required />
    <button type="submit">Unlock</button>
    ${error ? '<p class="err">Incorrect password. Try again.</p>' : ""}
  </form>
</body>
</html>`;
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
};

// ---------------------------------------------------------------------------
// Tool discovery
// ---------------------------------------------------------------------------

/** Read every tool folder and return an array of manifests. */
function discoverTools() {
  const tools = [];
  let entries = [];
  try {
    entries = fs.readdirSync(TOOLS_DIR, { withFileTypes: true });
  } catch {
    return tools;
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith("_") || entry.name.startsWith(".")) continue; // _template etc.
    const manifestPath = path.join(TOOLS_DIR, entry.name, "tool.json");
    if (!fs.existsSync(manifestPath)) continue;
    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
      manifest.id = manifest.id || entry.name;
      manifest.folder = entry.name;
      manifest.hasUi = fs.existsSync(path.join(TOOLS_DIR, entry.name, "ui.html"));
      manifest.hasApi = fs.existsSync(path.join(TOOLS_DIR, entry.name, "api.js"));
      tools.push(manifest);
    } catch (err) {
      console.error(`[toolhub] Skipping tool "${entry.name}": ${err.message}`);
    }
  }
  // Sort by explicit order, then name.
  tools.sort((a, b) => (a.order || 999) - (b.order || 999) || String(a.name).localeCompare(b.name));
  return tools;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function send(res, status, body, headers = {}) {
  res.writeHead(status, { "Cache-Control": "no-cache", ...headers });
  res.end(body);
}

function sendJson(res, status, obj) {
  send(res, status, JSON.stringify(obj, null, 2), {
    "Content-Type": "application/json; charset=utf-8",
  });
}

function redirect(res, location, extraHeaders = {}) {
  res.writeHead(302, { Location: location, "Cache-Control": "no-cache", ...extraHeaders });
  res.end();
}

function sendHtml(res, status, html, extraHeaders = {}) {
  send(res, status, html, { "Content-Type": "text/html; charset=utf-8", ...extraHeaders });
}

function readBody(req) {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > 25 * 1024 * 1024) req.destroy(); // 25MB guard
    });
    req.on("end", () => resolve(data));
    req.on("error", () => resolve(data));
  });
}

/** Serve a static file safely (no path traversal outside base). */
function serveStatic(res, baseDir, relPath) {
  const safePath = path
    .normalize(relPath)
    .replace(/^(\.\.[/\\])+/, "")
    .replace(/^[/\\]+/, "");
  const filePath = path.join(baseDir, safePath);
  if (!filePath.startsWith(baseDir)) {
    return send(res, 403, "Forbidden");
  }
  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      return send(res, 404, "Not found");
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      "Content-Type": MIME[ext] || "application/octet-stream",
      // Always revalidate so a redeploy never leaves a stale app.js/css cached.
      "Cache-Control": "no-cache",
    });
    fs.createReadStream(filePath).pipe(res);
  });
}

// ---------------------------------------------------------------------------
// Request handling
// ---------------------------------------------------------------------------

const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url, true);
  let pathname = decodeURIComponent(parsed.pathname);

  // --- Auth: login page & submit -----------------------------------------
  if (pathname === "/login") {
    if (!AUTH_ENABLED || isAuthed(req)) return redirect(res, "/");
    if (req.method === "POST") {
      const raw = await readBody(req);
      let password = "";
      const ctype = req.headers["content-type"] || "";
      if (ctype.includes("application/json")) {
        try { password = (JSON.parse(raw) || {}).password || ""; } catch { password = ""; }
      } else {
        password = new URLSearchParams(raw).get("password") || "";
      }
      const ok =
        password.length === APP_PASSWORD.length &&
        crypto.timingSafeEqual(Buffer.from(password), Buffer.from(APP_PASSWORD));
      if (ok) {
        return redirect(res, "/", { "Set-Cookie": authCookie(authToken(), COOKIE_MAX_AGE, isSecure(req)) });
      }
      return sendHtml(res, 401, loginPage(true));
    }
    return sendHtml(res, 200, loginPage(false));
  }

  // --- Auth: logout (clear the cookie) -----------------------------------
  if (pathname === "/logout") {
    return redirect(res, "/login", { "Set-Cookie": authCookie("", 0, isSecure(req)) });
  }

  // --- Auth gate: everything below requires a valid cookie ---------------
  if (!isAuthed(req)) {
    if (pathname.startsWith("/api/")) return sendJson(res, 401, { error: "Not authenticated" });
    return redirect(res, "/login");
  }

  // --- API: list of tools -------------------------------------------------
  if (pathname === "/api/tools") {
    return sendJson(res, 200, { tools: discoverTools() });
  }

  // --- API: per-tool backend  ->  /api/<toolId>/<rest> --------------------
  if (pathname.startsWith("/api/")) {
    const rest = pathname.slice("/api/".length);
    const slash = rest.indexOf("/");
    const toolId = slash === -1 ? rest : rest.slice(0, slash);
    const subPath = slash === -1 ? "/" : rest.slice(slash);
    const apiFile = path.join(TOOLS_DIR, toolId, "api.js");

    if (!fs.existsSync(apiFile)) {
      return sendJson(res, 404, { error: `No backend for tool "${toolId}"` });
    }
    try {
      // Fresh require each call so you can edit api.js without restarting.
      delete require.cache[require.resolve(apiFile)];
      const mod = require(apiFile);
      const handler = typeof mod === "function" ? mod : mod.handle;
      if (typeof handler !== "function") {
        return sendJson(res, 500, { error: `Tool "${toolId}" api.js has no handler` });
      }
      const rawBody = await readBody(req);
      let body = rawBody;
      const ctype = req.headers["content-type"] || "";
      if (ctype.includes("application/json") && rawBody) {
        try {
          body = JSON.parse(rawBody);
        } catch {
          return sendJson(res, 400, { error: "Invalid JSON body" });
        }
      }
      const ctx = {
        method: req.method,
        path: subPath,
        query: parsed.query,
        body,
        rawBody,
        headers: req.headers,
        send: (status, obj) => sendJson(res, status, obj),
        sendRaw: (status, data, headers) => send(res, status, data, headers),
      };
      return await handler(ctx, res);
    } catch (err) {
      console.error(`[toolhub] Error in tool "${toolId}":`, err);
      return sendJson(res, 500, { error: err.message });
    }
  }

  // --- Static: tool UIs & assets  ->  /tools/<id>/... ---------------------
  if (pathname.startsWith("/tools/")) {
    return serveStatic(res, TOOLS_DIR, pathname.slice("/tools/".length));
  }

  // --- Static: dashboard --------------------------------------------------
  if (pathname === "/") pathname = "/index.html";
  return serveStatic(res, PUBLIC_DIR, pathname);
});

// Keep the process alive if an unexpected error slips through, instead of
// letting the platform mark the deploy as crashed.
process.on("uncaughtException", (err) => console.error("[toolhub] uncaughtException:", err));
process.on("unhandledRejection", (err) => console.error("[toolhub] unhandledRejection:", err));

// Bind to 0.0.0.0 so the hosting platform's health check can reach the app
// (Node otherwise defaults to IPv6 "::", which some platforms can't reach).
server.listen(PORT, "0.0.0.0", () => {
  const tools = discoverTools();
  console.log("");
  console.log("  ┌───────────────────────────────────────────────┐");
  console.log("  │        Nest Creativs Office is running         │");
  console.log("  └───────────────────────────────────────────────┘");
  console.log("");
  console.log(`   ▶  Open:   http://localhost:${PORT}`);
  console.log(`   ▶  Tools:  ${tools.length} loaded (${tools.map((t) => t.name).join(", ") || "none yet"})`);
  console.log(`   ▶  Auth:   ${AUTH_ENABLED ? "ON (password gate active)" : "OFF (set APP_PASSWORD to enable)"}`);
  console.log("");
  console.log("   Press Ctrl+C to stop.");
  console.log("");
});
