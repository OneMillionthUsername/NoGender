// SPDX-License-Identifier: GPL-3.0-or-later
// Tests für die reine Normalisierungslogik (synchroner Pfad, ohne Wiktionary-Lookup
// und ohne DOM). Läuft mit dem eingebauten Node-Test-Runner: `npm test`.

const { test } = require("node:test");
const assert = require("node:assert/strict");
const ng = require("../nogender.js");

const { normalizeGenderedText, LEXICON } = ng;

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

test("v2.0.0 – Förder → Förderer (nur Nominativ)", () => {
  expect("aber auch nach Förder:innen", "aber auch nach Förderer");
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
// Strukturelle Invarianten
// ─────────────────────────────────────────────────────────────
test("LEXICON-Schlüssel sind kleingeschrieben und Werte vollständig", () => {
  for (const [key, val] of LEXICON) {
    assert.equal(key, key.toLowerCase(), `Schlüssel nicht kleingeschrieben: ${key}`);
    assert.ok(val.sg && val.pl, `sg/pl fehlt für: ${key}`);
  }
});
