/* Tool Hub: dashboard logic (vanilla JS, no build step) */

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

// ---- Sidebar collapse -----------------------------------------------------
const appEl = document.querySelector(".app");
if (localStorage.getItem("toolhub-sidebar") === "collapsed") appEl.classList.add("collapsed");
function toggleSidebar() {
  appEl.classList.toggle("collapsed");
  localStorage.setItem(
    "toolhub-sidebar",
    appEl.classList.contains("collapsed") ? "collapsed" : "open"
  );
}
document.getElementById("sidebar-toggle").addEventListener("click", toggleSidebar);
document.getElementById("sidebar-open").addEventListener("click", toggleSidebar);

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
  onboard:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.2"/><path d="M3.5 20a5.5 5.5 0 0 1 11 0"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="16" y1="11" x2="22" y2="11"/></svg>',
  invoice:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h9l4 4v12a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><polyline points="14 3 14 8 19 8"/><line x1="8" y1="12" x2="15" y2="12"/><line x1="8" y1="16" x2="15" y2="16"/></svg>',
};

function iconEl(tool) {
  const span = document.createElement("span");
  span.className = "ic";
  const svg = ICONS[tool.icon];
  // One consistent accent colour for every tool icon.
  span.style.color = "var(--accent)";
  if (svg) {
    span.innerHTML = svg;
  } else {
    span.textContent = tool.icon || tool.name.slice(0, 1).toUpperCase();
  }
  return span;
}

// ---- Custom drag order (persisted) ---------------------------------------
let customOrder = [];
try { customOrder = JSON.parse(localStorage.getItem("toolhub-order") || "[]"); } catch { customOrder = []; }

// Return tools sorted by the user's saved drag order; anything not in that
// list keeps its default order and falls in after the saved ones.
function orderedTools() {
  const rank = new Map(customOrder.map((id, i) => [id, i]));
  return [...state.tools].sort((a, b) => {
    const ra = rank.has(a.id) ? rank.get(a.id) : Infinity;
    const rb = rank.has(b.id) ? rank.get(b.id) : Infinity;
    return ra - rb;
  });
}

function saveOrderFromDom() {
  const ids = [...els.list.querySelectorAll(".tool-item")].map((el) => el.dataset.id);
  customOrder = ids;
  localStorage.setItem("toolhub-order", JSON.stringify(ids));
  render(els.search.value); // reflect the new order in the home cards too
}

function render(filter = "") {
  const q = filter.trim().toLowerCase();
  const matches = orderedTools().filter(
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
    d.textContent = state.tools.length ? "No matches." : "No tools yet. Add one!";
    els.list.appendChild(d);
  }
  const canDrag = !q; // reordering only makes sense on the full, unfiltered list
  for (const tool of matches) {
    const btn = document.createElement("button");
    btn.className = "tool-item" + (state.active === tool.id ? " active" : "");
    btn.dataset.id = tool.id;
    btn.appendChild(iconEl(tool));
    const label = document.createElement("span");
    label.textContent = tool.name;
    btn.appendChild(label);
    btn.addEventListener("click", () => { if (!btn.dataset.dragged) openTool(tool.id); });
    if (canDrag) {
      btn.draggable = true;
      btn.addEventListener("dragstart", (e) => {
        btn.classList.add("dragging");
        e.dataTransfer.effectAllowed = "move";
      });
      btn.addEventListener("dragend", () => {
        btn.classList.remove("dragging");
        // suppress the click that fires right after a drag
        btn.dataset.dragged = "1";
        setTimeout(() => delete btn.dataset.dragged, 0);
        saveOrderFromDom();
      });
    }
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

// ---- Drag-to-reorder: live shuffle of the sidebar list -------------------
function dragAfter(container, y) {
  const items = [...container.querySelectorAll(".tool-item:not(.dragging)")];
  let closest = { offset: -Infinity, el: null };
  for (const el of items) {
    const box = el.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    if (offset < 0 && offset > closest.offset) closest = { offset, el };
  }
  return closest.el;
}
els.list.addEventListener("dragover", (e) => {
  const dragging = els.list.querySelector(".dragging");
  if (!dragging) return;
  e.preventDefault();
  const after = dragAfter(els.list, e.clientY);
  if (after == null) els.list.appendChild(dragging);
  else els.list.insertBefore(dragging, after);
});

// ---- Open / close a tool --------------------------------------------------
function openTool(id) {
  const tool = state.tools.find((t) => t.id === id);
  if (!tool || !tool.hasUi) {
    // No UI file; still show a friendly message
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
