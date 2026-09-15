# Nest Creativs Office

Your own private, local platform for building and running tools. It runs entirely
on your machine — nothing is sent anywhere. Add new tools over time by dropping a
folder in `tools/`.

## Requirements

- [Node.js](https://nodejs.org) (LTS). One-time install. Nothing else — the app
  uses **zero npm dependencies**, so there is no `npm install` step.

## Run it

- **Everyday use:** the server starts automatically (hidden) when you log into
  Windows. Just open the **"Nest Creativs Office"** shortcut on your Desktop, or
  go to http://localhost:4600.
- **Start it now without a reboot:** double-click **`Nest Creativs Office.vbs`**
  (runs the server hidden + opens the dashboard).
- **Stop it:** double-click **`Stop Nest Creativs Office.bat`**.
- **See the server log / troubleshoot:** double-click `start.bat` (runs with a
  visible console window).

To use a different port: `set PORT=8080 && node server.js`.

## How it's organized

```
toolhub/
├─ server.js                  the local server + automatic tool loader (no deps)
├─ server-background.vbs      hidden server launcher (used by auto-start)
├─ Nest Creativs Office.vbs   double-click: hidden server + open dashboard
├─ Stop Nest Creativs Office.bat
├─ start.bat                  visible-console launcher (for troubleshooting)
├─ public/                    the dashboard shell
│  ├─ index.html
│  ├─ app.js
│  ├─ style.css
│  ├─ tool-kit.css            shared styles you can use in any tool
│  └─ logo.svg                the brand mark / favicon
└─ tools/                     ← every tool lives here, one folder each
   ├─ _template/              copy this to start a new tool (hidden: starts with _)
   ├─ _docs/                  the "Add a tool" guide
   ├─ todo/                   to-do list (saves to disk)
   ├─ work-timer/             work & break timer (saves to disk)
   └─ notes/                  quick notes (saves to disk)
```

## Add a new tool

1. Copy `tools/_template` → `tools/my-tool`.
2. Edit `tool.json` (name, description, icon, color).
3. Build `ui.html` — a normal web page. Link `/tool-kit.css` for the shared look.
4. *(Optional)* add `api.js` for server-side logic. Your UI calls it at
   `/api/my-tool/...`. Great for file access, databases, or calling an API with
   a secret key that never reaches the browser.
5. Refresh the dashboard — the tool appears automatically. No restart needed to
   add tools or change a UI; `api.js` also hot-reloads per request.

Folders starting with `_` or `.` are hidden from the dashboard.

### Tip

Ask Claude Code — *"add a &lt;whatever&gt; tool to my office"* — and it can
scaffold the entire folder for you.

## Included tools

| Tool | What it does |
|------|--------------|
| To-Do List | Add, rank (move up/down), tick off, edit, and delete tasks |
| Work Timer | Time work & breaks, keep/delete records, daily average |
| Notes | Quick notes, saved to disk |

All three tools save their data to disk (`tools/<tool>/data.json`), so everything
persists across restarts.
