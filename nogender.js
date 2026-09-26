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
//   start / stop       Schaltet die Verarbeitung ein bzw. trennt alle Observer.
//   init               Verarbeitet die Seite und startet die Observer.
//
// ── WIKTIONARY (Nachschlagewerk für seltene Wörter) ────────────────────────
//   fetchWiktionaryForms   Lädt Beugungsformen eines Worts von de.wiktionary.org
//                          (gedrosselt, ohne Cookies und Referer).
//   parseWiktionaryFlexion Extrahiert Singular/Plural und das Personen-Signal aus dem Wikitext.
//   loadWiktFromStore /    Cache in browser.storage.local (ein Schlüssel je Wort, 30 Tage);
//     saveWiktLater          für Webseiten unsichtbar, über Tabs und Sitzungen hinweg gültig.
//   getWikt                Liest aus dem Cache (ohne Netzwerkzugriff).
//   collectLookupStems /   Sammelt Stämme, die sich nicht lokal auflösen lassen, und lädt
//     prefetchLookups        sie gebündelt vor der Verarbeitung eines Textblocks.
//
// ── WÖRTERBUCH & FORMEN (Auflösung in natürliche Formen) ───────────────────
//   LEXICON            Kuratierte, autoritative Liste häufiger/unregelmäßiger Personenwörter.
//   PSEUDO_FEM         Kuratierte Pseudo-Feminina ("Menschin", "Mitgliedin") → echtes Grundwort.
//   PARTICIPLE         Kuratierte Partizip-Substantive ("Studierende") → echtes Nomen (Allowlist).
//   resolveParticiple  Bestimmt Numerus/Genus aus Determinativ + Endung (konservativ, nur Nominativ-Sg.).
//   resolveForm        Wählt die Form: erst LEXICON, dann Wiktionary, dann regelbasiert.
//   toPlural /         Regelbasierte Plural-/Singularbildung als Fallback.
//     toSingular
//   toDativPlural      Bildet den Dativ Plural ("Lehrer" → "Lehrern").
//   preserveCase       Überträgt die Groß-/Kleinschreibung des Originals auf das Ergebnis.
//   splitCompound      Zerlegt Komposita ("Sozialarbeiter" → "Sozial" + "arbeiter").
//   isLikelyPersonStem Prüft, ob ein Stamm eine Personenbezeichnung ist (schützt vor Fehlgriffen).
//   replaceStem        Setzt Stamm und aufgelöste Form zusammen.
//   isDativContext     Prüft den linken Kontext auf eindeutige Dativ-Auslöser ("mit"/"nach"/"den" …).
//   isMascContext      Prüft, ob ein maskulines/gegendertes Determinativ vor einer Singularform steht.
//
// ── ERKENNUNGS-MUSTER (Regex) ──────────────────────────────────────────────
//   MARKER / STEM      Bausteine: Trennzeichen ( : * · _ / … ) und Wortstamm.
//   reInnenWithMarker  Plural mit Marker: "Lehrer:innen", "Lehrer*innen"  → Stamm + Zeichen + "innen".
//   reInWithMarker     Singular mit Marker: "Ärzt:in"                      → Stamm + Zeichen + "in".
//   markerFormKind     Bewertet Leerzeichen/großes "I" an einer Marker-Form ("Termin: in Kürze"
//                      ist normales Deutsch, "Lehrer:innen" eindeutig Gendering).
//   reInnenParen /     Klammerform: "Lehrer(innen)" / "Bürger(in)".
//     reInParen
//   reBinnenIPlural /  Binnen-I (großes I mitten im Wort): "LehrerInnen" / "BürgerIn".
//     reBinnenISingular
//   reInSlashInnen     Slash-Form: "LehrerIn/Innen".
//   reInnenCompound    Gegendertes Kompositum: "Lehrer:innenzimmer" → "Lehrerzimmer".
//   reArticlePair      Artikel-/Pronomenpaare: "der*die" → "der", "sie/er" → "er".
//   reAdjNWithMarker / Adjektiv-/Pronomenendungen: "eine:n"→"einen", "ein:e"→"ein",
//     reAdjEWithMarker   "jede:r"→"jeder".
//     reAdjRWithMarker
//   reAdjErMWithMarker Dativ-Maskulinum: "jeder:m" → "jedem".
//   reGenderInfo       Stellenanzeigen-Kürzel "(m/w/d)" → wird entfernt.
//   reIndefinitePronoun "mensch"/"frau" als Ersatz für "man" → "man".
//   rePseudoFem        Pseudo-Feminina ohne Marker: "Mitgliedin(nen)" → "Mitglied"/"Mitglieder".
//   rePseudoFemArt     Artikel-Kongruenz davor: "Die Mitgliedin" → "Das Mitglied".
//   reParticiple       Substantivierte Partizipien: "Studierende" → "Studenten" (Allowlist).
//   reArtSingularNom   Artikel-Kongruenz am Satzanfang: "Die Kolleg:in" → "Der Kollege".
//   reStandalone*Marker Ein Marker, der allein in einem Textknoten steht (für über
//                      mehrere HTML-Tags verteilte Formen).
//   hasGenderCandidate Vorfilter: billige notwendige Bedingungen aller Muster (vermeidet unnötige Arbeit).
//
// ── KERN-UMWANDLUNG ────────────────────────────────────────────────────────
//   normalizeGenderedText Vorfilter + applyPatterns (synchron, ohne Netz).
//   applyPatterns         Wendet alle Muster nacheinander auf einen Text an.
//
// ── DOM-VERARBEITUNG ───────────────────────────────────────────────────────
//   isEditableNode /         Schließen Eingabefelder (input/textarea/contenteditable) und
//     acceptTextNode           Code (pre/code/kbd/samp, auch verschachtelt) aus.
//   processBatch /           Verarbeitet die sichtbaren Textknoten blockweise.
//     replaceGenderedLanguageInDOM
//   normalizeSplitMarkers*   Behandelt Formen, die HTML über mehrere Tags verteilt
//                            (z. B. "Lehrer<span>:innen</span>").
//   normalizeElementAttributes / normalizeAllAttributes  Normalisiert title, alt, aria-label …
//   normalizeDocumentTitle / normalizeMetaTags           Seitentitel & <meta>-Tags.
//   normalizeJsonLd*         Strukturierte Daten (JSON-LD) im <script>.
//   normalizeSvgText         Text innerhalb von SVG-Grafiken.
//   normalizeShadowDom       Web-Component-Bereiche (Shadow DOM), inkl. Observer.
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

  const DEFAULT_CONFIG = {
    enabled: true,
    blockedDomains: [],
    participles: true,   // Partizip-Substantive (Studierende → Studenten) zurückbauen
    wiktionary: true,    // unbekannte Wörter bei de.wiktionary.org nachschlagen
  };

  let debugEnabled       = false;
  let active             = false;  // verarbeitet dieses Dokument gerade Text?
  let participlesEnabled = true;   // aus cfg.participles gesetzt; steuert den Partizip-Pass
  let wiktionaryEnabled  = true;   // aus cfg.wiktionary gesetzt; steuert den Online-Lookup

  // Browser-APIs nur im Extension-Kontext ansprechen. Unter Node (Tests) fehlt
  // `browser`; die reinen Funktionen werden dann am Dateiende exportiert.
  const HAS_BROWSER = typeof browser !== "undefined" && !!browser.storage;

  // Einzige Versionsquelle ist das Manifest (Popup und Debug-Log lesen es aus).
  const VERSION = HAS_BROWSER && browser.runtime?.getManifest
    ? browser.runtime.getManifest().version
    : "dev";

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

  // Statusmeldungen im Debug-Log nur für die eigentliche Seite, nicht für jeden
  // (Werbe-)iframe – Ersetzungen ("✓ …") werden weiterhin in allen Frames protokolliert.
  const IS_TOP_FRAME = typeof window !== "undefined" && window === window.top;

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
      wiktionaryEnabled = newCfg.wiktionary !== false;   // wirkt sofort, ohne Reload
      const participlesChanged = (newCfg.participles !== false) !== participlesEnabled;
      participlesEnabled = newCfg.participles !== false;
      const willBeActive = newCfg.enabled && !isBlockedDomain(newCfg);

      // Einschalten braucht keinen Reload – die Seite wird direkt verarbeitet.
      if (willBeActive && !active) {
        start();
        return;
      }
      // Ausschalten: sofort nichts mehr verändern. Nur SICHTBARE Seiten neu laden, damit
      // der Originaltext zurückkehrt. Hintergrund-Tabs werden nicht ungefragt neu geladen
      // (sie könnten ungespeicherte Eingaben enthalten); dort gilt das beim nächsten Laden.
      if (!willBeActive && active) {
        stop();
        if (!document.hidden) location.reload();
        return;
      }
      // Umschalten des Partizip-Features: sichtbare Seite neu (bzw. im Original) rendern.
      if (participlesChanged && active && !document.hidden) {
        location.reload();
      }
    });

    // Konfiguration laden, dann starten
    browser.storage.local.get("nogender_config").then(result => {
      const cfg = { ...DEFAULT_CONFIG, ...(result.nogender_config ?? {}) };
      participlesEnabled = cfg.participles !== false;
      wiktionaryEnabled  = cfg.wiktionary !== false;

      if (!cfg.enabled || isBlockedDomain(cfg)) {
        if (IS_TOP_FRAME) debug("Deaktiviert oder geblockt:", location.hostname);
        return;
      }

      start();
    }).catch(() => {
      // Fallback: starten ohne Config
      start();
    });
  }

  // ─────────────────────────────────────────────────────────────
  // 1. WIKTIONARY-LOOKUP & CACHE
  // ─────────────────────────────────────────────────────────────

  // Zwei Cache-Ebenen: `wiktCache` im Speicher (pro Seite) und browser.storage.local
  // mit einem Schlüssel je Wort. Einzelne Schlüssel statt einer großen Map, weil
  // storage.onChanged jede Änderung an alle Tabs verteilt – so bleibt das billig.
  const WIKT_PREFIX      = "nogender_wikt:";
  const WIKT_TTL_MS      = 30 * 24 * 60 * 60 * 1000;
  const WIKT_PARALLEL    = 2;           // API-Etikette: nur wenige gleichzeitige Anfragen
  const WIKT_COOLDOWN_MS = 60 * 1000;   // Pause nach Drosselung (HTTP 429) oder Serverfehler

  const wiktCache    = new Map();   // Stamm (klein) → Formen | null (= definitiv unbekannt)
  const wiktInFlight = new Map();   // dedupliziert parallele Anfragen für dasselbe Wort
  const wiktQueue    = [];
  const wiktUnsaved  = {};
  let wiktRunning     = 0;
  let wiktPausedUntil = 0;
  let wiktSaveTimer   = null;

  function flushWiktSaves() {
    if (wiktSaveTimer) { clearTimeout(wiktSaveTimer); wiktSaveTimer = null; }
    const batch = { ...wiktUnsaved };
    for (const k in wiktUnsaved) delete wiktUnsaved[k];
    if (Object.keys(batch).length) browser.storage.local.set(batch).catch(() => {});
  }

  // Neue Einträge gebündelt schreiben (ein storage-Aufruf pro Sekunde statt pro Wort).
  function saveWiktLater(key, forms) {
    if (!HAS_BROWSER) return;
    wiktUnsaved[WIKT_PREFIX + key] = { f: forms, t: Date.now() };
    if (!wiktSaveTimer) wiktSaveTimer = setTimeout(flushWiktSaves, 1000);
  }
  if (HAS_BROWSER && typeof window !== "undefined") {
    window.addEventListener("pagehide", flushWiktSaves, { capture: true });
  }

  async function loadWiktFromStore(keys) {
    const missing = keys.filter(k => !wiktCache.has(k));
    if (!HAS_BROWSER || !missing.length) return;
    try {
      const stored = await browser.storage.local.get(missing.map(k => WIKT_PREFIX + k));
      const now = Date.now();
      for (const k of missing) {
        const entry = stored[WIKT_PREFIX + k];
        if (entry && now - entry.t < WIKT_TTL_MS && !wiktCache.has(k)) {
          wiktCache.set(k, entry.f ?? null);
        }
      }
    } catch {}
  }

  // Einfache Warteschlange: höchstens WIKT_PARALLEL Anfragen gleichzeitig.
  function withWiktSlot(task) {
    return new Promise((resolve, reject) => {
      const run = () => {
        wiktRunning++;
        task().then(resolve, reject).finally(() => {
          wiktRunning--;
          const next = wiktQueue.shift();
          if (next) next();
        });
      };
      if (wiktRunning < WIKT_PARALLEL) run(); else wiktQueue.push(run);
    });
  }

  async function fetchWiktionaryForms(lemma) {
    const key = lemma.toLowerCase();
    if (wiktCache.has(key)) return wiktCache.get(key);
    if (wiktInFlight.has(key)) return wiktInFlight.get(key);

    const promise = withWiktSlot(async () => {
      if (wiktCache.has(key)) return wiktCache.get(key);   // während des Wartens geladen
      // Gedrosselt oder offline: jetzt nicht fragen und NICHT als "unbekannt" merken –
      // ein späterer Textknoten versucht es nach der Pause erneut.
      if (Date.now() < wiktPausedUntil) return null;
      const url =
        "https://de.wiktionary.org/w/api.php?action=query&prop=revisions" +
        "&rvprop=content&rvslots=main&format=json&formatversion=2&origin=*" +
        "&maxage=86400&smaxage=86400&titles=" +
        encodeURIComponent(key[0].toUpperCase() + key.slice(1));
      try {
        // Ohne Cookies und ohne Referer: Wiktionary erfährt nur das Wort, nicht die Seite.
        const resp = await fetch(url, {
          signal: AbortSignal.timeout(4000),
          credentials: "omit",
          referrerPolicy: "no-referrer",
        });
        if (!resp.ok) {
          wiktPausedUntil = Date.now() + WIKT_COOLDOWN_MS;
          return null;
        }
        const data = await resp.json();
        const page = data?.query?.pages?.[0];
        const forms = !page || page.missing || page.invalid
          ? null
          : parseWiktionaryFlexion(page.revisions?.[0]?.slots?.main?.content ?? "");
        wiktCache.set(key, forms);
        saveWiktLater(key, forms);
        return forms;
      } catch {
        wiktPausedUntil = Date.now() + WIKT_COOLDOWN_MS / 4;   // Netzfehler/Timeout
        return null;
      }
    }).finally(() => wiktInFlight.delete(key));

    wiktInFlight.set(key, promise);
    return promise;
  }

  // de.wiktionary gliedert nach "== Wort ({{Sprache|Deutsch}}) ==", ein Abschnitt je
  // Eintrag. Eine Seite kann mehrere deutsche Einträge haben ("Leiter" m = Person,
  // "Leiter" f = Steiggerät mit Plural "Leitern"). Bevorzugt wird der Eintrag mit
  // "Weibliche Wortformen" – das Signal, dass es eine Personenbezeichnung ist.
  function parseWiktionaryFlexion(wikitext) {
    const sections = wikitext
      .split(/^(?===[^=])/m)
      .filter(s => /^==[^=\n]*\{\{Sprache\|Deutsch\}\}/.test(s));
    let fallback = null;
    for (const section of sections) {
      const forms = parseFlexionSection(section);
      if (forms?.person) return forms;
      fallback ??= forms;
    }
    return fallback;
  }

  function parseFlexionSection(section) {
    const tmpl = section.match(/\{\{Deutsch Substantiv Übersicht([\s\S]*?)\}\}/i);
    if (!tmpl) return null;
    const get = key => {
      const r = new RegExp("\\|\\s*" + key + "\\s*(?:1|\\*)?\\s*=\\s*([^|\\}\\n]+)", "i");
      const m = tmpl[1].match(r);
      if (!m) return null;
      const value = m[1].trim()
        .replace(/\[\[(?:[^\]|]+\|)?([^\]]+)\]\]/g, "$1")
        .replace(/'{2,}/g, "")
        .trim();
      // "—" (kein Plural/Singular) und Wikisyntax-Reste sind keine verwendbare Form.
      return /^\p{L}[\p{L}-]*$/u.test(value) ? value : null;
    };
    const sg = get("Nominativ Singular");
    const pl = get("Nominativ Plural");
    if (!sg && !pl) return null;
    return {
      sg: { nom: sg },
      pl: { nom: pl },
      person: /\{\{Weibliche Wortformen\}\}/.test(section),
    };
  }

  // ─────────────────────────────────────────────────────────────
  // 2. LEXIKON (Fallback)
  // ─────────────────────────────────────────────────────────────

  // Schlüssel = gegenderter Stamm (ohne End-e: "kolleg" für "Kolleg:innen"). `sg`/`pl`
  // sind die aufgelösten Formen. Optional: `m` = Maskulinum, falls `sg` feminin ist
  // (s. u.), und `exact` = nur als ganzes Wort, nicht als Kompositum-Kopf verwenden.
  const LEXICON = new Map([
    // Umlaut-Stämme: Singular zur natürlichen Femininform ("Ärzt:in" → "Ärztin"). Steht
    // ein maskulines oder gegendertes Determinativ davor, passt nur das Maskulinum `m`
    // ("jede:r Ärzt:in" → "jeder Arzt").
    ["ärzt",            { sg:"Ärztin",     m:"Arzt",      pl:"Ärzte"     }],
    ["anwält",          { sg:"Anwältin",   m:"Anwalt",    pl:"Anwälte"   }],
    ["köch",            { sg:"Köchin",     m:"Koch",      pl:"Köche"     }],
    ["bäuer",           { sg:"Bäuerin",    m:"Bauer",     pl:"Bauern"    }],
    ["französ",         { sg:"Französin",  m:"Franzose",  pl:"Franzosen" }],
    ["jüd",             { sg:"Jüdin",      m:"Jude",      pl:"Juden"     }],
    ["gäst",            { sg:"Gästin",     m:"Gast",      pl:"Gäste"     }],
    ["vorständ",        { sg:"Vorständin", m:"Vorstand",  pl:"Vorstände" }],
    // Umlaut-Plurale
    ["koch",            { sg:"Koch",               pl:"Köche"              }],
    // -e/-en-Plurale (Stamm ≠ Singular oder irregulärer Plural)
    ["bauer",           { sg:"Bauer",              pl:"Bauern"             }],
    ["nachbar",         { sg:"Nachbar",            pl:"Nachbarn"           }],
    ["kolleg",          { sg:"Kollege",            pl:"Kollegen"           }],
    ["sklav",           { sg:"Sklave",             pl:"Sklaven"            }],
    ["freund",          { sg:"Freund",             pl:"Freunde"            }],
    ["wirt",            { sg:"Wirt",               pl:"Wirte"              }],
    // Schwache Maskulina auf -e (Stamm ohne End-e: "Kund:in" → "Kunde")
    ["kund",            { sg:"Kunde",              pl:"Kunden"             }],
    ["expert",          { sg:"Experte",            pl:"Experten"           }],
    ["genoss",          { sg:"Genosse",            pl:"Genossen"           }],
    ["türk",            { sg:"Türke",              pl:"Türken"             }],
    ["griech",          { sg:"Grieche",            pl:"Griechen"           }],
    ["tschech",         { sg:"Tscheche",           pl:"Tschechen"          }],
    ["slowak",          { sg:"Slowake",            pl:"Slowaken"           }],
    // "zeug" nicht als Kompositum-Kopf: Fahrzeug, Werkzeug, Flugzeug … sind keine Personen.
    ["zeug",            { sg:"Zeuge",              pl:"Zeugen",   exact:true }],
    ["augenzeug",       { sg:"Augenzeuge",         pl:"Augenzeugen"        }],
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
    ["diplomat",        { sg:"Diplomat",           pl:"Diplomaten"         }],
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
    ["präsident",       { sg:"Präsident",          pl:"Präsidenten"        }],
    // -ist/-isten
    ["aktivist",        { sg:"Aktivist",           pl:"Aktivisten"         }],
    ["journalist",      { sg:"Journalist",         pl:"Journalisten"       }],
    ["kommunist",       { sg:"Kommunist",          pl:"Kommunisten"        }],
    ["terrorist",       { sg:"Terrorist",          pl:"Terroristen"        }],
    ["jurist",          { sg:"Jurist",             pl:"Juristen"           }],
    ["polizist",        { sg:"Polizist",           pl:"Polizisten"         }],
    ["spezialist",      { sg:"Spezialist",         pl:"Spezialisten"       }],
    // -eur/-eure (den Plural kann toPlural; die Einträge sichern die Personen-Erkennung,
    // Wiktionary führt z. B. bei "Akteur" keine weiblichen Wortformen)
    ["ingenieur",       { sg:"Ingenieur",          pl:"Ingenieure"         }],
    ["redakteur",       { sg:"Redakteur",          pl:"Redakteure"         }],
    ["friseur",         { sg:"Friseur",            pl:"Friseure"           }],
    ["monteur",         { sg:"Monteur",            pl:"Monteure"           }],
    ["akteur",          { sg:"Akteur",             pl:"Akteure"            }],
    // -or/-oren
    ["autor",           { sg:"Autor",              pl:"Autoren"            }],
    ["professor",       { sg:"Professor",          pl:"Professoren"        }],
    ["direktor",        { sg:"Direktor",           pl:"Direktoren"         }],
    ["moderator",       { sg:"Moderator",          pl:"Moderatoren"        }],
    ["administrator",   { sg:"Administrator",      pl:"Administratoren"    }],
    ["investor",        { sg:"Investor",           pl:"Investoren"         }],
    // Plural auf -s bzw. -e (Lehnwörter)
    ["chef",            { sg:"Chef",               pl:"Chefs"              }],
    ["fan",             { sg:"Fan",                pl:"Fans"               }],
    ["hotelier",        { sg:"Hotelier",           pl:"Hoteliers"          }],
    ["bankier",         { sg:"Bankier",            pl:"Bankiers"           }],
    ["kapitän",         { sg:"Kapitän",            pl:"Kapitäne"           }],
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
    ["programmierer",   { sg:"Programmierer",      pl:"Programmierer"      }],
    ["dienstleister",   { sg:"Dienstleister",      pl:"Dienstleister"      }],
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
    ["einwohner",       { sg:"Einwohner",          pl:"Einwohner"          }],
    ["anwohner",        { sg:"Anwohner",           pl:"Anwohner"           }],
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
    ["leiter",          { sg:"Leiter",             pl:"Leiter"             }],
    ["meister",         { sg:"Meister",            pl:"Meister"            }],
    ["minister",        { sg:"Minister",           pl:"Minister"           }],
    ["kanzler",         { sg:"Kanzler",            pl:"Kanzler"            }],
    ["vertreter",       { sg:"Vertreter",          pl:"Vertreter"          }],
    ["nehmer",          { sg:"Nehmer",             pl:"Nehmer"             }],
    ["geber",           { sg:"Geber",              pl:"Geber"              }],
    ["täter",           { sg:"Täter",              pl:"Täter"              }],
    ["sportler",        { sg:"Sportler",           pl:"Sportler"           }],
    ["erzieher",        { sg:"Erzieher",           pl:"Erzieher"           }],
    ["käufer",          { sg:"Käufer",             pl:"Käufer"             }],
    ["hersteller",      { sg:"Hersteller",         pl:"Hersteller"         }],
    ["betreuer",        { sg:"Betreuer",           pl:"Betreuer"           }],
    ["zuschauer",       { sg:"Zuschauer",          pl:"Zuschauer"          }],
    ["zuhörer",         { sg:"Zuhörer",            pl:"Zuhörer"            }],
    ["kämpfer",         { sg:"Kämpfer",            pl:"Kämpfer"            }],
    ["designer",        { sg:"Designer",           pl:"Designer"           }],
    ["manager",         { sg:"Manager",            pl:"Manager"            }],
    // Häufig in Banken, Verwaltung, Wohnen (Mieter, Kontoinhaber, Steuerzahler …)
    ["mieter",          { sg:"Mieter",             pl:"Mieter"             }],
    ["inhaber",         { sg:"Inhaber",            pl:"Inhaber"            }],
    ["anleger",         { sg:"Anleger",            pl:"Anleger"            }],
    ["sparer",          { sg:"Sparer",             pl:"Sparer"             }],
    ["empfänger",       { sg:"Empfänger",          pl:"Empfänger"          }],
    ["zahler",          { sg:"Zahler",             pl:"Zahler"             }],
    ["rentner",         { sg:"Rentner",            pl:"Rentner"            }],
    ["schuldner",       { sg:"Schuldner",          pl:"Schuldner"          }],
    ["gläubiger",       { sg:"Gläubiger",          pl:"Gläubiger"          }],
    ["vermittler",      { sg:"Vermittler",         pl:"Vermittler"         }],
    ["makler",          { sg:"Makler",             pl:"Makler"             }],
    ["azubi",           { sg:"Azubi",              pl:"Azubis"             }],
  ]);

  // ─────────────────────────────────────────────────────────────
  // 3. HILFSFUNKTIONEN
  // ─────────────────────────────────────────────────────────────

  // Text in diesen Elementen (auch tief verschachtelt, z. B. Syntax-Highlighting in
  // <pre><code><span>…) wird nie verändert.
  const SKIP_SELECTOR = "script,style,noscript,textarea,input,select,code,pre,kbd,samp";

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

  function resolveForm(stem, isPlural, wiktForms, masc = false) {
    const lower = stem.toLowerCase();

    // Das kuratierte LEXICON ist autoritativ und hat Vorrang vor Wiktionary:
    // Manche Gender-Stämme fallen mit einem anderen echten Wort zusammen (z. B.
    // "Kolleg" = das Kolleg), dessen Wiktionary-Formen sonst fälschlich gewönnen.
    const entry = LEXICON.get(lower);
    if (entry) {
      const form = isPlural ? entry.pl : (masc && entry.m) || entry.sg;
      return preserveCase(stem, form);
    }

    if (wiktForms) {
      const form = isPlural
        ? (wiktForms.pl?.nom ?? wiktForms.sg?.nom)
        : wiktForms.sg?.nom;
      if (form) return preserveCase(stem, form);
    }

    // Regelbasierter Fallback
    return isPlural ? toPlural(stem) : toSingular(stem);
  }

  function toPlural(stem) {
    // Endungen mit -e-Plural (Akteure, Offiziere, Notare, Aktionäre, Prüflinge) – vor der
    // -er-Regel, weil "-ier"/"-eur" sonst als "-er" gälten bzw. "-euren" entstünde.
    if (/(?:eur|ier|ar|är|ling)$/i.test(stem)) return stem + "e";
    // Schwach deklinierte Fremdwörter (Fotografen, Philosophen, Ökonomen, Oligarchen,
    // Theologen, Pädagogen, Katholiken).
    if (/(?:graf|graph|soph|nom|arch|log|gog|ik)$/i.test(stem)) return stem + "en";
    if (/(er|el|en|chen|lein)$/i.test(stem)) return stem;
    if (/e$/i.test(stem)) return stem + "n";
    if (/[tdnrsl]$/i.test(stem)) return stem + "en";
    return stem;
  }

  // Singular aus dem Stamm: Nur bei -loge/-goge fehlt dem Stamm das End-e sicher
  // ("Theolog:in" → "Theologe"); andere -e-Wörter stehen im LEXICON (Kunde, Experte).
  function toSingular(stem) {
    return /(?:log|gog)$/i.test(stem) ? stem + "e" : stem;
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

  // Maskuline Determinative vor einer Singularform: Dann passt nur das Maskulinum
  // ("ein Ärzt:in" → "ein Arzt"). "der", "des", "eines" fehlen bewusst – "der" ist auch
  // feminin (Dativ/Genitiv: "mit der Ärzt:in"), die Genitive verlangten "-es".
  const MASC_DETERMINERS = new Set([
    "den","dem","ein","einen","einem","kein","keinen","keinem",
    "irgendein","irgendeinen","irgendeinem",
    "mein","meinen","meinem","dein","deinen","deinem","sein","seinen","seinem",
    "ihr","ihren","ihrem","unser","unseren","unserem","euer","euren","eurem",
    "jeder","jeden","jedem","dieser","diesen","diesem","jener","jenen","jenem",
    "welcher","welchen","welchem","mancher","manchen","manchem","solcher","solchen","solchem",
  ]);

  // Determinative/Präpositionen mit Artikel, nach denen "mensch"/"frau" ein Substantiv
  // ist ("jeder mensch", "meine frau") und NICHT das Pronomen "man".
  const NOUN_DETERMINERS = new Set([
    "der","die","das","den","dem","des","als","zum","zur","vom","beim","im","am",
  ]);
  for (const base of ["ein","kein","mein","dein","sein","ihr","unser","euer","eur",
                      "jed","dies","jen","welch","manch","solch","irgendein"]) {
    for (const ending of ["","e","en","em","es","er"]) NOUN_DETERMINERS.add(base + ending);
  }

  // Pseudo-Feminina: künstliche -in-Ableitungen zu Grundwörtern, die schon alle
  // Geschlechter umfassen (der Mensch, das Mitglied, die Fachkraft). Sie stehen in keinem
  // Wörterbuch oder nur als Scherzwort ("Menschin") – deshalb ist der Rückbau praktisch
  // falsch-treffer-frei und braucht keine Heuristik, nur diese kuratierte Tabelle. NICHT
  // hierher gehören echte Feminina, die eine konkrete Frau bezeichnen: "Vorständin" und
  // "Gästin" bleiben wie "Ärztin" oder "Freundin" stehen. Schlüssel = kleingeschriebene
  // Singularform; der Plural wird über das angehängte "nen" (Mitgliedin → Mitgliedinnen)
  // im Muster erkannt. `g` = Genus des Grundworts (m/n/f) für die Artikel-Kongruenz.
  const PSEUDO_FEM = new Map([
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

  // Das Wort direkt vor `offset` (nur durch Leerraum getrennt, ohne führende Klammern
  // oder Anführungszeichen), sonst "".
  function precedingToken(text, offset) {
    const token = text.slice(Math.max(0, offset - 40), offset).match(/(\S+)\s+$/u)?.[1] ?? "";
    return token.replace(/^[^\p{L}]+/u, "");
  }

  // Verlangt der linke Kontext das Maskulinum? Ja nach maskulinem Determinativ ("ein",
  // "jeden" …) und nach einem gegenderten Determinativ/Adjektiv ("jede:r", "der*die",
  // "gute:r") – geprüft, BEVOR diese selbst aufgelöst werden.
  function isMascContext(text, offset) {
    const tok = precedingToken(text, offset);
    return reGenderedToken.test(tok) || MASC_DETERMINERS.has(tok.toLowerCase());
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

  const SORTED_STEMS = [...LEXICON]
    .filter(([, entry]) => !entry.exact)
    .map(([stem]) => stem)
    .sort((a, b) => b.length - a.length);

  function splitCompound(word) {
    const lower = word.toLowerCase();
    for (const stem of SORTED_STEMS) {
      if (lower.endsWith(stem) && lower.length > stem.length) {
        return { prefix: word.slice(0, word.length - stem.length), stem };
      }
    }
    return null;
  }

  // Personenbezeichnung? Belege: LEXICON, ein LEXICON-Stamm als Kompositum-Kopf oder
  // Wiktionary mit "Weibliche Wortformen". Dass Wiktionary das Wort nur als Substantiv
  // kennt, genügt NICHT – sonst gälten "Termin", "Farbe" oder "Check" als Person.
  function isLikelyPersonStem(stem) {
    const lower = stem.toLowerCase();
    if (LEXICON.has(lower)) return true;
    if (splitCompound(stem)) return true;
    return getWikt(stem)?.person === true;
  }

  // ─────────────────────────────────────────────────────────────
  // 6. REGEX-MUSTER
  // ─────────────────────────────────────────────────────────────

  // Bindestrich wird bewusst NICHT als Gender-Marker unterstützt:
  // Er ist als Gendering-Form extrem selten, kollidiert aber häufig mit normalen
  // deutschen Komposita (Standard-installationen), CLI-Flags (tail -n), URLs und Code.
  // Neben den gängigen Zeichen auch typografische Varianten (∗ ⁎ ꞉ ∶).
  const MARKER = "[:*·•‧∙⋅⋆_/∗⁎꞉∶]";
  // Der Stamm beginnt am Wortanfang. Das ändert keine Treffer, erspart der Regex-Engine
  // aber, es an jeder Position mitten im Wort erneut zu versuchen (≈ Faktor 3).
  const STEM   = "(?<![\\p{L}])([\\p{L}]{2,})";
  const WORD_START = "(?<![\\p{L}\\p{N}_])";
  const WORD_END   = "(?![\\p{L}\\p{N}_\\/])";

  const reGenderInfo = new RegExp(
    "\\s*[(\\[]\\s*(?:" +
      "(?:m|w|d|f|x|div|divers)\\s*(?:[\\/|]\\s*(?:m|w|d|f|x|div|divers)\\s*)+" +
      "|all genders|alle geschlechter|gn\\*?" +
    ")\\s*[)\\]]",
    "giu"
  );
  // Lookahead schließt neben Buchstaben auch `/` und `_` aus, damit URLs wie
  // "foo.de/in/impressum" und Slugs wie "foo_in_bar" nicht fälschlich als
  // Gendering gewertet werden. Leerraum vor/nach dem Marker und die Endung werden
  // gefangen, damit markerFormKind sie bewerten kann.
  // Eine schließende Klammer gehört nur dann zur Form, wenn direkt vor dem Marker eine
  // öffnende steht ("Lehrer(:in)") – sonst umschließt sie den Ausdruck und bleibt stehen
  // ("(Ansprechpartner:in)" → "(Ansprechpartner)", nicht "(Ansprechpartner").
  // Gruppen: 1 Stamm, 2 Leerraum davor, 3 Marker, 4 Leerraum danach, 5 Endung.
  const closeBracket = ending => "(?:(?<=[(\\[]" + MARKER + "\\s?-?" + ending + ")[)\\]])?";
  const reInnenWithMarker       = new RegExp(STEM + "(\\s*)(?:\\(|\\[)?(" + MARKER + ")(\\s?)(?:-)?(innen)" + closeBracket("innen") + "(?![\\p{L}\\/_])", "giu");
  const reInWithMarker          = new RegExp(STEM + "(\\s*)(?:\\(|\\[)?(" + MARKER + ")(\\s?)(?:-)?(in)"    + closeBracket("in")    + "(?![\\p{L}\\/_])", "giu");
  const reInnenParen            = new RegExp(STEM + "(\\s*)\\((innen)\\)", "giu");
  const reInParen               = new RegExp(STEM + "(\\s*)\\((in)\\)",    "giu");
  // Binnen-I ("LehrerInnen" → "Lehrer", "BürgerIn" → "Bürger"). Der Stamm darf
  // beliebig anfangen (auch großgeschrieben – das ist der Normalfall bei deutschen
  // Substantiven). Statt `\b` (ASCII-basiert, scheitert an Umlauten am Wortrand)
  // begrenzen Unicode-Lookbehind/Lookahead auf echte Wortgrenzen. Das große "I"
  // in "Innen"/"In" bleibt das case-sensitive Erkennungssignal; deshalb KEIN
  // `i`-Flag. Die Auflösung ist zusätzlich durch isLikelyPersonStem abgesichert.
  const reBinnenIPlural         = new RegExp("(?<![\\p{L}])(\\p{L}[\\p{L}]*)Innen(?![\\p{L}\\/_])", "gu");
  const reBinnenISingular       = new RegExp("(?<![\\p{L}])(\\p{L}[\\p{L}]*)In(?![\\p{L}\\/_])",    "gu");
  // "LehrerIn/Innen". Das große "I" vor dem Slash ist Pflicht: "Lehrerin/innen" ist die
  // natürliche Femininform (Lehrerin/Lehrerinnen) und bleibt stehen.
  const reInSlashInnen          = new RegExp(STEM + "In\\/[Ii]nnen(?![\\p{L}])", "gu");
  // Adjektiv-/Pronomenendungen. Nur kompakt geschrieben (ohne Leerzeichen am Marker) –
  // sonst träfe es Doppelpunkt-Aufzählungen und Formeln ("Beispiel: n = 5",
  // "2 * pi * r", "Meter: m"). Bei -n/-r endet der Stamm auf -e (jede:r, eine:n).
  const reAdjNWithMarker        = new RegExp(WORD_START + "(\\p{L}+e)"   + MARKER + "n" + WORD_END, "gu");
  const reAdjEWithMarker        = new RegExp(WORD_START + "(\\p{L}{2,})" + MARKER + "e" + WORD_END, "gu");
  const reAdjRWithMarker        = new RegExp(WORD_START + "(\\p{L}+e)"   + MARKER + "r" + WORD_END, "gu");
  // Dativ-Maskulinum: "jeder:m" → "jedem", "dieser:m" → "diesem", "der:m" → "dem".
  // Anders als die :r/:n/:e-Muster wird hier nicht angehängt, sondern die
  // Endung -er durch -em ersetzt (sonst käme "jederm" raus). Stamm-Minimum
  // ist bewusst 1 Buchstabe, damit auch "der:m" greift.
  const reAdjErMWithMarker      = new RegExp(WORD_START + "(\\p{L}+)er"  + MARKER + "m" + WORD_END, "gu");
  // Gegendertes Kompositum ("Lehrer*innenzimmer"). Immer kompakt geschrieben; mit
  // Leerzeichen wäre "Politik · Innenpolitik" oder "Bauer: Innenpolitisch …" ein Treffer.
  const reInnenCompound         = new RegExp(STEM + "(?:\\(|\\[)?" + MARKER + "(?:-)?(innen)([\\p{Ll}][\\p{L}]*)", "giu");
  const reStandaloneInMarker    = new RegExp("^\\s*(?:\\(|\\[)?" + MARKER + "\\s*(?:-)?\\s*in(?:\\)|\\])?\\s*$",    "iu");
  const reStandaloneInnenMarker = new RegExp("^\\s*(?:\\(|\\[)?" + MARKER + "\\s*(?:-)?\\s*innen(?:\\)|\\])?\\s*$", "iu");
  // Ein Wort mit Marker im Inneren ("jede:r", "der*die") – für isMascContext.
  const reGenderedToken         = new RegExp("^\\p{L}+" + MARKER + "\\p{L}+$", "u");

  // Artikel-/Pronomenpaare → Maskulinum ("der*die Nutzer*in" → "der Nutzer"). Nur
  // kompakt und als ganzes Wort: "der/die/das" (Aufzählung in Grammatiktexten) bleibt,
  // weil nach "die" ein weiterer Slash folgt.
  const PAIR_TO_MASC = new Map([
    ["der|die","der"],["die|der","der"],["den|die","den"],["die|den","den"],
    ["dem|der","dem"],["der|dem","dem"],["des|der","des"],["der|des","des"],
    ["er|sie","er"],["sie|er","er"],["ihn|sie","ihn"],["sie|ihn","ihn"],
    ["ihm|ihr","ihm"],["ihr|ihm","ihm"],["sein|ihr","sein"],["ihr|sein","sein"],
    ["seine|ihre","seine"],["ihre|seine","seine"],["seinen|ihren","seinen"],
    ["ihren|seinen","seinen"],["seinem|ihrem","seinem"],["ihrem|seinem","seinem"],
  ]);
  const PAIR_WORDS = [...new Set([...PAIR_TO_MASC.keys()].flatMap(k => k.split("|")))]
    .sort((a, b) => b.length - a.length).join("|");
  const reArticlePair = new RegExp(
    WORD_START + "(" + PAIR_WORDS + ")" + MARKER + "(" + PAIR_WORDS + ")" + WORD_END, "giu"
  );

  // Indefinitpronomen-Reversion: "mensch"/"frau" als entgendertes Ersatzwort
  // für "man" (z. B. "könnte mensch sagen") werden zu "man" zurückgeführt.
  // BEWUSST case-sensitiv und nur kleingeschrieben: Das großgeschriebene
  // Substantiv "Mensch"/"Frau" sowie "Menschen"/"Frauen" bleiben unangetastet.
  // Satzanfänge (großgeschrieben) werden nicht erfasst, um den Substantiv-
  // Sinn nicht zu zerstören. Nach einem Determinativ ("jeder mensch", "meine frau")
  // ist es in klein geschriebenen Texten ebenfalls das Substantiv (NOUN_DETERMINERS).
  const reIndefinitePronoun     = /\b(?:mensch|frau)\b/g;
  // Pseudo-Feminina (kein Marker): "Mitgliedin"/"Mitgliedinnen" – auch als Kompositum-KOPF
  // ("Vereinsmitgliedin" → "Vereinsmitglied", "Pflegefachkräftin" → "Pflegefachkraft"). Da
  // kein echtes deutsches Wort auf "…mitgliedin", "…fachkräftin" usw. endet, ist der
  // optionale Präfix (`\p{L}*?`, kürzestmöglich) falsch-treffer-frei. Längere Schlüssel
  // zuerst. Das optionale "nen" markiert den Plural. Der Lookahead `(?![\p{L}])` verlangt
  // das Pseudo-Femininum am Wortende – ein Vorkommen MITTEN im Wort
  // ("Mitgliedinnenversammlung") bleibt damit bewusst unangetastet. Unicode-Wortgrenzen.
  const PSEUDO_FEM_ALT = [...PSEUDO_FEM.keys()].sort((a, b) => b.length - a.length).join("|");
  const rePseudoFem = new RegExp(
    "(?<![\\p{L}])(\\p{L}*?)(" + PSEUDO_FEM_ALT + ")(nen)?(?![\\p{L}])",
    "giu"
  );
  // Artikel-Kongruenz für Pseudo-Feminina im Singular, analog zu reArtSingularNom:
  // großgeschriebenes feminines Determinativ direkt vor einem Pseudo-Femininum
  // ("Die Mitgliedin" → "Das Mitglied", "Die Vereinsmitgliedin" → "Das Vereinsmitglied").
  // Schreibt nur das Determinativ um; das Wort selbst bleibt für rePseudoFem stehen.
  // `(?![\p{L}])` schließt den Plural (…innen) aus.
  const rePseudoFemArt = new RegExp(
    "(?<![\\p{L}])(" + [...FEM_TO_MASC_NOM.keys()].sort((a, b) => b.length - a.length).join("|") +
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
    "(?<![\\p{L}])(" + [...FEM_TO_MASC_NOM.keys()].join("|") + ")(\\s+)([\\p{L}]{2,})(\\s*)(?:\\(|\\[)?(" +
    MARKER + ")(\\s?)(?:-)?(in)" + closeBracket("in") + "(?![\\p{L}\\/_])",
    "giu"
  );

  const FALSE_POSITIVES = new Set([
    "heroin","heroine","protein","platine","marine","maschine","routine",
    "medizin","vitamin","kantine","benzin","origin","satin","burin",
    "cousin","raisin","sequin","goblin","penguin","kabine","disziplin",
  ]);

  // Vorfilter: billige NOTWENDIGE Bedingungen aller Muster oben – ein Buchstabe direkt
  // vor einem Marker + "in", ein Binnen-I, "(m/…", ein Pseudo-Femininum usw. Ohne
  // gierige Stämme und ohne Backtracking, deshalb schnell. Er darf zu viel melden, aber
  // nie zu wenig (Test "Vorfilter übersieht nichts"). Getrennt nach Groß-/Kleinschreibung:
  // Binnen-I und "mensch"/"frau" sind case-sensitiv, mit `i` träfe der Filter sonst
  // jedes "ein", "Berlin" oder "Frau".
  const reCandidateCI = new RegExp([
    "\\p{L}\\s*[(\\[]?" + MARKER + "\\s?-?in",           // Marker-Formen (inkl. Kompositum/Slash)
    "\\p{L}\\s*\\(in",                                     // Klammerformen
    "\\p{L}" + MARKER + "\\p{L}",                          // Adjektivendungen, Artikelpaare
    "[(\\[]\\s*(?:[mwdfx]\\s*[\\/|]|div|all|gn)",         // Genus-Kürzel
    "(?:" + PSEUDO_FEM_ALT + ")(?:nen)?(?![\\p{L}])",     // Pseudo-Feminina
    "(?:" + PART_ALT + ")(?:en|e|er|em|es)(?![\\p{L}])",  // Partizipien
  ].join("|"), "iu");
  const reCandidateCS = /\p{L}In(?:nen)?(?![\p{L}/_])|\b(?:mensch|frau)\b/u;

  function hasGenderCandidate(text) {
    return reCandidateCI.test(text) || reCandidateCS.test(text);
  }

  // ─────────────────────────────────────────────────────────────
  // 7. NORMALISIERUNG
  // ─────────────────────────────────────────────────────────────

  function getWikt(stem) {
    return wiktCache.get(stem.toLowerCase()) ?? null;
  }

  function replaceStem(stem, isPlural, masc = false) {
    const lower = stem.toLowerCase();
    if (FALSE_POSITIVES.has(lower)) return stem;
    // Ein exakter LEXICON-Treffer geht vor die Zerlegung ("Mitarbeiter", nicht "Mit" + "arbeiter").
    const compound = LEXICON.has(lower) ? null : splitCompound(stem);
    if (compound) {
      const resolved = resolveForm(compound.stem, isPlural, getWikt(compound.stem), masc);
      // Der Stamm steht als zweiter Kompositateil mitten im Wort und muss
      // kleingeschrieben werden – sonst entstünde "BeNutzer", "SozialArbeiter".
      // Nur in durchgängig großgeschriebenen Wörtern bleibt er groß ("SOZIALARBEITER").
      const upper = compound.prefix === compound.prefix.toUpperCase() &&
                    compound.prefix !== compound.prefix.toLowerCase();
      const joined = !resolved ? resolved
        : upper ? resolved.toUpperCase()
        : resolved[0].toLowerCase() + resolved.slice(1);
      return compound.prefix + joined;
    }
    return resolveForm(stem, isPlural, getWikt(stem), masc);
  }

  // Bewertet eine Marker-Form anhand von Marker, Leerraum am Marker (`gap`) und Endung:
  //   "trusted" – eindeutig Gendering: kompakt ("Lehrer:innen", "Nutzer*Innen").
  //   "person"  – nur bei Personenbezeichnung: großes "I" nach "/" (dort beginnt oft ein
  //               neues Wort: "Außen/Innen", "Amoralismus/In|tellekt" über Textknoten
  //               verteilt) und ":In" vor einem Wort (fehlendes Leerzeichen: "Hinweis:In diesem").
  //   "strict"  – mit Leerzeichen ("Mieter: innen", aber auch "Farbe: innen weiß",
  //               "Lautsprecher: innen"): nur bei sicher belegter Person.
  //   "no"      – normales Deutsch: Leerzeichen + großes "I" (Satzanfang nach Doppelpunkt),
  //               Singular mit Leerzeichen vor einem weiteren Wort ("Termin: in Kürze")
  //               oder "innen und außen".
  // Durchgängig großgeschriebene Endungen ("MITARBEITER:INNEN") zählen als klein.
  function markerFormKind(marker, gap, suffix, singular, rest) {
    const capital = suffix[0] === "I" && /[a-z]/.test(suffix);
    const beforeWord = /^\s+\p{L}/u.test(rest);
    if (gap !== "") {
      if (capital || (singular && beforeWord)) return "no";
      if (!singular && /^\s*(?:und|oder|sowie|wie|&|\/|,)?\s*außen/iu.test(rest)) return "no";
      return "strict";
    }
    if (!capital) return "trusted";
    if (marker === "/" || (singular && beforeWord && /[:∶꞉]/.test(marker))) return "person";
    return "trusted";
  }

  // Stämme, die auf der Seite kompakt gegendert vorkommen ("Maurer:innen"). Sie gelten
  // auch in den mehrdeutigen Schreibweisen als Person – Texte mischen oft "Maurer:innen"
  // und "Maurer: innen". Gefüllt von der DOM-Verarbeitung (Vorab-Scan + jeder Block).
  const pageStems = new Set();

  // Belege sind kompakte Formen und Leerzeichen-Formen mit sicher belegter Person
  // ("Kund: innen" – Lexikon). Beide zeigen zugleich: Dieser Text gendert.
  function collectConfirmedStems(text, into) {
    const scan = (re, singular) => {
      for (const m of text.matchAll(re)) {
        if (/in$/i.test(m[1])) continue;
        const kind = markerFormKind(m[3], m[2] + m[4], m[5], singular, text.slice(m.index + m[0].length));
        if (kind === "trusted" || (kind === "strict" && isKnownPerson(m[1], false))) {
          into.add(m[1].toLowerCase());
        }
      }
    };
    scan(reInnenWithMarker, false);
    scan(reInWithMarker, true);
    return into;
  }

  // `confirmed`: Belege aus dem aktuellen Text (s. applyPatterns).
  function isConfirmedStem(stem, confirmed) {
    const lower = stem.toLowerCase();
    return confirmed.has(lower) || pageStems.has(lower);
  }

  // Gendert der Text bzw. die Seite nachweislich (mindestens ein Beleg)?
  function isGenderingContext(confirmed) {
    return confirmed.size > 0 || pageStems.size > 0;
  }

  // Strenger als isLikelyPersonStem: Ein Kompositum mit Personen-Kopf zählt nur, wenn der
  // Kopf allein kein Wort ist ("Privatkund" kann nur von "Privatkund:innen" stammen) oder
  // wenn der Kontext nachweislich gendert (`gendering`). Sonst könnte es ein Gerät sein:
  // "Lautsprecher" endet auf das eigenständige Wort "sprecher".
  function isKnownPerson(stem, gendering) {
    const lower = stem.toLowerCase();
    if (LEXICON.has(lower) || getWikt(stem)?.person === true) return true;
    const compound = splitCompound(stem);
    return !!compound && (gendering || isBoundStem(compound.stem));
  }

  // Gegenderter Stamm, der allein kein Wort ist: "kund" (Kunde), "ärzt" (Arzt), "förder".
  function isBoundStem(key) {
    return LEXICON.get(key).sg.toLowerCase() !== key;
  }

  function markerFormOk(stem, marker, gap, suffix, singular, rest, confirmed) {
    switch (markerFormKind(marker, gap, suffix, singular, rest)) {
      case "trusted": return true;
      case "person":  return isLikelyPersonStem(stem) || isConfirmedStem(stem, confirmed);
      case "strict":  return isKnownPerson(stem, isGenderingContext(confirmed)) ||
                             isConfirmedStem(stem, confirmed);
      default:        return false;
    }
  }

  // Unsichtbare Zeichen – weiches Trennzeichen (U+00AD, &shy;) und Nullbreiten-Zeichen
  // (U+200B–U+200D) – verstecken Gendering vor den Mustern ("Lehrer&shy;:innen"). Sie
  // werden nur aus Wörtern entfernt, die danach gegendert aussehen – sonst gingen
  // Silbentrennung und Emoji-Sequenzen (z. B. 👩‍💻 = 👩 + U+200D + 💻) im übrigen Text verloren.
  const INVISIBLE        = "[" + String.fromCharCode(0x00AD, 0x200B, 0x200C, 0x200D) + "]";
  const reInvisible      = new RegExp(INVISIBLE);
  const reInvisibleAll   = new RegExp(INVISIBLE, "g");
  const reInvisibleToken = new RegExp("\\S*" + INVISIBLE + "\\S*", "gu");

  function stripInvisibleInCandidates(text) {
    if (!reInvisible.test(text)) return text;
    return text.replace(reInvisibleToken, token => {
      const clean = token.replace(reInvisibleAll, "");
      return hasGenderCandidate(clean) ? clean : token;
    });
  }

  function normalizeGenderedText(text, participles = participlesEnabled) {
    if (!text) return text;
    const prepared = stripInvisibleInCandidates(text);
    if (!hasGenderCandidate(prepared)) return text;
    const out = applyPatterns(prepared, participles);
    // Nichts ersetzt → exakt das Original zurückgeben (auch dessen unsichtbare Zeichen).
    return out === prepared ? text : out;
  }

  function applyPatterns(text, participles) {
    let out = text;
    const R = (re, fn) => { re.lastIndex = 0; out = out.replace(re, fn); };

    // Plural-Form auflösen und – falls der Satzkontext eindeutig Dativ verlangt –
    // in den Dativ Plural setzen. `str`/`off` kommen aus dem replace-Callback.
    const plural = (stem, off, str) =>
      isDativContext(str, off) ? toDativPlural(replaceStem(stem, true)) : replaceStem(stem, true);
    const singular = (stem, off, str) => replaceStem(stem, false, isMascContext(str, off));

    // Kompakt gegenderte Stämme dieses Textes belegen dieselben Stämme in mehrdeutiger
    // Schreibweise – unabhängig von der Reihenfolge ("Maurer: innen … Maurer:innen").
    const confirmed = collectConfirmedStems(text, new Set());
    const isPerson = stem => isLikelyPersonStem(stem) || isConfirmedStem(stem, confirmed);
    const formOk = (m, stem, marker, gap, suffix, singularForm, off, str) =>
      markerFormOk(stem, marker, gap, suffix, singularForm, str.slice(off + m.length), confirmed);

    R(reGenderInfo,      ()            => "");
    R(reIndefinitePronoun, (m, off, str) =>
      NOUN_DETERMINERS.has(precedingToken(str, off).toLowerCase()) ? m : "man");
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
    // Pseudo-Feminina zurückbauen: "Mitgliedin"→"Mitglied", "Mitgliedinnen"→"Mitglieder",
    // als Kompositum-Kopf "Vereinsmitgliedin"→"Vereinsmitglied" (Präfix behält Schreibung,
    // Grundwort klein). Dativ Plural beachten: "mit den Mitgliedinnen"→"mit den Mitgliedern".
    R(rePseudoFem, (m, prefix, word, nen, off, str) => {
      const entry = PSEUDO_FEM.get(word.toLowerCase());
      if (!entry) return m;
      let form = nen ? entry.pl : entry.sg;
      if (nen && isDativContext(str, off)) form = toDativPlural(form);
      return prefix
        ? prefix + form[0].toLowerCase() + form.slice(1)
        : preserveCase(word, form);
    });
    R(reInSlashInnen,    (_, stem, off, str) => plural(stem, off, str));
    R(reBinnenIPlural,   (m, stem, off, str) => isPerson(stem) ? plural(stem, off, str) : m);
    R(reBinnenISingular, (m, stem, off, str) => isPerson(stem) ? singular(stem, off, str) : m);
    R(reInnenCompound,   (m, stem, _innen, suffix) => {
      if (!isPerson(stem)) return m;
      return replaceStem(stem, true) + suffix;
    });
    // "Lehrerin/innen" ist die natürliche Femininform (Lehrerin/Lehrerinnen) – stehen lassen.
    R(reInnenWithMarker, (m, stem, gap1, marker, gap2, suffix, off, str) =>
      !/in$/i.test(stem) && formOk(m, stem, marker, gap1 + gap2, suffix, false, off, str)
        ? plural(stem, off, str) : m);
    // Artikel-Kongruenz VOR reInWithMarker, damit das "…:in" hier noch vorhanden ist.
    R(reArtSingularNom, (m, det, ws, stem, gap1, marker, gap2, suffix, off, str) => {
      if (det[0] === det[0].toLowerCase()) return m;   // nur großgeschrieben (Satzanfang)
      if (!formOk(m, stem, marker, gap1 + gap2, suffix, true, off, str)) return m;
      if (!isPerson(stem)) return m;
      const noun = replaceStem(stem, false);
      if (/in$/i.test(noun)) return m;                 // aufgelöst feminin (Ärztin) → Artikel feminin lassen
      const masc = FEM_TO_MASC_NOM.get(det.toLowerCase());
      return masc ? preserveCase(det, masc) + ws + noun : m;
    });
    // Singularformen VOR den Adjektiv-/Artikelmustern: So sieht isMascContext noch das
    // gegenderte Determinativ ("jede:r Ärzt:in" → "jede:r Arzt" → "jeder Arzt").
    R(reInWithMarker, (m, stem, gap1, marker, gap2, suffix, off, str) =>
      formOk(m, stem, marker, gap1 + gap2, suffix, true, off, str)
        ? singular(stem, off, str) : m);
    R(reInnenParen, (m, stem, gap, suffix, off, str) =>
      formOk(m, stem, "(", gap, suffix, false, off, str)
        ? plural(stem, off, str) : m);
    R(reInParen, (m, stem, gap, suffix, off, str) =>
      formOk(m, stem, "(", gap, suffix, true, off, str)
        ? singular(stem, off, str) : m);
    R(reArticlePair, (m, first, second) => {
      const masc = PAIR_TO_MASC.get(first.toLowerCase() + "|" + second.toLowerCase());
      return masc ? preserveCase(first, masc) : m;
    });
    R(reAdjNWithMarker,  (_, stem)     => stem + "n");
    R(reAdjEWithMarker,  (_, stem)     => stem);
    R(reAdjRWithMarker,  (_, stem)     => stem + "r");
    R(reAdjErMWithMarker,(_, stem)     => stem + "em");

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

  // Endungen, bei denen die Regeln Singular und Plural sicher treffen. Für eindeutige
  // ("trusted") Formen mit solchen Stämmen lohnt kein Lookup ("Mieter:innen" → "Mieter").
  const RULE_SAFE = /(?:er|el|ist|ent|ant|at|et|ot|ut|or|eur|ier|ar|är|ling|graf|graph|soph|nom|arch|log|gog)$/i;

  // Sammelt die Stämme eines Textes, für die ein Wiktionary-Lookup etwas bringt: Stämme,
  // die weder LEXICON noch Kompositum-Zerlegung kennen und die entweder eine unsichere
  // Endung haben oder eine Personen-Prüfung brauchen (Binnen-I, Leerzeichen, Kompositum).
  // Strukturell ausgeschlossene Treffer ("Termin: in Kürze") lösen keine Anfrage aus.
  function collectLookupStems(text, into) {
    const s = stripInvisibleInCandidates(text);
    if (!hasGenderCandidate(s)) return into;
    const confirmed = collectConfirmedStems(s, new Set());
    // Ein Lookup liefert zweierlei: die Formen (wo die Regeln unsicher sind) und den
    // Personenbeleg (für mehrdeutige Schreibweisen). Gefragt wird nur, wenn etwas fehlt.
    // `evidence`: "trusted" (kein Beleg nötig), "person" oder "strict" (s. markerFormKind).
    const consider = (stem, evidence) => {
      const lower = stem.toLowerCase();
      const inLexicon = LEXICON.has(lower);
      const compound = !inLexicon && !!splitCompound(stem);
      const formsKnown = inLexicon || compound || RULE_SAFE.test(lower);
      const personKnown = evidence === "trusted" || inLexicon || isConfirmedStem(stem, confirmed) ||
                          (evidence === "person" && compound) ||
                          (evidence === "strict" && compound &&
                           isKnownPerson(stem, isGenderingContext(confirmed)));
      if (!formsKnown || !personKnown) into.add(lower);
    };
    const considerMarker = (m, marker, gap, suffix, singular) => {
      const kind = markerFormKind(marker, gap, suffix, singular, s.slice(m.index + m[0].length));
      if (kind !== "no") consider(m[1], kind);
    };
    for (const m of s.matchAll(reInnenCompound))   consider(m[1], "person");
    for (const m of s.matchAll(reInnenWithMarker)) if (!/in$/i.test(m[1])) considerMarker(m, m[3], m[2] + m[4], m[5], false);
    for (const m of s.matchAll(reInWithMarker))    considerMarker(m, m[3], m[2] + m[4], m[5], true);
    for (const m of s.matchAll(reInnenParen))      considerMarker(m, "(", m[2], m[3], false);
    for (const m of s.matchAll(reInParen))         considerMarker(m, "(", m[2], m[3], true);
    for (const m of s.matchAll(reInSlashInnen))    consider(m[1], "trusted");
    for (const m of s.matchAll(reBinnenIPlural))   consider(m[1], "person");
    for (const m of s.matchAll(reBinnenISingular)) consider(m[1], "person");
    return into;
  }

  // Lädt für eine Reihe von Texten alle benötigten Wörter – erst aus dem lokalen
  // Cache, dann (gedrosselt) von Wiktionary. Danach laufen die Texte synchron durch.
  async function prefetchLookups(texts) {
    if (!HAS_BROWSER || !wiktionaryEnabled) return;
    const stems = new Set();
    for (const t of texts) if (t) collectLookupStems(t, stems);
    if (!stems.size) return;
    const keys = [...stems];
    await loadWiktFromStore(keys);
    await Promise.all(keys.filter(k => !wiktCache.has(k)).map(fetchWiktionaryForms));
  }

  // ─────────────────────────────────────────────────────────────
  // 8. DOM-VERARBEITUNG
  // ─────────────────────────────────────────────────────────────

  const processed = new WeakSet();

  // Gilt für den Erstdurchlauf UND für Knoten aus dem MutationObserver – Text, der
  // nachträglich in Code-Blöcke gestreamt wird (KI-Chats), bleibt so ebenfalls unberührt.
  function acceptTextNode(node) {
    if (!node.nodeValue?.trim()) return false;
    const p = node.parentNode;
    if (!p || p.nodeType !== Node.ELEMENT_NODE) return true;
    if (p.closest(SKIP_SELECTOR)) return false;
    return !isEditableNode(node);
  }

  const walkerFilter = {
    acceptNode: node => acceptTextNode(node) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT,
  };

  function collectPageStemsFrom(text) {
    const s = stripInvisibleInCandidates(text);
    if (hasGenderCandidate(s)) collectConfirmedStems(s, pageStems);
  }

  // Vorab-Scan der ganzen Seite, BEVOR Text ersetzt wird: So profitiert auch ein
  // "Maurer: innen" oben auf der Seite von einem "Maurer:innen" weiter unten.
  function collectPageStems(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, walkerFilter);
    let node;
    while ((node = walker.nextNode())) collectPageStemsFrom(node.nodeValue);
  }

  async function processBatch(nodes) {
    const todo = nodes.filter(n => n.isConnected && !processed.has(n) && acceptTextNode(n));
    if (!todo.length) return;
    const originals = todo.map(n => n.nodeValue);
    originals.forEach(collectPageStemsFrom);     // nachgeladene Inhalte ergänzen die Belege
    await prefetchLookups(originals);
    todo.forEach((node, i) => {
      const original = originals[i];
      // Seit dem Lookup geändert (z. B. React-Rerender)? Dann nicht mit veraltetem Text
      // überschreiben – die Änderung erreicht uns ohnehin über den Observer.
      if (!active || !node.isConnected || node.nodeValue !== original) return;
      const replaced = normalizeGenderedText(original);
      if (replaced !== original) {
        node.nodeValue = replaced;
        if (debugEnabled) {
          debug("✓", JSON.stringify(original.trim()), "→", JSON.stringify(replaced.trim()));
        }
      }
      processed.add(node);
    });
  }

  async function replaceGenderedLanguageInDOM(root) {
    if (!root) root = document.documentElement;
    normalizeSplitMarkers(root);
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, walkerFilter);
    const CHUNK = 150;
    let batch = [], node;
    while (active && (node = walker.nextNode())) {
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
    if (element.nodeType === Node.ELEMENT_NODE && element.closest(SKIP_SELECTOR)) return;
    if (isEditableNode(element)) return;

    const getInline = node => {
      if (!node) return null;
      if (node.nodeType === Node.TEXT_NODE)
        return node.nodeValue ? { node, text: node.nodeValue } : null;
      if (node.nodeType !== Node.ELEMENT_NODE || node.matches(SKIP_SELECTOR)) return null;
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
      if (el.closest(SKIP_SELECTOR)) return;
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

  function normalizeJsonLdValue(v, k, state) {
    if (typeof v === "string") {
      if (k && JSON_LD_SKIP.has(k)) return v;
      const r = normalizeGenderedText(v);
      if (r !== v) state.changed = true;
      return r;
    }
    if (Array.isArray(v)) return v.map(e => normalizeJsonLdValue(e, undefined, state));
    if (v && typeof v === "object") {
      const out = {};
      for (const [ck, cv] of Object.entries(v)) out[ck] = normalizeJsonLdValue(cv, ck, state);
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
        // Nur zurückschreiben, wenn sich ein Text geändert hat – sonst würde jedes
        // formatierte JSON-LD ohne Grund kompaktiert (und der Head-Observer erneut ausgelöst).
        const state = { changed: false };
        const value = normalizeJsonLdValue(JSON.parse(orig), undefined, state);
        if (state.changed) s.textContent = JSON.stringify(value);
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
      const shadow = el?.shadowRoot;
      if (!shadow) return;
      replaceGenderedLanguageInDOM(shadow);
      normalizeAllAttributes(shadow);
      normalizeSvgText(shadow);
      normalizeJsonLdScripts(shadow);
      // Auch nachgeladene Inhalte im Shadow DOM erfassen (Observer reichen nicht hinein).
      if (!observedRoots.has(shadow)) {
        observedRoots.add(shadow);
        observeGenderedLanguage(shadow);
      }
      shadow.querySelectorAll("*").forEach(proc);
    };
    if (root?.nodeType === Node.ELEMENT_NODE) proc(root);
    try { root?.querySelectorAll?.("*").forEach(proc); } catch {}
  }

  // ─────────────────────────────────────────────────────────────
  // 11. MUTATIONOBSERVER (debounced)
  // ─────────────────────────────────────────────────────────────

  const observers = [];                 // alle aktiven Observer – stop() trennt sie
  let observedRoots = new WeakSet();    // Shadow Roots mit eigenem Observer

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
      if (isFlushing || !active) return;

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
          if (!active) break;
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
            if (hasGenderCandidate(m.target.nodeValue || "")) {
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
    observers.push(observer);
  }

  function observeHeadChanges(doc = document) {
    if (!doc?.head) return;
    // Gebündelt: Werbe-/Tracking-Skripte ändern den <head> oft dutzendfach pro Sekunde.
    let queued = false;
    const run = () => {
      queued = false;
      if (!active) return;
      normalizeDocumentTitle(doc);
      normalizeMetaTags(doc);
      normalizeJsonLdScripts(doc);
    };
    const observer = new MutationObserver(() => {
      if (!queued) { queued = true; setTimeout(run, 50); }
    });
    observer.observe(doc.head, {
      childList: true, subtree: true, attributes: true, characterData: true,
      attributeFilter: ["content"],
    });
    observers.push(observer);
  }

  // ─────────────────────────────────────────────────────────────
  // 12. START / STOP / INIT (wird nach Config-Laden aufgerufen)
  // ─────────────────────────────────────────────────────────────

  function start() {
    if (active) return;
    active = true;
    init().catch(err => debug("Fehler bei der Verarbeitung:", err));
  }

  function stop() {
    active = false;
    observers.splice(0).forEach(o => o.disconnect());
    observedRoots = new WeakSet();
    pageStems.clear();
  }

  async function init() {
    const root = document.documentElement;
    if (!root) return;
    // Observer zuerst: Was die Seite während des (asynchronen) Erstdurchlaufs nachlädt
    // oder ändert, geht so nicht verloren.
    observeGenderedLanguage(root);
    observeHeadChanges();
    collectPageStems(root);
    normalizeDocumentTitle();
    normalizeMetaTags();
    normalizeJsonLdScripts();
    normalizeAllAttributes(root);
    normalizeSvgText(root);
    normalizeShadowDom(root);
    await replaceGenderedLanguageInDOM(root);
    if (IS_TOP_FRAME) debug("NoGender v" + VERSION + " aktiv auf:", location.hostname);
  }

  // Reine Funktionen für die Testsuite exportieren (nur unter Node/CommonJS;
  // im Browser-Content-Script ist `module` undefiniert und dieser Block inaktiv).
  if (typeof module !== "undefined" && module.exports) {
    module.exports = {
      LEXICON,
      PSEUDO_FEM,
      PARTICIPLE,
      FALSE_POSITIVES,
      wiktCache,
      hasGenderCandidate,
      applyPatterns,
      collectLookupStems,
      parseWiktionaryFlexion,
      preserveCase,
      toPlural,
      toSingular,
      splitCompound,
      resolveForm,
      replaceStem,
      normalizeGenderedText,
    };
  }

})();
