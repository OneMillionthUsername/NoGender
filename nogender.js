// SPDX-License-Identifier: GPL-3.0-or-later
// NoGender – ersetzt künstlich gegenderte Formen (Ärzt:in, Lehrer*innen, …) durch natürliches Deutsch.
// Natürliche Formen (Ärztin, Lehrerinnen, meine Freundinnen, …) werden NIE angetastet.
// Copyright (C) 2026 Dean Marinov. Lizenz: GNU GPL v3 oder später (siehe LICENSE).
//
// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ MODUL-ÜBERBLICK                                                           ║
// ╚══════════════════════════════════════════════════════════════════════════╝
//
// Verarbeitungs-Pipeline: sichtbaren Text einsammeln → per Vorfilter prüfen, ob
// Gendering vorkommt → mit spezialisierten Mustern die gegenderten Stellen finden →
// den Wortstamm in natürliches Deutsch auflösen → Groß-/Kleinschreibung und
// (Dativ-)Kasus setzen → zurückschreiben. Ein MutationObserver wiederholt die
// Verarbeitung für nachgeladene Inhalte (z. B. auf React-/SPA-Seiten).
//
// ── KONFIGURATION & START ──────────────────────────────────────────────────
//   isBlockedDomain    Prüft, ob die Domain auf der Ausschlussliste steht.
//   init               Einstiegspunkt: verarbeitet die Seite und startet die Observer.
//
// ── WIKTIONARY (Nachschlagewerk für seltene Wörter) ────────────────────────
//   fetchWiktionaryForms   Lädt Beugungsformen eines Worts von de.wiktionary.org (mit Cache).
//   parseWiktionaryFlexion Extrahiert Singular/Plural aus dem Wiktionary-Rohtext.
//   getWikt                Liest aus dem Cache (ohne Netzwerkzugriff).
//   persistWiktCache /     Sichert den Cache gebündelt im sessionStorage.
//     schedulePersist
//
// ── WÖRTERBUCH & FORMEN (Auflösung in natürliche Formen) ───────────────────
//   LEXICON            Kuratierte, autoritative Liste häufiger/unregelmäßiger Personenwörter.
//   PSEUDO_FEM         Kuratierte Pseudo-Feminina ("Gästin", "Vorständin") → echtes Grundwort.
//   PARTICIPLE         Kuratierte Partizip-Substantive ("Studierende") → echtes Nomen (Allowlist).
//   resolveParticiple  Bestimmt Numerus/Genus aus Determinativ + Endung (konservativ, nur Nominativ-Sg.).
//   resolveForm        Wählt die Form: erst LEXICON, dann Wiktionary, dann regelbasiert.
//   toPlural           Regelbasierte Pluralbildung als Fallback.
//   toDativPlural      Bildet den Dativ Plural ("Lehrer" → "Lehrern").
//   preserveCase       Überträgt die Groß-/Kleinschreibung des Originals auf das Ergebnis.
//   splitCompound      Zerlegt Komposita ("Sozialarbeiter" → "Sozial" + "arbeiter").
//   isLikelyPersonStem Prüft, ob ein Stamm eine Personenbezeichnung ist (schützt vor Fehlgriffen).
//   replaceStem        Setzt Stamm und aufgelöste Form zusammen.
//   isDativContext     Prüft den linken Kontext auf eindeutige Dativ-Auslöser ("mit"/"nach"/"den" …).
//
// ── ERKENNUNGS-MUSTER (Regex) ──────────────────────────────────────────────
//   MARKER / STEM      Bausteine: Trennzeichen ( : * · _ / … ) und Wortstamm.
//   reInnenWithMarker  Plural mit Marker: "Lehrer:innen", "Lehrer*innen"  → Stamm + Zeichen + "innen".
//   reInWithMarker     Singular mit Marker: "Ärzt:in"                      → Stamm + Zeichen + "in".
//   reInnenParen /     Klammerform: "Lehrer(innen)" / "Bürger(in)".
//     reInParen
//   reBinnenIPlural /  Binnen-I (großes I mitten im Wort): "LehrerInnen" / "BürgerIn".
//     reBinnenISingular
//   reInSlashInnen     Slash-Form: "LehrerIn/Innen".
//   reInnenCompound    Gegendertes Kompositum: "Lehrer:innenzimmer" → "Lehrerzimmer".
//   reAdjNWithMarker / Adjektiv-/Pronomenendungen: "eine:n"→"einen", "ein:e"→"ein",
//     reAdjEWithMarker   "jede:r"→"jeder".
//     reAdjRWithMarker
//   reAdjErMWithMarker Dativ-Maskulinum: "jeder:m" → "jedem".
//   reGenderInfo       Stellenanzeigen-Kürzel "(m/w/d)" → wird entfernt.
//   reIndefinitePronoun "mensch"/"frau" als Ersatz für "man" → "man".
//   rePseudoFem        Pseudo-Feminina ohne Marker: "Gästin(nen)" → "Gast"/"Gäste".
//   rePseudoFemArt     Artikel-Kongruenz davor: "Die Vorständin" → "Der Vorstand".
//   reParticiple       Substantivierte Partizipien: "Studierende" → "Studenten" (Allowlist).
//   reArtSingularNom   Artikel-Kongruenz am Satzanfang: "Die Kolleg:in" → "Der Kollege".
//   reStandalone*Marker Ein Marker, der allein in einem Textknoten steht (für über
//                      mehrere HTML-Tags verteilte Formen).
//   reAnyGenderPattern Vorfilter: prüft, ob überhaupt Gendering vorkommt (vermeidet unnötige Arbeit).
//
// ── KERN-UMWANDLUNG ────────────────────────────────────────────────────────
//   normalizeGenderedText      Wendet alle Muster nacheinander auf einen Text an (synchron, ohne Netz).
//   normalizeGenderedTextAsync Wie oben, lädt aber vorab fehlende Wörter von Wiktionary nach.
//
// ── DOM-VERARBEITUNG ───────────────────────────────────────────────────────
//   isEditableNode           Schließt Eingabefelder aus (input/textarea/contenteditable).
//   processBatch /           Verarbeitet die sichtbaren Textknoten blockweise.
//     replaceGenderedLanguageInDOM
//   normalizeSplitMarkers*   Behandelt Formen, die HTML über mehrere Tags verteilt
//                            (z. B. "Lehrer<span>:innen</span>").
//   normalizeElementAttributes / normalizeAllAttributes  Normalisiert title, alt, aria-label …
//   normalizeDocumentTitle / normalizeMetaTags           Seitentitel & <meta>-Tags.
//   normalizeJsonLd*         Strukturierte Daten (JSON-LD) im <script>.
//   normalizeSvgText         Text innerhalb von SVG-Grafiken.
//   normalizeShadowDom       Web-Component-Bereiche (Shadow DOM).
//
// ── OBSERVER (für dynamische Seiten) ───────────────────────────────────────
//   observeGenderedLanguage  Reagiert auf nachträglich eingefügten/geänderten Inhalt (SPAs).
//   observeHeadChanges       Beobachtet Titel/Meta im <head>.
//
(() => {
  "use strict";

  // ─────────────────────────────────────────────────────────────
  // 0. KONFIGURATION – aus browser.storage.local laden
  // ─────────────────────────────────────────────────────────────

  const VERSION    = "2.1.0";
  const CACHE_KEY  = "nogender_wikt_cache";

  const DEFAULT_CONFIG = {
    enabled: true,
    blockedDomains: [],
    participles: true,   // Partizip-Substantive (Studierende → Studenten) zurückbauen
  };

  let debugEnabled       = false;
  let wasActive          = false;
  let participlesEnabled = true;   // aus cfg.participles gesetzt; steuert den Partizip-Pass

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

  // Browser-APIs nur im Extension-Kontext ansprechen. Unter Node (Tests) fehlt
  // `browser`; die reinen Funktionen werden dann am Dateiende exportiert.
  const HAS_BROWSER = typeof browser !== "undefined" && !!browser.storage;

  if (HAS_BROWSER) {
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
      const newCfg = { ...DEFAULT_CONFIG, ...(changes.nogender_config.newValue ?? {}) };
      // Auch ein Umschalten des Partizip-Features erfordert einen Reload, damit der
      // Seitentext neu (bzw. im Original) gerendert wird.
      const participlesChanged = (newCfg.participles !== false) !== participlesEnabled;
      participlesEnabled = newCfg.participles !== false;
      const willBeActive = newCfg.enabled && !isBlockedDomain(newCfg);
      if (participlesChanged && willBeActive && wasActive) {
        location.reload();
        return;
      }
      // Reload bei Toggle in beide Richtungen (aktiv↔inaktiv), damit die Seite
      // beim Deaktivieren in den Original-Zustand zurückkehrt und beim
      // Aktivieren die Erweiterung überhaupt greift. Änderungen an anderen
      // Domains der Blockliste lösen keinen Reload aus.
      if (willBeActive !== wasActive) {
        location.reload();
      }
    });

    // Konfiguration laden, dann starten
    browser.storage.local.get("nogender_config").then(result => {
      const cfg = { ...DEFAULT_CONFIG, ...(result.nogender_config ?? {}) };
      participlesEnabled = cfg.participles !== false;

      if (!cfg.enabled || isBlockedDomain(cfg)) {
        debug("Deaktiviert oder geblockt:", location.hostname);
        return;
      }

      wasActive = true;
      init();
    }).catch(() => {
      // Fallback: starten ohne Config
      wasActive = true;
      init();
    });
  }

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

  let persistTimer = null;
  function schedulePersist() {
    if (persistTimer) clearTimeout(persistTimer);
    persistTimer = setTimeout(() => {
      persistTimer = null;
      persistWiktCache();
    }, 2000);
  }
  // Vor BFCache/Unload ausstehenden Persist flushen, damit nichts verloren geht.
  if (typeof window !== "undefined" && window.addEventListener) {
    window.addEventListener("pagehide", () => {
      if (persistTimer) { clearTimeout(persistTimer); persistTimer = null; }
      persistWiktCache();
    }, { capture: true });
  }

  // Dedupliziert parallele Fetches für dasselbe Lemma. Ohne das würden
  // zweitrangige Aufrufer den `null`-Sentinel des ersten Calls lesen und
  // die später eintreffenden Forms nicht verwenden.
  const wiktInFlight = new Map();

  async function fetchWiktionaryForms(lemma) {
    const key = lemma.toLowerCase();
    if (wiktCache.has(key)) return wiktCache.get(key);
    if (wiktInFlight.has(key)) return wiktInFlight.get(key);

    const promise = (async () => {
      try {
        const url =
          "https://de.wiktionary.org/w/api.php?action=query&prop=revisions" +
          "&rvprop=content&rvslots=main&format=json&origin=*&titles=" +
          encodeURIComponent(lemma);
        const resp = await fetch(url, { signal: AbortSignal.timeout(4000) });
        if (!resp.ok) { wiktCache.set(key, null); return null; }
        const data = await resp.json();
        const page = Object.values(data?.query?.pages ?? {})[0];
        if (!page || page.missing !== undefined) { wiktCache.set(key, null); return null; }
        const wikitext =
          page?.revisions?.[0]?.slots?.main?.["*"] ??
          page?.revisions?.[0]?.["*"] ?? "";
        const forms = parseWiktionaryFlexion(wikitext);
        wiktCache.set(key, forms);
        schedulePersist();
        return forms;
      } catch {
        wiktCache.set(key, null);
        return null;
      } finally {
        wiktInFlight.delete(key);
      }
    })();

    wiktInFlight.set(key, promise);
    return promise;
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
    // Umlaut-Plurale
    ["ärzt",            { sg:"Ärztin",             pl:"Ärzte"              }],
    ["anwält",          { sg:"Anwältin",           pl:"Anwälte"            }],
    ["koch",            { sg:"Koch",               pl:"Köche"              }],
    // -e/-en-Plurale (Stamm ≠ Singular oder irregulärer Plural)
    ["bauer",           { sg:"Bauer",              pl:"Bauern"             }],
    ["bäuer",           { sg:"Bäuerin",            pl:"Bauern"             }],
    ["köch",            { sg:"Köchin",             pl:"Köche"              }],
    ["nachbar",         { sg:"Nachbar",            pl:"Nachbarn"           }],
    ["kolleg",          { sg:"Kollege",            pl:"Kollegen"           }],
    ["sklav",           { sg:"Sklave",             pl:"Sklaven"            }],
    ["freund",          { sg:"Freund",             pl:"Freunde"            }],
    ["wirt",            { sg:"Wirt",               pl:"Wirte"              }],
    // -oge/-ogen
    ["pädagog",         { sg:"Pädagoge",           pl:"Pädagogen"          }],
    ["psycholog",       { sg:"Psychologe",         pl:"Psychologen"        }],
    ["soziolog",        { sg:"Soziologe",          pl:"Soziologen"         }],
    ["biolog",          { sg:"Biologe",            pl:"Biologen"           }],
    ["philolog",        { sg:"Philologe",          pl:"Philologen"         }],
    ["elementarpädagog",{ sg:"Elementarpädagoge",  pl:"Elementarpädagogen" }],
    // -ekt/-eten/-eut/-ot (schwache Deklination)
    ["architekt",       { sg:"Architekt",          pl:"Architekten"        }],
    ["athlet",          { sg:"Athlet",             pl:"Athleten"           }],
    ["therapeut",       { sg:"Therapeut",          pl:"Therapeuten"        }],
    ["pilot",           { sg:"Pilot",              pl:"Piloten"            }],
    // -at/-aten
    ["kandidat",        { sg:"Kandidat",           pl:"Kandidaten"         }],
    ["diplomat",        { sg:"Diplomat",            pl:"Diplomaten"         }],
    ["soldat",          { sg:"Soldat",             pl:"Soldaten"           }],
    ["demokrat",        { sg:"Demokrat",           pl:"Demokraten"         }],
    // -ant/-anten
    ["praktikant",      { sg:"Praktikant",         pl:"Praktikanten"       }],
    ["migrant",         { sg:"Migrant",            pl:"Migranten"          }],
    ["demonstrant",     { sg:"Demonstrant",        pl:"Demonstranten"      }],
    // -ent/-enten
    ["student",         { sg:"Student",            pl:"Studenten"          }],
    ["patient",         { sg:"Patient",            pl:"Patienten"          }],
    ["dozent",          { sg:"Dozent",             pl:"Dozenten"           }],
    ["absolvent",       { sg:"Absolvent",          pl:"Absolventen"        }],
    ["referent",        { sg:"Referent",           pl:"Referenten"         }],
    ["produzent",       { sg:"Produzent",          pl:"Produzenten"        }],
    // -ist/-isten
    ["aktivist",        { sg:"Aktivist",           pl:"Aktivisten"         }],
    ["journalist",      { sg:"Journalist",         pl:"Journalisten"       }],
    ["kommunist",       { sg:"Kommunist",          pl:"Kommunisten"        }],
    ["terrorist",       { sg:"Terrorist",          pl:"Terroristen"        }],
    ["jurist",          { sg:"Jurist",             pl:"Juristen"           }],
    ["polizist",        { sg:"Polizist",           pl:"Polizisten"         }],
    ["spezialist",      { sg:"Spezialist",         pl:"Spezialisten"       }],
    // -eur/-eure (toPlural versagt hier: würde -euren liefern)
    ["ingenieur",       { sg:"Ingenieur",          pl:"Ingenieure"         }],
    ["redakteur",       { sg:"Redakteur",          pl:"Redakteure"         }],
    ["friseur",         { sg:"Friseur",            pl:"Friseure"           }],
    ["monteur",         { sg:"Monteur",            pl:"Monteure"           }],
    // -or/-oren
    ["autor",           { sg:"Autor",              pl:"Autoren"            }],
    ["professor",       { sg:"Professor",          pl:"Professoren"        }],
    ["direktor",        { sg:"Direktor",           pl:"Direktoren"         }],
    ["moderator",       { sg:"Moderator",          pl:"Moderatoren"        }],
    ["administrator",   { sg:"Administrator",      pl:"Administratoren"    }],
    // -er/-er (gleicher Plural, häufig gegendert)
    ["pfleger",         { sg:"Pfleger",            pl:"Pfleger"            }],
    ["bürger",          { sg:"Bürger",             pl:"Bürger"             }],
    ["teilnehmer",      { sg:"Teilnehmer",         pl:"Teilnehmer"         }],
    ["mitarbeiter",     { sg:"Mitarbeiter",        pl:"Mitarbeiter"        }],
    ["politiker",       { sg:"Politiker",          pl:"Politiker"          }],
    ["lehrer",          { sg:"Lehrer",             pl:"Lehrer"             }],
    ["schüler",         { sg:"Schüler",            pl:"Schüler"            }],
    ["arbeiter",        { sg:"Arbeiter",           pl:"Arbeiter"           }],
    ["leser",           { sg:"Leser",              pl:"Leser"              }],
    ["richter",         { sg:"Richter",            pl:"Richter"            }],
    ["sprecher",        { sg:"Sprecher",           pl:"Sprecher"           }],
    ["nutzer",          { sg:"Nutzer",             pl:"Nutzer"             }],
    ["entwickler",      { sg:"Entwickler",         pl:"Entwickler"         }],
    ["forscher",        { sg:"Forscher",           pl:"Forscher"           }],
    ["unternehmer",     { sg:"Unternehmer",        pl:"Unternehmer"        }],
    ["wissenschaftler", { sg:"Wissenschaftler",    pl:"Wissenschaftler"    }],
    ["berater",         { sg:"Berater",            pl:"Berater"            }],
    ["fahrer",          { sg:"Fahrer",             pl:"Fahrer"             }],
    ["händler",         { sg:"Händler",            pl:"Händler"            }],
    ["künstler",        { sg:"Künstler",           pl:"Künstler"           }],
    ["musiker",         { sg:"Musiker",            pl:"Musiker"            }],
    ["trainer",         { sg:"Trainer",            pl:"Trainer"            }],
    ["bewohner",        { sg:"Bewohner",           pl:"Bewohner"           }],
    ["besucher",        { sg:"Besucher",           pl:"Besucher"           }],
    ["einwohner",       { sg:"Einwohner",          pl:"Einwohner"         }],
    ["eigentümer",      { sg:"Eigentümer",         pl:"Eigentümer"         }],
    ["verbraucher",     { sg:"Verbraucher",        pl:"Verbraucher"        }],
    ["gründer",         { sg:"Gründer",            pl:"Gründer"            }],
    // "Förder:innen" → Stamm "Förder"; das Maskulinum ist "Förderer" (Fem. "Förderin").
    ["förder",          { sg:"Förderer",           pl:"Förderer"           }],
    ["helfer",          { sg:"Helfer",             pl:"Helfer"             }],
    ["spieler",         { sg:"Spieler",            pl:"Spieler"            }],
    ["wähler",          { sg:"Wähler",             pl:"Wähler"             }],
    ["gegner",          { sg:"Gegner",             pl:"Gegner"             }],
    ["partner",         { sg:"Partner",            pl:"Partner"            }],
  ]);

  // ─────────────────────────────────────────────────────────────
  // 3. HILFSFUNKTIONEN
  // ─────────────────────────────────────────────────────────────

  const NON_TEXT_PARENTS = new Set([
    "SCRIPT","STYLE","NOSCRIPT","TEXTAREA","CODE","PRE","INPUT","SELECT",
  ]);

  const NORMALIZABLE_ATTRIBUTES = [
    "title","alt","placeholder","aria-label",
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

    // Das kuratierte LEXICON ist autoritativ und hat Vorrang vor Wiktionary:
    // Manche Gender-Stämme fallen mit einem anderen echten Wort zusammen (z. B.
    // "Kolleg" = das Kolleg), dessen Wiktionary-Formen sonst fälschlich gewönnen.
    const entry = LEXICON.get(lower);
    if (entry) return preserveCase(stem, isPlural ? entry.pl : entry.sg);

    if (wiktForms) {
      const form = isPlural
        ? (wiktForms.pl?.nom ?? wiktForms.sg?.nom)
        : wiktForms.sg?.nom;
      if (form) return preserveCase(stem, form);
    }

    // Regelbasierter Fallback
    return isPlural ? toPlural(stem) : stem;
  }

  function toPlural(stem) {
    if (/(er|el|en|chen|lein)$/i.test(stem)) return stem;
    if (/e$/i.test(stem)) return stem + "n";
    if (/[tdnrsl]$/i.test(stem)) return stem + "en";
    return stem;
  }

  // Dativ Plural: regelhaft ein -n an den Nominativ Plural, außer er endet schon
  // auf -n oder -s ("Lehrer"→"Lehrern", "Förderer"→"Förderern", "Frauen"→"Frauen",
  // "Autos"→"Autos"). Kein Wiktionary nötig.
  function toDativPlural(nominativPlural) {
    return /[ns]$/i.test(nominativPlural) ? nominativPlural : nominativPlural + "n";
  }

  // Feminine Nominativ-Determinative → Maskulinum (für die Singular-Artikel-Kongruenz,
  // z. B. "Die Kolleg:in" → "Der Kollege"). Im Nominativ Singular ändert sich die
  // Nomen-Endung nicht, daher genügt das Umschreiben des Determinativs.
  const FEM_TO_MASC_NOM = new Map([
    ["die","der"],["eine","ein"],["keine","kein"],["irgendeine","irgendein"],
    ["meine","mein"],["deine","dein"],["seine","sein"],["ihre","ihr"],
    ["unsere","unser"],["eure","euer"],
    ["diese","dieser"],["jene","jener"],["jede","jeder"],["welche","welcher"],
    ["manche","mancher"],["solche","solcher"],["jegliche","jeglicher"],["sämtliche","sämtlicher"],
  ]);

  // Wie FEM_TO_MASC_NOM, aber → Neutrum (für Pseudo-Feminina mit neutralem Grundwort,
  // z. B. "Die Mitgliedin" → "Das Mitglied"). Nur Nominativ Singular.
  const FEM_TO_NEUT_NOM = new Map([
    ["die","das"],["eine","ein"],["keine","kein"],["irgendeine","irgendein"],
    ["meine","mein"],["deine","dein"],["seine","sein"],["ihre","ihr"],
    ["unsere","unser"],["eure","euer"],
    ["diese","dieses"],["jene","jenes"],["jede","jedes"],["welche","welches"],
    ["manche","manches"],["solche","solches"],["jegliche","jegliches"],["sämtliche","sämtliches"],
  ]);

  // Pseudo-Feminina: künstliche -in-Ableitungen zu Grundwörtern, die GAR KEINE
  // männliche Personenbezeichnung sind (Gast, Vorstand, Mensch, Mitglied …). Solche
  // Formen ("Gästin", "Vorständin") existieren im Deutschen nicht – deshalb ist der
  // Rückbau praktisch falsch-treffer-frei und braucht keine Heuristik, nur diese
  // kuratierte Tabelle. Schlüssel = kleingeschriebene Singularform; der Plural wird
  // über das angehängte "nen" (Gästin → Gästinnen) im Muster erkannt. `g` = Genus des
  // Grundworts (m/n/f) für die Artikel-Kongruenz am Satzanfang.
  const PSEUDO_FEM = new Map([
    ["gästin",       { sg:"Gast",      pl:"Gäste",      g:"m" }],
    ["vorständin",   { sg:"Vorstand",  pl:"Vorstände",  g:"m" }],
    ["menschin",     { sg:"Mensch",    pl:"Menschen",   g:"m" }],
    ["mitgliedin",   { sg:"Mitglied",  pl:"Mitglieder", g:"n" }],
    ["mitgliederin", { sg:"Mitglied",  pl:"Mitglieder", g:"n" }],
    ["fachkräftin",  { sg:"Fachkraft", pl:"Fachkräfte", g:"f" }],
  ]);

  // Substantivierte Partizipien als Gender-Ersatz ("Studierende" statt "Studenten").
  // ALLOWLIST-ONLY: nur diese kuratierten Stämme werden umgewandelt; jedes andere
  // -nd-Wort bleibt unangetastet (so sind echte Partizip-Substantive wie "Reisende",
  // "Vorsitzende", "Auszubildende" automatisch sicher). Schlüssel = Partizip-Stamm OHNE
  // Adjektivendung ("studierend"); `m`/`f` = maskuline/feminine Nominativ-Singular-Form
  // (f=null, wenn es kein sauberes Femininum gibt, z. B. Flüchtling), `pl` = Plural.
  const PARTICIPLE = new Map([
    ["studierend",     { m:"Student",     f:"Studentin",     pl:"Studenten"     }],
    ["forschend",      { m:"Forscher",    f:"Forscherin",    pl:"Forscher"      }],
    ["lehrend",        { m:"Lehrer",      f:"Lehrerin",      pl:"Lehrer"        }],
    ["mitarbeitend",   { m:"Mitarbeiter", f:"Mitarbeiterin", pl:"Mitarbeiter"   }],
    ["teilnehmend",    { m:"Teilnehmer",  f:"Teilnehmerin",  pl:"Teilnehmer"    }],
    ["pflegend",       { m:"Pfleger",     f:"Pflegerin",     pl:"Pfleger"       }],
    ["lesend",         { m:"Leser",       f:"Leserin",       pl:"Leser"         }],
    ["nutzend",        { m:"Nutzer",      f:"Nutzerin",      pl:"Nutzer"        }],
    ["helfend",        { m:"Helfer",      f:"Helferin",      pl:"Helfer"        }],
    ["wählend",        { m:"Wähler",      f:"Wählerin",      pl:"Wähler"        }],
    ["zuschauend",     { m:"Zuschauer",     f:"Zuschauerin",     pl:"Zuschauer"     }],
    ["zuhörend",       { m:"Zuhörer",       f:"Zuhörerin",       pl:"Zuhörer"       }],
    ["demonstrierend", { m:"Demonstrant",   f:"Demonstrantin",   pl:"Demonstranten" }],
    ["promovierend",   { m:"Doktorand",     f:"Doktorandin",     pl:"Doktoranden"   }],
    ["konsumierend",   { m:"Konsument",     f:"Konsumentin",     pl:"Konsumenten"   }],
    ["antragstellend", { m:"Antragsteller", f:"Antragstellerin", pl:"Antragsteller" }],
    ["anwohnend",      { m:"Anwohner",      f:"Anwohnerin",      pl:"Anwohner"      }],
    ["pendelnd",       { m:"Pendler",       f:"Pendlerin",       pl:"Pendler"       }],
    ["flüchtend",      { m:"Flüchtling",    f:null,              pl:"Flüchtlinge"   }],
  ]);

  // Determinativ-Klassifikation für die adjektivische Deklination der Partizipien.
  // Numerus/Genus/Kasus lässt sich nur am vorangehenden Determinativ + der Endung
  // ablesen. Bewusst KONSERVATIV: nur Nominativ wird im Singular aufgelöst; oblique
  // Singularformen (dem/des/einem …) sind zu nomen-spezifisch (n-Deklination) und
  // bleiben unangetastet.
  const PART_FEM_SG  = new Set([  // + Endung -e  → feminines Nomen ("die Studierende")
    "die","eine","keine","diese","jede","welche","manche","solche","irgendeine",
    "jegliche","meine","deine","seine","ihre","unsere","eure",
  ]);
  const PART_MASC_SG = new Set([  // schwach (+ -e) bzw. stark (+ -er) → maskulines Nomen
    "der","dieser","jeder","welcher","mancher","solcher","jeglicher",
    "ein","kein","mein","dein","sein","unser","euer","irgendein",
  ]);
  const PART_SG_OBLIQUE = new Set([  // Dativ/Genitiv/Akk. Singular → unangetastet lassen
    "dem","des","einem","eines","keinem","keines","diesem","dieses","jedem","jedes",
    "meinem","meines","deinem","deines","seinem","seines","ihrem","ihres",
    "welchem","welches","manchem","solchem","jeglichem",
  ]);
  const PART_PLURAL = new Set([   // + -e/-en → Plural
    "die","alle","beide","viele","wenige","einige","etliche","mehrere","manche","solche",
    "keine","diese","jene","meine","deine","seine","ihre","unsere","eure","sämtliche",
    "den","denen","allen","beiden","vielen","wenigen","einigen","etlichen","mehreren",
    "manchen","solchen","keinen","diesen","jenen","meinen","deinen","seinen","ihren",
    "unseren","euren","sämtlichen","anderen",
  ]);
  // Funktionswörter (Präpositionen/Konjunktionen), nach denen ein artikelloser Plural
  // folgt ("für Studierende", "von Lehrenden", "Studierende und Lehrende").
  const PART_PLURAL_LEAD = new Set([
    "für","fuer","gegen","ohne","um","durch","wider","per","pro","bis",
    "mit","nach","bei","von","zu","aus","seit","ab","außer","ausser","gegenüber",
    "gegenueber","entgegen","gemäß","gemaess","nebst","samt","mitsamt","binnen",
    "und","oder","sowie","bzw","als","wie","sowohl","weder","noch",
  ]);

  // Eindeutig Dativ regierende Auslöser direkt vor einem Plural: unzweideutige
  // Dativ-Präpositionen sowie Dativ-Plural-Determinative (z. B. "den …:innen" –
  // der Akkusativ Plural wäre "die", also ist "den" + Plural eindeutig Dativ).
  // Wechselpräpositionen (in/an/auf …) fehlen bewusst – sie sind mehrdeutig.
  const DATIV_TRIGGERS = new Set([
    "nach","mit","bei","von","zu","aus","seit","ab","außer","ausser",
    "gegenüber","entgegen","gemäß","gemaess","nebst","samt","mitsamt","binnen",
    "den","denen","allen","vielen","beiden","diesen","jenen","manchen",
    "sämtlichen","saemtlichen","keinen","meinen","deinen","seinen","ihren",
    "unseren","euren","solchen","wenigen","mehreren","etlichen","einigen","anderen",
  ]);

  // Konservative Kasus-Heuristik: Steht direkt vor der gegenderten Plural-Form
  // (höchstens durch Artikel/Adjektive getrennt) ein eindeutiger Dativ-Auslöser?
  // Großgeschriebene Wörter (vermutlich Nomen) und nachgestellte Klausel-Satzzeichen
  // beenden die Suche, damit ein Auslöser vor einem ANDEREN Nomen nicht übergreift.
  function isDativContext(text, offset) {
    const words = text.slice(0, offset).split(/\s+/);
    for (let i = words.length - 1, seen = 0; i >= 0 && seen < 4; i--) {
      const raw = words[i];
      if (!raw) continue;
      const core = raw.toLowerCase().replace(/[^a-zäöüß]/g, "");
      if (!core) continue;                       // reines Satzzeichen-Token
      seen++;
      if (DATIV_TRIGGERS.has(core)) return true; // Auslöser (auch "(mit" → "mit")
      if (/[.,;:!?…]$/.test(raw)) return false;  // Klausel-Ende davor
      if (/^\p{Lu}/u.test(raw)) return false;    // Großschreibung → vermutlich Nomen
    }
    return false;
  }

  // Das für das Partizip maßgebliche Determinativ (kleingeschrieben). Sucht nach links
  // und überspringt dabei attributive Adjektive ("liebe", "junge"), damit Anreden wie
  // "Liebe Studierende" korrekt als Plural erkannt werden. Stoppt – analog zu
  // isDativContext – an Klausel-Satzzeichen und an großgeschriebenen Wörtern (vermutlich
  // Nomen), damit ein Determinativ NICHT über eine Phrasengrenze hinweg übergreift
  // ("Die Universität bildet Studierende aus" → "Die" gehört zu Universität, nicht zum
  // Partizip). Ein erkanntes Determinativ wird VOR dem Großschreibungs-Stopp geprüft,
  // damit großgeschriebene Determinative am Satzanfang ("Eine …") noch greifen.
  function leadDeterminer(text, offset) {
    const toks = text.slice(0, offset).split(/\s+/);
    for (let i = toks.length - 1, seen = 0; i >= 0 && seen < 4; i--) {
      const raw = toks[i];
      if (!raw) continue;
      const core = raw.toLowerCase().replace(/[^a-zäöüß]/g, "");
      if (!core) continue;
      seen++;
      if (PART_FEM_SG.has(core) || PART_MASC_SG.has(core) || PART_SG_OBLIQUE.has(core)
          || PART_PLURAL.has(core) || PART_PLURAL_LEAD.has(core)) return core;
      if (/[.,;:!?…]$/.test(raw)) return "";   // Klauselgrenze davor → artikellos
      if (/^\p{Lu}/u.test(raw)) return "";     // großgeschrieben → vermutlich Nomen davor
    }
    return "";
  }

  // Löst ein substantiviertes Partizip auf Basis von vorangehendem Determinativ (lead)
  // und Adjektivendung in die passende Nomenform auf. Gibt null zurück, wenn die
  // Konstellation mehrdeutig/außerhalb des Scopes ist (→ Original bleibt stehen).
  // Konservativ: Singular nur im Nominativ; oblique Singularformen bleiben unangetastet.
  function resolveParticiple(lead, ending, prefix, entry, off, str) {
    const attach = form => (prefix ? prefix + form[0].toLowerCase() + form.slice(1) : form);
    const plural = () =>
      attach(isDativContext(str, off) ? toDativPlural(entry.pl) : entry.pl);

    if (PART_SG_OBLIQUE.has(lead)) return null;          // dem/des/einem … → unangetastet

    if (ending === "er") {                               // starkes Mask. Nom. Sg. ("ein …er")
      if (lead === "" || PART_MASC_SG.has(lead)) return attach(entry.m);
      return null;
    }
    if (ending === "e") {
      if (PART_FEM_SG.has(lead))  return entry.f ? attach(entry.f) : null;  // "die Studierende"
      if (PART_MASC_SG.has(lead)) return attach(entry.m);                   // "der Studierende"
      if (lead === "" || PART_PLURAL.has(lead) || PART_PLURAL_LEAD.has(lead)) return plural();
      return null;
    }
    if (ending === "en") {                               // fast immer Plural ("die Studierenden")
      if (lead === "" || PART_PLURAL.has(lead) || PART_PLURAL_LEAD.has(lead)) return plural();
      return null;
    }
    return null;                                         // -em/-es → unangetastet
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

  function isLikelyPersonStem(stem) {
    const lower = stem.toLowerCase();
    if (LEXICON.has(lower)) return true;
    if (splitCompound(stem)) return true;
    if (getWikt(stem)) return true;
    return false;
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
  // Lookahead schließt neben Buchstaben auch `/` und `_` aus, damit URLs wie
  // "foo.de/in/impressum" und Slugs wie "foo_in_bar" nicht fälschlich als
  // Gendering gewertet werden. Marker-Set selbst bleibt unverändert.
  const reInnenWithMarker       = new RegExp(STEM + "\\s*(?:\\(|\\[)?" + MARKER + "\\s?(?:-)?innen(?:\\)|\\])?(?![\\p{L}\\/_])", "giu");
  const reInWithMarker          = new RegExp(STEM + "\\s*(?:\\(|\\[)?" + MARKER + "\\s?(?:-)?in(?:\\)|\\])?(?![\\p{L}\\/_])",    "giu");
  const reInnenParen            = new RegExp(STEM + "\\s*\\(innen\\)", "giu");
  const reInParen               = new RegExp(STEM + "\\s*\\(in\\)",    "giu");
  // Binnen-I ("LehrerInnen" → "Lehrer", "BürgerIn" → "Bürger"). Der Stamm darf
  // beliebig anfangen (auch großgeschrieben – das ist der Normalfall bei deutschen
  // Substantiven). Statt `\b` (ASCII-basiert, scheitert an Umlauten am Wortrand)
  // begrenzen Unicode-Lookbehind/Lookahead auf echte Wortgrenzen. Das große "I"
  // in "Innen"/"In" bleibt das case-sensitive Erkennungssignal; deshalb KEIN
  // `i`-Flag. Die Auflösung ist zusätzlich durch isLikelyPersonStem abgesichert.
  const reBinnenIPlural         = new RegExp("(?<![\\p{L}])(\\p{L}[\\p{L}]*)Innen(?![\\p{L}\\/_])", "gu");
  const reBinnenISingular       = new RegExp("(?<![\\p{L}])(\\p{L}[\\p{L}]*)In(?![\\p{L}\\/_])",    "gu");
  const reInSlashInnen          = new RegExp(STEM + "In/Innen\\b", "gi");
  // `(?!\/)` verhindert False-Positives in URLs/Pfaden wie "path/n/foo".
  // Bei `_` greift bereits die Wortgrenze `\b` (weil `_` in `\w` enthalten ist).
  const reAdjNWithMarker        = new RegExp("(\\b[\\p{L}]{2,})\\s*" + MARKER + "\\s*n\\b(?!\\/)", "gu");
  const reAdjEWithMarker        = new RegExp("(\\b[\\p{L}]{2,})\\s*" + MARKER + "\\s*e\\b(?!\\/)", "gu");
  const reAdjRWithMarker        = new RegExp("(\\b[\\p{L}]{2,})\\s*" + MARKER + "\\s*r\\b(?!\\/)", "gu");
  // Dativ-Maskulinum: "jeder:m" → "jedem", "dieser:m" → "diesem", "der:m" → "dem".
  // Anders als die :r/:n/:e-Muster wird hier nicht angehängt, sondern die
  // Endung -er durch -em ersetzt (sonst käme "jederm" raus). Stamm-Minimum
  // ist bewusst 1 Buchstabe, damit auch "der:m" greift.
  const reAdjErMWithMarker      = new RegExp("(\\b[\\p{L}]+)er\\s*" + MARKER + "\\s*m\\b(?!\\/)", "gu");
  const reInnenCompound         = new RegExp(STEM + "\\s*(?:\\(|\\[)?" + MARKER + "\\s?(?:-)?innen([\\p{Ll}][\\p{L}]*)", "giu");
  const reStandaloneInMarker    = new RegExp("^\\s*(?:\\(|\\[)?" + MARKER + "\\s*(?:-)?\\s*in(?:\\)|\\])?\\s*$",    "iu");
  const reStandaloneInnenMarker = new RegExp("^\\s*(?:\\(|\\[)?" + MARKER + "\\s*(?:-)?\\s*innen(?:\\)|\\])?\\s*$", "iu");
  // Indefinitpronomen-Reversion: "mensch"/"frau" als entgendertes Ersatzwort
  // für "man" (z. B. "könnte mensch sagen") werden zu "man" zurückgeführt.
  // BEWUSST case-sensitiv und nur kleingeschrieben: Das großgeschriebene
  // Substantiv "Mensch"/"Frau" sowie "Menschen"/"Frauen" bleiben unangetastet.
  // Satzanfänge (großgeschrieben) werden nicht erfasst, um den Substantiv-
  // Sinn nicht zu zerstören.
  const reIndefinitePronoun     = /\b(?:mensch|frau)\b/g;
  // Pseudo-Feminina (kein Marker): "Gästin"/"Gästinnen" – auch als Kompositum-KOPF
  // ("Stammgästin" → "Stammgast", "Pflegefachkräftin" → "Pflegefachkraft"). Da kein
  // echtes deutsches Wort auf "…gästin", "…mitgliedin" usw. endet, ist der optionale
  // Präfix (`\p{L}*?`, kürzestmöglich) falsch-treffer-frei. Längere Schlüssel zuerst.
  // Das optionale "nen" markiert den Plural. Der Lookahead `(?![\p{L}])` verlangt das
  // Pseudo-Femininum am Wortende – ein Vorkommen MITTEN im Wort ("Stammgästinraum",
  // "raum" folgt) bleibt damit bewusst unangetastet. Unicode-Wortgrenzen (umlautfest).
  const PSEUDO_FEM_ALT = [...PSEUDO_FEM.keys()].sort((a, b) => b.length - a.length).join("|");
  const rePseudoFem = new RegExp(
    "(?<![\\p{L}])(\\p{L}*?)(" + PSEUDO_FEM_ALT + ")(nen)?(?![\\p{L}])",
    "giu"
  );
  // Artikel-Kongruenz für Pseudo-Feminina im Singular, analog zu reArtSingularNom:
  // großgeschriebenes feminines Determinativ direkt vor einem Pseudo-Femininum
  // ("Die Vorständin" → "Der Vorstand", "Die Vereinsvorständin" → "Der Vereinsvorstand").
  // Schreibt nur das Determinativ um; das Wort selbst bleibt für rePseudoFem stehen.
  // `(?![\p{L}])` schließt den Plural (…innen) aus.
  const rePseudoFemArt = new RegExp(
    "\\b(" + [...FEM_TO_MASC_NOM.keys()].sort((a, b) => b.length - a.length).join("|") +
    ")(\\s+)(\\p{L}*?)(" + PSEUDO_FEM_ALT + ")(?![\\p{L}])",
    "giu"
  );
  // Substantivierte Partizipien: optionaler Präfix (Kompositum, "Lehramts-studierende"),
  // Partizip-Stamm aus der Allowlist, Adjektivendung. "en" vor "e", damit "studierenden"
  // korrekt als Stamm+"en" greift. Der Lookahead `(?![\p{L}])` verlangt das Wortende
  // (so bleibt "Studierendenwerk" o. Ä. unangetastet). Die Groß-/Kleinschreibung
  // (Substantiv vs. attributives Adjektiv) prüft erst der Callback.
  const PART_ALT = [...PARTICIPLE.keys()].sort((a, b) => b.length - a.length).join("|");
  const reParticiple = new RegExp(
    "(?<![\\p{L}])(\\p{L}*?)(" + PART_ALT + ")(en|e|er|em|es)(?![\\p{L}])",
    "giu"
  );
  // Singular-Artikel-Kongruenz: großgeschriebenes feminines Determinativ direkt vor
  // einer gegenderten Singularform ("Die Kolleg:in"). Die Großschreibung dient als
  // Signal für einen Nominativ-Satzanfang; kleingeschrieben mitten im Satz ist
  // "die"/"eine" mehrdeutig (Nom./Akk.) und wird NICHT angetastet.
  const reArtSingularNom = new RegExp(
    "\\b(" + [...FEM_TO_MASC_NOM.keys()].join("|") + ")(\\s+)([\\p{L}]{2,})\\s*(?:\\(|\\[)?" +
    MARKER + "\\s?(?:-)?in(?:\\)|\\])?(?![\\p{L}\\/_])",
    "giu"
  );

  const FALSE_POSITIVES = new Set([
    "heroin","heroine","protein","platine","marine","maschine","routine",
    "medizin","vitamin","kantine","benzin","origin","satin","burin",
    "cousin","raisin","sequin","goblin","penguin","kabine","disziplin",
  ]);

  // Vorfilter für normalizeGenderedText. Wird NUR für test() genutzt –
  // eventuelle False-Positives hier sind harmlos, weil die echten Patterns
  // danach laufen und nichts finden. Das `i`-Flag liefert die Case-Insensitivität,
  // die die markerbehafteten Patterns (ursprünglich `giu`) erwarten; es darf hier
  // NICHT entfernt werden. Auf die case-sensitiven reBinnenI*-Muster wirkt das
  // `i` im Vorfilter zwar lockernd, das ist aber unschädlich (s. o.).
  const reAnyGenderPattern = new RegExp(
    [
      reGenderInfo.source,
      reAdjNWithMarker.source,
      reAdjEWithMarker.source,
      reAdjRWithMarker.source,
      reAdjErMWithMarker.source,
      reIndefinitePronoun.source,
      rePseudoFem.source,
      reParticiple.source,
      reInSlashInnen.source,
      reBinnenIPlural.source,
      reBinnenISingular.source,
      reInnenCompound.source,
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
      const resolved = resolveForm(compound.stem, isPlural, getWikt(compound.stem));
      // Der Stamm steht als zweiter Kompositateil mitten im Wort und muss
      // kleingeschrieben werden – sonst entstünde "BeNutzer", "SozialArbeiter".
      const joined = resolved
        ? resolved[0].toLowerCase() + resolved.slice(1)
        : resolved;
      return compound.prefix + joined;
    }
    return resolveForm(stem, isPlural, getWikt(stem));
  }

  function normalizeGenderedText(text, participles = participlesEnabled) {
    if (!text) return text;
    let out = text.replace(/[\u00AD\u200B\u200C\u200D]/g, "");
    reAnyGenderPattern.lastIndex = 0;
    if (!reAnyGenderPattern.test(out)) return out;

    const R = (re, fn) => { re.lastIndex = 0; out = out.replace(re, fn); };

    // Plural-Form auflösen und – falls der Satzkontext eindeutig Dativ verlangt –
    // in den Dativ Plural setzen. `str`/`off` kommen aus dem replace-Callback.
    const plural = (stem, off, str) =>
      isDativContext(str, off) ? toDativPlural(replaceStem(stem, true)) : replaceStem(stem, true);

    R(reGenderInfo,      ()            => "");
    R(reIndefinitePronoun, ()          => "man");
    // Artikel-Kongruenz VOR dem Wort-Rückbau, damit das Pseudo-Femininum hier noch steht.
    // Nur großgeschriebenes Determinativ (eindeutiger Nominativ-Satzanfang); kleingeschrieben
    // mitten im Satz ist "die"/"eine" mehrdeutig und bleibt unangetastet. Feminine Grundwörter
    // (Fachkraft) behalten ihren Artikel.
    R(rePseudoFemArt, (m, det, ws, prefix, word) => {
      if (det[0] === det[0].toLowerCase()) return m;       // nur großgeschrieben
      const entry = PSEUDO_FEM.get(word.toLowerCase());
      if (!entry || entry.g === "f") return m;
      const map = entry.g === "n" ? FEM_TO_NEUT_NOM : FEM_TO_MASC_NOM;
      const adj = map.get(det.toLowerCase());
      return adj ? preserveCase(det, adj) + ws + prefix + word : m;
    });
    // Pseudo-Feminina zurückbauen: "Gästin"→"Gast", "Gästinnen"→"Gäste",
    // als Kompositum-Kopf "Stammgästin"→"Stammgast" (Präfix behält Schreibung,
    // Grundwort klein). Dativ Plural beachten: "mit den Gästinnen"→"mit den Gästen".
    R(rePseudoFem, (m, prefix, word, nen, off, str) => {
      const entry = PSEUDO_FEM.get(word.toLowerCase());
      if (!entry) return m;
      let form = nen ? entry.pl : entry.sg;
      if (nen && isDativContext(str, off)) form = toDativPlural(form);
      return prefix
        ? prefix + form[0].toLowerCase() + form.slice(1)
        : preserveCase(word, form);
    });
    R(reAdjNWithMarker,  (_, stem)     => stem + "n");
    R(reAdjEWithMarker,  (_, stem)     => stem);
    R(reAdjRWithMarker,  (_, stem)     => stem + "r");
    R(reAdjErMWithMarker,(_, stem)     => stem + "em");
    R(reInSlashInnen,    (_, stem, off, str) => plural(stem, off, str));
    R(reBinnenIPlural,   (m, stem, off, str) => isLikelyPersonStem(stem) ? plural(stem, off, str) : m);
    R(reBinnenISingular, (m, stem)     => isLikelyPersonStem(stem) ? replaceStem(stem, false) : m);
    R(reInnenCompound,   (m, stem, suffix) => {
      if (!isLikelyPersonStem(stem)) return m;
      return replaceStem(stem, true) + suffix;
    });
    R(reInnenWithMarker, (_, stem, off, str) => plural(stem, off, str));
    // Artikel-Kongruenz VOR reInWithMarker, damit das "…:in" hier noch vorhanden ist.
    R(reArtSingularNom, (m, det, ws, stem) => {
      if (det[0] === det[0].toLowerCase()) return m;   // nur großgeschrieben (Satzanfang)
      if (!isLikelyPersonStem(stem)) return m;
      const noun = replaceStem(stem, false);
      if (/in$/i.test(noun)) return m;                 // aufgelöst feminin (Ärztin) → Artikel feminin lassen
      const masc = FEM_TO_MASC_NOM.get(det.toLowerCase());
      return masc ? preserveCase(det, masc) + ws + noun : m;
    });
    R(reInWithMarker,    (_, stem)     => replaceStem(stem, false));
    R(reInnenParen,      (_, stem, off, str) => plural(stem, off, str));
    R(reInParen,         (_, stem)     => replaceStem(stem, false));

    // Substantivierte Partizipien (optional zuschaltbar). Nur großgeschrieben =
    // Substantiv ("die Studierenden"); kleingeschrieben ist es ein attributives
    // Adjektiv ("studierende Jugend") und bleibt unangetastet.
    if (participles) {
      R(reParticiple, (m, prefix, word, ending, off, str) => {
        const first = (prefix || word)[0];
        if (first.toLowerCase() === first && first.toUpperCase() !== first) return m; // klein → Adjektiv
        const entry = PARTICIPLE.get(word.toLowerCase());
        if (!entry) return m;
        const lead = leadDeterminer(str, off);
        const resolved = resolveParticiple(lead, ending.toLowerCase(), prefix, entry, off, str);
        return resolved == null ? m : preserveCase(prefix || word, resolved);
      });
    }

    return out;
  }

  async function normalizeGenderedTextAsync(text) {
    if (!text) return text;
    let tmp = text.replace(/[\u00AD\u200B\u200C\u200D]/g, "");
    reAnyGenderPattern.lastIndex = 0;
    if (!reAnyGenderPattern.test(tmp)) return text;

    const stems = new Set();
    const collect = (_, stem) => { if (stem) stems.add(stem.toLowerCase()); return _; };
    [reInnenCompound, reInnenWithMarker, reInWithMarker, reInnenParen, reInParen,
     reBinnenIPlural, reBinnenISingular, reInSlashInnen].forEach(re => {
      re.lastIndex = 0;
      tmp.replace(re, collect);
      re.lastIndex = 0;
    });

    await Promise.all([...stems].filter(Boolean).map(async s => {
      if (wiktCache.has(s)) return;
      // Kuratierte LEXICON-Stämme nicht abfragen: spart Requests und verhindert,
      // dass ein gleichlautendes Fremdwort (z. B. "Kolleg") in den Cache gerät.
      if (LEXICON.has(s)) return;
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
        if (debugEnabled) {
          debug("✓", JSON.stringify(original.trim()), "→", JSON.stringify(replaced.trim()));
        }
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
            !isEditableNode(m.target)) {
          if (processed.has(m.target)) {
            // Text wurde extern geändert (z.B. React-Hydration) –
            // erneut prüfen ob Gendering vorhanden
            reAnyGenderPattern.lastIndex = 0;
            if (reAnyGenderPattern.test(m.target.nodeValue || "")) {
              processed.delete(m.target);
              pendingText.add(m.target);
            }
          } else {
            pendingText.add(m.target);
          }
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
    debug("NoGender v" + VERSION + " aktiv auf:", location.hostname);
  }

  // Reine Funktionen für die Testsuite exportieren (nur unter Node/CommonJS;
  // im Browser-Content-Script ist `module` undefiniert und dieser Block inaktiv).
  if (typeof module !== "undefined" && module.exports) {
    module.exports = {
      VERSION,
      LEXICON,
      PSEUDO_FEM,
      PARTICIPLE,
      FALSE_POSITIVES,
      reAnyGenderPattern,
      preserveCase,
      toPlural,
      splitCompound,
      resolveForm,
      replaceStem,
      normalizeGenderedText,
    };
  }

})();
