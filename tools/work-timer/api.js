/**
 * Work Timer backend — timestamp-based so elapsed time is always real
 * wall-clock time, even if the tab was minimized, closed, or reopened later.
 *
 * The running session lives on the SERVER as accumulated milliseconds plus the
 * timestamp of the current running segment. Any client computes live time as
 * accumulated + (now - segStart); nothing depends on a client-side tick.
 *
 * <DATA_DIR>/work-timer.json = {
 *   active: null | { mode:"work"|"break", running, workMs, breakMs, segStart, task },
 *   records: [ { id, seconds, breakSeconds, end, label } ]   // end = epoch ms
 * }
 */
const fs = require("fs");
const { fileFor } = require("../../lib/datadir");

const DATA_FILE = fileFor("work-timer.json");

function load() {
  try {
    const db = JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
    return { active: db.active || null, records: db.records || [] };
  } catch {
    return { active: null, records: [] };
  }
}
function save(db) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
}

// Fold the currently running segment into its accumulator and restart the clock.
function fold(active) {
  if (active && active.running && active.segStart) {
    const now = Date.now();
    const d = Math.max(0, now - active.segStart);
    if (active.mode === "break") active.breakMs += d;
    else active.workMs += d;
    active.segStart = now;
  }
}

module.exports = async function handle(ctx) {
  const db = load();
  const reply = () => ctx.send(200, { active: db.active, records: db.records, now: Date.now() });

  if (ctx.method === "GET" && ctx.path === "/state") {
    return reply();
  }

  // Begin a new session for the chosen task.
  if (ctx.method === "POST" && ctx.path === "/start") {
    const task = String((ctx.body && ctx.body.task) || "").trim().slice(0, 200);
    db.active = { mode: "work", running: true, workMs: 0, breakMs: 0, segStart: Date.now(), task };
    save(db);
    return reply();
  }

  if (ctx.method === "POST" && ctx.path === "/pause") {
    if (db.active && db.active.running) {
      fold(db.active);
      db.active.running = false;
      db.active.segStart = null;
    }
    save(db);
    return reply();
  }

  if (ctx.method === "POST" && ctx.path === "/resume") {
    if (db.active && !db.active.running) {
      db.active.running = true;
      db.active.segStart = Date.now();
    }
    save(db);
    return reply();
  }

  // Toggle work <-> break (freezes one, starts the other).
  if (ctx.method === "POST" && ctx.path === "/break-toggle") {
    if (db.active) {
      fold(db.active);
      db.active.mode = db.active.mode === "work" ? "break" : "work";
      db.active.running = true;
      db.active.segStart = Date.now();
    }
    save(db);
    return reply();
  }

  // Finish the session and store a record.
  if (ctx.method === "POST" && ctx.path === "/end") {
    if (db.active) {
      fold(db.active);
      const seconds = Math.round(db.active.workMs / 1000);
      const breakSeconds = Math.round(db.active.breakMs / 1000);
      if (seconds >= 1 || breakSeconds >= 1) {
        db.records.unshift({
          id: Date.now().toString(36),
          seconds,
          breakSeconds,
          end: Date.now(),
          label: db.active.task,
        });
      }
      db.active = null;
    }
    save(db);
    return reply();
  }

  if (ctx.method === "POST" && ctx.path === "/delete") {
    db.records = db.records.filter((r) => r.id !== (ctx.body && ctx.body.id));
    save(db);
    return reply();
  }

  if (ctx.method === "POST" && ctx.path === "/clear") {
    db.records = [];
    save(db);
    return reply();
  }

  return ctx.send(404, { error: "Unknown route: " + ctx.method + " " + ctx.path });
};
