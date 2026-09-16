/**
 * Onboarding backend — stores client onboarding entries.
 * <DATA_DIR>/onboarding.json = { entries: [ { id, ...fields, createdAt } ] }
 */
const fs = require("fs");
const { fileFor } = require("../../lib/datadir");

const DATA_FILE = fileFor("onboarding.json");

const FIELDS = [
  "clientName", "business", "whatsapp", "email", "channel", "videos", "rate",
  "upfront", "outstanding", "startDate", "status", "source", "notes",
  "welcomeSent", "kickoffSent",
];

function load() {
  try {
    const db = JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
    return { entries: db.entries || [] };
  } catch {
    return { entries: [] };
  }
}
function save(db) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
}
function clean(body) {
  const e = {};
  for (const f of FIELDS) e[f] = body && body[f] != null ? String(body[f]).slice(0, 2000) : "";
  return e;
}

module.exports = async function handle(ctx) {
  const db = load();

  if (ctx.method === "GET" && ctx.path === "/entries") {
    return ctx.send(200, db);
  }

  if (ctx.method === "POST" && ctx.path === "/entry") {
    const e = clean(ctx.body);
    if (!e.clientName) return ctx.send(400, { error: "Client name required" });
    e.id = Date.now().toString(36);
    e.createdAt = Date.now();
    db.entries.unshift(e);
    save(db);
    return ctx.send(200, db);
  }

  if (ctx.method === "POST" && ctx.path === "/update") {
    const id = ctx.body && ctx.body.id;
    const i = db.entries.findIndex((x) => x.id === id);
    if (i !== -1) {
      const e = clean(ctx.body);
      e.id = id;
      e.createdAt = db.entries[i].createdAt;
      db.entries[i] = e;
      save(db);
    }
    return ctx.send(200, db);
  }

  if (ctx.method === "POST" && ctx.path === "/delete") {
    db.entries = db.entries.filter((x) => x.id !== (ctx.body && ctx.body.id));
    save(db);
    return ctx.send(200, db);
  }

  return ctx.send(404, { error: "Unknown route: " + ctx.method + " " + ctx.path });
};
