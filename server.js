/**
 * Nest Creativs Office — a private, local, extensible tool platform.
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

const PORT = process.env.PORT || 4600;
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, "public");
const TOOLS_DIR = path.join(ROOT, "tools");

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
  console.log("");
  console.log("   Press Ctrl+C to stop.");
  console.log("");
});
