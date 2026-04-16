# Changelog
## 1.8 (2026-04-16)

### Fehlerbehebungen
- **URL- und Slug-Schutz**: Die Marker `/` und `_` in `reInWithMarker`, `reInnenWithMarker` und `reAdjNWithMarker` führten zu False-Positives in URLs (`foo.de/in/impressum`), Pfaden (`path/n/foo`) und Slugs (`foo_in_bar`). Der Lookahead wurde erweitert um auch diese Zeichen als Wortfortsetzung zu werten – das jeweilige Gendering-Suffix wird nur noch am tatsächlichen Wortende erkannt. Die Marker selbst bleiben erhalten, damit echte Schreibweisen wie `Lehrer/in` weiterhin funktionieren.
- **Reload-Logik bei Status-Wechsel**: Bisher lud die Seite nur beim Deaktivieren oder Blocken automatisch neu. Wurde eine Domain wieder von der Blockliste entfernt oder die Erweiterung reaktiviert, blieb der alte Zustand bis zum manuellen Reload bestehen. Jetzt erkennt die Extension den Wechsel in beide Richtungen über ein internes `wasActive`-Flag; Änderungen an anderen Domains der Blockliste lösen keinen unnötigen Reload aus.
- **aria-describedby nicht mehr normalisiert**: Das Attribut enthält Element-IDs, keinen lesbaren Text. Es wurde aus `NORMALIZABLE_ATTRIBUTES` entfernt.
- **Versions-Drift im Debug-Log**: Der Init-Log zeigte noch `v1.7.1`, obwohl Manifest und Popup bereits auf `1.7.2` waren. Die Version wird jetzt aus einer einzigen `VERSION`-Konstante im Content-Script gelesen.
- **Konsistente Debug-Ausgaben**: Der „Deaktiviert oder geblockt"-Log lief bisher immer über `console.log`, unabhängig vom Debug-Schalter. Jetzt läuft er über `debug()`.

### Performance
- **Fetch-Deduplizierung**: Parallele Wiktionary-Lookups für denselben Stamm wurden bisher doppelt ausgelöst, und zweite Aufrufer bekamen den `null`-Sentinel des ersten Calls – die später eintreffenden Formen gingen verloren. Eine in-flight-Promise-Map stellt jetzt sicher, dass mehrere Aufrufer auf dasselbe Ergebnis warten.
- **Debounced Cache-Persist**: `persistWiktCache` schrieb bisher bei jedem neuen Stamm die komplette Map synchron in den `sessionStorage`. Bei vielen Lookups hintereinander summiert sich das. Schreibvorgänge werden jetzt per `schedulePersist()` gebündelt (2 s Debounce) und per `pagehide`-Listener vor dem Verlassen der Seite geflusht.
- **Guard vor JSON.stringify im Debug-Pfad**: `processBatch` serialisierte Vorher/Nachher-Text auch dann, wenn Debug deaktiviert war. Ein `if (debugEnabled)` vor dem Call spart die Arbeit auf Seiten mit vielen Ersetzungen.

### Wartung
- **Zentrale `VERSION`-Konstante** in `nogender.js` ersetzt das hart kodierte Versions-String-Literal im Debug-Log. Manifest und Popup-HTML tragen die Version wie bisher separat.
- **Kommentar zu `reAnyGenderPattern`**: Das zusammengeführte Prefilter-Pattern nutzt bewusst das `i`-Flag, obwohl einzelne Subpatterns (`reBinnenIPlural`/`reBinnenISingular`) case-sensitiv definiert sind. Ein Kommentar im Code schützt vor versehentlichem Entfernen.

---

## 1.7.2 (2026-04-13)

### Fehlerbehebungen
- **Leerzeichen nach Gender-Marker**: Formen wie „Mieter: innen" oder „Mieter: in" (mit Leerzeichen nach dem Doppelpunkt) werden jetzt korrekt erkannt. Betrifft `reInnenWithMarker`, `reInWithMarker` und `reInnenCompound`.

---

## 1.7.1 (2026-04-02)

### Neue Funktionen
- **Kompositum-Erkennung nach Gender-Marker**: Gegenderte Komposita wie „Architekt:Innenbüros" oder „Lehrer*Innenzimmer" werden jetzt korrekt erkannt und zu „Architektenbüros" bzw. „Lehrerzimmer" aufgelöst. Bisher verhinderte der Lookahead nach „innen", dass angehängte Wortteile erkannt wurden.
- **Personenstamm-Prüfung (`isLikelyPersonStem`)**: Bevor ein Kompositum ersetzt wird, prüft die Extension per LEXICON, Kompositazerlegung und Wiktionary-Cache, ob der Stamm eine Personenbezeichnung ist. Dadurch bleiben nicht-gegenderte Formen wie „Außen/Innenräume" oder „Außen:Innenbereich" unverändert.
- **LEXICON stark erweitert**: Von 29 auf 81 Einträge. Neue Kategorien: -eur (Ingenieur, Redakteur), -ekt (Architekt), -at (Kandidat, Diplomat), -oge (Biologe), sowie viele häufig gegenderte -er/-or/-ist-Formen. Umlaut-Stämme (bäuer→Bäuerin, köch→Köchin) werden korrekt auf die natürliche Femininform zurückgeführt.

### Fehlerbehebungen
- **React-Hydration-Bug auf SPAs (LinkedIn, XING u.a.)**: Wenn React nach der Extension den Text zurück auf die gegenderte Form überschrieb, wurde der Knoten nicht erneut verarbeitet, da er im `processed`-WeakSet stand. Der MutationObserver prüft jetzt bei `characterData`-Änderungen, ob erneut Gendering vorliegt, und verarbeitet den Knoten ggf. nochmal.
- **Umlaut-Singular korrekt**: „Ärzt:in", „Köch:in", „Bäuer:in", „Anwält:in" werden jetzt zur natürlichen Femininform aufgelöst (Ärztin, Köchin, Bäuerin, Anwältin) statt zum grammatisch falschen Maskulinum.

---

## 1.6.1 (2026-03-28)

### Fehlerbehebungen
- **False-Positive bei Schrägstrich-Komposita**: Wörter wie „Schule/Inspektion" oder „Außen/Innenraum" wurden fälschlich als Gendering erkannt, weil `/` als Marker gewertet und das folgende Wort ab „In…" als Suffix interpretiert wurde. Die Patterns `reInnenWithMarker` und `reInWithMarker` erzwingen jetzt per negativem Lookahead `(?![\p{L}])`, dass nach „in"/„innen" kein weiterer Buchstabe folgt.

---

## 1.6 (2026-03-03)

### Änderungen
- **Performance-Optimierung**: Debug-Flag wird gecacht statt pro Treffer aus `storage` gelesen; Mutation-Flushes laufen nicht mehr überlappend; bei dynamischen DOM-Updates werden verschachtelte Subtrees dedupliziert, um doppelte Arbeit zu vermeiden.
- **Split-Marker-Verarbeitung gezielter**: Kandidaten für die Marker-Normalisierung werden textnah gesammelt statt pauschal über alle Elemente iteriert.
- **Popup-Hinweis präzisiert**: Die frühere pauschale Deaktivierungs-Empfehlung für Code/KI-Seiten wurde in einen Vorsichtshinweis geändert. Bekannte CLI-Fehler gelten als behoben; es bleibt ein Hinweis auf seltene False-Positives beim Kopieren von Code.

---

## 1.5.3 (2026-02-26)

### Fehlerbehebungen
- **Popup CSS**: Styling-Probleme im Popup behoben.
- **Email-Funktion**: Fehler in der Email-Funktionalität korrigiert.

## 1.5.2 (2026-02-26)

### Änderungen
- **Bindestrich als Gender-Marker entfernt**: `-in` / `-innen` / `-n` werden nicht mehr als Gendering-Marker erkannt. Der Bindestrich ist als Gendering-Form äußerst selten, kollidiert aber häufig mit normalen deutschen Komposita (`Standard-installationen`), CLI-Flags (`tail -n`, `git log -n`), URLs und Code-Schnipseln. Die Regex-Patterns sind dadurch wieder deutlich einfacher und robuster.
- **Warnung im Popup**: Neuer Hinweis-Block, der empfiehlt, NoGender auf Seiten mit Code oder KI-generierten Inhalten (ChatGPT, Claude, Gemini …) zu deaktivieren oder per Blockliste auszuschließen, um unbeabsichtigte Veränderungen an Terminal-Befehlen und Codebeispielen zu vermeiden.

---

## 1.5.1 (2026-02-26)

### Fehlerbehebungen
- **Falsch-Positiv: CLI-Flags (`tail -n`, `git log -n`)**: `reAdjNWithMarker` enthielt den Bindestrich im Marker-Zeichensatz. Dadurch wurde z.B. `tail -n 100` zu `tailn 100` verfälscht. Bindestrich aus diesem Pattern entfernt; Adjektiv-Gendering (z.B. `eine*n`) funktioniert weiterhin.
- **Falsch-Positiv: Wörter mit Bindestrich-Präfix (`Standard-installationen`)**: `reInWithMarker` und `reInnenWithMarker` hatten kein Wortende-Anchoring beim Bindestrich-Marker. Dadurch wurde `Standard-in[stallationen]` fälschlicherweise als Gendering erkannt. Pattern in zwei Alternations aufgeteilt: Nicht-Bindestrich-Marker (`:`, `*`, `_` …) behalten das alte Verhalten (nötig für Komposita wie `Bundesärzt:innenkammer`); beim Bindestrich-Marker wird ein Lookahead `(?![\p{Ll}])` ergänzt, der sicherstellt dass nach `in`/`innen` kein Kleinbuchstabe folgt. `Lehrer-in` und `Lehrer-innen` werden weiterhin korrekt erkannt.

---

## 1.5 (2026-02-22)

### Neue Features
- **Aktivieren / Deaktivieren**: Globaler Ein-/Aus-Schalter im Popup.
- **Domain-Blockliste**: User kann beliebige Seiten (z.B. github.com) vom Scan ausschließen. Aktuelle Seite lässt sich mit einem Klick hinzufügen.
- **Wiktionary-Lookup**: Unbekannte Stämme werden anonym über de.wiktionary.org nachgeschlagen und liefern alle 8 Kasus-Formen (Nom/Gen/Dat/Akk × Sg/Pl). Ergebnisse werden in sessionStorage gecacht (max. 500 Einträge).
- **Komposita-Erkennung**: Zusammengesetzte Wörter wie „Teamleiter:innen" oder „Bundesärzt:innenkammer" werden korrekt aufgelöst.
- **Debug-Modus**: Im Popup per Klick aktivierbar; gibt Ersetzungen in der Browser-Konsole aus (`[NoGender] ...`).
- **Erweitertes Lexikon**: Neue Einträge für Richter:in, Autor:in, Sprecher:in, Professor:in, Direktor:in, Nutzer:in, Entwickler:in, Forscher:in, Unternehmer:in, Wissenschaftler:in u.v.m.

### Fehlerbehebungen
- **Regex-Bug in `normalizeSplitMarkersInElement`**: `\p{L}` funktioniert nur in RegExp-Objekten mit `u`-Flag – war als String-Literal definiert und wurde daher nie ausgeführt.
- **`lastIndex`-Bug**: Alle globalen Regex werden vor jedem Aufruf zurückgesetzt; verhindert falsche Trefferposition nach `test()`.
- **Falsch-Positive-Filter**: Wörter wie „Heroin", „Protein", „Medizin" werden nicht mehr fälschlicherweise verändert.
- **User-Eingaben ausgenommen**: `<input>`, `<textarea>` und `contenteditable`-Elemente werden vollständig übersprungen (MutationObserver + TreeWalker + Attribute).

### Performance
- **Debounced MutationObserver**: Mutations werden per `requestAnimationFrame` gebatcht; verhindert übermäßige Arbeit bei dynamischen Seiten (GitHub, SPAs).
- **Chunked DOM-Processing**: Der initiale DOM-Scan läuft in 60-Node-Batches mit `setTimeout(0)` dazwischen; blockiert den Haupt-Thread nicht mehr.
- **WeakSet-Cache**: Bereits verarbeitete Text-Nodes werden nicht doppelt geprüft.
- **Wiktionary-Batch-Lookup**: Alle Stämme eines Textes werden parallel nachgeschlagen (Promise.all).

---

## 1.4 (2026-02-13)
- Erkennung von geteilten Markern über mehrere Textknoten erweitert (z.B. "Poster : in").
- Marker-Varianten für Mittelpunkte im Popup dokumentiert.
- Marker-Erkennung auf case-insensitive erweitert (z.B. :in / :In).
- Vorfilter hinzugefügt.

## 1.3 (2026-02-08)
- Icon-Größen korrigiert (48x48 und 128x128 Pixel).
- HTML-Attribute werden normalisiert (title, alt, placeholder, aria-label, aria-describedby, aria-description, data-tooltip, data-title, data-original-title, label).
- SVG Text-Elemente werden normalisiert (text, tspan, textPath).
- Shadow DOM Unterstützung hinzugefügt (Web Components werden vollständig durchsucht).
- Vollständige DOM-Abdeckung durch document.documentElement (Head + Body + alle Elemente).
- MutationObserver erweitert für Attribut-Änderungen und Character-Data-Mutationen.
- Android-Support hinzugefügt (Firefox für Android ab Version 142.0).
- Options-Seite hinzugefügt (auf Android über Einstellungen erreichbar).
- Datenschutz-Deklaration im Manifest hinzugefügt (data_collection_permissions: none).

## 1.2 (2026-02-08)
- Versionsnummer im Popup hinzugefügt.
- Titel und Meta-Tags werden im Head normalisiert.
- JSON-LD Inhalte im Head werden normalisiert.

## 1.1 (2026-02-08)
- Entfernt Host-Permissions in `manifest.json`.
- Aktiviert iframe-Support via `all_frames: true` für Content-Scripts.
- Ergänzt Datenschutz-Infotexte im Popup.

## 1.0
- Erste Veröffentlichung.
