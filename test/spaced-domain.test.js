// SPDX-License-Identifier: GPL-3.0-or-later
// Tests für SPACED_MARKER_DOMAINS: Nur auf diesen Seiten werden Marker-Formen mit
// Leerzeichen aufgelöst. Das Skript liest `location.hostname` beim Laden – deshalb wird
// es je Host mit simuliertem `location` frisch geladen.

const { test } = require("node:test");
const assert = require("node:assert/strict");

const SCRIPT = require.resolve("../nogender.js");

function loadFor(hostname) {
  globalThis.location = { hostname };
  delete require.cache[SCRIPT];
  try { return require(SCRIPT); } finally { delete globalThis.location; delete require.cache[SCRIPT]; }
}

const DOMAIN = loadFor("").SPACED_MARKER_DOMAINS[0];

// Prüft Eingabe → erwartete Ausgabe für alle Paare.
function expectAll(ng, pairs) {
  for (const [input, output] of pairs) assert.equal(ng.normalizeGenderedText(input), output, input);
}

// Auf allen Seiten gleich: kompakte Formen, Klammerformen und normales Deutsch.
const SAME_EVERYWHERE = [
  ["Kund:innen", "Kunden"],
  ["Lehrer*innen", "Lehrer"],
  ["Mitarbeiter:in", "Mitarbeiter"],
  ["Die Kolleg:in kommt", "Der Kollege kommt"],
  ["Lehrer (innen)", "Lehrer"],
  ["Lehrer(innen)", "Lehrer"],
  ["Tür (innen) lackiert", "Tür (innen) lackiert"],
  ["Termin: in Kürze", "Termin: in Kürze"],
  ["Lehrer: in der Schule", "Lehrer: in der Schule"],
  ["Farbe: innen weiß, außen blau", "Farbe: innen weiß, außen blau"],
  ["Leiter: innen und außen", "Leiter: innen und außen"],
];

// Leerzeichen-Formen → Ergebnis auf den gelisteten Seiten (sonst bleibt die Eingabe stehen).
const SPACED = [
  ["Kund: innen", "Kunden"],
  ["Liebe Privatkund: innen", "Liebe Privatkunden"],
  ["Firmenkund :innen", "Firmenkunden"],
  ["Lehrer: innen", "Lehrer"],
  ["Mieter: innen", "Mieter"],
  ["Investor: innen", "Investoren"],
];

test("Domain-Liste ist nicht leer", () => {
  assert.ok(DOMAIN, "SPACED_MARKER_DOMAINS braucht mindestens einen Eintrag");
});

for (const host of [DOMAIN, "www." + DOMAIN, "online." + DOMAIN]) {
  test(`${host}: Leerzeichen-Formen werden aufgelöst`, () => {
    const ng = loadFor(host);
    expectAll(ng, SPACED);
    expectAll(ng, SAME_EVERYWHERE);
    expectAll(ng, [["Maurer:innen und Maurer: innen", "Maurer und Maurer"]]);
    assert.deepEqual([...ng.collectLookupStems("Farbe: innen weiß", new Set())], ["farbe"]);
  });
}

for (const host of ["andere-seite.de", "nicht" + DOMAIN, DOMAIN + ".evil.com", ""]) {
  test(`${host || "(kein Host)"}: Leerzeichen-Formen bleiben stehen`, () => {
    const ng = loadFor(host);
    expectAll(ng, SPACED.map(([input]) => [input, input]));
    expectAll(ng, SAME_EVERYWHERE);
    // Die kompakte Form wird aufgelöst, die mit Leerzeichen nicht.
    expectAll(ng, [["Maurer:innen und Maurer: innen", "Maurer und Maurer: innen"]]);
    // Kein Wiktionary-Lookup für Formen, die ohnehin stehen bleiben.
    assert.deepEqual([...ng.collectLookupStems("Maurer: innen", new Set())], []);
    assert.deepEqual([...ng.collectLookupStems("Farbe: innen weiß", new Set())], []);
  });
}
