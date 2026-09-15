/* Tool Hub — dashboard logic (vanilla JS, no build step) */

const state = {
  tools: [],
  active: null,
};

const els = {
  list: document.getElementById("tool-list"),
  cards: document.getElementById("cards"),
  home: document.getElementById("home"),
  frameWrap: document.getElementById("frame-wrap"),
  frame: document.getElementById("content-frame"),
  toolTitle: document.getElementById("tool-title"),
  openNew: document.getElementById("open-new"),
  backBtn: document.getElementById("back-btn"),
  search: document.getElementById("search"),
  themeToggle: document.getElementById("theme-toggle"),
};

// ---- Theme ----------------------------------------------------------------
const savedTheme = localStorage.getItem("toolhub-theme");
if (savedTheme) document.documentElement.setAttribute("data-theme", savedTheme);
els.themeToggle.addEventListener("click", () => {
  const next =
    document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  localStorage.setItem("toolhub-theme", next);
});

// ---- Load tools -----------------------------------------------------------
async function loadTools() {
  try {
    const res = await fetch("/api/tools");
    const data = await res.json();
    state.tools = data.tools || [];
  } catch (err) {
    state.tools = [];
  }
  render();
  routeFromHash();
}

// Minimal line-icon set (stroke = currentColor). Keyed by tool.json "icon".
const ICONS = {
  check:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9"/><polyline points="9 11 12 14 20 6"/></svg>',
  timer:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="13" r="7.5"/><path d="M12 13V9"/><line x1="9" y1="2.5" x2="15" y2="2.5"/><line x1="12" y1="2.5" x2="12" y2="5.5"/></svg>',
  note:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3" width="16" height="18" rx="2"/><line x1="8" y1="8" x2="16" y2="8"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="8" y1="16" x2="13" y2="16"/></svg>',
  plus:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
};

function iconEl(tool) {
  const span = document.createElement("span");
  span.className = "ic";
  const svg = ICONS[tool.icon];
  if (svg) {
    span.innerHTML = svg;
    span.style.color = tool.color || "var(--accent)";
  } else {
    // fallback: text/emoji in the tool's colour
    span.textContent = tool.icon || tool.name.slice(0, 1).toUpperCase();
    span.style.color = tool.color || "var(--accent)";
  }
  return span;
}

function render(filter = "") {
  const q = filter.trim().toLowerCase();
  const matches = state.tools.filter(
    (t) =>
      !q ||
      (t.name && t.name.toLowerCase().includes(q)) ||
      (t.description && t.description.toLowerCase().includes(q)) ||
      (t.tags && String(t.tags).toLowerCase().includes(q))
  );

  // Sidebar list
  els.list.innerHTML = "";
  if (matches.length === 0) {
    const d = document.createElement("div");
    d.className = "empty";
    d.textContent = state.tools.length ? "No matches." : "No tools yet — add one!";
    els.list.appendChild(d);
  }
  for (const tool of matches) {
    const btn = document.createElement("button");
    btn.className = "tool-item" + (state.active === tool.id ? " active" : "");
    btn.appendChild(iconEl(tool));
    const label = document.createElement("span");
    label.textContent = tool.name;
    btn.appendChild(label);
    btn.addEventListener("click", () => openTool(tool.id));
    els.list.appendChild(btn);
  }

  // Home cards
  els.cards.innerHTML = "";
  for (const tool of matches) {
    const card = document.createElement("div");
    card.className = "card";
    card.appendChild(iconEl(tool));
    const h = document.createElement("h3");
    h.textContent = tool.name;
    const p = document.createElement("p");
    p.textContent = tool.description || "";
    card.appendChild(h);
    card.appendChild(p);
    if (tool.tags) {
      const tag = document.createElement("span");
      tag.className = "tag";
      tag.textContent = tool.tags;
      card.appendChild(tag);
    }
    card.addEventListener("click", () => openTool(tool.id));
    els.cards.appendChild(card);
  }
}

// ---- Open / close a tool --------------------------------------------------
function openTool(id) {
  const tool = state.tools.find((t) => t.id === id);
  if (!tool || !tool.hasUi) {
    // No UI file — still show a friendly message
    if (tool) alert(`"${tool.name}" has no UI yet.`);
    return;
  }
  state.active = id;
  const src = `/tools/${tool.folder}/ui.html`;
  els.frame.src = src;
  els.openNew.href = src;
  els.toolTitle.textContent = tool.name;
  els.home.hidden = true;
  els.frameWrap.hidden = false;
  location.hash = "#/" + id;
  render(els.search.value);
}

function showHome() {
  state.active = null;
  els.frameWrap.hidden = true;
  els.home.hidden = false;
  els.frame.src = "about:blank";
  location.hash = "";
  render(els.search.value);
}

els.backBtn.addEventListener("click", showHome);
els.search.addEventListener("input", (e) => render(e.target.value));

function routeFromHash() {
  const m = location.hash.match(/^#\/(.+)$/);
  if (m) openTool(m[1]);
  else showHome();
}
window.addEventListener("hashchange", routeFromHash);

loadTools();
