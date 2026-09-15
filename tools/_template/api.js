/**
 * Optional backend for a tool.
 *
 * Export a single async function. It receives a context object and the raw
 * Node response. Use ctx.send(status, obj) to reply with JSON.
 *
 * ctx = {
 *   method,      // "GET", "POST", ...
 *   path,        // sub-path after /api/<toolId>  (e.g. "/echo")
 *   query,       // parsed ?query=params
 *   body,        // parsed JSON body (if Content-Type: application/json)
 *   rawBody,     // raw request body string
 *   headers,     // request headers
 *   send(status, obj),          // reply with JSON
 *   sendRaw(status, data, hdrs) // reply with anything
 * }
 *
 * You can edit this file and just re-run the request — no server restart
 * needed (the module is reloaded on every call).
 */

module.exports = async function handle(ctx) {
  if (ctx.path === "/echo" && ctx.method === "POST") {
    const text = (ctx.body && ctx.body.text) || "";
    return ctx.send(200, {
      received: text,
      length: text.length,
      reversed: text.split("").reverse().join(""),
      at: new Date().toISOString(),
    });
  }
  return ctx.send(404, { error: "Unknown route: " + ctx.method + " " + ctx.path });
};
