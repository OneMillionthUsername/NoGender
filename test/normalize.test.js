// SPDX-License-Identifier: GPL-3.0-or-later
// Tests für die reine Normalisierungslogik (synchroner Pfad, ohne Wiktionary-Lookup
// und ohne DOM). Läuft mit dem eingebauten Node-Test-Runner: `npm test`.

const { test } = require("node:test");
const assert = require("node:assert/strict");
const ng = require("../nogender.js");

const { normalizeGenderedText, LEXICON, PSEUDO_FEM } = ng;

// Hilfsfunktion: prüft Eingabe → erwartete Ausgabe.
function expect(input, output) {
  assert.equal(normalizeGenderedText(input), output);
}

// ─────────────────────────────────────────────────────────────
// Regressionstests zu den in v2.0.0 gemeldeten Bugs
// ─────────────────────────────────────────────────────────────
test("v2.0.0 – Kompositum-Großschreibung wird kleingeschrieben", () => {
  expect("Benutzer:innen", "Benutzer");
  expect("dass Kinder von sozialen Bewegungsaktivist*innen",
         "dass Kinder von sozialen Bewegungsaktivisten");
  expect("Sozialarbeiter:innen", "Sozialarbeiter");
  expect("Mitbürger*innen", "Mitbürger");
});

test("v2.0.0 – Sklav (n-Deklination)", () => {
  expect("dass die Abwertung der Sklav*innen", "dass die Abwertung der Sklaven");
  expect("sozusagen additiv dem Sklav*innenstatus", "sozusagen additiv dem Sklavenstatus");
  expect("Sklav:in", "Sklave");
});

test("v2.0.0 – Förder → Förderer", () => {
  expect("Die Förder:innen", "Die Förderer");  // Nominativ-Kontext
  expect("Förder:in", "Förderer");
});

test("v2.0.0 – Indefinitpronomen mensch/frau → man", () => {
  expect("Anarchie und Luxus, könnte mensch sagen",
         "Anarchie und Luxus, könnte man sagen");
  expect("wie frau weiß", "wie man weiß");
});

test("v2.0.0 – Substantive Mensch/Frau bleiben unangetastet", () => {
  expect("Der Mensch ist gut", "Der Mensch ist gut");
  expect("viele Menschen", "viele Menschen");
  expect("ich liebe meine Frau", "ich liebe meine Frau");
  expect("Frauen kämpfen", "Frauen kämpfen");
  expect("der Übermensch", "der Übermensch"); // keine Wortgrenze → unverändert
});

// ─────────────────────────────────────────────────────────────
// Grundlegende Marker-Erkennung
// ─────────────────────────────────────────────────────────────
test("verschiedene Marker für -innen-Plural", () => {
  for (const marker of [":", "*", "·", "_", "/"]) {
    expect("Lehrer" + marker + "innen", "Lehrer");
  }
});

test("Singular -in-Marker", () => {
  expect("Ärzt:in", "Ärztin");
  expect("Köch*in", "Köchin");
  expect("Bäuer:in", "Bäuerin");
});

test("Umlaut- und unregelmäßige Plurale aus LEXICON", () => {
  expect("Ärzt:innen", "Ärzte");
  expect("Student*innen", "Studenten");
  expect("Architekt:innen", "Architekten");
});

// -e-Nomen: Stamm ohne End-e ("Kollege" → "Kolleg:innen"). Schlüssel müssen
// ohne das -e hinterlegt sein, sonst greift der LEXICON-Eintrag nicht.
test("-e-Nomen (kolleg/biolog)", () => {
  expect("Kolleg:innen", "Kollegen");
  expect("Kolleg:in", "Kollege");
  expect("Biolog*innen", "Biologen");
  expect("Biolog:in", "Biologe");
  expect("mit Kolleg:innen", "mit Kollegen");          // + Dativ
  expect("Arbeitskolleg:innen", "Arbeitskollegen");    // + Kompositum
});

test("Kompositum nach Marker (1.7.1)", () => {
  expect("Architekt:Innenbüros", "Architektenbüros");
  expect("Lehrer*Innenzimmer", "Lehrerzimmer");
});

test("Adjektiv-/Pronomenformen", () => {
  expect("jede:r", "jeder");
  expect("eine:n", "einen");
  expect("kein:e", "kein");
  expect("jeder:m", "jedem");
});

test("Binnen-I Plural", () => {
  expect("LehrerInnen", "Lehrer");                // großgeschriebenes ASCII-Wort
  expect("StudentInnen", "Studenten");
  expect("MitarbeiterInnen", "Mitarbeiter");
  expect("SozialarbeiterInnen", "Sozialarbeiter"); // Kompositum
  expect("die BürgerInnen", "die Bürger");         // Umlaut im Stamm
  expect("lehrerInnen", "Lehrer");                 // kleingeschriebener Wortanfang
  expect("Die LehrerInnen und SchülerInnen.", "Die Lehrer und Schüler.");
});

test("Binnen-I Singular", () => {
  expect("LehrerIn", "Lehrer");
  expect("BürgerIn", "Bürger");
});

// Binnen-I greift nur bei tatsächlichen Personenstämmen (isLikelyPersonStem)
// und nur beim großen "I" als Signal – sonst bleibt der Text unverändert.
test("Binnen-I – keine False Positives", () => {
  expect("Innenstadt", "Innenstadt");
  expect("der Innenraum", "der Innenraum");
  expect("im Innen", "im Innen");
  expect("Spinnen", "Spinnen");           // kleines i, kein Binnen-I
  expect("LinkedInnen", "LinkedInnen");   // "Linked" ist kein Personenstamm
});

test("Klammerformen (Auflösung zum generischen Maskulinum)", () => {
  expect("Lehrer(innen)", "Lehrer");
  expect("Bürger(in)", "Bürger");     // Singular → Maskulinum, nicht "Bürgerin"
  expect("Bürger(innen)", "Bürger");
});

// ─────────────────────────────────────────────────────────────
// Dativ-Plural (konservativ, präzisionsorientiert)
// ─────────────────────────────────────────────────────────────
test("Dativ-Plural bei eindeutigem Auslöser", () => {
  expect("nach Förder:innen", "nach Förderern");
  expect("mit Lehrer:innen", "mit Lehrern");
  expect("von den Bürger:innen", "von den Bürgern");
  expect("bei Ärzt:innen", "bei Ärzten");
  expect("aus Aktivist:innen", "aus Aktivisten");
  expect("nach den vielen Förder:innen", "nach den vielen Förderern"); // Artikel/Adjektiv dazwischen
  expect("Mit Lehrer:innen sprechen", "Mit Lehrern sprechen");         // Trigger am Satzanfang
  expect("den Lehrer:innen", "den Lehrern");                           // "den" + Plural = Dativ
});

test("Dativ-Regel: -n nur wenn nicht schon -n/-s", () => {
  expect("mit Student:innen", "mit Studenten");   // endet auf n → unverändert
  expect("mit Lehrer:innen", "mit Lehrern");      // -er → -ern
  expect("von Ärzt:innen", "von Ärzten");         // -e → -en
});

test("kein Dativ ohne eindeutigen Auslöser", () => {
  expect("Die Lehrer:innen streiken", "Die Lehrer streiken");        // Nominativ-Subjekt
  expect("für Lehrer:innen", "für Lehrer");                          // Akkusativ-Präposition
  expect("Wir denken an Lehrer:innen", "Wir denken an Lehrer");      // Wechselpräp. + Verb
  expect("in Lehrer:innen", "in Lehrer");                            // Wechselpräp. → nicht raten
  expect("der Dank an die Lehrer:innen", "der Dank an die Lehrer");  // Nomen-Grenze stoppt
});

test("Dativ nur im Plural, nicht im Singular", () => {
  expect("mit einer Lehrer:in", "mit einer Lehrer"); // Singular bleibt Nominativ
});

// ─────────────────────────────────────────────────────────────
// Artikel-Kongruenz im Singular (nur eindeutiger Nominativ-Satzanfang)
// ─────────────────────────────────────────────────────────────
test("Artikel-Kongruenz bei großgeschriebenem Determinativ", () => {
  expect("Die Kolleg:in sagte das", "Der Kollege sagte das");
  expect("Eine Mitarbeiter:in fehlt", "Ein Mitarbeiter fehlt");
  expect("Jede Lehrer:in weiß das", "Jeder Lehrer weiß das");
  expect("Meine Kolleg:in kommt", "Mein Kollege kommt");
  expect("Diese Bürger:in klagt", "Dieser Bürger klagt");
});

test("Artikel-Kongruenz: feminin auflösende Nomen behalten femininen Artikel", () => {
  expect("Die Ärzt:in kommt", "Die Ärztin kommt");
  expect("Eine Köch:in fehlt", "Eine Köchin fehlt");
});

test("Artikel-Kongruenz: kleingeschrieben (mehrdeutig) bleibt unverändert", () => {
  expect("Ich kenne die Kolleg:in", "Ich kenne die Kollege");  // Nom./Akk. unklar → Artikel unangetastet
  expect("mit einer Kolleg:in", "mit einer Kollege");
});

// ─────────────────────────────────────────────────────────────
// False Positives – dürfen NICHT verändert werden
// ─────────────────────────────────────────────────────────────
test("normale deutsche Wörter bleiben unverändert", () => {
  for (const w of ["Heroin", "Medizin", "Maschine", "Routine", "Disziplin",
                   "Lehrerin", "Lehrerinnen", "meine Freundinnen", "Kantine"]) {
    expect(w, w);
  }
});

test("URLs und Pfade werden nicht als Gendering gewertet", () => {
  expect("foo.de/in/impressum", "foo.de/in/impressum");
  expect("path/n/foo", "path/n/foo");
  expect("foo_in_bar", "foo_in_bar");
});

test("Text ohne Gendering bleibt identisch (Referenzgleichheit egal)", () => {
  const plain = "Ein ganz normaler Satz ohne jede Besonderheit.";
  expect(plain, plain);
});

// ─────────────────────────────────────────────────────────────
// Pseudo-Feminina ("Gästin", "Vorständin", …) – Phase 1
// ─────────────────────────────────────────────────────────────
test("Pseudo-Feminina Singular → Grundwort", () => {
  expect("Gästin", "Gast");
  expect("Vorständin", "Vorstand");
  expect("Menschin", "Mensch");
  expect("Mitgliedin", "Mitglied");
  expect("Mitgliederin", "Mitglied");
  expect("Fachkräftin", "Fachkraft");
});

test("Pseudo-Feminina Plural → Grundwort-Plural", () => {
  expect("Gästinnen", "Gäste");
  expect("Vorständinnen", "Vorstände");
  expect("Menschinnen", "Menschen");
  expect("Mitgliederinnen", "Mitglieder");
  expect("Fachkräftinnen", "Fachkräfte");
});

test("Pseudo-Feminina im Satz mit Dativ Plural", () => {
  expect("ein Abend mit den Gästinnen", "ein Abend mit den Gästen");
  expect("Gespräch mit den Vorständinnen", "Gespräch mit den Vorständen");
  expect("zusammen mit den Mitgliederinnen", "zusammen mit den Mitgliedern");
  expect("eine Begrüßung der Gästinnen", "eine Begrüßung der Gäste"); // Genitiv, kein Dativ-n
});

test("Pseudo-Feminina – Groß-/Kleinschreibung wird übertragen", () => {
  expect("liebe GÄSTINNEN", "liebe GÄSTE");
});

test("Pseudo-Feminina – Artikel-Kongruenz am Satzanfang", () => {
  expect("Die Vorständin sprach", "Der Vorstand sprach");          // m
  expect("Eine Gästin kam", "Ein Gast kam");                       // m
  expect("Die Mitgliedin stimmte zu", "Das Mitglied stimmte zu");  // n
  expect("Jede Mitgliederin zählt", "Jedes Mitglied zählt");       // n
  expect("Die Fachkräftin fehlt", "Die Fachkraft fehlt");          // f → Artikel bleibt
});

test("Pseudo-Feminina – kleingeschriebener Artikel (mehrdeutig) bleibt", () => {
  expect("Ich sah die Vorständin", "Ich sah die Vorstand");        // wie "die Kollege": konservativ
});

test("Pseudo-Feminina – Grundwörter bleiben unangetastet", () => {
  for (const w of ["Gast", "Gäste", "Vorstand", "Vorstände", "Mensch", "Menschen",
                   "Mitglied", "Mitglieder", "Fachkraft", "Fachkräfte"]) {
    expect(w, w);
  }
});

test("Pseudo-Feminina als Kompositum-Kopf (Suffix)", () => {
  expect("Stammgästin", "Stammgast");
  expect("Stammgästinnen", "Stammgäste");
  expect("Vereinsmitgliederinnen", "Vereinsmitglieder");
  expect("Pflegefachkräftin", "Pflegefachkraft");        // Fachkraft ist ohnehin feminin
  expect("Die Vereinsvorständin trat zurück", "Der Vereinsvorstand trat zurück");
});

test("Pseudo-Femininum MITTEN im Wort bleibt unangetastet", () => {
  expect("Stammgästinraum", "Stammgästinraum"); // "raum" folgt → kein Wort-Ende-Treffer
});

// ─────────────────────────────────────────────────────────────
// Strukturelle Invarianten
// ─────────────────────────────────────────────────────────────
test("LEXICON-Schlüssel sind kleingeschrieben und Werte vollständig", () => {
  for (const [key, val] of LEXICON) {
    assert.equal(key, key.toLowerCase(), `Schlüssel nicht kleingeschrieben: ${key}`);
    assert.ok(val.sg && val.pl, `sg/pl fehlt für: ${key}`);
  }
});

test("PSEUDO_FEM-Schlüssel sind kleingeschrieben, enden auf -in und haben sg/pl", () => {
  for (const [key, val] of PSEUDO_FEM) {
    assert.equal(key, key.toLowerCase(), `Schlüssel nicht kleingeschrieben: ${key}`);
    assert.ok(key.endsWith("in"), `Schlüssel endet nicht auf -in: ${key}`);
    assert.ok(val.sg && val.pl, `sg/pl fehlt für: ${key}`);
  }
});
