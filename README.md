# NoGender

Eine Firefox-Erweiterung, die **künstlich gegenderte Formen** auf Webseiten durch
natürliches Deutsch ersetzt – z. B. `Ärzt:innen` → `Ärzte`, `Lehrer*innen` → `Lehrer`,
`jede:r` → `jeder`. Natürliche Formen (`Ärztin`, `Lehrerinnen`, `meine Freundinnen`)
bleiben **immer** unangetastet.

Die Erweiterung arbeitet vollständig lokal. Die einzige optionale Netzanfrage ist ein
Lookup auf [de.wiktionary.org](https://de.wiktionary.org), um seltene Pluralformen
korrekt aufzulösen (siehe [Datenschutz](#datenschutz)).

## Funktionsumfang

- **Viele Marker**: `:`, `*`, `·`, `•`, `‧`, `∙`, `⋅`, `⋆`, `_`, `/`
  (z. B. `Mieter:innen`, `Mieter*innen`, `Mieter_innen`).
- **Singular & Plural**: `Ärzt:in` → `Ärztin`, `Ärzt:innen` → `Ärzte`.
- **Binnen-I**: `LehrerInnen` → `Lehrer`, `BürgerIn` → `Bürger`.
- **Klammerformen**: `Lehrer(innen)` → `Lehrer`, `Bürger(in)` → `Bürger`.
- **Adjektiv-/Pronomenformen**: `jede:r` → `jeder`, `ein:e` → `ein`, `jeder:m` → `jedem`.
- **Genus-Kürzel**: `Mitarbeiter (m/w/d)` → `Mitarbeiter`.
- **Indefinitpronomen**: `mensch`/`frau` (als Ersatz für „man") → `man`.
- **Komposita**: `Bewegungsaktivist*innen` → `Bewegungsaktivisten`,
  `Lehrer*Innenzimmer` → `Lehrerzimmer`.
- **Lexikon + Wiktionary**: ein eingebautes Lexikon häufiger Personenbezeichnungen,
  ergänzt um einen optionalen Wiktionary-Lookup für seltenere Wörter.
- **Vollständige Seitenabdeckung**: Textknoten, Attribute (`title`, `alt`, `aria-label`
  …), `<meta>`-Tags, Seitentitel, JSON-LD, SVG-Text und Shadow DOM. Dynamisch
  nachgeladene Inhalte werden über einen `MutationObserver` mitverarbeitet.
- **Schont Eingaben**: `input`, `textarea` und `contenteditable` werden nie verändert.

### Beispiele

| Vorher | Nachher |
| --- | --- |
| `Liebe Kolleg:innen` | `Liebe Kollegen` |
| `Ärzt:innen und Patient*innen` | `Ärzte und Patienten` |
| `jede:r Einzelne` | `jeder Einzelne` |
| `die Sklav*innen` | `die Sklaven` |
| `könnte mensch sagen` | `könnte man sagen` |

## Installation

### Aus dem Quelltext (temporär, zum Testen)

1. Repository klonen oder als ZIP herunterladen.
2. In Firefox `about:debugging#/runtime/this-firefox` öffnen.
3. **„Temporäres Add-on laden…"** klicken und die `manifest.json` auswählen.

Die Erweiterung bleibt bis zum nächsten Firefox-Neustart aktiv.

### Mit `web-ext` (für die Entwicklung)

```bash
npm install
npm start          # startet Firefox mit geladener Erweiterung (Live-Reload)
```

## Bedienung

Über das Symbol in der Symbolleiste öffnet sich das Popup:

- **Ein/Aus-Schalter** für die gesamte Erweiterung.
- **Ausschlussliste**: einzelne Domains von der Verarbeitung ausnehmen –
  entweder die aktuelle Seite per Klick oder eine Domain manuell hinzufügen.
- **Debug-Modus**: protokolliert jede Ersetzung in der Browser-Konsole (F12).

## Funktionsweise (Kurzüberblick)

1. Ein zusammengesetztes Vorfilter-Regex (`reAnyGenderPattern`) prüft schnell, ob ein
   Textknoten überhaupt eine gegenderte Form enthält.
2. Trifft das zu, laufen spezialisierte Regex-Muster (Singular, Plural, Binnen-I,
   Klammern, Adjektivformen …) nacheinander über den Text.
3. Der erkannte **Wortstamm** wird aufgelöst – zuerst über den Wiktionary-Cache, dann
   über das eingebaute `LEXICON`, zuletzt über regelbasierte Pluralbildung.
4. **Komposita** werden vom Wortende her am längsten passenden Stamm zerlegt
   (`Sozialarbeiter` → `Sozial` + `arbeiter`).
5. Groß-/Kleinschreibung des Originals wird übernommen (`preserveCase`).

Der gesamte relevante Code steckt in [`nogender.js`](nogender.js); das Popup in
[`popup.html`](popup.html)/[`popup.js`](popup.js).

## Entwicklung

Voraussetzung: Node.js ≥ 18.

```bash
npm install        # Dev-Abhängigkeiten (ESLint, web-ext)
npm test           # Testsuite (Node-Test-Runner, ohne Netz/Browser)
npm run lint       # ESLint
npm run lint:ext   # web-ext lint (Manifest-/Store-Prüfung)
npm run build      # signierfertiges ZIP unter web-ext-artifacts/
```

Die Testsuite (`test/normalize.test.js`) lädt `nogender.js` direkt und prüft die reine
Normalisierungslogik. Im Browser-Kontext bootet die Datei wie gewohnt; unter Node
exportiert sie ihre reinen Funktionen (per `module.exports`), ohne Browser-APIs
anzufassen.

### Projektstruktur

```
manifest.json      WebExtension-Manifest (MV2, Firefox)
nogender.js        Content-Script – die gesamte Ersetzungslogik
popup.html/.js     Bedienoberfläche (Ein/Aus, Ausschlussliste, Debug)
test/              Testsuite (Node-Test-Runner)
icons/             Symbole
CHANGELOG.md       Versionshistorie
```

## Datenschutz

- Es werden **keine** personenbezogenen Daten erhoben, gespeichert oder übertragen.
- Einstellungen liegen ausschließlich lokal in `browser.storage.local`.
- Die **einzige** ausgehende Anfrage geht an die öffentliche API von
  `de.wiktionary.org`, um Beugungsformen unbekannter Wörter nachzuschlagen.
  Übertragen wird dabei nur das nachzuschlagende Wort (kein Bezug zur besuchten Seite).
  Ergebnisse werden für die Sitzung zwischengespeichert.

## Mitwirken

Beiträge sind willkommen. Für den Einstieg eignen sich besonders:

- **Lexikon erweitern**: weitere Personenbezeichnungen in `LEXICON` ergänzen.
- **`-e`-Lemma-Schlüssel**: einige Lexikon-Einträge (`kollege`, `biologe`) sind mit dem
  vollständigen Wort als Schlüssel hinterlegt, während der gegenderte Stamm ohne `-e`
  ankommt (`Kolleg:innen` → Stamm `Kolleg`); der Eintrag greift dadurch nicht.

Bitte vor einem Pull Request `npm test` und `npm run lint` ausführen und neue Fälle
mit Tests absichern.

### Bekannte Einschränkungen

- **Keine Kasus-Erkennung**: Aufgelöst wird stets der Nominativ. Nach „nach Förder:innen"
  entsteht `Förderer` (Nominativ), nicht der grammatisch erwartete Dativ `Förderern`.
- **`mensch`/`frau` → `man`**: nur kleingeschrieben; durchgängig kleingeschriebenes
  `frau` im Substantiv-Sinn kann fälschlich mit-ersetzt werden.

## Lizenz

[GNU General Public License v3.0 oder später](LICENSE) (GPL-3.0-or-later).

## Danksagung

Beugungsformen stammen aus dem [deutschsprachigen Wiktionary](https://de.wiktionary.org),
dessen Inhalte unter [CC BY-SA](https://creativecommons.org/licenses/by-sa/4.0/) stehen.
