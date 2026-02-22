# Changelog

## 1.5 (2026-02-22)

### Neue Features
- **Aktivieren / Deaktivieren**: Globaler Ein-/Aus-Schalter im Popup.
- **Domain-Blockliste**: User kann beliebige Seiten (z.B. github.com) vom Scan ausschließen. Aktuelle Seite lässt sich mit einem Klick hinzufügen.
- **Wiktionary-Lookup**: Unbekannte Stämme werden anonym über de.wiktionary.org nachgeschlagen und liefern alle 8 Kasus-Formen (Nom/Gen/Dat/Akk × Sg/Pl). Ergebnisse werden in sessionStorage gecacht (max. 500 Einträge).
- **Kasus-Kontext**: Artikel und Präpositionen vor einem Wort (der/die/das/dem/den/mit/für/…) werden erkannt und für die korrekte Wortform genutzt (z.B. „mit der Ärztin" → „mit dem Arzt").
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
