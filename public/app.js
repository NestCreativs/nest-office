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

function iconEl(tool) {
  const span = document.createElement("span");
  span.className = "ic";
  span.style.background = tool.color || "#6366f1";
  span.textContent = tool.icon || tool.name.slice(0, 1).toUpperCase();
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
