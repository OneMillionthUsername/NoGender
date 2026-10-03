"use strict";

// ── Zustand ───────────────────────────────────────────────────
const DEFAULT = {
  enabled: true, blockedDomains: [], participles: true, doublets: true, wiktionary: true,
};
let cfg = { ...DEFAULT };
let tabHost = null;
let toastTimer = null;

// Einzige Versionsquelle ist das Manifest.
document.getElementById("version").textContent = "v" + browser.runtime.getManifest().version;

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
    loadConfig();   // Anzeige wieder auf den tatsächlich gespeicherten Stand bringen
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

  // Partizip-, Doppelnennungs- und Wiktionary-Toggle (Default an, falls nicht gesetzt)
  document.getElementById("participlesToggle").checked = cfg.participles !== false;
  document.getElementById("doubletsToggle").checked    = cfg.doublets !== false;
  document.getElementById("wiktionaryToggle").checked  = cfg.wiktionary !== false;

  // Domain-Liste
  const list = document.getElementById("domainList");
  list.replaceChildren();

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
      btn.setAttribute("aria-label", d + " entfernen");
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

// Als <button>, damit die Aktion auch per Tastatur erreichbar ist.
function linkButton(label, onClick) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "link-btn";
  btn.textContent = label;
  btn.addEventListener("click", onClick);
  return btn;
}

function updateCurrentHint() {
  const hint = document.getElementById("currentHint");
  hint.replaceChildren();
  if (!tabHost) return;

  if (cfg.blockedDomains.includes(tabHost)) {
    hint.append(
      tabHost + " ist ausgeschlossen. ",
      linkButton("Entfernen?", () => {
        const i = cfg.blockedDomains.indexOf(tabHost);
        if (i !== -1) removeDomain(i, tabHost + " wieder erlaubt.");
      })
    );
  } else {
    hint.append(
      "Aktuelle Seite: ",
      linkButton(tabHost + " ausschließen →", () => addDomain(tabHost))
    );
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

document.getElementById("doubletsToggle").addEventListener("change", e => {
  saveConfig(
    { doublets: e.target.checked },
    e.target.checked
      ? "✓ Doppelnennungen werden gekürzt."
      : "Doppelnennungen bleiben unverändert."
  );
});

document.getElementById("wiktionaryToggle").addEventListener("change", e => {
  saveConfig(
    { wiktionary: e.target.checked },
    e.target.checked
      ? "✓ Seltene Wörter werden bei Wiktionary nachgeschlagen."
      : "Keine Anfragen mehr an Wiktionary (nur eingebautes Lexikon)."
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
  }).catch(() => showToast("Fehler beim Speichern.", "err"));
});

// Klick auf die ganze Debug-Zeile toggelt den Schalter
document.getElementById("debugRow").addEventListener("click", e => {
  if (e.target.closest("label") || e.target.closest("input")) return;
  const t = document.getElementById("debugToggle");
  t.checked = !t.checked;
  t.dispatchEvent(new Event("change"));
});

// ── Tab-Host ermitteln ────────────────────────────────────────
// Die URL des aktiven Tabs liefert die "activeTab"-Berechtigung, die Firefox beim
// Öffnen des Popups vergibt. Fehlt sie (z. B. als Optionsseite geöffnet), bleibt der
// Hinweis einfach leer.
browser.tabs.query({ active: true, currentWindow: true }).then(tabs => {
  const url = tabs[0]?.url;
  if (!url || !/^https?:/.test(url)) return;
  tabHost = new URL(url).hostname.replace(/^www\./, "");
  updateCurrentHint();
}).catch(() => {});

// ── Init ──────────────────────────────────────────────────────
loadConfig();
