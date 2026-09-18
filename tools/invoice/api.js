/**
 * Invoice backend: stores saved invoices.
 * <DATA_DIR>/invoices.json = { invoices: [ { id, createdAt, updatedAt, data } ], seq }
 * `data` is the full invoice object built by the UI (from, billTo, meta, items, notes, logo, currency, totals).
 */
const fs = require("fs");
const { fileFor } = require("../../lib/datadir");

const DATA_FILE = fileFor("invoices.json");

function load() {
  try {
    const db = JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
    return { invoices: db.invoices || [], seq: db.seq || 0 };
  } catch {
    return { invoices: [], seq: 0 };
  }
}
function save(db) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
}
/** A short summary for list views, so the picker stays light. */
function summarize(rec) {
  const d = rec.data || {};
  return {
    id: rec.id,
    createdAt: rec.createdAt,
    updatedAt: rec.updatedAt,
    number: d.number || "",
    billName: (d.billTo && (d.billTo.company || d.billTo.name)) || "",
    date: d.date || "",
    total: d.total || "",
    currency: d.currency || "$",
  };
}

module.exports = async function handle(ctx) {
  const db = load();

  // List = light summaries only (no logo data URLs etc.)
  if (ctx.method === "GET" && ctx.path === "/list") {
    return ctx.send(200, { invoices: db.invoices.map(summarize), nextSeq: db.seq + 1 });
  }

  // Fetch one full invoice.
  if (ctx.method === "GET" && ctx.path === "/get") {
    const rec = db.invoices.find((x) => x.id === ctx.query.id);
    if (!rec) return ctx.send(404, { error: "Not found" });
    return ctx.send(200, rec);
  }

  // Create a new invoice.
  if (ctx.method === "POST" && ctx.path === "/save") {
    const data = (ctx.body && ctx.body.data) || {};
    const rec = {
      id: Date.now().toString(36),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      data,
    };
    db.invoices.unshift(rec);
    db.seq = (db.seq || 0) + 1;
    save(db);
    return ctx.send(200, { id: rec.id, list: db.invoices.map(summarize), nextSeq: db.seq + 1 });
  }

  // Update an existing invoice.
  if (ctx.method === "POST" && ctx.path === "/update") {
    const id = ctx.body && ctx.body.id;
    const i = db.invoices.findIndex((x) => x.id === id);
    if (i === -1) return ctx.send(404, { error: "Not found" });
    db.invoices[i].data = (ctx.body && ctx.body.data) || {};
    db.invoices[i].updatedAt = Date.now();
    save(db);
    return ctx.send(200, { id, list: db.invoices.map(summarize), nextSeq: db.seq + 1 });
  }

  if (ctx.method === "POST" && ctx.path === "/delete") {
    db.invoices = db.invoices.filter((x) => x.id !== (ctx.body && ctx.body.id));
    save(db);
    return ctx.send(200, { list: db.invoices.map(summarize), nextSeq: db.seq + 1 });
  }

  return ctx.send(404, { error: "Unknown route: " + ctx.method + " " + ctx.path });
};
