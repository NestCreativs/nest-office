/**
 * To-Do backend — tasks persisted to <DATA_DIR>/todo.json.
 * Array order = rank (top = highest).
 */
const fs = require("fs");
const { fileFor } = require("../../lib/datadir");

const DATA_FILE = fileFor("todo.json");

function load() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
  } catch {
    return [];
  }
}
function save(tasks) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(tasks, null, 2));
}

module.exports = async function handle(ctx) {
  const tasks = load();

  if (ctx.method === "GET" && ctx.path === "/list") {
    return ctx.send(200, { tasks });
  }

  if (ctx.method === "POST" && ctx.path === "/add") {
    const text = ((ctx.body && ctx.body.text) || "").trim();
    if (!text) return ctx.send(400, { error: "Empty task" });
    const task = { id: Date.now().toString(36), text, done: false };
    tasks.push(task);
    save(tasks);
    return ctx.send(200, { task });
  }

  if (ctx.method === "POST" && ctx.path === "/toggle") {
    const t = tasks.find((x) => x.id === (ctx.body && ctx.body.id));
    if (t) t.done = !t.done;
    save(tasks);
    return ctx.send(200, { ok: true });
  }

  if (ctx.method === "POST" && ctx.path === "/edit") {
    const t = tasks.find((x) => x.id === (ctx.body && ctx.body.id));
    const text = ((ctx.body && ctx.body.text) || "").trim();
    if (t && text) t.text = text;
    save(tasks);
    return ctx.send(200, { ok: true });
  }

  if (ctx.method === "POST" && ctx.path === "/delete") {
    save(tasks.filter((x) => x.id !== (ctx.body && ctx.body.id)));
    return ctx.send(200, { ok: true });
  }

  if (ctx.method === "POST" && ctx.path === "/move") {
    const { id, dir } = ctx.body || {};
    const i = tasks.findIndex((x) => x.id === id);
    if (i !== -1) {
      const j = dir === "up" ? i - 1 : i + 1;
      if (j >= 0 && j < tasks.length) {
        [tasks[i], tasks[j]] = [tasks[j], tasks[i]];
        save(tasks);
      }
    }
    return ctx.send(200, { ok: true });
  }

  // Reorder to match a full list of ids (from drag-and-drop).
  if (ctx.method === "POST" && ctx.path === "/reorder") {
    const ids = (ctx.body && ctx.body.ids) || [];
    const pos = new Map(ids.map((id, i) => [id, i]));
    tasks.sort(
      (a, b) => (pos.has(a.id) ? pos.get(a.id) : 999) - (pos.has(b.id) ? pos.get(b.id) : 999)
    );
    save(tasks);
    return ctx.send(200, { tasks });
  }

  if (ctx.method === "POST" && ctx.path === "/clear-done") {
    save(tasks.filter((x) => !x.done));
    return ctx.send(200, { ok: true });
  }

  return ctx.send(404, { error: "Unknown route: " + ctx.method + " " + ctx.path });
};
