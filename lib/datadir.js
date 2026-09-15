/**
 * Central data directory for all tools.
 *
 * - Locally it defaults to  <toolhub>/data
 * - On a host (Railway, etc.) set the env var  DATA_DIR=/data  and mount a
 *   persistent volume at that path, so tool data survives restarts/redeploys.
 *
 * Usage in a tool's api.js:
 *   const { fileFor } = require("../../lib/datadir");
 *   const DATA_FILE = fileFor("todo.json");
 */
const fs = require("fs");
const path = require("path");

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "..", "data");

/** Return an absolute path inside DATA_DIR, creating the directory if needed. */
function fileFor(name) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch {
    /* ignore — write will surface any real error */
  }
  return path.join(DATA_DIR, name);
}

module.exports = { DATA_DIR, fileFor };
