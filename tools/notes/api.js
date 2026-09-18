/**
 * Notes backend: demonstrates persisting data to disk.
 * Notes are stored in <DATA_DIR>/notes.json (created on first save).
 */
const fs = require("fs");
const { fileFor } = require("../../lib/datadir");

const DATA_FILE = fileFor("notes.json");

function load() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
  } catch {
    return [];
  }
}
function save(notes) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(notes, null, 2));
}

module.exports = async function handle(ctx) {
  // GET /api/notes/list
  if (ctx.method === "GET" && ctx.path === "/list") {
    return ctx.send(200, { notes: load() });
  }

  // POST /api/notes/add   { text }
  if (ctx.method === "POST" && ctx.path === "/add") {
    const text = (ctx.body && ctx.body.text || "").trim();
    if (!text) return ctx.send(400, { error: "Empty note" });
    const notes = load();
    const note = { id: Date.now().toString(36), text, at: new Date().toISOString() };
    notes.unshift(note);
    save(notes);
    return ctx.send(200, { note });
  }

  // POST /api/notes/delete   { id }
  if (ctx.method === "POST" && ctx.path === "/delete") {
    const id = ctx.body && ctx.body.id;
    save(load().filter((n) => n.id !== id));
    return ctx.send(200, { ok: true });
  }

  return ctx.send(404, { error: "Unknown route: " + ctx.method + " " + ctx.path });
};
