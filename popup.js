"use strict";

// ── Zustand ───────────────────────────────────────────────────
const DEFAULT = { enabled: true, blockedDomains: [], participles: true };
let cfg = { ...DEFAULT };
let tabHost = null;
let toastTimer = null;

// ── Toast ─────────────────────────────────────────────────────
function showToast(msg, type = "ok", duration = 2500) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.className = "toast show " + type;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.className = "toast"; }, duration);
}

// ── Domain-Hilfsfunktionen ────────────────────────────────────
function cleanDomain(raw) {
  return raw.trim()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "")
    .toLowerCase();
}

function isValidDomain(d) {
  return d.length > 2 && d.includes(".") && !/\s/.test(d);
}

// ── Storage ───────────────────────────────────────────────────
function loadConfig() {
  browser.storage.local.get("nogender_config").then(result => {
    cfg = { ...DEFAULT, ...(result.nogender_config ?? {}) };
    render();
  }).catch(() => render());
}

function saveConfig(patch, feedbackMsg) {
  cfg = { ...cfg, ...patch };
  browser.storage.local.set({ nogender_config: cfg }).then(() => {
    if (feedbackMsg) showToast(feedbackMsg, "ok");
    render();
  }).catch(() => {
    showToast("Fehler beim Speichern.", "err");
  });
}

// ── Render ────────────────────────────────────────────────────
function render() {
  // Ein/Aus-Toggle
  const toggle = document.getElementById("enabledToggle");
  const badge  = document.getElementById("statusBadge");
  const text   = document.getElementById("statusText");
  toggle.checked   = cfg.enabled;
  badge.className  = "status-badge " + (cfg.enabled ? "on" : "off");
  text.textContent = cfg.enabled ? "Aktiv" : "Deaktiviert";

  // Partizip-Formen-Toggle (Default an, falls nicht gesetzt)
  document.getElementById("participlesToggle").checked = cfg.participles !== false;

  // Domain-Liste
  const list = document.getElementById("domainList");
  list.innerHTML = "";

  if (cfg.blockedDomains.length === 0) {
    const li = document.createElement("li");
    li.className   = "domain-empty";
    li.textContent = "Noch keine Seiten ausgeschlossen.";
    list.appendChild(li);
  } else {
    cfg.blockedDomains.forEach((d, i) => {
      const li   = document.createElement("li");
      li.className = "domain-item";

      const span = document.createElement("span");
      span.textContent = d;

      const btn = document.createElement("button");
      btn.className   = "domain-delete";
      btn.textContent = "×";
      btn.title       = d + " entfernen";
      btn.dataset.index = String(i);

      li.append(span, btn);
      list.appendChild(li);
    });
  }

  updateCurrentHint();
}

// Delegierter Listener für Löschen-Buttons
document.getElementById("domainList").addEventListener("click", e => {
  const btn = e.target.closest(".domain-delete");
  if (!btn) return;
  const i = parseInt(btn.dataset.index, 10);
  removeDomain(i);
});

function updateCurrentHint() {
  const hint = document.getElementById("currentHint");
  hint.innerHTML = "";
  if (!tabHost) return;

  if (cfg.blockedDomains.includes(tabHost)) {
    const msg  = document.createTextNode(tabHost + " ist ausgeschlossen. ");
    const link = document.createElement("a");
    link.textContent = "Entfernen?";
    link.id = "removeCurrentLink";
    hint.append(msg, link);
    link.addEventListener("click", () => {
      const i = cfg.blockedDomains.indexOf(tabHost);
      if (i !== -1) removeDomain(i, tabHost + " wieder erlaubt.");
    });
  } else {
    const msg  = document.createTextNode("Aktuelle Seite: ");
    const link = document.createElement("a");
    link.textContent = tabHost + " ausschließen →";
    link.id = "addCurrentLink";
    hint.append(msg, link);
    link.addEventListener("click", () => addDomain(tabHost));
  }
}

// ── Aktionen ──────────────────────────────────────────────────
function addDomain(raw) {
  const d = cleanDomain(raw);
  if (!d) {
    showToast("Bitte eine Domain eingeben.", "err");
    return;
  }
  if (!isValidDomain(d)) {
    showToast("Ungültige Domain: " + d, "err");
    return;
  }
  if (cfg.blockedDomains.includes(d)) {
    showToast(d + " ist bereits in der Liste.", "info");
    return;
  }
  saveConfig({ blockedDomains: [...cfg.blockedDomains, d] }, "✓ " + d + " gespeichert.");
  document.getElementById("domainInput").value = "";
}

function removeDomain(index, msg) {
  const d = cfg.blockedDomains[index];
  saveConfig(
    { blockedDomains: cfg.blockedDomains.filter((_, i) => i !== index) },
    msg ?? "✓ " + d + " entfernt."
  );
}

// ── Events ────────────────────────────────────────────────────
document.getElementById("enabledToggle").addEventListener("change", e => {
  saveConfig(
    { enabled: e.target.checked },
    e.target.checked ? "✓ NoGender aktiviert." : "NoGender deaktiviert."
  );
});

document.getElementById("participlesToggle").addEventListener("change", e => {
  saveConfig(
    { participles: e.target.checked },
    e.target.checked
      ? "✓ Partizip-Formen werden ersetzt."
      : "Partizip-Formen bleiben unverändert."
  );
});

document.getElementById("addBtn").addEventListener("click", () => {
  addDomain(document.getElementById("domainInput").value);
});

document.getElementById("domainInput").addEventListener("keydown", e => {
  if (e.key === "Enter") addDomain(e.target.value);
});

// Debug-Toggle
browser.storage.local.get("nogender_debug").then(r => {
  document.getElementById("debugToggle").checked = !!r.nogender_debug;
}).catch(() => {});

document.getElementById("debugToggle").addEventListener("change", e => {
  browser.storage.local.set({ nogender_debug: e.target.checked }).then(() => {
    showToast(
      e.target.checked
        ? "Debug aktiv – Ersetzungen in F12 → Konsole sichtbar."
        : "Debug-Modus deaktiviert.",
      "info", 3000
    );
  });
});

// Klick auf die ganze Debug-Zeile toggelt den Schalter
document.getElementById("debugRow").addEventListener("click", e => {
  if (e.target.closest("label") || e.target.closest("input")) return;
  const t = document.getElementById("debugToggle");
  t.checked = !t.checked;
  t.dispatchEvent(new Event("change"));
});

// ── Tab-Host ermitteln ────────────────────────────────────────
browser.tabs.query({ active: true, currentWindow: true }).then(tabs => {
  const url = tabs[0]?.url;
  if (!url || url.startsWith("about:") || url.startsWith("moz-")) return;
  tabHost = new URL(url).hostname.replace(/^www\./, "");
  updateCurrentHint();
}).catch(() => {});

// ── Init ──────────────────────────────────────────────────────
loadConfig();
