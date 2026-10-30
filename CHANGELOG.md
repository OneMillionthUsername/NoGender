# Changelog
## 3.3.0 (2026-10-30)

Doppelnennungen mit Zahlen und Prozentangaben werden jetzt gekürzt. Geändertes Verhalten auf allen Seiten, deshalb ein Minor-Sprung.

Herzlichen Dank an @phisigma für die Meldungen!

### Geändertes Verhalten
- **Doppelnennungen mit Zahl davor** werden gekürzt: „rund 1.500 Polizistinnen und Polizisten" → „rund 1.500 Polizisten", „zehn Prozent der Wählerinnen und Wähler" → „zehn Prozent der Wähler". Mit eigener Zahl je Form bleiben sie stehen („40 Lehrerinnen und 60 Lehrer").
- **Doppelnennungen in Sätzen mit Prozentangabe** werden gekürzt: „Unter den Wählerinnen und Wählern, die … (48 Prozent) …" → „Unter den Wählern, die …".

### Wartung
- **Tests**: 1 neuer Testfall (110 insgesamt).

---

## 3.2.0 (2026-10-21)

Formen mit Leerzeichen am Marker werden nur noch auf ausgewählten Seiten aufgelöst, dazu neue Partizipien. Geändertes Verhalten auf allen Seiten, deshalb ein Minor-Sprung.

### Geändertes Verhalten
- **Formen mit Leerzeichen am Marker** („Kund: innen", „Lehrer :innen") bleiben stehen, außer auf Seiten aus `SPACED_MARKER_DOMAINS`. Kompakte Formen („Kund:innen") und Klammerformen („Lehrer (innen)") gelten weiter überall.

### Neue Funktionen
- **Weitere Partizipien** (Beitrag von @phisigma, #6): „Ausbildende" → „Ausbilder", „Beratende" → „Berater", „Besuchende" → „Besucher", „Radfahrende" → „Radfahrer", „Zufußgehende" → „Fußgänger".

### Wartung
- **Tests**: 8 neue Testfälle (109 insgesamt).
- **Versionen**: `package.json` und `manifest.json` stimmen wieder überein.

---

## 3.1.3 und 3.1.4 (2026-10-09)

Mobilgeräte werden jetzt automatisch erkannt und das Popup füllt den ganzen Bildschirm aus.

## 3.1.2 (2026-10-07)

Fehlerbehebung für einen Absturz beim Seitenstart. Keine neuen Funktionen, deshalb ein Patch-Sprung.

### Fehlerbehebungen
- **Absturz „too much recursion"** auf Seiten mit langen Zeichenketten ohne Leerzeichen (z. B. Meta-Tags mit Base64 oder JSON) behoben.

### Wartung
- **Tests**: 1 neuer Testfall (101 insgesamt).

---

## 3.1.1 (2026-10-03)

Fehlerbehebungen nach einem Test am Forum von derstandard.at. Keine neuen Funktionen, deshalb ein Patch-Sprung.

### Fehlerbehebungen
- **Nachgeladene Web Components** (z. B. das Forum auf derstandard.at) werden jetzt bearbeitet, auch verschachtelte.
- **Geschlossene Shadow Roots** werden jetzt bearbeitet.
- **„Politikern/innen"** ergibt „Politikern" statt „Politikernen" (ebenso „mit Lehrern/innen", „Bauern/innen").

### Wartung
- **Tests**: 1 neuer Testfall (100 insgesamt).

---

## 3.1.0 (2026-10-03)

Doppelnennungen werden auf das Maskulinum gekürzt. Neue Funktion, deshalb ein Minor-Sprung.

### Neue Funktionen
- **Doppelnennungen** („Bürgerinnen und Bürger" → „Bürger"): in beiden Reihenfolgen, mit „und", „oder", „sowie", „bzw.", „/", „&" und Komma; der Kasus bleibt erhalten („mit Lehrerinnen und Lehrern" → „mit Lehrern"). Außerdem:
  - Singular: „die Ärztin oder der Arzt" → „der Arzt", „Jede Schülerin und jeder Schüler" → „Jeder Schüler".
  - Anreden: „Liebe Kolleginnen, liebe Kollegen" → „Liebe Kollegen".
  - Aufzählungen: „Liebe Eltern, Schülerinnen und Schüler" → „Liebe Eltern und Schüler".
  - Ergänzungsstrich: „Kinderärztinnen und -ärzte" → „Kinderärzte", „Bürgerinnen- und Bürgerbeteiligung" → „Bürgerbeteiligung".
  - Pronomenpaare: „Jede und jeder" → „Jeder".
- **Ausnahmen**: Unverändert bleiben Doppelnennungen, in denen beide Formen Information tragen – etwa bei Zahlen („40 Lehrerinnen und 60 Lehrer"), Vergleichen („Unterschiede zwischen Ärztinnen und Ärzten"), Geschlecht als Thema, Auswahlfragen, Zitaten und zwei Personen im Singular („der Arzt und die Ärztin").
- **Popup**: neuer Schalter „Doppelnennungen" (Standard: an).

### Wartung
- **Tests**: 19 neue Testfälle (99 insgesamt).

---

## 3.0.0 (2026-09-26)

Umfassende Überarbeitung: weniger Falschtreffer, mehr Datenschutz, schneller. Wegen des Umfangs ein Major-Sprung.

### Fehlerbehebungen
- **Falschtreffer bei Leerzeichen am Marker**: „Termin: in zwei Wochen", „Farbe: innen weiß" und „Tür (innen)" bleiben unverändert.
- **Falschtreffer bei „/In" und „:In"**: „Außen/Innen", „Amoralismus/Intellekt" und „Hinweis:In diesem Fall" bleiben unverändert.
- **Falschtreffer in Formeln**: „Beispiel: n = 5", „2 * pi * r" und „Meter: m" bleiben unverändert.
- **Code-Blöcke** bleiben unverändert, auch mit Syntax-Highlighting und in nachträglich gestreamtem Code (KI-Chats).
- **Klammern** bleiben erhalten: „(Ansprechpartner:in)" → „(Ansprechpartner)".
- **„PatientIn/Innen"** → „Patienten"; „Lehrerin/innen" bleibt stehen.
- **Emojis und unsichtbare Zeichen** bleiben in Text ohne Gendering erhalten („👩‍💻").
- **Echte Feminina** wie „Vorständin" und „Gästin" bleiben stehen.
- **Genus nach Determinativ**: „jede:r Ärzt:in" → „jeder Arzt".
- **Versal-Komposita**: „MITARBEITER:INNEN" → „MITARBEITER".
- **„mensch"/„frau" nach Artikel** bleiben Substantive („jeder mensch", „meine frau").
- **Pluralformen**: „Akteur:innen" → „Akteure", „Notar:innen" → „Notare"; „Offizier", „Fotograf", „Philosoph" u. a. bekommen den richtigen Plural.
- **Wiktionary**: kein „—" mehr als Wort; bei mehreren Einträgen gilt der Personen-Eintrag („Leiter").
- **Dynamische Seiten**: Änderungen der Seite während der Verarbeitung gehen nicht mehr verloren.

### Datenschutz
- **Wiktionary-Anfragen ohne Cookies und Referer.**
- **Cache im Erweiterungsspeicher** statt im Speicher der Webseite – für Websites unsichtbar.
- **Weniger Wiktionary-Anfragen.**
- **Wiktionary-Lookup abschaltbar** (Schalter im Popup, Standard: an).
- **`activeTab` statt `tabs`**: Die Installationswarnung „Auf Browsertabs zugreifen" entfällt.

### Rücksicht auf Wiktionary und Nutzer
- **Gedrosselte Wiktionary-Anfragen** (höchstens zwei gleichzeitig, Pause nach Fehlern).
- **Ausschalten lädt nur noch sichtbare Tabs neu**, Einschalten ganz ohne Reload.

### Performance
- **Deutlich schneller** auf großen Seiten (Wikipedia „Deutschland": 6–10 s → 0,45 s).

### Neue Funktionen
- **Gemischte Schreibweise**: Steht ein Wort irgendwo auf der Seite kompakt gegendert („Maurer:innen"), werden auch „Maurer: innen", „Maurer/Innen" und „MaurerInnen" aufgelöst.
- **Leerzeichen-Formen in Komposita**: „Privatkund: innen", „Fachärzt: innen"; „Betrag: in Euro" bleibt.
- **Artikel-/Pronomenpaare**: „der*die Nutzer*in" → „der Nutzer", „sie/er" → „er".
- **Genus-Kürzel**: zusätzlich „(m/f/d)", „(w/m/x)", „(div)", „(all genders)", „(alle Geschlechter)", „(gn)".
- **Weitere Marker**: ∗ ⁎ ꞉ ∶.
- **Lexikon**: rund 50 neue Wörter (u. a. Kunde, Experte, Zeuge, Chef, Präsident, Minister, Mieter, Azubi).
- **Popup**: Version aus dem Manifest, bessere Barrierefreiheit.

### Wartung
- **Tests**: 30 neue Testfälle (80 insgesamt).

---

## 2.1.0 (2026-06-14)

Pseudo-Feminina und substantivierte Partizipien werden zurückgebaut. Neue Funktionen, deshalb ein Minor-Sprung.

### Neue Funktionen
- **Partizipien**: „Studierende" → „Studenten", „Lehrende" → „Lehrer", „Mitarbeitende" → „Mitarbeiter" und weitere aus einer festen Liste; „Reisende", „Vorsitzende", „Auszubildende" u. ä. bleiben. Auch im Singular („der Studierende" → „der Student", „die Studierende" → „die Studentin") und in Komposita („Lehramtsstudierende" → „Lehramtsstudenten"). Eigener Schalter im Popup (Standard: an).
- **Pseudo-Feminina**: „Menschin" → „Mensch", „Mitgliedin" → „Mitglied", „Fachkräftin" → „Fachkraft", auch in Komposita („Vereinsmitgliederinnen" → „Vereinsmitglieder") und mit Artikel („Die Mitgliedin" → „Das Mitglied").

---

## 2.0.0 (2026-05-28)

Erster Open-Source-Release unter der GNU GPL v3. Wegen des Umfangs ein Major-Sprung.

### Projekt
- **Open Source** (GPL-3.0-or-later), README, Testsuite (`npm test`), ESLint und `web-ext`.

### Fehlerbehebungen
- **Komposita**: „Benutzer:innen" → „Benutzer" statt „BeNutzer", „Sozialarbeiter:innen" → „Sozialarbeiter".
- **„Sklav*innen"** → „Sklaven", **„Förder:innen"** → „Förderer".
- **„Kolleg:innen"** → „Kollegen", **„Biolog:innen"** → „Biologen".
- **Binnen-I**: „LehrerInnen" → „Lehrer", „StudentInnen" → „Studenten"; „Innenstadt" bleibt.

### Neue Funktionen
- **Artikel im Singular**: „Die Kolleg:in" → „Der Kollege", „Jede Lehrer:in" → „Jeder Lehrer".
- **Dativ Plural**: „mit Lehrer:innen" → „mit Lehrern", „von den Bürger:innen" → „von den Bürgern".
- **„mensch"/„frau" → „man"**: „könnte mensch sagen" → „könnte man sagen".

---

## 1.8.3 (2026-05-09)

### Neue Funktionen
- **Dativ-Formen mit „:m"**: „jeder:m" → „jedem", „einer:m" → „einem".

---

## 1.8.2 (2026-04-18)

### Neue Funktionen
- **„:e"-Formen**: „ein:e" → „ein", „kein:e" → „kein".

---

## 1.8.1 (2026-04-18)

### Neue Funktionen
- **„:r"-Formen**: „jede:r" → „jeder", „eine:r" → „einer".

---

## 1.8 (2026-04-16)

### Fehlerbehebungen
- **URLs, Pfade und Slugs** („foo.de/in/impressum", „foo_in_bar") bleiben unverändert.
- **Neu laden** auch beim Wiederaktivieren und beim Entfernen einer Domain von der Blockliste.
- **`aria-describedby`** wird nicht mehr verändert.
- **Debug-Log**: richtige Versionsnummer; „Deaktiviert oder geblockt" nur noch im Debug-Modus.

### Performance
- Weniger doppelte Wiktionary-Anfragen und seltenere Schreibzugriffe auf den Cache.

---

## 1.7.2 (2026-04-13)

### Fehlerbehebungen
- **Leerzeichen nach dem Marker**: „Mieter: innen" und „Mieter: in" werden erkannt.

---

## 1.7.1 (2026-04-02)

### Neue Funktionen
- **Gegenderte Komposita**: „Architekt:Innenbüros" → „Architektenbüros", „Lehrer*Innenzimmer" → „Lehrerzimmer"; „Außen/Innenräume" bleibt.
- **Lexikon** von 29 auf 81 Einträge erweitert.

### Fehlerbehebungen
- **SPAs (LinkedIn, XING u. a.)**: Text, den die Seite wieder gegendert zurückschreibt, wird erneut bearbeitet.
- **Umlaut-Singular**: „Ärzt:in" → „Ärztin", „Köch:in" → „Köchin".

---

## 1.6.1 (2026-03-28)

### Fehlerbehebungen
- **„Schule/Inspektion"** und **„Außen/Innenraum"** bleiben unverändert.

---

## 1.6 (2026-03-03)

### Änderungen
- **Schneller** auf dynamischen Seiten.
- **Popup-Hinweis** zu Code- und KI-Seiten entschärft.

---

## 1.5.3 (2026-02-26)

### Fehlerbehebungen
- Popup-Darstellung und E-Mail-Funktion korrigiert.

## 1.5.2 (2026-02-26)

### Änderungen
- **Bindestrich ist kein Gender-Marker mehr**: „Standard-installationen", „tail -n" und URLs bleiben unverändert.
- **Popup**: Hinweis zu Seiten mit Code oder KI-Inhalten.

---

## 1.5.1 (2026-02-26)

### Fehlerbehebungen
- **„tail -n 100"** und **„Standard-installationen"** bleiben unverändert.

---

## 1.5 (2026-02-22)

### Neue Funktionen
- **Ein-/Aus-Schalter** im Popup.
- **Domain-Blockliste**; die aktuelle Seite lässt sich mit einem Klick hinzufügen.
- **Wiktionary-Lookup** für unbekannte Wörter.
- **Komposita**: „Teamleiter:innen", „Bundesärzt:innenkammer".
- **Debug-Modus** mit Ausgabe in der Browser-Konsole.
- **Lexikon** erweitert (Richter, Autor, Professor, Nutzer, Entwickler u. v. m.).

### Fehlerbehebungen
- **Falschtreffer** wie „Heroin", „Protein" und „Medizin" bleiben unverändert.
- **Eingabefelder** (`input`, `textarea`, `contenteditable`) bleiben unverändert.

### Performance
- Flüssiger auf dynamischen Seiten; der erste Durchlauf blockiert die Seite nicht mehr.

---

## 1.4 (2026-02-13)
- Über mehrere Textknoten verteilte Marker werden erkannt („Poster : in").
- Marker-Varianten mit Mittelpunkt im Popup dokumentiert.
- Marker unabhängig von Groß-/Kleinschreibung („:in" / „:In").
- Schneller durch einen Vorfilter.

## 1.3 (2026-02-08)
- Icon-Größen korrigiert.
- HTML-Attribute (title, alt, placeholder, aria-label …), SVG-Text und Shadow DOM werden bearbeitet.
- Die ganze Seite samt Kopfbereich wird bearbeitet, auch nachträgliche Änderungen.
- Firefox für Android ab Version 142.
- Options-Seite (auf Android über die Einstellungen erreichbar).
- Datenschutz-Angabe im Manifest.

## 1.2 (2026-02-08)
- Versionsnummer im Popup.
- Seitentitel, Meta-Tags und JSON-LD werden bearbeitet.

## 1.1 (2026-02-08)
- Keine Host-Berechtigungen mehr nötig.
- Funktioniert auch in iframes.
- Datenschutz-Hinweise im Popup.

## 1.0
- Erste Veröffentlichung.
