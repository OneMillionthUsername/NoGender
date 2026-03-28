// NoGender v1.6.1
// Ersetzt künstlich gegenderte Formen (Ärzt:in, Lehrer*innen, …) durch natürliches Deutsch.
// Natürliche Formen (Ärztin, Lehrerinnen, meine Freundinnen, …) werden NIE angetastet.
(() => {
  "use strict";

  // ─────────────────────────────────────────────────────────────
  // 0. KONFIGURATION – aus browser.storage.local laden
  // ─────────────────────────────────────────────────────────────

  const CACHE_KEY  = "nogender_wikt_cache";

  const DEFAULT_CONFIG = {
    enabled: true,
    blockedDomains: [],
  };

  let debugEnabled = false;

  function isBlockedDomain(cfg) {
    const host = location.hostname.replace(/^www\./, "");
    return (cfg.blockedDomains || []).some(
      d => host === d || host.endsWith("." + d)
    );
  }

  const debug = (...args) => {
    try {
      if (debugEnabled) console.log("[NoGender]", ...args);
    } catch {}
  };

  browser.storage.local.get("nogender_debug").then(r => {
    debugEnabled = !!r.nogender_debug;
  }).catch(() => {});

  // Auf Konfigurationsänderungen reagieren (z.B. Domain im Popup hinzugefügt)
  browser.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;

    if (changes.nogender_debug) {
      debugEnabled = !!changes.nogender_debug.newValue;
    }

    if (!changes.nogender_config) return;
    const newCfg = changes.nogender_config.newValue ?? DEFAULT_CONFIG;
    if (!newCfg.enabled || isBlockedDomain(newCfg)) {
      // Seite neu laden damit Addon sich zurückzieht
      location.reload();
    }
  });

  // Konfiguration laden, dann starten
  browser.storage.local.get("nogender_config").then(result => {
    const cfg = { ...DEFAULT_CONFIG, ...(result.nogender_config ?? {}) };

    if (!cfg.enabled || isBlockedDomain(cfg)) {
      console.log("[NoGender] Deaktiviert oder geblockt:", location.hostname);
      return;
    }

    init();
  }).catch(() => {
    // Fallback: starten ohne Config
    init();
  });

  // ─────────────────────────────────────────────────────────────
  // 1. WIKTIONARY-LOOKUP & CACHE
  // ─────────────────────────────────────────────────────────────

  const wiktCache = (() => {
    try {
      const raw = sessionStorage.getItem(CACHE_KEY);
      return raw ? new Map(JSON.parse(raw)) : new Map();
    } catch { return new Map(); }
  })();

  function persistWiktCache() {
    try {
      if (wiktCache.size > 500) {
        [...wiktCache.keys()].slice(0, wiktCache.size - 500).forEach(k => wiktCache.delete(k));
      }
      sessionStorage.setItem(CACHE_KEY, JSON.stringify([...wiktCache.entries()]));
    } catch {}
  }

  async function fetchWiktionaryForms(lemma) {
    const key = lemma.toLowerCase();
    if (wiktCache.has(key)) return wiktCache.get(key);
    wiktCache.set(key, null);

    try {
      const url =
        "https://de.wiktionary.org/w/api.php?action=query&prop=revisions" +
        "&rvprop=content&rvslots=main&format=json&origin=*&titles=" +
        encodeURIComponent(lemma);
      const resp = await fetch(url, { signal: AbortSignal.timeout(4000) });
      if (!resp.ok) return null;
      const data = await resp.json();
      const page = Object.values(data?.query?.pages ?? {})[0];
      if (!page || page.missing !== undefined) return null;
      const wikitext =
        page?.revisions?.[0]?.slots?.main?.["*"] ??
        page?.revisions?.[0]?.["*"] ?? "";
      const forms = parseWiktionaryFlexion(wikitext);
      wiktCache.set(key, forms);
      persistWiktCache();
      return forms;
    } catch {
      wiktCache.set(key, null);
      return null;
    }
  }

  function parseWiktionaryFlexion(wikitext) {
    const deSection =
      wikitext.match(/==\s*Deutsch\s*==[\s\S]*?(?===\s*\w|\s*$)/)?.[0] ?? wikitext;
    const tmpl = deSection.match(/\{\{Deutsch Substantiv Übersicht([\s\S]*?)\}\}/i);
    if (!tmpl) return null;
    const body = tmpl[1];
    const get = key => {
      const r = new RegExp("\\|\\s*" + key + "\\s*(?:1|\\*)?\\s*=\\s*([^|\\}\\n]+)", "i");
      const m = body.match(r);
      if (!m) return null;
      return m[1].trim()
        .replace(/^\[\[|\]\]$/g, "")
        .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2")
        .replace(/'{2,}/g, "");
    };
    const forms = {
      sg: { nom: get("Nominativ Singular") },
      pl: { nom: get("Nominativ Plural") },
    };
    if (!forms.sg.nom && !forms.pl.nom) return null;
    return forms;
  }

  // ─────────────────────────────────────────────────────────────
  // 2. LEXIKON (Fallback)
  // ─────────────────────────────────────────────────────────────

  const LEXICON = new Map([
    ["ärzt",            { sg:"Arzt",               pl:"Ärzte"              }],
    ["anwält",          { sg:"Anwalt",             pl:"Anwälte"            }],
    ["wirt",            { sg:"Wirt",               pl:"Wirte"              }],
    ["koch",            { sg:"Koch",               pl:"Köche"              }],
    ["pfleger",         { sg:"Pfleger",            pl:"Pfleger"            }],
    ["pädagog",         { sg:"Pädagoge",           pl:"Pädagogen"          }],
    ["psycholog",       { sg:"Psychologe",         pl:"Psychologen"        }],
    ["soziolog",        { sg:"Soziologe",          pl:"Soziologen"         }],
    ["bürger",          { sg:"Bürger",             pl:"Bürger"             }],
    ["student",         { sg:"Student",            pl:"Studenten"          }],
    ["praktikant",      { sg:"Praktikant",         pl:"Praktikanten"       }],
    ["patient",         { sg:"Patient",            pl:"Patienten"          }],
    ["teilnehmer",      { sg:"Teilnehmer",         pl:"Teilnehmer"         }],
    ["mitarbeiter",     { sg:"Mitarbeiter",        pl:"Mitarbeiter"        }],
    ["aktivist",        { sg:"Aktivist",           pl:"Aktivisten"         }],
    ["journalist",      { sg:"Journalist",         pl:"Journalisten"       }],
    ["kommunist",       { sg:"Kommunist",          pl:"Kommunisten"        }],
    ["terrorist",       { sg:"Terrorist",          pl:"Terroristen"        }],
    ["politiker",       { sg:"Politiker",          pl:"Politiker"          }],
    ["kollege",         { sg:"Kollege",            pl:"Kollegen"           }],
    ["freund",          { sg:"Freund",             pl:"Freunde"            }],
    ["lehrer",          { sg:"Lehrer",             pl:"Lehrer"             }],
    ["schüler",         { sg:"Schüler",            pl:"Schüler"            }],
    ["arbeiter",        { sg:"Arbeiter",           pl:"Arbeiter"           }],
    ["leser",           { sg:"Leser",              pl:"Leser"              }],
    ["richter",         { sg:"Richter",            pl:"Richter"            }],
    ["autor",           { sg:"Autor",              pl:"Autoren"            }],
    ["sprecher",        { sg:"Sprecher",           pl:"Sprecher"           }],
    ["professor",       { sg:"Professor",          pl:"Professoren"        }],
    ["direktor",        { sg:"Direktor",           pl:"Direktoren"         }],
    ["nutzer",          { sg:"Nutzer",             pl:"Nutzer"             }],
    ["entwickler",      { sg:"Entwickler",         pl:"Entwickler"         }],
    ["forscher",        { sg:"Forscher",           pl:"Forscher"           }],
    ["unternehmer",     { sg:"Unternehmer",        pl:"Unternehmer"        }],
    ["wissenschaftler", { sg:"Wissenschaftler",    pl:"Wissenschaftler"    }],
    ["elementarpädagog",{ sg:"Elementarpädagoge",  pl:"Elementarpädagogen" }],
  ]);

  // ─────────────────────────────────────────────────────────────
  // 3. HILFSFUNKTIONEN
  // ─────────────────────────────────────────────────────────────

  const NON_TEXT_PARENTS = new Set([
    "SCRIPT","STYLE","NOSCRIPT","TEXTAREA","CODE","PRE","INPUT","SELECT",
  ]);

  const NORMALIZABLE_ATTRIBUTES = [
    "title","alt","placeholder","aria-label","aria-describedby",
    "aria-description","data-tooltip","data-title","data-original-title","label",
  ];

  const NORMALIZABLE_SELECTOR = NORMALIZABLE_ATTRIBUTES.map(a => "[" + a + "]").join(",");

  function isEditableNode(node) {
    let el = node.nodeType === Node.TEXT_NODE ? node.parentNode : node;
    while (el && el.nodeType === Node.ELEMENT_NODE) {
      if (el.nodeName === "INPUT" || el.nodeName === "TEXTAREA") return true;
      if (el.isContentEditable) return true;
      el = el.parentNode;
    }
    return false;
  }

  function preserveCase(source, replacement) {
    if (!source || !replacement) return replacement || "";
    const isAllUpper =
      source === source.toUpperCase() && source !== source.toLowerCase();
    const isCapitalized =
      source[0] === source[0].toUpperCase() &&
      source.slice(1) === source.slice(1).toLowerCase();
    if (isAllUpper) return replacement.toUpperCase();
    if (isCapitalized) return replacement[0].toUpperCase() + replacement.slice(1);
    return replacement;
  }

  // ─────────────────────────────────────────────────────────────
  // 4. FORMEN-AUFLÖSUNG
  // ─────────────────────────────────────────────────────────────

  function resolveForm(stem, isPlural, wiktForms) {
    const lower = stem.toLowerCase();

    if (wiktForms) {
      const form = isPlural
        ? (wiktForms.pl?.nom ?? wiktForms.sg?.nom)
        : wiktForms.sg?.nom;
      if (form) return preserveCase(stem, form);
    }

    const entry = LEXICON.get(lower);
    if (entry) return preserveCase(stem, isPlural ? entry.pl : entry.sg);

    // Regelbasierter Fallback
    return isPlural ? toPlural(stem) : stem;
  }

  function toPlural(stem) {
    if (/(er|el|en|chen|lein)$/i.test(stem)) return stem;
    if (/e$/i.test(stem)) return stem + "n";
    if (/[tdnrsl]$/i.test(stem)) return stem + "en";
    return stem;
  }

  // ─────────────────────────────────────────────────────────────
  // 5. KOMPOSITA
  // ─────────────────────────────────────────────────────────────

  const SORTED_STEMS = [...LEXICON.keys()].sort((a, b) => b.length - a.length);

  function splitCompound(word) {
    const lower = word.toLowerCase();
    for (const stem of SORTED_STEMS) {
      if (lower.endsWith(stem) && lower.length > stem.length) {
        return { prefix: word.slice(0, word.length - stem.length), stem };
      }
    }
    return null;
  }

  // ─────────────────────────────────────────────────────────────
  // 6. REGEX-MUSTER
  // ─────────────────────────────────────────────────────────────

  // Bindestrich wird bewusst NICHT als Gender-Marker unterstützt:
  // Er ist als Gendering-Form extrem selten, kollidiert aber häufig mit normalen
  // deutschen Komposita (Standard-installationen), CLI-Flags (tail -n), URLs und Code.
  const MARKER = "[:*·•‧∙⋅⋆_/]";
  const STEM   = "([\\p{L}]{2,})";

  const reGenderInfo            = /\s*[\(\[]\s*(?:m|w|d)\s*(?:[\/|]\s*(?:m|w|d))+\s*[\)\]]/giu;
  const reInnenWithMarker       = new RegExp(STEM + "\\s*(?:\\(|\\[)?" + MARKER + "(?:-)?innen(?:\\)|\\])?(?![\\p{L}])", "giu");
  const reInWithMarker          = new RegExp(STEM + "\\s*(?:\\(|\\[)?" + MARKER + "(?:-)?in(?:\\)|\\])?(?![\\p{L}])",    "giu");
  const reInnenParen            = new RegExp(STEM + "\\s*\\(innen\\)", "giu");
  const reInParen               = new RegExp(STEM + "\\s*\\(in\\)",    "giu");
  const reBinnenIPlural         = new RegExp("(\\b[\\p{Ll}][\\p{L}]*)Innen\\b", "gu");
  const reBinnenISingular       = new RegExp("(\\b[\\p{Ll}][\\p{L}]*)In\\b",    "gu");
  const reInSlashInnen          = new RegExp(STEM + "In/Innen\\b", "gi");
  const reAdjNWithMarker        = new RegExp("(\\b[\\p{L}]{2,})\\s*" + MARKER + "\\s*n\\b", "gu");
  const reStandaloneInMarker    = new RegExp("^\\s*(?:\\(|\\[)?" + MARKER + "\\s*(?:-)?\\s*in(?:\\)|\\])?\\s*$",    "iu");
  const reStandaloneInnenMarker = new RegExp("^\\s*(?:\\(|\\[)?" + MARKER + "\\s*(?:-)?\\s*innen(?:\\)|\\])?\\s*$", "iu");

  const FALSE_POSITIVES = new Set([
    "heroin","heroine","protein","platine","marine","maschine","routine",
    "medizin","vitamin","kantine","benzin","origin","satin","burin",
    "cousin","raisin","sequin","goblin","penguin","kabine","disziplin",
  ]);

  const reAnyGenderPattern = new RegExp(
    [
      reGenderInfo.source,
      reAdjNWithMarker.source,
      reInSlashInnen.source,
      reBinnenIPlural.source,
      reBinnenISingular.source,
      reInnenWithMarker.source,
      reInWithMarker.source,
      reInnenParen.source,
      reInParen.source,
    ].join("|"),
    "iu"
  );

  // ─────────────────────────────────────────────────────────────
  // 7. NORMALISIERUNG
  // ─────────────────────────────────────────────────────────────

  function getWikt(stem) {
    const lower = stem.toLowerCase();
    const cap   = lower[0].toUpperCase() + lower.slice(1);
    return wiktCache.get(lower) ?? wiktCache.get(cap) ?? null;
  }

  function replaceStem(stem, isPlural) {
    if (FALSE_POSITIVES.has(stem.toLowerCase())) return stem;
    const compound = splitCompound(stem);
    if (compound) {
      return compound.prefix + resolveForm(compound.stem, isPlural, getWikt(compound.stem));
    }
    return resolveForm(stem, isPlural, getWikt(stem));
  }

  function normalizeGenderedText(text) {
    if (!text) return text;
    let out = text.replace(/[\u00AD\u200B\u200C\u200D]/g, "");
    reAnyGenderPattern.lastIndex = 0;
    if (!reAnyGenderPattern.test(out)) return out;

    const R = (re, fn) => { re.lastIndex = 0; out = out.replace(re, fn); };

    R(reGenderInfo,      ()            => "");
    R(reAdjNWithMarker,  (_, stem)     => stem + "n");
    R(reInSlashInnen,    (_, stem)     => replaceStem(stem, true));
    R(reBinnenIPlural,   (_, stem)     => replaceStem(stem, true));
    R(reBinnenISingular, (_, stem)     => replaceStem(stem, false));
    R(reInnenWithMarker, (_, stem)     => replaceStem(stem, true));
    R(reInWithMarker,    (_, stem)     => replaceStem(stem, false));
    R(reInnenParen,      (_, stem)     => replaceStem(stem, true));
    R(reInParen,         (_, stem)     => replaceStem(stem, false));

    return out;
  }

  async function normalizeGenderedTextAsync(text) {
    if (!text) return text;
    let tmp = text.replace(/[\u00AD\u200B\u200C\u200D]/g, "");
    reAnyGenderPattern.lastIndex = 0;
    if (!reAnyGenderPattern.test(tmp)) return text;

    const stems = new Set();
    const collect = (_, stem) => { if (stem) stems.add(stem.toLowerCase()); return _; };
    [reInnenWithMarker, reInWithMarker, reInnenParen, reInParen,
     reBinnenIPlural, reBinnenISingular, reInSlashInnen].forEach(re => {
      re.lastIndex = 0;
      tmp.replace(re, collect);
      re.lastIndex = 0;
    });

    await Promise.all([...stems].filter(Boolean).map(async s => {
      if (wiktCache.has(s)) return;
      await fetchWiktionaryForms(s[0].toUpperCase() + s.slice(1));
    }));

    return normalizeGenderedText(text);
  }

  // ─────────────────────────────────────────────────────────────
  // 8. DOM-VERARBEITUNG
  // ─────────────────────────────────────────────────────────────

  const processed = new WeakSet();

  const walkerFilter = {
    acceptNode(node) {
      if (!node.nodeValue?.trim()) return NodeFilter.FILTER_REJECT;
      const p = node.parentNode;
      if (!p || p.nodeType !== Node.ELEMENT_NODE) return NodeFilter.FILTER_ACCEPT;
      if (NON_TEXT_PARENTS.has(p.nodeName)) return NodeFilter.FILTER_REJECT;
      if (isEditableNode(node)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  };

  async function processBatch(nodes) {
    for (const node of nodes) {
      if (!node.isConnected || processed.has(node)) continue;
      const original = node.nodeValue;
      const replaced = await normalizeGenderedTextAsync(original);
      if (replaced !== original) {
        node.nodeValue = replaced;
        debug("✓", JSON.stringify(original.trim()), "→", JSON.stringify(replaced.trim()));
      }
      processed.add(node);
    }
  }

  async function replaceGenderedLanguageInDOM(root) {
    if (!root) root = document.documentElement;
    normalizeSplitMarkers(root);
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, walkerFilter);
    const CHUNK = 60;
    let batch = [], node;
    while ((node = walker.nextNode())) {
      if (processed.has(node)) continue;
      batch.push(node);
      if (batch.length >= CHUNK) {
        await processBatch(batch);
        batch = [];
        await new Promise(r => setTimeout(r, 0));
      }
    }
    if (batch.length) await processBatch(batch);
  }

  // ─────────────────────────────────────────────────────────────
  // 9. SPLIT-MARKER-NORMALISIERUNG
  // ─────────────────────────────────────────────────────────────

  const reStemEndFix = new RegExp("[\\p{L}]{2,}\\s*$", "u");

  function normalizeSplitMarkersInElement(element) {
    if (!element?.childNodes || element.childNodes.length < 2) return;
    if (element.nodeType === Node.ELEMENT_NODE && NON_TEXT_PARENTS.has(element.nodeName)) return;
    if (isEditableNode(element)) return;

    const getInline = node => {
      if (!node) return null;
      if (node.nodeType === Node.TEXT_NODE)
        return node.nodeValue ? { node, text: node.nodeValue } : null;
      if (node.nodeType !== Node.ELEMENT_NODE || NON_TEXT_PARENTS.has(node.nodeName)) return null;
      if (node.childNodes.length === 1 && node.firstChild.nodeType === Node.TEXT_NODE) {
        const t = node.firstChild.nodeValue || "";
        return t ? { node: node.firstChild, text: t } : null;
      }
      return null;
    };

    const nodes = Array.from(element.childNodes);
    for (let i = 0; i < nodes.length - 1; i++) {
      const cur = getInline(nodes[i]);
      if (!cur || !reStemEndFix.test(cur.text)) continue;

      let markerText = "";
      const markerNodes = [];
      for (let j = i + 1; j < nodes.length && markerNodes.length < 4; j++) {
        const mi = getInline(nodes[j]);
        if (!mi) break;
        markerText += mi.text;
        markerNodes.push(mi.node);
        if (markerText.length > 14) break;
        if (reStandaloneInMarker.test(markerText) || reStandaloneInnenMarker.test(markerText)) {
          const combined = cur.text + markerText;
          const replaced = normalizeGenderedText(combined);
          if (replaced !== combined) {
            cur.node.nodeValue = replaced;
            markerNodes.forEach(n => { n.nodeValue = ""; });
          }
          break;
        }
      }
    }
  }

  function normalizeSplitMarkers(root) {
    if (!root) root = document.documentElement;
    const candidates = new Set();

    const addCandidate = el => {
      if (!el || el.nodeType !== Node.ELEMENT_NODE) return;
      if (NON_TEXT_PARENTS.has(el.nodeName)) return;
      candidates.add(el);
    };

    if (root.nodeType === Node.ELEMENT_NODE) addCandidate(root);

    try {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
      let n;
      while ((n = walker.nextNode())) {
        addCandidate(n.parentNode);
      }
    } catch {}

    candidates.forEach(normalizeSplitMarkersInElement);
  }

  // ─────────────────────────────────────────────────────────────
  // 10. ATTRIBUTE, META, SVG, JSON-LD, SHADOW DOM
  // ─────────────────────────────────────────────────────────────

  function normalizeElementAttributes(element) {
    if (!element?.hasAttributes || isEditableNode(element)) return;
    for (const attr of NORMALIZABLE_ATTRIBUTES) {
      if (!element.hasAttribute(attr)) continue;
      const orig = element.getAttribute(attr);
      if (!orig?.trim()) continue;
      const repl = normalizeGenderedText(orig);
      if (repl !== orig) element.setAttribute(attr, repl);
    }
  }

  function normalizeAllAttributes(root) {
    if (!root) root = document.documentElement;
    if (root.nodeType === Node.ELEMENT_NODE) normalizeElementAttributes(root);
    try { root.querySelectorAll?.(NORMALIZABLE_SELECTOR).forEach(normalizeElementAttributes); } catch {}
  }

  function normalizeDocumentTitle(doc = document) {
    if (typeof doc?.title !== "string") return;
    const r = normalizeGenderedText(doc.title);
    if (r !== doc.title) doc.title = r;
  }

  function normalizeMetaTags(doc = document) {
    doc?.head?.querySelectorAll("meta[name], meta[property]").forEach(meta => {
      const orig = meta.getAttribute("content");
      if (!orig) return;
      const r = normalizeGenderedText(orig);
      if (r !== orig) meta.setAttribute("content", r);
    });
  }

  const JSON_LD_SKIP = new Set(["@id","url","sameAs","contentUrl","embedUrl","thumbnailUrl"]);

  function normalizeJsonLdValue(v, k) {
    if (typeof v === "string") return (k && JSON_LD_SKIP.has(k)) ? v : normalizeGenderedText(v);
    if (Array.isArray(v)) return v.map(e => normalizeJsonLdValue(e));
    if (v && typeof v === "object") {
      const out = {};
      for (const [ck, cv] of Object.entries(v)) out[ck] = normalizeJsonLdValue(cv, ck);
      return out;
    }
    return v;
  }

  function normalizeJsonLdScripts(root = document) {
    const scope = root?.querySelectorAll ? root : root?.ownerDocument;
    scope?.querySelectorAll("script[type='application/ld+json']").forEach(s => {
      const orig = s.textContent;
      if (!orig?.trim()) return;
      try {
        const r = JSON.stringify(normalizeJsonLdValue(JSON.parse(orig)));
        if (r !== orig) s.textContent = r;
      } catch {}
    });
  }

  function normalizeSvgText(root) {
    try {
      root?.querySelectorAll?.("text, tspan, textPath").forEach(el => {
        const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
        let n;
        while ((n = w.nextNode())) {
          const r = normalizeGenderedText(n.nodeValue || "");
          if (r !== n.nodeValue) n.nodeValue = r;
        }
      });
    } catch {}
  }

  function normalizeShadowDom(root) {
    const proc = el => {
      if (el?.shadowRoot) {
        replaceGenderedLanguageInDOM(el.shadowRoot);
        normalizeAllAttributes(el.shadowRoot);
        normalizeSvgText(el.shadowRoot);
        normalizeJsonLdScripts(el.shadowRoot);
        el.shadowRoot.querySelectorAll("*").forEach(proc);
      }
    };
    if (root?.nodeType === Node.ELEMENT_NODE) proc(root);
    try { root?.querySelectorAll?.("*").forEach(proc); } catch {}
  }

  // ─────────────────────────────────────────────────────────────
  // 11. MUTATIONOBSERVER (debounced)
  // ─────────────────────────────────────────────────────────────

  function observeGenderedLanguage(root) {
    if (!root?.ownerDocument) return;

    const pendingText  = new Set();
    const pendingElems = new Set();
    const pendingAttrs = new Set();
    let rafId = null;
    let isFlushing = false;

    const getTopLevelElements = elements => {
      const list = [...elements].filter(el => el?.isConnected);
      if (list.length < 2) return list;
      return list.filter(el => !list.some(other => other !== el && other.contains(el)));
    };

    const flush = () => {
      rafId = null;
      if (isFlushing) return;

      for (const el of pendingAttrs) {
        if (!isEditableNode(el)) normalizeElementAttributes(el);
      }
      pendingAttrs.clear();

      const texts = [...pendingText];
      const elems = getTopLevelElements(pendingElems);
      pendingText.clear();
      pendingElems.clear();

      isFlushing = true;

      (async () => {
        if (texts.length) await processBatch(texts);
        for (const el of elems) {
          await replaceGenderedLanguageInDOM(el);
          normalizeAllAttributes(el);
          normalizeSvgText(el);
          normalizeJsonLdScripts(el);
          normalizeShadowDom(el);
        }
      })().finally(() => {
        isFlushing = false;
        if (pendingText.size || pendingElems.size || pendingAttrs.size) schedule();
      });
    };

    const schedule = () => { if (!rafId) rafId = requestAnimationFrame(flush); };

    const observer = new MutationObserver(mutations => {
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (isEditableNode(node)) continue;
          if (node.nodeType === Node.TEXT_NODE && !processed.has(node))
            pendingText.add(node);
          else if (node.nodeType === Node.ELEMENT_NODE && !processed.has(node))
            pendingElems.add(node);
        }
        if (m.type === "characterData" &&
            m.target.nodeType === Node.TEXT_NODE &&
            !isEditableNode(m.target) &&
            !processed.has(m.target)) {
          pendingText.add(m.target);
        }
        if (m.type === "attributes" &&
            m.target.nodeType === Node.ELEMENT_NODE &&
            !isEditableNode(m.target) &&
            NORMALIZABLE_ATTRIBUTES.includes(m.attributeName)) {
          pendingAttrs.add(m.target);
        }
      }
      if (pendingText.size || pendingElems.size || pendingAttrs.size) schedule();
    });

    observer.observe(root, {
      childList: true, subtree: true, attributes: true,
      attributeFilter: NORMALIZABLE_ATTRIBUTES, characterData: true,
    });
  }

  function observeHeadChanges(doc = document) {
    if (!doc?.head) return;
    new MutationObserver(() => {
      normalizeDocumentTitle(doc);
      normalizeMetaTags(doc);
      normalizeJsonLdScripts(doc);
    }).observe(doc.head, {
      childList: true, subtree: true, attributes: true, characterData: true,
      attributeFilter: ["content"],
    });
  }

  // ─────────────────────────────────────────────────────────────
  // 12. INIT (wird nach Config-Laden aufgerufen)
  // ─────────────────────────────────────────────────────────────

  async function init() {
    const root = document.documentElement;
    await replaceGenderedLanguageInDOM(root);
    normalizeAllAttributes(root);
    normalizeSvgText(root);
    normalizeShadowDom(root);
    normalizeDocumentTitle();
    normalizeMetaTags();
    normalizeJsonLdScripts();
    observeGenderedLanguage(root);
    observeHeadChanges();
    debug("NoGender v1.6.1 aktiv auf:", location.hostname);
  }

})();
