/**
 * Work Timer backend (simple count-up stopwatch).
 * Persists completed work sessions only. All clock/date formatting happens on
 * the CLIENT, so times always follow the user's local timezone regardless of
 * where the server is hosted.
 *
 * <DATA_DIR>/work-timer.json = {
 *   records: [ { id, seconds, breakSeconds, end, label } ]  // end = epoch ms (UTC)
 * }
 */
const fs = require("fs");
const { fileFor } = require("../../lib/datadir");

const DATA_FILE = fileFor("work-timer.json");

function load() {
  try {
    const db = JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
    return { records: db.records || [] };
  } catch {
    return { records: [] };
  }
}
function save(db) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
}

module.exports = async function handle(ctx) {
  const db = load();

  if (ctx.method === "GET" && ctx.path === "/state") {
    return ctx.send(200, db);
  }

  // Record a completed work session.
  if (ctx.method === "POST" && ctx.path === "/record") {
    const seconds = Math.max(0, Math.round(Number(ctx.body && ctx.body.seconds) || 0));
    const breakSeconds = Math.max(0, Math.round(Number(ctx.body && ctx.body.breakSeconds) || 0));
    if (seconds < 1 && breakSeconds < 1) return ctx.send(200, db); // ignore empty
    const label = String((ctx.body && ctx.body.label) || "").trim().slice(0, 200);
    db.records.unshift({ id: Date.now().toString(36), seconds, breakSeconds, end: Date.now(), label });
    save(db);
    return ctx.send(200, db);
  }

  if (ctx.method === "POST" && ctx.path === "/delete") {
    db.records = db.records.filter((r) => r.id !== (ctx.body && ctx.body.id));
    save(db);
    return ctx.send(200, db);
  }

  if (ctx.method === "POST" && ctx.path === "/clear") {
    db.records = [];
    save(db);
    return ctx.send(200, db);
  }

  return ctx.send(404, { error: "Unknown route: " + ctx.method + " " + ctx.path });
};
