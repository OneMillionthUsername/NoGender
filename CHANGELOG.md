# Changelog
## 3.1.0 (2026-10-03)

Doppelnennungen werden auf das Maskulinum gekürzt. Neue Funktion, deshalb ein Minor-Sprung.

### Neue Funktionen
- **Doppelnennungen** („Bürgerinnen und Bürger" → „Bürger"): unabhängig von der Reihenfolge („Bürger und Bürgerinnen" → „Bürger"), mit „und", „oder", „sowie", „bzw.", „beziehungsweise", „/", „&" und Komma. Das Maskulinum bleibt so stehen, wie es im Text steht – samt Kasus („mit Lehrerinnen und Lehrern" → „mit Lehrern") und mit Umlautwechsel („Ärztinnen und Ärzte", „Bäuerinnen und Bauern", „Jüdinnen und Juden"). Natürliche Feminina ohne maskulines Gegenstück bleiben wie bisher stehen. Außerdem:
  - Singular mit Artikeln und Adjektiven: „die Ärztin oder der Arzt" → „der Arzt", „mit der Ärztin oder dem Arzt" → „mit dem Arzt", „eine erfahrene Ärztin oder ein erfahrener Arzt" → „ein erfahrener Arzt", „Jede Schülerin und jeder Schüler" → „Jeder Schüler".
  - Anreden: „Liebe Kolleginnen, liebe Kollegen" → „Liebe Kollegen", „Liebe Kollegin, lieber Kollege" → „Lieber Kollege".
  - Aufzählungen: „Liebe Eltern, Schülerinnen und Schüler" → „Liebe Eltern und Schüler".
  - Ergänzungsstrich: „Kinderärztinnen und -ärzte" → „Kinderärzte", „Bürgerinnen- und Bürgerbeteiligung" → „Bürgerbeteiligung", „Schüler- und Schülerinnenvertretung" → „Schülervertretung".
  - Pronomenpaare: „Jede und jeder" → „Jeder", „für jede und jeden" → „für jeden".
  - Nach der Auflösung anderer Formen: „Lehrerinnen und Lehrende" → „Lehrer".
- **Ausschlussgruppe**: Gekürzt wird nur, wenn das andere Glied nachweislich das Maskulinum zum selben Wort ist. Unverändert bleiben Doppelnennungen, in denen beide Formen Information tragen oder die Kürzung grammatisch nicht sicher ist: Zahlen und Mengen („40 Lehrerinnen und 60 Lehrer", „rund 40 Lehrerinnen und Lehrer"), Vergleich, Anteile und Geschlecht als Thema im selben Satz („Unterschiede zwischen Ärztinnen und Ärzten", „Anteil", „%", „Frauen", „weiblich", „Gleichberechtigung" – auch Texte über das Gendern selbst), Betonung, Auswahl und Zuordnung („sowohl … als auch", „entweder … oder", „egal ob", Fragen mit „oder", „Lehrerinnen bzw. Lehrer erhalten 100 bzw. 200 Euro", „Ehepaare aus …"), Zitate und Sätze über Sprache („Die Paarform „Bürgerinnen und Bürger“"), ein Komma als Satzgrenze („Erst kamen die Lehrerinnen, Lehrer folgten später", „die Lehrerinnen, die Lehrer ausbilden"), zwei Personen im Singular („der Arzt und die Ärztin"), unpassende Beifügungen („die jungen Lehrerinnen und die alten Lehrer", „Lehrerinnen, nicht Lehrer"), ein feminines Wort vor dem Femininum („die Ärztin oder Arzt", „jeder und jede Lehrerin") und Singular ohne Artikel ohne Personenbeleg („Augustin oder August").
- **Popup**: neuer Schalter „Doppelnennungen" (Standard: an). Umschalten lädt die sichtbare Seite neu.

### Wartung
- **Tests**: 19 neue Testfälle (99 insgesamt), darunter beide Reihenfolgen jeder Paarform, die Ausschlussgruppe, „Vorfilter für Doppelnennungen übersieht nichts" und „ein zweiter Durchlauf ändert nichts". „Liebe Gästinnen und Gäste" ergibt jetzt „Liebe Gäste".
- **Performance**: Doppelnennungen haben einen eigenen Vorfilter; die Sondermuster (Ergänzungsstrich, „jede") laufen nur, wenn ihr Kennzeichen im Text steht.

---

## 3.0.0 (2026-09-26)

Umfassende Überarbeitung nach einem Projekt-Review: Falschtreffer in normalem Text und in Code-Blöcken, gemischte Schreibweisen mit und ohne Leerzeichen, Datenschutz und Drosselung des Wiktionary-Lookups, Performance. Wegen des Umfangs ein Major-Sprung.

### Fehlerbehebungen
- **Marker mit Leerzeichen trafen normalen Text**: Seit 1.7.2 galt auch „Mieter: innen" als Gendering – und damit jede Doppelpunkt-Aufzählung mit „in"/„innen" dahinter: „Termin: in zwei Wochen" → „Termin zwei Wochen", „Farbe: innen weiß" → „Farben weiß", „Startseite · in eigener Sache" → „Startseite eigener Sache", „Tür (innen)" → „Türen". Im Wikipedia-Artikel „Deutschland" wurde aus „ausgeübt: In Zivil- und Strafsachen" „ausgeübt Zivil- und Strafsachen". Formen mit Leerzeichen am Marker werden jetzt nur noch bei sicher belegter Personenbezeichnung ersetzt (LEXICON oder Wiktionary), nur kleingeschrieben und im Singular nicht vor einem weiteren Wort („Lehrer: in der Schule" bleibt). Gegenderte Komposita („Lehrer*innenzimmer") werden nur noch kompakt erkannt („Bauer: Innenpolitisch …" bleibt).
- **Großes „I" nach „/" (todo: „Amoralismus/Intellekt")**: Endete ein Textknoten mitten im Wort („(Amoralismus/In" + `<em>tellekt</em>`) oder war das Wort getrennt („In- tellekt"), wurde „/In" als Gender-Endung entfernt. Nach „/" beginnt mit großem „I" oft ein neues Wort („Außen/Innen"); dort – und bei „:In" vor einem Wort („Hinweis:In diesem Fall", fehlendes Leerzeichen) – wird jetzt nur bei Personenbezeichnungen aufgelöst. Direkt am Marker gilt großes „I" sonst weiter als eindeutige Gender-Schreibung („Maurer*Innen" → „Maurer", auch ohne Lexikon).
- **Adjektivendungen in Formeln und Aufzählungen**: `:n`, `:e`, `:r` und `er:m` erlaubten Leerzeichen und beliebige Stämme – „Beispiel: n = 5" → „Beispieln = 5", „2 * pi * r" → „2 * pir", „Meter: m" → „Metem", „var_n" → „varn". Jetzt nur kompakt; bei `:n`/`:r` muss der Stamm auf -e enden (jede:r, eine:n).
- **Code-Blöcke wurden verändert**: Ausgenommen war nur Text, dessen *direktes* Elternelement `code`/`pre` ist. Syntax-Highlighting (`<pre><code><span>jede:r</span>`) und Text, den der MutationObserver meldet (nachträglich gestreamter Code in KI-Chats), wurden deshalb normalisiert. Der Ausschluss gilt jetzt für alle Nachfahren von `pre`, `code`, `kbd`, `samp`, `script`, `style` usw. – im Erstdurchlauf und im Observer.
- **Klammern verschwanden**: Eine gegenderte Form direkt vor „)" oder „]" nahm die Klammer mit – „Kontakt (Ansprechpartner:in) anrufen" → „Kontakt (Ansprechpartner anrufen", „(Ärzt:innen)" → „(Ärzte". Die schließende Klammer gehört jetzt nur noch zur Form, wenn direkt vor dem Marker eine öffnende steht („Lehrer(:in)").
- **Slash-Form „PatientIn/Innen"**: Dem Muster fehlte das `u`-Flag, `\p{L}` griff nie, und ein anderes Muster machte „PatientInen" daraus. Jetzt → „Patienten". Die natürliche Femininform „Lehrerin/innen" bleibt stehen (vorher „Lehrerinen").
- **Unsichtbare Zeichen**: Weiche Trennstriche und Nullbreiten-Zeichen wurden aus dem *ganzen* Text entfernt – auch ohne Gendering (Attribute, Titel und JSON-LD wurden grundlos umgeschrieben) und inklusive U+200D, das Emoji-Sequenzen zusammenhält („👩‍💻" zerfiel). Jetzt nur noch in Wörtern, die danach gegendert aussehen.
- **Echte Feminina wurden umgewandelt**: „Finanzvorständin" → „Finanzvorstand", „Die Vorständin" → „Der Vorstand", „Gästin" → „Gast". Diese Formen bezeichnen eine konkrete Frau – wie „Ärztin" oder „Freundin" – und bleiben jetzt stehen. Als Pseudo-Feminina gelten nur noch Kunst- und Scherzwörter, deren Grundwort schon alle Geschlechter umfasst: „Menschin", „Mitgliedin", „Mitgliederin", „Fachkräftin". Gegenderte Formen werden weiter aufgelöst, „Vorständ:innen" jetzt mit korrektem Plural „Vorstände" (vorher „Vorständen").
- **Genus nach Determinativ**: „jede:r Ärzt:in" → „jeder Ärztin", „ein:e Ärzt:in" → „ein Ärztin". Nach maskulinem oder gegendertem Determinativ wird jetzt das Maskulinum gewählt („jeder Arzt"); „mit der Ärzt:in" bleibt „mit der Ärztin".
- **Versal-Komposita**: „MITARBEITER:INNEN" → „MITarbeiter". Ein exakter LEXICON-Treffer geht jetzt vor die Kompositum-Zerlegung, und in Versalwörtern bleibt der Kopf groß.
- **„mensch"/„frau" nach Determinativ**: In klein geschriebenen Texten wurde „jeder mensch" zu „jeder man" und „meine frau" zu „meine man". Nach Artikel, Possessivum oder „als" bleibt das Substantiv jetzt stehen.
- **Pluralregeln**: „Akteur:innen" → „Akteuren", „Notar:innen" → „Notaren", „Aktionär:innen" → „Aktionären" (Dativ- statt Nominativform); „Offizier", „Fotograf", „Philosoph", „Ökonom", „Oligarch", „Theolog" blieben ohne Plural. Neu: -eur/-ier/-ar/-är/-ling → -e; -graf/-soph/-nom/-arch/-log/-gog/-ik → -en; Singular „Theolog:in" → „Theologe".
- **Wiktionary-Auswertung**: „—" (Form existiert nicht, z. B. Singular von „News") wurde als Wort eingesetzt. Der deutsche Abschnitt wurde nie erkannt (falsches Überschriftenformat); jetzt werden die deutschen Einträge getrennt und bei mehreren („Leiter" als Person bzw. Steiggerät) der Personen-Eintrag bevorzugt.
- **Veralteter Text nach dem Lookup**: Änderte die Seite einen Text, während dessen Wiktionary-Anfrage lief (React-Rerender), schrieb NoGender danach die normalisierte *alte* Fassung zurück. Jetzt wird nur geschrieben, wenn der Text unverändert ist.
- **Änderungen während des Erstdurchlaufs**: Der MutationObserver startete erst nach dem kompletten, wegen Wiktionary teils sekundenlangen Erstdurchlauf; was die Seite in der Zeit änderte, blieb unbearbeitet. Er startet jetzt zuerst. Auch Shadow-DOM-Bereiche erhalten einen Observer.
- **JSON-LD**: wurde bei jedem Durchlauf kompaktiert neu geschrieben, auch ohne Ersetzung (und löste den Head-Observer erneut aus). Jetzt nur bei tatsächlicher Änderung; der Head-Observer ist gebündelt.

### Datenschutz
- **Wiktionary ohne Cookies und Referer** (`credentials: "omit"`, `referrerPolicy: "no-referrer"`): Bisher konnte der Referer die besuchte Website mitschicken.
- **Cache im Erweiterungsspeicher statt im sessionStorage der Webseite**: Der Cache lag im Speicher der jeweiligen Website, war dort für deren Skripte lesbar und verriet die Erweiterung samt nachgeschlagener Wörter. Jetzt in `browser.storage.local` (ein Schlüssel je Wort, 30 Tage gültig, seitenübergreifend) – weniger Anfragen, für Websites unsichtbar. Alte Einträge verschwinden mit dem Schließen des Tabs von selbst; die Erweiterung greift gar nicht mehr auf den Speicher der Seite zu (vorher löste das in Werbe-iframes Firefox-Hinweise zu „partitioniertem Speicherzugriff" aus).
- **Weniger Anfragen**: Nachgeschlagen wird nur, was lokal nicht lösbar ist – nicht mehr bei Komposita mit Lexikon-Kopf, sicher geregelten Endungen („Mieter:innen") oder strukturell ausgeschlossenen Treffern („Termin: in Kürze").
- **Wiktionary-Lookup abschaltbar**: neuer Schalter im Popup (Standard: an). README und Manifest nannten den Lookup schon „optional" – jetzt ist er es.
- **`activeTab` statt `tabs`**: Das Popup braucht nur die URL des aktiven Tabs, und zwar nur, solange es offen ist. Die weitreichende Berechtigung zum Lesen aller Tabs (Installationswarnung „Auf Browsertabs zugreifen") entfällt.

### Rücksicht auf Wiktionary und Nutzer
- **Drosselung**: höchstens zwei gleichzeitige Anfragen; nach HTTP 429/5xx eine Minute Pause. Fehlgeschlagene Anfragen werden nicht mehr als „unbekannt" gecacht (vorher blieb ein Wort nach einem Timeout für die Sitzung unauflösbar). Antworten sind über `maxage` cachebar.
- **Kein Reload fremder Tabs**: Das Ausschalten lud bisher *alle* offenen Tabs neu – ungespeicherte Eingaben in anderen Tabs gingen verloren. Jetzt nur noch sichtbare Tabs; Hintergrund-Tabs hören sofort auf, Text zu ändern. Das Einschalten kommt ganz ohne Reload aus.

### Performance
- **Vorfilter**: Das kombinierte Vorfilter-Regex schlug durch das `i`-Flag auf die Binnen-I-Muster bei praktisch jedem deutschen Text an („ein", „Berlin", „Frau") und war selbst teuer (≈ 260 ms für 175 000 Zeichen). Ersetzt durch billige notwendige Bedingungen (`hasGenderCandidate`); die Muster ankern am Wortanfang. Am Wikipedia-Artikel „Deutschland" (≈ 29 000 Textknoten): 6–10 s → ≈ 0,45 s.
- **Gebündelte Lookups**: Stämme werden pro Block von 150 Textknoten gesammelt und gemeinsam geladen, statt Knoten für Knoten auf die eigene Anfrage zu warten.

### Neue Funktionen
- **Gemischte Schreibweise**: Kommt ein Wort irgendwo auf der Seite kompakt gegendert vor („Maurer:innen"), gilt es auch in den mehrdeutigen Schreibweisen als Person – „Liebe Maurer: innen" weiter oben, „Maurer/Innen" oder „MaurerInnen" werden dann ohne Lexikon und ohne Wiktionary aufgelöst. Ein Vorab-Scan sammelt diese Belege, bevor Text ersetzt wird; nachgeladene Inhalte ergänzen sie. „innen und außen" (auch „innen & außen", „innen/außen") gilt nie als Gendering.
- **Leerzeichen-Formen in Komposita** (Anlass: Beschwerde über eine Bank-Website mit „Kund: innen", „Investor: innen", „Sparer: innen"): Ist der Kopf allein kein Wort („Privatkund: innen", „Fachärzt: innen"), ist die Form eindeutig. Mit eigenständigem Kopf („Kundenberater: innen", „Kontoinhaber: innen") gilt sie, sobald der Text bzw. die Seite nachweislich gendert – ein alleinstehendes „Lautsprecher: innen" bleibt stehen. Formularbeschriftungen wie „Betrag: in Euro" bleiben immer unverändert.
- **Artikel-/Pronomenpaare**: „der*die Nutzer*in" → „der Nutzer", „die/der" → „der", „sie/er" → „er", „seine:ihre" → „seine" (nur kompakt; „der/die/das" bleibt).
- **Genus-Kürzel**: zusätzlich „(m/f/d)", „(w/m/x)", „(div)", „(all genders)", „(alle Geschlechter)", „(gn)".
- **Weitere Marker**: ∗ ⁎ ꞉ ∶ (typografische Varianten von Stern und Doppelpunkt).
- **Lexikon**: Programmierer, Dienstleister, Kunde, Experte, Genosse, Zeuge/Augenzeuge, Gast/Gästin („Gäst:innen"), Vorstand/Vorständin („Vorständ:innen"), Türke, Grieche, Tscheche, Slowake, Franzose, Jude, Chef, Fan, Hotelier, Bankier, Kapitän, Akteur, Präsident, Leiter, Meister, Minister, Kanzler, Vertreter, Anwohner, -nehmer, -geber, Täter, Sportler, Erzieher, Käufer, Hersteller, Betreuer, Zuschauer, Zuhörer, Kämpfer, Designer, Manager, Mieter, Inhaber, Anleger, Investor, Sparer, Empfänger, Zahler, Rentner, Schuldner, Gläubiger, Vermittler, Makler, Azubi. Neue optionale Felder: `m` (Maskulinum bei femininem `sg`) und `exact` (kein Kompositum-Kopf – „zeug" wegen „Fahrzeug").
- **Popup**: Version aus dem Manifest; Barrierefreiheit (Beschriftungen für alle Schalter, sichtbarer Tastaturfokus, Buttons statt Links ohne Ziel, Statusmeldungen per `aria-live`).

### Wartung
- **Eine Versionsquelle**: Popup und Content-Script lesen die Version aus dem Manifest; ein Test prüft den Gleichlauf von `manifest.json` und `package.json`.
- **Ruhigeres Debug-Log**: Die Statuszeile „aktiv auf …" erscheint nur noch für die eigentliche Seite, nicht für jeden Werbe-iframe; Ersetzungen werden weiterhin in allen Frames protokolliert.
- **Tests**: 30 neue Testfälle (80 insgesamt), darunter die Invariante „Vorfilter übersieht nichts" über alle Testeingaben.

---

## 2.1.0 (2026-06-14)

Marker-freies Gendering wird zurückgebaut: Pseudo-Feminina (Phase 1) und substantivierte Partizipien (Phase 2). Wegen des neuen Funktionsumfangs ein Minor-Sprung.

### Neue Funktionen
- **Partizip-Substantive-Rückbau (Phase 2)**: Als Gender-Ersatz genutzte substantivierte Partizipien werden zum echten Nomen zurückgeführt – „Studierende" → „Studenten", „Lehrende" → „Lehrer", „Forschende" → „Forscher", „Mitarbeitende" → „Mitarbeiter", „Teilnehmende", „Pflegende", „Lesende", „Nutzende", „Helfende", „Wählende", „Zuschauende", „Zuhörende", „Demonstrierende", „Promovierende" (→ Doktoranden), „Konsumierende", „Antragstellende", „Anwohnende", „Pendelnde", „Flüchtende". **Allowlist-only**: nur diese kuratierten Stämme (Map `PARTICIPLE`) werden angefasst; jedes andere `-nd`-Wort bleibt unangetastet, sodass echte Partizip-/Adjektiv-Substantive wie „Reisende", „Vorsitzende", „Auszubildende", „Angestellte", „Abgeordnete", „Betroffene" automatisch sicher sind. Die adjektivische Deklination wird konservativ aufgelöst: **Plural** immer (inkl. Dativ Plural über die vorhandene Heuristik – „mit den Studierenden" → „mit den Studenten"); **Singular** nur bei eindeutigem Nominativ-Artikel, genus-genau – „der Studierende" → „der Student", „die Studierende" → „die Studentin", „ein Studierender" → „ein Student". Adjektive zwischen Artikel und Partizip werden übersprungen, sodass auch Anreden greifen („Liebe Studierende" → „Liebe Studenten"). Auch als Kompositum-Kopf („Lehramtsstudierende" → „Lehramtsstudenten"). Bewusst konservativ unangetastet: attributive Adjektive (kleingeschrieben: „studierende Jugend"), oblique Singularformen („dem Studierenden") und Komposita mit Folgewort („Studierendenwerk"). Eigener **Schalter im Popup** (Default an), getrennt vom Marker-Entgendern. Für „Flüchtende" gibt es kein sauberes Femininum, daher bleibt der feminine Singular („die Flüchtende") stehen; Plural „die Flüchtenden" → „die Flüchtlinge".
- **Pseudo-Feminina-Rückbau (Phase 1)**: Künstliche `-in`-Ableitungen zu Grundwörtern, die gar keine männliche Personenbezeichnung sind, werden zum echten Grundwort zurückgeführt – „Gästin" → „Gast", „Vorständin" → „Vorstand", „Menschin" → „Mensch", „Mitgliedin"/„Mitgliederin" → „Mitglied", „Fachkräftin" → „Fachkraft", inkl. Plural („Gästinnen" → „Gäste") und Dativ Plural („mit den Gästinnen" → „mit den Gästen"). Da diese Wörter im Deutschen schlicht nicht existieren, ist der Rückbau praktisch falsch-treffer-frei und kommt ohne Heuristik aus – er nutzt eine kuratierte Tabelle (`PSEUDO_FEM`). Erkennt das Pseudo-Femininum auch als **Kompositum-Kopf/Suffix** – „Stammgästin" → „Stammgast", „Vereinsmitgliederinnen" → „Vereinsmitglieder", „Pflegefachkräftin" → „Pflegefachkraft" (Präfix behält seine Schreibung; da kein echtes Wort auf „…gästin", „…mitgliedin" usw. endet, falsch-treffer-frei). Steht ein **großgeschriebenes** feminines Determinativ direkt davor (Satzanfang = eindeutiger Nominativ), wird es ans Genus des Grundworts angepasst – „Die Vorständin" → „Der Vorstand" (m), „Die Mitgliedin" → „Das Mitglied" (n), „Die Fachkräftin" → „Die Fachkraft" (f, bleibt). Bewusst konservativ: ein Pseudo-Femininum *mitten* im Wort („Stammgästinraum"), kleingeschriebene (mehrdeutige) Artikel mitten im Satz und die echten Grundwörter bleiben unangetastet.

---

## 2.0.0 (2026-05-28)

Erster **Open-Source-Release** unter der GNU GPL v3, zusammen mit mehreren
Fehlerbehebungen und einer neuen Funktion. Wegen des Umfangs (Projekt-Infrastruktur +
neue Funktion) ein Major-Sprung.

### Projekt / Infrastruktur
- **Open Source (GPL-3.0-or-later)**: Vollständige `LICENSE`, SPDX-Header in den Quelldateien.
- **README.md**: Funktionsumfang, Installation, Bedienung, Funktionsweise, Datenschutz, Mitwirken.
- **Testsuite**: Node-Test-Runner (`npm test`), lädt `nogender.js` direkt – die Datei
  exportiert ihre reinen Funktionen unter Node (`module.exports`) und kapselt den
  Browser-Bootstrap hinter `typeof`-Guards, ohne Verhalten im Browser zu ändern.
- **Tooling**: `package.json` mit Scripts (`test`, `lint`, `start`, `build`),
  ESLint-Flat-Config, `web-ext`-Integration. `.gitignore` um Node-Artefakte ergänzt.
- **Aufräumen**: leere `todo.txt` entfernt.

### Fehlerbehebungen
- **Kompositum-Großschreibung**: Bei zusammengesetzten Wörtern wurde der erkannte Personenstamm aus dem LEXICON großgeschrieben mitten ins Wort eingesetzt – „Benutzer:innen" → „BeNutzer", „Bewegungsaktivist*innen" → „BewegungsAktivisten", „Sozialarbeiter:innen" → „SozialArbeiter". `replaceStem` schreibt den aufgelösten Stamm jetzt klein, da er als zweiter Kompositateil mitten im Wort steht. Ergebnis: „Benutzer", „Bewegungsaktivisten", „Sozialarbeiter".
- **„Sklav:in/-innen"**: Der Stamm „Sklav" war weder im LEXICON noch (unter dem Lemma „Sklave") über Wiktionary auffindbar; `toPlural` ließ die `v`-Endung unverändert, sodass „Sklav*innen" → „Sklav" und „Sklav*innenstatus" gänzlich unverändert blieb. Neuer LEXICON-Eintrag (n-Deklination): „Sklave"/„Sklaven". Ergebnis: „Sklaven", „Sklavenstatus".
- **„Förder:in/-innen"**: Der unbekannte Stamm „Förder" blieb wegen `toPlural` unverändert. Neuer LEXICON-Eintrag „Förderer" (Fem. „Förderin"). Ergebnis: „Förderer". Hinweis: Die Extension löst nur den Nominativ auf; kasusabhängige Formen wie der Dativ Plural „Förderern" (nach „nach") werden bewusst nicht erzeugt.
- **`-e`-Nomen (`Kolleg:innen`, `Biolog:innen`)**: Die LEXICON-Einträge `kollege`/`biologe` waren samt End-`e` hinterlegt, der gegenderte Stamm kommt aber ohne `e` an (`Kolleg`, `Biolog`) – der Eintrag griff nie, das Ergebnis war `Kolleg`/`Biolog`. Schlüssel an die Konvention der übrigen `-e`-Nomen (`pädagog`, `psycholog` …) angeglichen → `kolleg`/`biolog`. Zusätzlich ist das kuratierte LEXICON jetzt **autoritativ vor Wiktionary** und LEXICON-Stämme werden nicht mehr abgefragt; sonst hätte der Browser für „Kolleg" die Formen des gleichnamigen Fremdworts („das Kolleg") geladen und fälschlich verwendet. Ergebnis: „Kollegen"/„Biologen", auch im Dativ und in Komposita.
- **Binnen-I bei großgeschriebenen Wörtern**: `LehrerInnen`, `StudentInnen` u. ä. wurden nicht erkannt, weil die Muster einen kleingeschriebenen Wortanfang (`\b[\p{Ll}]`) verlangten und das ASCII-basierte `\b` an Umlauten am Wortrand scheiterte. Die Muster nutzen jetzt Unicode-Lookbehind/-Lookahead und erlauben beliebigen Wortanfang; das große „I" in „Innen"/„In" bleibt das case-sensitive Erkennungssignal. Zur Absicherung wird – wie bei den Kompositum-Mustern – `isLikelyPersonStem` geprüft, sodass Nicht-Personen-Wörter (z. B. „Innenstadt", „LinkedInnen") unangetastet bleiben. Ergebnis: „LehrerInnen" → „Lehrer", „StudentInnen" → „Studenten".

### Neue Funktionen
- **Artikel-Kongruenz im Singular (konservativ)**: Bei einer gegenderten Singularform wurde bisher das Nomen zum Maskulinum aufgelöst, der vorangehende feminine Artikel aber nicht – z. B. „die Kolleg:in" → „die Kollege" (Genus-Konflikt). Steht ein **großgeschriebenes** feminines Determinativ direkt davor (Satzanfang = eindeutiger Nominativ), wird es jetzt mit angepasst: „Die Kolleg:in" → „Der Kollege", „Eine Mitarbeiter:in" → „Ein Mitarbeiter", „Jede Lehrer:in" → „Jeder Lehrer". Im Nominativ ändert sich die Nomen-Endung nicht, daher genügt das Umschreiben des Artikels. Bewusst nur großgeschrieben: kleingeschriebenes „die"/„eine" mitten im Satz ist Nominativ/Akkusativ-mehrdeutig und bleibt unangetastet. Nomen, die zur Femininform aufgelöst werden (z. B. „Die Ärzt:in" → „Die Ärztin"), behalten korrekt den femininen Artikel.
- **Dativ-Plural-Erkennung (konservativ)**: Steht vor einer gegenderten Plural-Form ein eindeutiger Dativ-Auslöser, wird statt des Nominativs der Dativ Plural erzeugt – z. B. „nach Förder:innen" → „nach Förderern", „mit Lehrer:innen" → „mit Lehrern", „von den Bürger:innen" → „von den Bürgern". Auslöser sind unzweideutige Dativ-Präpositionen (`nach`, `mit`, `bei`, `von`, `zu`, `aus`, `seit` …) und das Determinativ `den` vor einem Plural (der Akkusativ Plural wäre „die"). Die Form folgt der Regel „Nominativ Plural + n, außer er endet auf -n/-s". Bewusst **nicht** erfasst (zu mehrdeutig/risikoreich): Wechselpräpositionen (`in`/`an`/`auf` …), verbregierter Dativ, Dativ Singular, Genitiv. Großgeschriebene Wörter (vermutlich Nomen) und Klausel-Satzzeichen begrenzen die Rückschau, damit ein Auslöser nicht auf ein anderes Nomen übergreift.
- **Indefinitpronomen-Reversion (`mensch`/`frau` → `man`)**: Das in entgenderter Sprache als Ersatz für „man" genutzte „mensch" bzw. „frau" (z. B. „könnte mensch sagen", „wie frau weiß") wird zu „man" zurückgeführt. Bewusst case-sensitiv und nur kleingeschrieben: Die großgeschriebenen Substantive „Mensch"/„Frau", deren Plurale „Menschen"/„Frauen" sowie Wortbestandteile (z. B. „Übermensch") bleiben unangetastet. Satzanfänge (großgeschrieben) werden nicht erfasst, um den Substantiv-Sinn nicht zu zerstören. Resteinschränkung: durchgängig kleingeschriebenes „frau" im Substantiv-Sinn (informelle Texte) wird ggf. mit-ersetzt.

---

## 1.8.3 (2026-05-09)

### Neue Funktionen
- **`:m`-Dativ-Formen**: Gegenderte Dativ-Pronomen mit `-er:m`-Suffix werden jetzt erkannt und zum maskulinen Dativ aufgelöst – z. B. „jeder:m" → „jedem", „dieser:m" → „diesem", „welcher:m" → „welchem", „einer:m" → „einem", „der:m" → „dem". Anders als die `:r`/`:n`/`:e`-Muster wird hier die Endung `-er` durch `-em` ersetzt (statt nur angehängt), da das Anhängen ein Nicht-Wort ergäbe. Betrifft alle Marker (`:`, `*`, `·` usw.).

---

## 1.8.2 (2026-04-18)

### Neue Funktionen
- **`:e`-Adjektivformen**: Gegenderte Formen mit `-:e`-Suffix werden jetzt erkannt und zum Maskulinum aufgelöst – z. B. „ein:e" → „ein", „kein:e" → „kein".

---

## 1.8.1 (2026-04-18)

### Neue Funktionen
- **`:r`-Adjektivformen**: Gegenderte Pronomen- und Adjektivformen mit `-:r`-Suffix werden jetzt erkannt und aufgelöst – z. B. „jede:r" → „jeder", „welche:r" → „welcher", „eine:r" → „einer". Betrifft alle Marker (`:`, `*`, `·` usw.).

---

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
