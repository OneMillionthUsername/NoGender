// SPDX-License-Identifier: GPL-3.0-or-later
// Tests für die reine Normalisierungslogik (synchroner Pfad, ohne Wiktionary-Lookup
// und ohne DOM). Läuft mit dem eingebauten Node-Test-Runner: `npm test`.

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ng = require("../nogender.js");

const {
  normalizeGenderedText, applyPatterns, hasGenderCandidate, collectLookupStems,
  collapseDoublets, hasDoubletCandidate,
  parseWiktionaryFlexion, splitCompound, toPlural, toSingular, wiktCache,
  LEXICON, PSEUDO_FEM, PARTICIPLE,
} = ng;

// Unsichtbare Zeichen im Klartext wären im Quelltext nicht zu erkennen.
const SHY  = String.fromCharCode(0x00AD);   // weiches Trennzeichen (&shy;)
const ZWSP = String.fromCharCode(0x200B);   // Nullbreiten-Leerzeichen
const ZWJ  = String.fromCharCode(0x200D);   // Nullbreiten-Verbinder (Emoji-Sequenzen)
const MOD_COLON = String.fromCharCode(0xA789);   // ꞉ "modifier letter colon" (sieht aus wie ":")
const AST_OP    = String.fromCharCode(0x2217);   // ∗ "asterisk operator"

// Alle geprüften Eingaben – für den Vorfilter-Test am Dateiende.
const seenInputs = [];

// Hilfsfunktion: prüft Eingabe → erwartete Ausgabe.
function expect(input, output) {
  seenInputs.push(input);
  assert.equal(normalizeGenderedText(input), output);
}

// Simuliert einen Wiktionary-Treffer im Cache (ohne Netz) für die Dauer von `fn`.
function withWikt(entries, fn) {
  for (const [word, forms] of Object.entries(entries)) wiktCache.set(word, forms);
  try { fn(); } finally { for (const word of Object.keys(entries)) wiktCache.delete(word); }
}
const wiktPerson = (sg, pl) => ({ sg: { nom: sg }, pl: { nom: pl }, person: true });
const wiktNoun   = (sg, pl) => ({ sg: { nom: sg }, pl: { nom: pl }, person: false });

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

// Gekürzte Schreibung am schon gebeugten Wort (Posting auf derstandard.at): "Politikern/innen"
// steht für "Politikern/Politikerinnen" – vorher wurde daraus "Politikernen".
test("Stamm schon im Dativ Plural (-ern/-en vor dem Marker)", () => {
  expect("eine große Zahl von Politikern/innen", "eine große Zahl von Politikern");
  expect("mit Lehrern/innen", "mit Lehrern");
  expect("eine Reihe von Ärzten/innen", "eine Reihe von Ärzten");
  expect("Bauern/innen", "Bauern");
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
// Pseudo-Feminina ("Menschin", "Mitgliedin", "Fachkräftin") – Phase 1
// ─────────────────────────────────────────────────────────────
test("Pseudo-Feminina Singular → Grundwort", () => {
  expect("Menschin", "Mensch");
  expect("Mitgliedin", "Mitglied");
  expect("Mitgliederin", "Mitglied");
  expect("Fachkräftin", "Fachkraft");
});

test("Pseudo-Feminina Plural → Grundwort-Plural", () => {
  expect("Menschinnen", "Menschen");
  expect("Mitgliedinnen", "Mitglieder");
  expect("Mitgliederinnen", "Mitglieder");
  expect("Fachkräftinnen", "Fachkräfte");
});

test("Pseudo-Feminina im Satz mit Dativ Plural", () => {
  expect("ein Abend mit den Mitgliedinnen", "ein Abend mit den Mitgliedern");
  expect("zusammen mit den Mitgliederinnen", "zusammen mit den Mitgliedern");
  expect("eine Begrüßung der Mitgliedinnen", "eine Begrüßung der Mitglieder"); // Genitiv, kein Dativ-n
});

test("Pseudo-Feminina – Groß-/Kleinschreibung wird übertragen", () => {
  expect("liebe MITGLIEDINNEN", "liebe MITGLIEDER");
});

test("Pseudo-Feminina – Artikel-Kongruenz am Satzanfang", () => {
  expect("Die Menschin lacht", "Der Mensch lacht");                // m
  expect("Die Mitgliedin stimmte zu", "Das Mitglied stimmte zu");  // n
  expect("Jede Mitgliederin zählt", "Jedes Mitglied zählt");       // n
  expect("Die Fachkräftin fehlt", "Die Fachkraft fehlt");          // f → Artikel bleibt
});

test("Pseudo-Feminina – kleingeschriebener Artikel (mehrdeutig) bleibt", () => {
  expect("Ich sah die Mitgliedin", "Ich sah die Mitglied");        // wie "die Kollege": konservativ
});

test("Pseudo-Feminina – Grundwörter bleiben unangetastet", () => {
  for (const w of ["Mensch", "Menschen", "Mitglied", "Mitglieder", "Fachkraft", "Fachkräfte"]) {
    expect(w, w);
  }
});

test("Pseudo-Feminina als Kompositum-Kopf (Suffix)", () => {
  expect("Vereinsmitgliederinnen", "Vereinsmitglieder");
  expect("Pflegefachkräftin", "Pflegefachkraft");        // Fachkraft ist ohnehin feminin
  expect("Die Vereinsmitgliedin trat aus", "Das Vereinsmitglied trat aus");
});

test("Pseudo-Femininum MITTEN im Wort bleibt unangetastet", () => {
  expect("Mitgliedinnenversammlung", "Mitgliedinnenversammlung"); // kein Wort-Ende-Treffer
});

// Echte Feminina bezeichnen eine konkrete Frau und bleiben – auch seltene wie
// "Gästin" (Wiktionary: selten) und "Vorständin" (Wirtschaftspresse). Nur in einer
// Doppelnennung ("Liebe Gästinnen und Gäste") entfällt die Dopplung (s. u.).
test("natürliche Feminina bleiben stehen", () => {
  for (const w of ["Freundin", "meine Freundin", "Die Freundin kam", "Freundinnen",
                   "Finanzvorständin", "Die Vorständin sprach", "Vorständinnen",
                   "Gästin", "Stammgästin", "Liebe Gästinnen",
                   "Ärztin", "Lehrerinnen", "Kollegin"]) {
    expect(w, w);
  }
});

test("gegenderte Formen davon werden weiter aufgelöst", () => {
  expect("Freund:innen", "Freunde");
  expect("Vorständ:innen", "Vorstände");                              // vorher "Vorständen"
  expect("Finanzvorständ:in", "Finanzvorständin");                    // wie Ärzt:in → Ärztin
  expect("ein:e Vorständ:in", "ein Vorstand");
  expect("Gäst:in", "Gästin");
  expect("Gäst:innen", "Gäste");
});

// ─────────────────────────────────────────────────────────────
// Substantivierte Partizipien ("Studierende", "Lehrende") – Phase 2
// ─────────────────────────────────────────────────────────────
test("Partizip Plural → Nomen", () => {
  expect("Liebe Studierende!", "Liebe Studenten!");
  expect("Sehr geehrte Studierende,", "Sehr geehrte Studenten,");
  expect("die Studierenden protestieren", "die Studenten protestieren");
  expect("für Studierende", "für Studenten");
  expect("die Mitarbeitenden", "die Mitarbeiter");
  expect("von Lehrenden und Forschenden", "von Lehrern und Forscher"); // 2. Glied: konservative Dativ-Grenze
});

test("Partizip – neu aufgenommene Stämme", () => {
  expect("die Promovierenden", "die Doktoranden");
  expect("ein Promovierender", "ein Doktorand");
  expect("die Zuhörenden", "die Zuhörer");
  expect("für Antragstellende", "für Antragsteller");
  expect("die Konsumierenden", "die Konsumenten");
  expect("die Anwohnenden", "die Anwohner");
  expect("promovierende Wissenschaftler", "promovierende Wissenschaftler"); // klein → Adjektiv bleibt
});

test("Partizip Dativ Plural", () => {
  expect("mit den Studierenden", "mit den Studenten");
  expect("von den Forschenden", "von den Forschern");
  expect("mit Teilnehmenden", "mit Teilnehmern");
});

test("Partizip Singular nur mit eindeutigem Artikel (Nominativ)", () => {
  expect("der Studierende", "der Student");
  expect("die Studierende", "die Studentin");
  expect("ein Studierender", "ein Student");
  expect("eine Studierende", "eine Studentin");
  expect("der fleißige Studierende", "der fleißige Student"); // Adjektiv dazwischen
});

test("Partizip – obliquer Singular bleibt konservativ unangetastet", () => {
  expect("dem Studierenden half niemand", "dem Studierenden half niemand");
  expect("des Studierenden Buch", "des Studierenden Buch");
});

test("Partizip – Adjektiv vs. Nomen (Großschreibung entscheidet)", () => {
  expect("studierende Jugend", "studierende Jugend");           // klein → attributives Adjektiv
  expect("die erforschende Methode", "die erforschende Methode");
});

test("Partizip – Kompositum-Kopf", () => {
  expect("Lehramtsstudierende protestieren", "Lehramtsstudenten protestieren");
  expect("die Lehramtsstudierenden", "die Lehramtsstudenten");
});

test("Partizip – Flüchtende (kein sauberes Femininum)", () => {
  expect("die Flüchtenden", "die Flüchtlinge");
  expect("Hilfe für Flüchtende", "Hilfe für Flüchtlinge");
  expect("die Flüchtende", "die Flüchtende");   // fem. Singular: f=null → unangetastet
});

test("Partizip – Schutzliste (echte Partizip-/Adjektiv-Substantive) bleibt", () => {
  for (const w of ["die Reisenden", "der Vorsitzende", "die Auszubildenden",
                   "die Angestellten", "die Abgeordneten", "die Vorgesetzten",
                   "die Betroffenen", "die Freiwilligen", "die Jugendlichen",
                   "die Beschäftigten", "die Überlebenden", "die Verwandten",
                   "die Anwesenden", "die Erwachsenen", "die Bekannten",
                   "die Gefangenen", "die Angeklagten", "die Verdächtigen",
                   "die Hinterbliebenen", "die Delegierten", "die Selbstständigen",
                   "die Sachverständigen", "die Verantwortlichen", "die Alleinerziehenden",
                   "die Gläubigen", "die Heranwachsenden", "die Geschädigten",
                   "die Asylsuchenden", "die Verstorbenen", "die Erkrankten"]) {
    expect(w, w);
  }
});

test("Partizip – bewusst NICHT aufgenommene (echte) Partizipien bleiben", () => {
  // Diese sehen umwandelbar aus, sind aber normales Deutsch (kein Gendering-Ersatz):
  for (const w of ["die Streikenden", "die Wartenden", "die Umstehenden",
                   "die Lernenden", "die Sterbenden", "die Mitwirkenden",
                   "die Vortragenden", "die Schaffenden"]) {
    expect(w, w);
  }
});

test("Partizip – Komposita mit nachfolgendem Wort bleiben unangetastet", () => {
  expect("Studierendenwerk", "Studierendenwerk");
  expect("Studierendenausweis", "Studierendenausweis");
});

test("Partizip – abschaltbar über Flag", () => {
  assert.equal(normalizeGenderedText("Liebe Studierende!", false), "Liebe Studierende!");
  // Marker-Entgendern bleibt unabhängig vom Partizip-Flag aktiv:
  assert.equal(normalizeGenderedText("Lehrer:innen und Studierende", false),
               "Lehrer und Studierende");
});

// ─────────────────────────────────────────────────────────────
// Doppelnennungen ("Bürgerinnen und Bürger" → "Bürger")
// ─────────────────────────────────────────────────────────────
const doubletInputs = [];
function expectDoublet(input, output) {
  doubletInputs.push(input);
  expect(input, output);
}

test("Doppelnennung Plural – Reihenfolge egal", () => {
  for (const [fem, masc] of [
    ["Bürgerinnen", "Bürger"], ["Lehrerinnen", "Lehrer"], ["Ärztinnen", "Ärzte"],
    ["Kolleginnen", "Kollegen"], ["Studentinnen", "Studenten"], ["Bäuerinnen", "Bauern"],
    ["Jüdinnen", "Juden"], ["Französinnen", "Franzosen"], ["Zauberinnen", "Zauberer"],
    ["Rätinnen", "Räte"], ["Gästinnen", "Gäste"],
  ]) {
    expectDoublet(`${fem} und ${masc}`, masc);
    expectDoublet(`${masc} und ${fem}`, masc);
  }
});

test("Doppelnennung – alle Bindewörter", () => {
  for (const conn of [" und ", " oder ", " sowie ", " bzw. ", " beziehungsweise ",
                      "/", " / ", " & ", ", "]) {
    expectDoublet("Bürgerinnen" + conn + "Bürger", "Bürger");
    expectDoublet("Bürger" + conn + "Bürgerinnen", "Bürger");
  }
});

test("Doppelnennung – Kasus und Beifügungen bleiben wie im Text", () => {
  expectDoublet("mit Lehrerinnen und Lehrern", "mit Lehrern");
  expectDoublet("mit Lehrern und Lehrerinnen", "mit Lehrern");
  expectDoublet("den Ärztinnen und Ärzten", "den Ärzten");
  expectDoublet("die neuen Lehrerinnen und Lehrer", "die neuen Lehrer");
  expectDoublet("alle Schülerinnen und Schüler", "alle Schüler");
  expectDoublet("unsere Kundinnen und Kunden", "unsere Kunden");
  expectDoublet("die Bürgerinnen und die Bürger", "die Bürger");
  expectDoublet("Liebe Kolleginnen, liebe Kollegen", "Liebe Kollegen");
  expectDoublet("Liebe Kollegen, liebe Kolleginnen", "Liebe Kollegen");
  expectDoublet("Sehr geehrte Kundinnen, sehr geehrte Kunden", "Sehr geehrte Kunden");
  expectDoublet("Liebe Gästinnen und Gäste", "Liebe Gäste");
  expectDoublet("Sozialarbeiterinnen und Sozialarbeiter", "Sozialarbeiter");
  expectDoublet("Nicht-Akademikerinnen und Nicht-Akademiker", "Nicht-Akademiker");
  expectDoublet("LIEBE KOLLEGINNEN UND KOLLEGEN", "LIEBE KOLLEGEN");
  expectDoublet("Schülerinnen und Schüler sowie Lehrerinnen und Lehrer", "Schüler sowie Lehrer");
  expectDoublet("Was verdienen Lehrerinnen und Lehrer?", "Was verdienen Lehrer?");
  expectDoublet("Am 3. Oktober sind alle Bürgerinnen und Bürger eingeladen",
                "Am 3. Oktober sind alle Bürger eingeladen");
  expectDoublet("Dr. Müller begrüßte die Bürgerinnen und Bürger.", "Dr. Müller begrüßte die Bürger.");
  expectDoublet("Verantwortung gegenüber den Bürgerinnen und Bürgern",
                "Verantwortung gegenüber den Bürgern");
  expectDoublet("Schülerinnen und Schüler bzw. deren Eltern", "Schüler bzw. deren Eltern");
  expectDoublet("„Liebe Bürgerinnen und Bürger“, sagte sie.", "„Liebe Bürger“, sagte sie.");
});

test("Doppelnennung in Aufzählungen", () => {
  expectDoublet("Liebe Eltern, Schülerinnen und Schüler", "Liebe Eltern und Schüler");
  expectDoublet("Liebe Eltern, Schüler und Schülerinnen", "Liebe Eltern und Schüler");
  expectDoublet("Lehrerinnen, Lehrer, Erzieherinnen und Erzieher", "Lehrer und Erzieher");
  expectDoublet("Ärztinnen, Ärzte und Pfleger", "Ärzte und Pfleger");
  expectDoublet("Liebe Kolleginnen, liebe Kollegen, wir laden ein", "Liebe Kollegen, wir laden ein");
  expectDoublet("Sehr geehrte Damen und Herren, liebe Kolleginnen und Kollegen",
                "Sehr geehrte Damen und Herren, liebe Kollegen");
  expectDoublet("Damen und Herren, Kolleginnen und Kollegen", "Damen und Herren, Kollegen");
  expectDoublet("Vielen Dank, Kolleginnen und Kollegen", "Vielen Dank, Kollegen");  // Anrede, keine Liste
  expectDoublet("Ja, Lehrerinnen und Lehrer sind wichtig", "Ja, Lehrer sind wichtig");
});

test("Doppelnennung nach Auflösung anderer Formen", () => {
  expectDoublet("Lehrerinnen und Lehrende", "Lehrer");               // Partizip
  expectDoublet("Schülerinnen und Schüler:innen", "Schüler");         // Marker
});

test("Doppelnennung Singular mit Artikeln und Adjektiven", () => {
  expectDoublet("der Arzt oder die Ärztin", "der Arzt");
  expectDoublet("die Ärztin oder der Arzt", "der Arzt");
  expectDoublet("Die Ärztin oder der Arzt entscheidet", "Der Arzt entscheidet");
  expectDoublet("eine Lehrerin oder ein Lehrer", "ein Lehrer");
  expectDoublet("einen Lehrer oder eine Lehrerin", "einen Lehrer");
  expectDoublet("mit der Ärztin oder dem Arzt", "mit dem Arzt");
  expectDoublet("des Arztes oder der Ärztin", "des Arztes");
  expectDoublet("zur Ärztin oder zum Arzt", "zum Arzt");
  expectDoublet("Ihre Ärztin oder Ihr Arzt", "Ihr Arzt");
  expectDoublet("jeder Arzt oder jede Ärztin", "jeder Arzt");
  expectDoublet("die neue Kollegin oder der neue Kollege", "der neue Kollege");
  expectDoublet("eine erfahrene Ärztin oder ein erfahrener Arzt", "ein erfahrener Arzt");
  expectDoublet("Jede Schülerin und jeder Schüler", "Jeder Schüler");     // verteilend
  expectDoublet("jeder Schüler und jede Schülerin", "jeder Schüler");
  expectDoublet("Jede Bürgerin, jeder Bürger", "Jeder Bürger");
  expectDoublet("Liebe Kollegin, lieber Kollege", "Lieber Kollege");      // Anrede
  expectDoublet("Lieber Kollege, liebe Kollegin", "Lieber Kollege");
  expectDoublet("Sehr geehrte Kundin, sehr geehrter Kunde", "Sehr geehrter Kunde");
  expectDoublet("fragen Sie Ihre Ärztin, Ihren Arzt oder in Ihrer Apotheke",
                "fragen Sie Ihren Arzt oder in Ihrer Apotheke");
});

test("Doppelnennung Singular ohne Artikel nur mit Personenbeleg", () => {
  expectDoublet("Ärztin oder Arzt", "Arzt");
  expectDoublet("Arzt/Ärztin", "Arzt");
  expectDoublet("Bewerbung als Lehrerin oder Lehrer", "Bewerbung als Lehrer");
  expectDoublet("Ansprechpartnerin/Ansprechpartner", "Ansprechpartner");
  expectDoublet("Augustin oder August", "Augustin oder August");          // kein Beleg
  expectDoublet("Termin oder Term", "Termin oder Term");
  expectDoublet("Chirurgin oder Chirurg", "Chirurgin oder Chirurg");
  withWikt({ chirurg: wiktPerson("Chirurg", "Chirurgen") }, () => {
    expect("Chirurgin oder Chirurg", "Chirurg");
  });
});

test("Doppelnennung mit Ergänzungsstrich", () => {
  expectDoublet("Kinderärztinnen und -ärzte", "Kinderärzte");
  expectDoublet("Kinderärzte und -ärztinnen", "Kinderärzte");
  expectDoublet("Sozialarbeiterinnen und -arbeiter", "Sozialarbeiter");
  expectDoublet("Kinderärztin oder -arzt", "Kinderarzt");
  expectDoublet("Bürgerinnen- und Bürgerbeteiligung", "Bürgerbeteiligung");
  expectDoublet("Bürger- und Bürgerinnenbeteiligung", "Bürgerbeteiligung");
  expectDoublet("Schüler- und Schülerinnenvertretung", "Schülervertretung");
  expectDoublet("Ärzte- und Ärztinnenkammer", "Ärztekammer");
  expectDoublet("Studentinnen- und Studentenwerk", "Studentenwerk");
  expectDoublet("Bürgerinnen- und Bürgerinitiativen", "Bürgerinitiativen");
  expectDoublet("Kinderärztinnen, -ärzte und Apotheker", "Kinderärzte und Apotheker");
});

test("Doppelnennung als Pronomenpaar", () => {
  expectDoublet("Jede und jeder ist willkommen", "Jeder ist willkommen");
  expectDoublet("jeder und jede", "jeder");
  expectDoublet("jede/jeder", "jeder");
  expectDoublet("für jede und jeden", "für jeden");
  expectDoublet("mit jeder und jedem", "mit jedem");
  expectDoublet("jede und jeder Einzelne", "jeder Einzelne");
  expectDoublet("jeder und jede Lehrerin", "jeder und jede Lehrerin");   // Nomen richtet sich nach "jede"
});

// Ausschlussgruppe: Hier trägt die Nennung beider Formen Information, oder die Kürzung
// wäre grammatisch nicht sicher – der Text bleibt unverändert.
test("Ausschlussgruppe: Zahlen und Mengen", () => {
  for (const s of ["40 Lehrerinnen und 60 Lehrer", "4 Lehrerinnen und 4 Lehrer",
                   "zwei Ärztinnen und drei Ärzte", "rund 40 Lehrerinnen und Lehrer",
                   "Es kamen zwanzig Lehrerinnen und Lehrer",
                   "Tausende Bürgerinnen und Bürger demonstrierten",
                   "Lehrerinnen und Lehrer (40 bzw. 60)", "Lehrer und Lehrerinnen: 40 bzw. 60",
                   "beide Lehrerinnen und beide Lehrer"]) {
    expectDoublet(s, s);
  }
});

test("Ausschlussgruppe: Vergleich, Anteile, Geschlecht als Thema", () => {
  for (const s of ["Unterschiede zwischen Ärztinnen und Ärzten", "Ärztinnen und Ärzte im Vergleich",
                   "Ärztinnen und Ärzte verdienen unterschiedlich viel",
                   "das Verhältnis von Lehrerinnen und Lehrern",
                   "Der Anteil der Professorinnen und Professoren steigt",
                   "Rund 70 % der Lehrerinnen und Lehrer sind zufrieden",
                   "Bei den Ärztinnen und Ärzten sind Frauen in der Mehrheit",
                   "Gleichberechtigung für Bürgerinnen und Bürger",
                   "Lehrerinnen und Lehrer verdienen gleich viel",
                   "Ehepaare aus Ärztinnen und Ärzten",
                   "Doppelnennungen wie Bürgerinnen und Bürger",
                   "In der Anrede Kolleginnen und Kollegen"]) {
    expectDoublet(s, s);
  }
});

test("Ausschlussgruppe: Betonung, Einräumung, Auswahlfrage, Gegensatz", () => {
  for (const s of ["sowohl Lehrerinnen und Lehrer als auch Eltern",
                   "entweder die Ärztin oder der Arzt", "egal ob Lehrerin oder Lehrer",
                   "Eher Lehrerinnen oder Lehrer?", "Wer kommt: die Ärztin oder der Arzt?",
                   "Lehrerinnen oder Lehrer – wer verdient mehr?",
                   "Wir suchen Lehrerinnen, nicht Lehrer", "nicht Lehrerinnen, sondern Lehrer",
                   "Lehrerinnen und auch Lehrer", "Lehrerinnen und alle anderen Lehrer",
                   "Ärztinnen oder Ärzte, z. B. in Kliniken?",
                   "Lehrerinnen bzw. Lehrer erhalten 100 bzw. 200 Euro"]) {   // "bzw. … bzw." ordnet zu
    expectDoublet(s, s);
  }
});

test("Ausschlussgruppe: Komma als Satzgrenze, Relativsatz, Zitat", () => {
  for (const s of ["Erst kamen die Lehrerinnen, Lehrer folgten später.",
                   "die Lehrerinnen, die Lehrer ausbilden",
                   "Ich kenne jede Bürgerin, jeder Bürger kennt mich",
                   "Die Paarform „Bürgerinnen und Bürger“ ist verbreitet",
                   "Man schreibt „Lehrerinnen und Lehrer“."]) {
    expectDoublet(s, s);
  }
});

test("Ausschlussgruppe: zwei Personen im Singular", () => {
  for (const s of ["der Arzt und die Ärztin", "ein Lehrer und eine Lehrerin", "Arzt und Ärztin",
                   "die Kollegin und der Kollege", "der Arzt, die Ärztin und der Pfleger",
                   "Neue Kollegin, neuer Kollege", "Kinderärztin und -arzt"]) {
    expectDoublet(s, s);
  }
});

test("Ausschlussgruppe: unpassende oder fehlende Beifügungen", () => {
  for (const s of ["die jungen Lehrerinnen und die alten Lehrer",
                   "viele Lehrerinnen und wenige Lehrer",
                   "weibliche Lehrerinnen und männliche Lehrer", "der Arzt oder eine Ärztin",
                   "die Ärztin oder Arzt", "eine erfahrene Ärztin oder Arzt"]) {
    expectDoublet(s, s);
  }
});

test("keine Doppelnennung: verschiedene Wörter, Nicht-Personen, Komposita", () => {
  for (const s of ["Lehrerinnen und Schüler", "Damen und Herren", "Frauen und Männer",
                   "Kauffrauen und Kaufmänner", "meine Freundinnen und ich",
                   "Spinnen und Spinner", "Berlin und Brandenburg",
                   "Lehrerinnen und Lehrer-Verband", "Lehrerin/innen"]) {
    expectDoublet(s, s);
  }
});

test("Doppelnennungen – abschaltbar über Flag", () => {
  assert.equal(normalizeGenderedText("Liebe Bürgerinnen und Bürger", true, false),
               "Liebe Bürgerinnen und Bürger");
  // Marker-Entgendern bleibt unabhängig vom Doppelnennungs-Flag aktiv:
  assert.equal(normalizeGenderedText("Lehrer:innen sowie Bürgerinnen und Bürger", true, false),
               "Lehrer sowie Bürgerinnen und Bürger");
});

test("Doppelnennungen – ein zweiter Durchlauf ändert nichts", () => {
  for (const input of doubletInputs) {
    const once = normalizeGenderedText(input);
    assert.equal(normalizeGenderedText(once), once, input);
  }
});

// ─────────────────────────────────────────────────────────────
// Lexikon-Ergänzungen
// ─────────────────────────────────────────────────────────────
test("Programmierer und Dienstleister (-er/-er, kuratiert)", () => {
  expect("Programmierer:in", "Programmierer");
  expect("Programmierer:innen", "Programmierer");
  expect("Dienstleister*in", "Dienstleister");
  expect("Dienstleister*innen", "Dienstleister");
  expect("Softwareprogrammierer:innen", "Softwareprogrammierer");
});

// ─────────────────────────────────────────────────────────────
// Falschtreffer: Marker mit Leerzeichen, großes "I", Formeln (v3.0.0)
// ─────────────────────────────────────────────────────────────
test("Doppelpunkt/Stern/Mittelpunkt mit Leerzeichen ist normales Deutsch", () => {
  expect("Termin: in zwei Wochen", "Termin: in zwei Wochen");
  expect("Wohnhaft: in Berlin", "Wohnhaft: in Berlin");
  expect("ausgeübt: In Zivil- und Strafsachen", "ausgeübt: In Zivil- und Strafsachen");
  expect("Farbe: innen weiß, außen blau", "Farbe: innen weiß, außen blau");
  expect("Startseite · in eigener Sache", "Startseite · in eigener Sache");
  expect("Preis* in Euro", "Preis* in Euro");
  expect("Lehrer: in der Schule", "Lehrer: in der Schule");            // Präposition, auch nach Person
  expect("Wechselrichter: in Betrieb", "Wechselrichter: in Betrieb");
  expect("Bauer: Innenpolitisch ist das schwierig", "Bauer: Innenpolitisch ist das schwierig");
});

test("Klammer mit Leerzeichen: (innen)/(in) bei Nicht-Personen bleibt", () => {
  expect("Maße (innen): 30 cm", "Maße (innen): 30 cm");
  expect("Tür (innen) lackiert", "Tür (innen) lackiert");
  expect("Lehrer (innen)", "Lehrer");                                  // Person → weiterhin aufgelöst
});

test("Leerzeichen-Formen nur bei sicher belegter Person", () => {
  expect("Lehrer: innen", "Lehrer");
  expect("Lehrer :innen", "Lehrer");
  expect("Mieter: innen", "Mieter");                                   // Lexikon
  expect("Maurer: innen", "Maurer: innen");                            // ohne Wiktionary kein Beleg
  expect("Lautsprecher: innen und außen", "Lautsprecher: innen und außen");  // "-sprecher" genügt nicht
  expect("Fahrzeug: innen und außen gereinigt", "Fahrzeug: innen und außen gereinigt");
  withWikt({ maurer: wiktPerson("Maurer", "Maurer"), farbe: wiktNoun("Farbe", "Farben") }, () => {
    expect("Maurer: innen", "Maurer");
    expect("Farbe: innen weiß", "Farbe: innen weiß");                  // Substantiv, aber keine Person
  });
});

test("großes I direkt am Marker ist Gender-Schreibung – auch ohne Lexikon", () => {
  expect("Lehrer*Innen", "Lehrer");
  expect("Student*Innen", "Studenten");
  expect("Maurer*Innen", "Maurer");
  expect("Maurer:Innen", "Maurer");
  expect("Maurer_In", "Maurer");
  expect("Maurer*In gesucht", "Maurer gesucht");
  expect("MITARBEITER:INNEN GESUCHT", "MITARBEITER GESUCHT");           // Versalien zählen als klein
});

test("großes I: nach „/“ und bei „:In“ vor einem Wort nur mit Personenbeleg (todo.txt)", () => {
  expect("Lehrer/In gesucht", "Lehrer gesucht");                        // Lexikon
  expect("Maurer/Innen", "Maurer/Innen");                               // kein Beleg
  expect("Außen/Innen-Bereich", "Außen/Innen-Bereich");
  expect("Hinweis:In diesem Fall", "Hinweis:In diesem Fall");           // fehlendes Leerzeichen
  // Textknoten endet mitten im Wort ("…/In<em>tellekt</em>") bzw. Worttrennung:
  expect("(Amoralismus/In", "(Amoralismus/In");
  expect("(Amoralismus/In- tellekt)", "(Amoralismus/In- tellekt)");
  expect("Kategorie:Innenpolitik", "Kategorie:Innenpolitik");
  expect("Datei:Innenraum.jpg", "Datei:Innenraum.jpg");
});

test("Leerzeichen-Form bei Komposita, deren Kopf allein kein Wort ist", () => {
  expect("Liebe Privatkund: innen", "Liebe Privatkunden");              // "kund" ← Kunde
  expect("Firmenkund :innen", "Firmenkunden");
  expect("Fachärzt: innen", "Fachärzte");
  expect("Arbeitskolleg: innen", "Arbeitskollegen");
  expect("Lautsprecher: innen", "Lautsprecher: innen");                  // "sprecher" ist ein Wort
  expect("Halbleiter: innen", "Halbleiter: innen");
});

test("Bank-Texte mit Leerzeichen am Doppelpunkt", () => {
  expect("Liebe Kund: innen, unsere Kundenberater: innen helfen gern",
         "Liebe Kunden, unsere Kundenberater helfen gern");            // Text gendert → freier Kopf ok
  expect("Kund: innen und Kontoinhaber: innen", "Kunden und Kontoinhaber");
  expect("Für Anleger: innen und Sparer: innen", "Für Anleger und Sparer");
  expect("Investor: innen", "Investoren");
  expect("Sparer: innen", "Sparer");
  expect("Investor:innen und Privatinvestor: innen", "Investoren und Privatinvestoren");
  expect("mit Investor: innen", "mit Investoren");                      // Dativ
  expect("Kontoinhaber: innen", "Kontoinhaber: innen");                 // allein: könnte ein Gerät sein
  expect("Azubi:innen", "Azubis");
  expect("Steuerzahler:innen", "Steuerzahler");
  expect("Betrag: in Euro", "Betrag: in Euro");                         // Formularbeschriftung bleibt
  expect("Laufzeit: in Monaten", "Laufzeit: in Monaten");
});

test("gemischte Schreibweise: die kompakte Form belegt die mit Leerzeichen", () => {
  expect("Maurer:innen und Maurer: innen", "Maurer und Maurer");
  expect("Liebe Maurer: innen, die Maurer:innen der Firma", "Liebe Maurer, die Maurer der Firma");
  expect("Maurer/Innen und Maurer*innen", "Maurer und Maurer");
  expect("MaurerInnen und Maurer:innen", "Maurer und Maurer");          // auch Binnen-I
  expect("Die Maurer:in kommt", "Der Maurer kommt");                    // Artikel passt sich an
  expect("Maurer: innen", "Maurer: innen");                             // allein: kein Beleg
});

test("„innen und außen“ ist nie Gendering", () => {
  expect("Leiter: innen und außen", "Leiter: innen und außen");         // Leiter steht im Lexikon
  expect("Lehrer: innen & außen", "Lehrer: innen & außen");
  withWikt({ fenster: wiktNoun("Fenster", "Fenster") }, () => {
    expect("Fenster: innen/außen", "Fenster: innen/außen");
  });
});

test("Adjektivendungen nur kompakt (keine Formeln/Aufzählungen)", () => {
  expect("Beispiel: n = 5", "Beispiel: n = 5");
  expect("Lösung: e = 2,718", "Lösung: e = 2,718");
  expect("U = 2 * pi * r", "U = 2 * pi * r");
  expect("Einheiten: Liter: l, Meter: m", "Einheiten: Liter: l, Meter: m");
  expect("var_n", "var_n");
  expect("jede/r", "jeder");
  expect("eine·n", "einen");
  expect("ein_e", "ein");
});

test("Slash-Form LehrerIn/Innen", () => {
  expect("PatientIn/Innen", "Patienten");
  expect("LehrerIn/Innen", "Lehrer");
  expect("Lehrerin/innen", "Lehrerin/innen");                          // natürliche Femininform
});

test("umschließende Klammern bleiben erhalten", () => {
  expect("(Lehrer:in)", "(Lehrer)");
  expect("(Ärzt:innen)", "(Ärzte)");
  expect("Kontakt (Ansprechpartner:in) anrufen", "Kontakt (Ansprechpartner) anrufen");
  expect("[Mitarbeiter*innen]", "[Mitarbeiter]");
  expect("(Die Kolleg:in)", "(Der Kollege)");
  expect("Lehrer(:in)", "Lehrer");                                     // Klammer gehört zur Form
  expect("Lehrer[*innen] und", "Lehrer und");
});

test("weitere Marker-Varianten", () => {
  expect("Mitarbeiter" + MOD_COLON + "innen", "Mitarbeiter");
  expect("Lehrer" + AST_OP + "innen", "Lehrer");
  expect("Schüler/-innen", "Schüler");
  expect("Ärzt:innen- und Patient:innenverbände", "Ärzte- und Patientenverbände");
});

// ─────────────────────────────────────────────────────────────
// Unsichtbare Zeichen
// ─────────────────────────────────────────────────────────────
test("weiches Trennzeichen/Nullbreite im gegenderten Wort wird entfernt", () => {
  expect("Lehrer" + SHY + ":innen", "Lehrer");
  expect("Lehrer:" + ZWSP + "innen", "Lehrer");
});

test("unsichtbare Zeichen außerhalb gegenderter Wörter bleiben erhalten", () => {
  const emoji = "\u{1F469}" + ZWJ + "\u{1F4BB}";                      // 👩‍💻
  expect("Kolleg:innen " + emoji, "Kollegen " + emoji);
  expect("Donau" + SHY + "dampf" + SHY + "schiff", "Donau" + SHY + "dampf" + SHY + "schiff");
  const family = "Familie \u{1F468}" + ZWJ + "\u{1F469}" + ZWJ + "\u{1F467}";
  assert.equal(normalizeGenderedText(family), family);                 // ohne Gendering: unverändert
});

// ─────────────────────────────────────────────────────────────
// Kongruenz: Maskulinum nach (gegendertem) Determinativ, Artikelpaare
// ─────────────────────────────────────────────────────────────
test("Umlaut-Stämme nach maskulinem/gegendertem Determinativ → Maskulinum", () => {
  expect("jede:r Ärzt:in", "jeder Arzt");
  expect("ein:e Ärzt:in", "ein Arzt");
  expect("eine:n Zahnärzt:in", "einen Zahnarzt");
  expect("ein:e Französ:in", "ein Franzose");
  expect("mit der Ärzt:in", "mit der Ärztin");                         // "der" auch feminin → bleibt
  expect("eine Ärzt:in", "eine Ärztin");
  expect("(jede:r Ärzt:in)", "(jeder Arzt)");                          // Klammer davor stört nicht
  expect("„jeder mensch“", "„jeder mensch“");
});

test("Artikel-/Pronomenpaare → Maskulinum", () => {
  expect("der*die Nutzer*in", "der Nutzer");
  expect("die:der Mitarbeiter:in", "der Mitarbeiter");
  expect("der*die Ärzt*in", "der Arzt");
  expect("Sie/Er kommt", "Er kommt");
  expect("seine:ihre Kolleg:innen", "seine Kollegen");
  expect("der/die/das", "der/die/das");                                // Aufzählung bleibt
  expect("er/sie/es", "er/sie/es");
});

test("mensch/frau nach Determinativ bleibt Substantiv", () => {
  expect("jeder mensch hat rechte", "jeder mensch hat rechte");
  expect("meine frau und ich", "meine frau und ich");
  expect("als frau", "als frau");
  expect("könnte mensch sagen", "könnte man sagen");
});

test("Genus-Kürzel-Varianten", () => {
  expect("Entwickler (m/f/d)", "Entwickler");
  expect("Engineer (all genders)", "Engineer");
  expect("Stelle (w/m/d) in Berlin", "Stelle in Berlin");
  expect("Geschwindigkeit (m/s)", "Geschwindigkeit (m/s)");
});

// ─────────────────────────────────────────────────────────────
// Formen-Auflösung: Lexikon-Ergänzungen und Pluralregeln
// ─────────────────────────────────────────────────────────────
test("schwache Maskulina auf -e und weitere Lexikon-Einträge", () => {
  expect("Kund:in", "Kunde");
  expect("Kund:innen", "Kunden");
  expect("Expert:in", "Experte");
  expect("Gäst:innen", "Gäste");
  expect("Chef:innen", "Chefs");
  expect("Fan:innen", "Fans");
  expect("Türk:innen", "Türken");
  expect("Französ:innen", "Franzosen");
  expect("Zeug:innen", "Zeugen");
  expect("Augenzeug:innen", "Augenzeugen");
  expect("SOZIALARBEITER:INNEN", "SOZIALARBEITER");
});

test("\"exact\"-Einträge sind kein Kompositum-Kopf", () => {
  assert.equal(splitCompound("Fahrzeug"), null);
  assert.equal(splitCompound("Werkzeug"), null);
  for (const [key, val] of LEXICON) {
    if (val.exact) assert.equal(splitCompound("Test" + key), null, key);
  }
});

test("Pluralregeln: -eur/-ier/-ar/-är/-ling → -e, Fremdwörter → -en", () => {
  const cases = {
    Akteur: "Akteure", Regisseur: "Regisseure", Offizier: "Offiziere", Notar: "Notare",
    Aktionär: "Aktionäre", Prüfling: "Prüflinge", Fotograf: "Fotografen",
    Philosoph: "Philosophen", Ökonom: "Ökonomen", Oligarch: "Oligarchen", Theolog: "Theologen",
    Lehrer: "Lehrer", Student: "Studenten", Autor: "Autoren", Bürge: "Bürgen",
  };
  for (const [stem, plural] of Object.entries(cases)) assert.equal(toPlural(stem), plural, stem);
  assert.equal(toSingular("Theolog"), "Theologe");
  assert.equal(toSingular("Lehrer"), "Lehrer");
  expect("Regisseur:innen", "Regisseure");
  expect("mit Akteur:innen", "mit Akteuren");
  expect("Theolog:in", "Theologe");
});

// ─────────────────────────────────────────────────────────────
// Wiktionary: Auswertung und gezielte Lookups
// ─────────────────────────────────────────────────────────────
const wikitext = (title, genus, sg, pl, extra = "") =>
  `== ${title} ({{Sprache|Deutsch}}) ==\n=== {{Wortart|Substantiv|Deutsch}}, {{${genus}}} ===\n` +
  `{{Deutsch Substantiv Übersicht\n|Genus=${genus}\n|Nominativ Singular=${sg}\n` +
  `|Nominativ Plural=${pl}\n|Genitiv Singular=x\n}}\n${extra}`;

test("parseWiktionaryFlexion: Formen und Personen-Signal", () => {
  const person = parseWiktionaryFlexion(
    wikitext("Mieter", "m", "Mieter", "Mieter", "{{Weibliche Wortformen}}\n:[1] [[Mieterin]]\n"));
  assert.deepEqual(person, { sg: { nom: "Mieter" }, pl: { nom: "Mieter" }, person: true });

  const noun = parseWiktionaryFlexion(wikitext("Termin", "m", "Termin", "Termine"));
  assert.equal(noun.person, false);
  assert.equal(noun.pl.nom, "Termine");

  // "—" = Form existiert nicht → keine verwendbare Form
  assert.equal(parseWiktionaryFlexion(wikitext("News", "f", "—", "News")).sg.nom, null);

  // Mehrere deutsche Einträge: der Personen-Eintrag gewinnt ("Leiter" m vs. f)
  const leiter = parseWiktionaryFlexion(
    wikitext("Leiter", "f", "Leiter", "Leitern") +
    wikitext("Leiter", "m", "Leiter", "Leiter", "{{Weibliche Wortformen}}\n:[1] [[Leiterin]]\n"));
  assert.equal(leiter.pl.nom, "Leiter");

  // Nur deutsche Abschnitte zählen
  const english = "== chef ({{Sprache|Englisch}}) ==\n{{Weibliche Wortformen}}\n";
  assert.equal(parseWiktionaryFlexion(english), null);
});

test("Wiktionary-Personenbeleg: Binnen-I nur bei Person, nicht bei jedem Substantiv", () => {
  expect("CheckIn", "CheckIn");
  withWikt({ check: wiktNoun("Check", "Checks"), mieter: wiktPerson("Mieter", "Mieter") }, () => {
    expect("CheckIn", "CheckIn");                                      // Substantiv ≠ Person
    expect("MieterInnen", "Mieter");
  });
});

test("collectLookupStems fragt nur, was lokal nicht lösbar ist", () => {
  const stems = text => [...collectLookupStems(text, new Set())].sort();
  assert.deepEqual(stems("Liebe Kolleg:innen und Lehrer:innen"), []);   // LEXICON
  assert.deepEqual(stems("Die Mieter:innen"), []);                      // -er: Regel genügt
  assert.deepEqual(stems("Sozialarbeiter:innen"), []);                  // Kompositum
  assert.deepEqual(stems("Termin: in Kürze"), []);                      // strukturell ausgeschlossen
  assert.deepEqual(stems("Die Bischof:innen"), ["bischof"]);            // Plural unsicher
  assert.deepEqual(stems("MaurerInnen"), ["maurer"]);                   // Personenbeleg nötig
  assert.deepEqual(stems("Farbe: innen weiß"), ["farbe"]);
  assert.deepEqual(stems("Maurer:innen und Maurer: innen"), []);        // im Text belegt
  assert.deepEqual(stems("Bischof:innen und Bischof: innen"), ["bischof"]); // Plural fehlt trotzdem
});

// ─────────────────────────────────────────────────────────────
// Vorfilter
// ─────────────────────────────────────────────────────────────
test("Vorfilter lässt gewöhnlichen Text durch", () => {
  for (const s of ["Er kommt aus Berlin.", "Das ist mein Termin.", "Die Frau lacht.",
                   "Ein Mensch.", "Wir sehen uns in fünf Minuten."]) {
    assert.equal(hasGenderCandidate(s), false, s);
    assert.equal(hasDoubletCandidate(s), false, s);
  }
  for (const s of ["Er ist allein und müde.", "Wir gehen hinein, dann darin weiter."]) {
    assert.equal(hasDoubletCandidate(s), false, s);             // kleingeschrieben: kein Nomen
  }
});

// ─────────────────────────────────────────────────────────────
// Strukturelle Invarianten
// ─────────────────────────────────────────────────────────────
test("LEXICON-Schlüssel sind kleingeschrieben und Werte vollständig", () => {
  for (const [key, val] of LEXICON) {
    assert.equal(key, key.toLowerCase(), `Schlüssel nicht kleingeschrieben: ${key}`);
    assert.ok(val.sg && val.pl, `sg/pl fehlt für: ${key}`);
    if ("m" in val) assert.ok(/in$/.test(val.sg), `m nur bei femininem sg: ${key}`);
  }
});

test("PSEUDO_FEM-Schlüssel sind kleingeschrieben, enden auf -in und haben sg/pl", () => {
  for (const [key, val] of PSEUDO_FEM) {
    assert.equal(key, key.toLowerCase(), `Schlüssel nicht kleingeschrieben: ${key}`);
    assert.ok(key.endsWith("in"), `Schlüssel endet nicht auf -in: ${key}`);
    assert.ok(val.sg && val.pl, `sg/pl fehlt für: ${key}`);
  }
});

test("PARTICIPLE-Schlüssel sind kleingeschrieben, enden auf -nd und haben m/pl", () => {
  for (const [key, val] of PARTICIPLE) {
    assert.equal(key, key.toLowerCase(), `Schlüssel nicht kleingeschrieben: ${key}`);
    assert.ok(key.endsWith("nd"), `Schlüssel endet nicht auf -nd: ${key}`);
    assert.ok(val.m && val.pl, `m/pl fehlt für: ${key}`);
    assert.ok("f" in val, `f-Feld fehlt für: ${key}`); // darf null sein, muss aber existieren
  }
});

// Der Vorfilter prüft nur billige notwendige Bedingungen. Würde er eine Eingabe
// abweisen, die ein Muster tatsächlich verändert, bliebe diese Form im Browser stehen.
test("Vorfilter übersieht nichts (alle Testeingaben)", () => {
  assert.ok(seenInputs.length > 100);
  for (const input of seenInputs) {
    if (applyPatterns(input, true) !== input) {
      assert.ok(hasGenderCandidate(input), `Vorfilter übersieht: ${JSON.stringify(input)}`);
    }
  }
});

// Dasselbe für Doppelnennungen – geprüft am Rohtext und nach den übrigen Mustern, denn
// normalizeGenderedText fragt den Vorfilter an beiden Stellen.
test("Vorfilter für Doppelnennungen übersieht nichts (alle Testeingaben)", () => {
  assert.ok(doubletInputs.length > 100);
  for (const input of seenInputs) {
    for (const text of [input, applyPatterns(input, true)]) {
      if (collapseDoublets(text) !== text) {
        assert.ok(hasDoubletCandidate(text), `Vorfilter übersieht: ${JSON.stringify(text)}`);
      }
    }
  }
});

// Das Manifest ist die einzige Versionsquelle für Popup und Content-Script;
// package.json muss mitziehen.
test("Versionen von manifest.json und package.json stimmen überein", () => {
  const read = file => JSON.parse(fs.readFileSync(path.join(__dirname, "..", file), "utf8"));
  assert.equal(read("package.json").version, read("manifest.json").version);
  const popup = fs.readFileSync(path.join(__dirname, "..", "popup.html"), "utf8");
  assert.ok(!/v\d+\.\d+\.\d+/.test(popup), "popup.html soll keine feste Version enthalten");
});
