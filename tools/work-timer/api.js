/**
 * Work Timer backend.
 * Stores the currently-running session on the server so the clock keeps
 * running even if you close the tab, plus a history of finished sessions.
 *
 * <DATA_DIR>/work-timer.json = { active: null | { type, start, label }, records: [...] }
 *   record = { id, type: "work"|"break", start, end, seconds, label }
 */
const fs = require("fs");
const { fileFor } = require("../../lib/datadir");

const DATA_FILE = fileFor("work-timer.json");

function load() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
  } catch {
    return { active: null, records: [] };
  }
}
function save(db) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
}

function finalize(db) {
  if (!db.active) return;
  const start = db.active.start;
  const end = Date.now();
  const seconds = Math.max(0, Math.round((end - start) / 1000));
  db.records.unshift({
    id: end.toString(36),
    type: db.active.type,
    label: db.active.label || "",
    start,
    end,
    seconds,
  });
  db.active = null;
}

module.exports = async function handle(ctx) {
  const db = load();

  // GET /state — current running session (if any) + all records
  if (ctx.method === "GET" && ctx.path === "/state") {
    return ctx.send(200, db);
  }

  // POST /start { type: "work"|"break", label? }
  if (ctx.method === "POST" && ctx.path === "/start") {
    const type = (ctx.body && ctx.body.type) === "break" ? "break" : "work";
    const label = (ctx.body && ctx.body.label || "").trim();
    finalize(db); // close any session already running
    db.active = { type, label, start: Date.now() };
    save(db);
    return ctx.send(200, db);
  }

  // POST /stop — end the running session and record it
  if (ctx.method === "POST" && ctx.path === "/stop") {
    finalize(db);
    save(db);
    return ctx.send(200, db);
  }

  // POST /delete { id } — delete one record
  if (ctx.method === "POST" && ctx.path === "/delete") {
    db.records = db.records.filter((r) => r.id !== (ctx.body && ctx.body.id));
    save(db);
    return ctx.send(200, db);
  }

  // POST /clear — delete all records (keeps any running session)
  if (ctx.method === "POST" && ctx.path === "/clear") {
    db.records = [];
    save(db);
    return ctx.send(200, db);
  }

  return ctx.send(404, { error: "Unknown route: " + ctx.method + " " + ctx.path });
};
