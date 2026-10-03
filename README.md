# NoGender

Eine Firefox-Erweiterung, die **künstlich gegenderte Formen** auf Webseiten durch
natürliches Deutsch ersetzt – z. B. `Ärzt:innen` → `Ärzte`, `Lehrer*innen` → `Lehrer`,
`jede:r` → `jeder` – und **Doppelnennungen** kürzt: `Bürgerinnen und Bürger` → `Bürger`.
Natürliche Formen (`Ärztin`, `Lehrerinnen`, `meine Freundinnen`) bleiben unangetastet;
nur wo dieselbe Gruppe zusätzlich im Maskulinum genannt wird, entfällt die Dopplung.

Die Erweiterung arbeitet vollständig lokal. Die einzige optionale Netzanfrage ist ein
Lookup auf [de.wiktionary.org](https://de.wiktionary.org), um seltene Pluralformen
korrekt aufzulösen (siehe [Datenschutz](#datenschutz)).

## Funktionsumfang

- **Viele Marker**: `:`, `*`, `·`, `•`, `‧`, `∙`, `⋅`, `⋆`, `_`, `/` sowie die
  typografischen Varianten `∗`, `⁎`, `꞉`, `∶` (z. B. `Mieter:innen`, `Mieter*innen`, `Mieter_innen`).
- **Singular & Plural**: `Ärzt:in` → `Ärztin`, `Ärzt:innen` → `Ärzte`.
- **Binnen-I**: `LehrerInnen` → `Lehrer`, `BürgerIn` → `Bürger`.
- **Klammerformen**: `Lehrer(innen)` → `Lehrer`, `Bürger(in)` → `Bürger`.
- **Adjektiv-/Pronomenformen**: `jede:r` → `jeder`, `ein:e` → `ein`, `jeder:m` → `jedem`.
- **Artikel-/Pronomenpaare**: `der*die Nutzer*in` → `der Nutzer`, `sie/er` → `er`,
  `seine:ihre` → `seine`. Nach solchen Determinativen passt sich auch das Nomen an
  (`jede:r Ärzt:in` → `jeder Arzt`).
- **Dativ-Plural** (konservativ): `nach Förder:innen` → `nach Förderern`, `mit Lehrer:innen` → `mit Lehrern` (nur bei eindeutigem Auslöser, siehe [bekannte Einschränkungen](#bekannte-einschränkungen)).
- **Artikel-Kongruenz im Singular**: `Die Kolleg:in` → `Der Kollege`, `Eine Mitarbeiter:in` → `Ein Mitarbeiter` (nur bei großgeschriebenem Determinativ am Satzanfang).
- **Doppelnennungen** (abschaltbar): `Bürgerinnen und Bürger` und `Bürger und Bürgerinnen`
  → `Bürger` – die Reihenfolge spielt keine Rolle. Ebenso mit `oder`, `sowie`, `bzw.`, `/`,
  `&` und Komma, im Dativ (`mit Lehrerinnen und Lehrern` → `mit Lehrern`), im Singular mit
  Artikeln (`die Ärztin oder der Arzt` → `der Arzt`, `jede Schülerin und jeder Schüler` →
  `jeder Schüler`), in Anreden (`Liebe Kolleginnen, liebe Kollegen` → `Liebe Kollegen`), mit
  Ergänzungsstrich (`Kinderärztinnen und -ärzte` → `Kinderärzte`, `Bürgerinnen- und
  Bürgerbeteiligung` → `Bürgerbeteiligung`) und als Pronomenpaar (`jede und jeder` → `jeder`).
  Wo beide Formen Information tragen, bleibt der Text stehen (siehe
  [Doppelnennungen](#doppelnennungen)).
- **Genus-Kürzel**: `Mitarbeiter (m/w/d)` → `Mitarbeiter`, ebenso `(m/f/d)`, `(w/m/x)`,
  `(all genders)`, `(gn)`.
- **Indefinitpronomen**: `mensch`/`frau` (als Ersatz für „man") → `man`.
- **Komposita**: `Bewegungsaktivist*innen` → `Bewegungsaktivisten`,
  `Lehrer*Innenzimmer` → `Lehrerzimmer`.
- **Lexikon + Wiktionary**: ein eingebautes Lexikon häufiger Personenbezeichnungen,
  ergänzt um einen abschaltbaren Wiktionary-Lookup für seltenere Wörter.
- **Vollständige Seitenabdeckung**: Textknoten, Attribute (`title`, `alt`, `aria-label`
  …), `<meta>`-Tags, Seitentitel, JSON-LD, SVG-Text und Shadow DOM. Dynamisch
  nachgeladene Inhalte werden über einen `MutationObserver` mitverarbeitet.
- **Schont Eingaben und Code**: `input`, `textarea` und `contenteditable` werden nie
  verändert, ebenso Text in `pre`, `code`, `kbd` und `samp` – auch tief verschachtelt
  (Syntax-Highlighting) und auch, wenn er nachträglich hineingestreamt wird (KI-Chats).
- **Vorsichtig bei Mehrdeutigem**: `Termin: in zwei Wochen`, `Farbe: innen weiß` oder
  `Tür (innen)` sind normales Deutsch und bleiben stehen. Formen mit Leerzeichen am
  Marker (`Mieter: innen`) werden nur bei belegten Personenbezeichnungen ersetzt – Beleg
  ist das Lexikon, Wiktionary oder dasselbe Wort kompakt gegendert irgendwo auf der
  Seite (`Mieter:innen`). Großes „I“ direkt am Marker (`Mieter*Innen`) gilt als eindeutig,
  außer nach `/` (`Außen/Innen`).

### Beispiele

| Vorher | Nachher |
| --- | --- |
| `Liebe Kolleg:innen` | `Liebe Kollegen` |
| `Ärzt:innen und Patient*innen` | `Ärzte und Patienten` |
| `jede:r Einzelne` | `jeder Einzelne` |
| `die Sklav*innen` | `die Sklaven` |
| `könnte mensch sagen` | `könnte man sagen` |
| `Liebe Bürgerinnen und Bürger` | `Liebe Bürger` |
| `mit Lehrern und Lehrerinnen` | `mit Lehrern` |
| `Die Ärztin oder der Arzt entscheidet` | `Der Arzt entscheidet` |

### Doppelnennungen

Gekürzt wird auf das Maskulinum, und nur, wenn das andere Glied nachweislich das Maskulinum
zum selben Wort ist (`Ärztinnen` ↔ `Ärzte`, `Bäuerinnen` ↔ `Bauern`). Es bleibt so stehen,
wie es im Text steht, samt Kasus. `Lehrerinnen und Schüler` oder `Damen und Herren` sind
keine Doppelnennungen.

Im Zweifel bleibt der Text unverändert – lieber eine Doppelnennung zu viel als eine
verfälschte Aussage. Diese **Ausschlussgruppe** wird nie gekürzt:

- **Zahlen und Mengen**: `40 Lehrerinnen und 60 Lehrer`, `rund 40 Lehrerinnen und Lehrer`,
  `Tausende Bürgerinnen und Bürger`, `Lehrerinnen und Lehrer (40 bzw. 60)`.
- **Vergleich, Anteile, Geschlecht als Thema** im selben Satz: `Unterschiede zwischen
  Ärztinnen und Ärzten`, `der Anteil der Professorinnen und Professoren`, Sätze mit
  „Frauen", „Männer", „weiblich", „Geschlecht", „Gleichberechtigung", „%" usw. – auch Texte
  über das Gendern selbst (`Doppelnennungen wie Bürgerinnen und Bürger`).
- **Betonung, Auswahl, Zuordnung**: `sowohl … als auch`, `entweder … oder`, `egal ob
  Lehrerin oder Lehrer`, Fragen mit „oder" (`Eher Lehrerinnen oder Lehrer?`), `Lehrerinnen
  bzw. Lehrer erhalten 100 bzw. 200 Euro`, Paare (`Ehepaare aus Ärztinnen und Ärzten`).
- **Zitat statt Verwendung**: `Die Paarform „Bürgerinnen und Bürger“`; ebenso Sätze über
  Sprache („Schreibweise", „Formulierung", „Anrede", „sprachlich").
- **Komma als Satzgrenze**: `Erst kamen die Lehrerinnen, Lehrer folgten später`,
  `die Lehrerinnen, die Lehrer ausbilden`. Ein Komma zählt nur als Bindeglied, wenn das
  zweite Glied eine Phrase abschließt (`Liebe Kolleginnen, liebe Kollegen,`).
- **Zwei Personen im Singular**: `der Arzt und die Ärztin`, `ein Lehrer und eine Lehrerin`.
  Im Singular wird nur bei „oder", „bzw." und „/" gekürzt, bei `jede … und jeder …` und in
  Anreden (`Liebe Kollegin, lieber Kollege`).
- **Unpassende Beifügungen**: `die jungen Lehrerinnen und die alten Lehrer`,
  `Wir suchen Lehrerinnen, nicht Lehrer`, `der Arzt oder eine Ärztin`.
- **Grammatik nicht sicher**: `die Ärztin oder Arzt` – der Artikel passt nicht zum Maskulinum.
- **Singular ohne Artikel ohne Personenbeleg** (Lexikon, Wiktionary, Endung wie -er):
  `Augustin oder August`.

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

- **Ein/Aus-Schalter** für die gesamte Erweiterung. Beim Ausschalten wird nur der
  sichtbare Tab neu geladen; Hintergrund-Tabs ändern ab sofort nichts mehr und zeigen
  den Originaltext beim nächsten Laden (so gehen dort keine ungespeicherten Eingaben verloren).
- **Partizip-Formen**: `Studierende` → `Studenten` usw. separat abschaltbar.
- **Doppelnennungen**: `Bürgerinnen und Bürger` → `Bürger` usw. separat abschaltbar.
- **Wiktionary-Lookup**: abschaltbar; dann arbeitet die Erweiterung ohne jede Netzanfrage
  nur mit dem eingebauten Lexikon und den Pluralregeln.
- **Ausschlussliste**: einzelne Domains von der Verarbeitung ausnehmen –
  entweder die aktuelle Seite per Klick oder eine Domain manuell hinzufügen.
- **Debug-Modus**: protokolliert jede Ersetzung in der Browser-Konsole (F12).

## Funktionsweise (Kurzüberblick)

1. Ein Vorfilter (`hasGenderCandidate`) prüft mit billigen, notwendigen Bedingungen
   (Buchstabe + Marker + „in“, Binnen-I, „(m/…“ …), ob ein Textknoten überhaupt eine
   gegenderte Form enthalten kann. Die allermeisten Knoten scheiden hier aus.
2. Trifft das zu, laufen spezialisierte Regex-Muster (Singular, Plural, Binnen-I,
   Klammern, Adjektivformen, Artikelpaare …) nacheinander über den Text.
   Kompakte Formen (`Lehrer:innen`) gelten als eindeutig; mit Leerzeichen oder großem
   „I“ braucht es einen Beleg, dass der Stamm eine Personenbezeichnung ist
   (`markerFormKind`).
3. Der erkannte **Wortstamm** wird aufgelöst – zuerst über das eingebaute, maßgebliche
   `LEXICON`, dann über den Wiktionary-Cache, zuletzt über regelbasierte
   Plural-/Singularbildung (`toPlural`, `toSingular`).
4. **Komposita** werden vom Wortende her am längsten passenden Stamm zerlegt
   (`Sozialarbeiter` → `Sozial` + `arbeiter`).
5. Groß-/Kleinschreibung des Originals wird übernommen (`preserveCase`).
6. Zuletzt kürzt `collapseDoublets` Doppelnennungen – mit eigenem Vorfilter
   (`hasDoubletCandidate`) und auf dem bereits normalisierten Text, sodass auch
   `Lehrerinnen und Lehrende` zu `Lehrer` wird. `isMascCounterpart` prüft das Paar,
   `isDoubletExcluded` und `singularDoubletOk` die Ausschlussgruppe.

Bevor ein Block von Textknoten verarbeitet wird, sammelt `collectLookupStems` die Stämme,
die sich lokal nicht auflösen lassen, und lädt sie gebündelt aus dem Cache bzw. von
Wiktionary. Als Personenbeleg zählt dort der Abschnitt „Weibliche Wortformen“ – dass ein
Wort ein Substantiv ist („Termin“, „Farbe“), genügt nicht.

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

Die Versionsnummer steht nur in `manifest.json` (Popup und Content-Script lesen sie von
dort) und in `package.json`; ein Test prüft, dass beide übereinstimmen.

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
  `de.wiktionary.org`, um Beugungsformen unbekannter Wörter nachzuschlagen – und nur,
  wenn Lexikon und Regeln nicht ausreichen. Übertragen wird dabei nur das
  nachzuschlagende Wort: ohne Cookies und ohne Referer, also ohne Bezug zur besuchten
  Seite. Der Lookup lässt sich im Popup abschalten.
- Ergebnisse werden 30 Tage im Speicher der Erweiterung (`browser.storage.local`)
  zwischengespeichert. Webseiten können diesen Cache nicht lesen.
- Berechtigungen: `storage` für Einstellungen und Cache, `activeTab` für die Domain des
  aktuellen Tabs im Popup („aktuelle Seite ausschließen“) – nur solange das Popup offen ist.

## Mitwirken

Beiträge sind willkommen. Für den Einstieg eignen sich besonders:

- **Lexikon erweitern**: weitere Personenbezeichnungen in `LEXICON` ergänzen. Wichtig:
  Schlüssel ist immer der **gegenderte Stamm** (ohne End-`e`), z. B. `kolleg` für
  „Kollege"/„Kolleg:innen", nicht `kollege`. Optional: `m` für das Maskulinum, wenn
  `sg` feminin ist (`ärzt`: `sg:"Ärztin"`, `m:"Arzt"`), und `exact: true`, wenn der
  Stamm nicht als Kompositum-Kopf gelten darf (`zeug` – sonst wäre „Fahrzeug“ eine Person).

Bitte vor einem Pull Request `npm test` und `npm run lint` ausführen und neue Fälle
mit Tests absichern.

### Bekannte Einschränkungen

- **Kasus-Erkennung nur teilweise**: Erkannt wird der **Dativ Plural** bei eindeutigen
  Auslösern (Dativ-Präpositionen, `den` + Plural). **Nicht** behandelt werden
  Wechselpräpositionen (`in`/`an`/`auf` …, mehrdeutig Dativ/Akkusativ), verbregierter
  Dativ (`hilft den …:innen`), Dativ Singular und Genitiv – dort bleibt es beim
  Nominativ. In Aufzählungen erhält nur das erste Glied direkt nach dem Auslöser den
  Dativ (`von Lehrern, Schüler und Eltern`).
- **Artikel-Kongruenz nur am Satzanfang**: Der feminine Artikel wird nur an das
  Maskulinum angepasst, wenn er **großgeschrieben** direkt vor der Singularform steht
  (`Die Kolleg:in` → `Der Kollege`). Kleingeschrieben mitten im Satz (`die Kolleg:in`,
  mehrdeutig Nom./Akk.) bleibt der Artikel unverändert; ein dazwischenstehendes Adjektiv
  (`Die neue Kolleg:in`) wird nicht mitdekliniert.
- **`mensch`/`frau` → `man`**: nur kleingeschrieben und nicht nach einem Determinativ
  (`jeder mensch`, `meine frau` bleiben). Nach einem Adjektiv (`junge frau`) kann das
  Substantiv in durchgängig kleingeschriebenen Texten noch fälschlich ersetzt werden.
- **Formen mit Leerzeichen am Marker** (`Maurer: innen`) und großem „I“ nach `/`
  (`Maurer/Innen`) brauchen einen Personenbeleg: Lexikon, Wiktionary oder dasselbe Wort
  kompakt gegendert auf derselben Seite. Steht so ein Wort allein und ist der Lookup
  abgeschaltet, bleibt es stehen.
- **Pluralregeln** sind Faustregeln: seltene Ausnahmen (z. B. `Barbar:innen` →
  `Barbare` statt `Barbaren`) löst nur Wiktionary richtig auf.
- **Doppelnennungen** werden nur innerhalb eines Textknotens erkannt; verteilt sich eine
  über mehrere HTML-Elemente (`<a>Bürgerinnen</a> und Bürger`), bleibt sie stehen. Paare
  aus verschiedenen Wörtern (`Prinzessinnen und Prinzen`, `Kauffrauen und Kaufmänner`) und
  Personalpronomen (`er oder sie`, `ihr bzw. sein`) werden nicht gekürzt. Steht vor einer
  Aufzählung keine bekannte Personengruppe, entsteht eine Aufzählung ohne „und"
  (`Apotheker, Ärztinnen und Ärzte` → `Apotheker, Ärzte`).

## Lizenz

[GNU General Public License v3.0 oder später](LICENSE) (GPL-3.0-or-later).

## Danksagung

Beugungsformen stammen aus dem [deutschsprachigen Wiktionary](https://de.wiktionary.org),
dessen Inhalte unter [CC BY-SA](https://creativecommons.org/licenses/by-sa/4.0/) stehen.
