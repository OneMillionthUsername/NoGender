// SPDX-License-Identifier: GPL-3.0-or-later
// ESLint Flat-Config. Ausführen mit `npm run lint` (benötigt vorher `npm install`).
const js = require("@eslint/js");
const globals = require("globals");

module.exports = [
  js.configs.recommended,

  // Content-Script & Popup laufen im Browser bzw. WebExtension-Kontext.
  {
    files: ["nogender.js", "popup.js"],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "script",
      globals: {
        ...globals.browser,
        ...globals.webextensions,
        // Export-Guard am Dateiende (nur unter Node aktiv):
        module: "readonly",
      },
    },
    rules: {
      // Mehrere bewusste Fehler-Schlucker (try/catch um optionale Browser-APIs).
      "no-empty": ["error", { allowEmptyCatch: true }],
    },
  },

  // Tests und Konfig laufen unter Node/CommonJS.
  {
    files: ["test/**/*.js", "eslint.config.js"],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "commonjs",
      globals: { ...globals.node },
    },
  },

  {
    ignores: ["icons/", "**/*.zip", "web-ext-artifacts/"],
  },
];
