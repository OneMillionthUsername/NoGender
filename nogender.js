(() => {
  const IRREGULAR_SINGULAR = new Map([
    ["ärzt", "arzt"],
    ["anwält", "anwalt"],
    ["wirt", "wirt"],
    ["koch", "koch"],
    ["pfleger", "pfleger"],
    ["pädagog", "pädagog"],
    ["psycholog", "psycholog"],
    ["soziolog", "soziolog"],
    ["bürger", "bürger"],
    ["student", "student"],
    ["praktikant", "praktikant"],
    ["patient", "patient"],
    ["teilnehmer", "teilnehmer"],
    ["mitarbeiter", "mitarbeiter"],
    ["aktivist", "aktivist"],
    ["journalist", "journalist"],
    ["kommunist", "kommunist"],
    ["terrorist", "terrorist"],
    ["politiker", "politiker"],
    ["kollege", "kollege"],
    ["freund", "freund"],
    ["lehrer", "lehrer"],
    ["schüler", "schüler"],
    ["arbeiter", "arbeiter"],
    ["leser", "leser"],
    ["Elementarpädagog", "Elementarpädagoge"],
  ]);

  const IRREGULAR_PLURAL = new Map([
    ["ärzt", "ärzte"],
    ["anwält", "anwälte"],
    ["wirt", "wirte"],
    ["koch", "köche"],
    ["pfleger", "pfleger"],
    ["pädagog", "pädagogen"],
    ["psycholog", "psychologen"],
    ["soziolog", "soziologen"],
    ["bürger", "bürger"],
    ["student", "studenten"],
    ["praktikant", "praktikanten"],
    ["patient", "patienten"],
    ["teilnehmer", "teilnehmer"],
    ["mitarbeiter", "mitarbeiter"],
    ["aktivist", "aktivisten"],
    ["journalist", "journalisten"],
    ["kommunist", "kommunisten"],
    ["terrorist", "terroristen"],
    ["politiker", "politiker"],
    ["kollege", "kollegen"],
    ["freund", "freunde"],
    ["lehrer", "lehrer"],
    ["schüler", "schüler"],
    ["arbeiter", "arbeiter"],
    ["leser", "leser"],
    ["Elementarpädagog", "Elementarpädagogen"],
  ]);

  const NON_TEXT_PARENTS = new Set([
    "SCRIPT",
    "STYLE",
    "NOSCRIPT",
    "TEXTAREA",
    "CODE",
    "PRE",
  ]);

  const NORMALIZABLE_ATTRIBUTES = [
    "title",
    "alt",
    "placeholder",
    "aria-label",
    "aria-describedby",
    "aria-description",
    "data-tooltip",
    "data-title",
    "data-original-title",
    "label",
  ];

  const MARKER = "[:*·•‧∙⋅⋆_/-]";
  const STEM = "([\\p{L}]{2,})";

  const reGenderInfo = /\s*[\(\[]\s*(?:m|w|d)\s*(?:[\/|]\s*(?:m|w|d))+\s*[\)\]]/giu;
  const reInnenWithMarker = new RegExp(`${STEM}\\s*(?:\\(|\\[)?${MARKER}(?:-)?innen(?:\\)|\\])?`, "gu");
  const reInWithMarker = new RegExp(`${STEM}\\s*(?:\\(|\\[)?${MARKER}(?:-)?in(?:\\)|\\])?`, "gu");
  const reInnenParen = new RegExp(`${STEM}\\s*\\(innen\\)`, "gu");
  const reInParen = new RegExp(`${STEM}\\s*\\(in\\)`, "gu");
  const reBinnenIPlural = new RegExp(`(\\b[\\p{Ll}][\\p{L}]*)Innen\\b`, "gu");
  const reBinnenISingular = new RegExp(`(\\b[\\p{Ll}][\\p{L}]*)In\\b`, "gu");
  const reInSlashInnen = new RegExp(`${STEM}In/Innen\\b`, "g");
  const reAdjNWithMarker = new RegExp(`(\\b[\\p{L}]{2,})\\s*${MARKER}\\s*n\\b`, "gu");
  const reAnyGenderPattern = new RegExp(
    [
      reGenderInfo.source,
      reAdjNWithMarker.source,
      reInSlashInnen.source,
      reBinnenIPlural.source,
      reBinnenISingular.source,
      reInnenWithMarker.source,
      reInWithMarker.source,
      reInnenParen.source,
      reInParen.source,
    ].join("|"),
    "iu"
  );
  const NORMALIZABLE_SELECTOR = NORMALIZABLE_ATTRIBUTES.map(attr => `[${attr}]`).join(',');

  function preserveCase(source, replacement) {
    if (!source) return replacement;
    const isUpper = source.toUpperCase() === source;
    const isCapitalized = source[0] === source[0].toUpperCase() && source.slice(1) === source.slice(1).toLowerCase();

    if (isUpper) return replacement.toUpperCase();
    if (isCapitalized) return replacement[0].toUpperCase() + replacement.slice(1);
    return replacement;
  }

  function toMasculine(stem) {
    const lower = stem.toLowerCase();
    if (IRREGULAR_SINGULAR.has(lower)) {
      return preserveCase(stem, IRREGULAR_SINGULAR.get(lower));
    }
    return stem;
  }

  function toPlural(stem) {
    const lower = stem.toLowerCase();
    if (IRREGULAR_PLURAL.has(lower)) {
      return preserveCase(stem, IRREGULAR_PLURAL.get(lower));
    }

    if (/(er|el|en|chen|lein)$/i.test(stem)) {
      return stem;
    }
    if (/e$/i.test(stem)) {
      return stem + "n";
    }
    if (/[tdnrsll]$/i.test(stem)) {
      return stem + "en";
    }

    return stem;
  }

  function normalizeGenderedText(text) {
    if (!text) return text;

    let out = text;

    // Remove soft hyphens / zero-width chars that split words in many news sites
    out = out.replace(/[\u00AD\u200B\u200C\u200D]/g, "");

    if (!reAnyGenderPattern.test(out)) return out;

    out = out.replace(reGenderInfo, "");

    out = out.replace(reAdjNWithMarker, (_, stem) => `${stem}n`);

    out = out.replace(reInSlashInnen, (_, stem) => toPlural(stem));

    out = out.replace(reBinnenIPlural, (_, stem) => toPlural(stem));
    out = out.replace(reBinnenISingular, (_, stem) => toMasculine(stem));

    out = out.replace(reInnenWithMarker, (_, stem) => toPlural(stem));
    out = out.replace(reInWithMarker, (_, stem) => toMasculine(stem));

    out = out.replace(reInnenParen, (_, stem) => toPlural(stem));
    out = out.replace(reInParen, (_, stem) => toMasculine(stem));

    return out;
  }

  function replaceGenderedLanguageInDOM(root) {
    if (!root) root = document.documentElement;
    if (!root) return 0;

    const walker = document.createTreeWalker(
      root,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode(node) {
          if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
          const parent = node.parentNode;
          if (!parent || parent.nodeType !== Node.ELEMENT_NODE) return NodeFilter.FILTER_ACCEPT;
          if (NON_TEXT_PARENTS.has(parent.nodeName)) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        },
      }
    );

    let count = 0;
    let node;
    while ((node = walker.nextNode())) {
      const original = node.nodeValue;
      const replaced = normalizeGenderedText(original);
      if (replaced !== original) {
        node.nodeValue = replaced;
        count++;
      }
    }

    return count;
  }

  function normalizeDocumentTitle(doc = document) {
    if (!doc || typeof doc.title !== "string") return;
    const original = doc.title;
    const replaced = normalizeGenderedText(original);
    if (replaced !== original) doc.title = replaced;
  }

  function normalizeMetaTags(doc = document) {
    if (!doc || !doc.head) return;
    const metas = doc.head.querySelectorAll("meta[name], meta[property]");
    metas.forEach((meta) => {
      if (!meta.hasAttribute("content")) return;
      const original = meta.getAttribute("content");
      if (!original) return;
      const replaced = normalizeGenderedText(original);
      if (replaced !== original) meta.setAttribute("content", replaced);
    });
  }

  const JSON_LD_SKIP_KEYS = new Set([
    "@id",
    "url",
    "sameAs",
    "contentUrl",
    "embedUrl",
    "thumbnailUrl",
  ]);

  function normalizeJsonLdValue(value, key) {
    if (typeof value === "string") {
      if (key && JSON_LD_SKIP_KEYS.has(key)) return value;
      return normalizeGenderedText(value);
    }

    if (Array.isArray(value)) {
      return value.map((entry) => normalizeJsonLdValue(entry));
    }

    if (value && typeof value === "object") {
      const normalized = {};
      for (const [childKey, childValue] of Object.entries(value)) {
        normalized[childKey] = normalizeJsonLdValue(childValue, childKey);
      }
      return normalized;
    }

    return value;
  }

  function normalizeJsonLdScripts(root = document) {
    if (!root) return;
    const context = root.querySelectorAll ? root : root.ownerDocument;
    if (!context || !context.querySelectorAll) return;
    const scripts = context.querySelectorAll("script[type='application/ld+json']");
    scripts.forEach((script) => {
      const original = script.textContent;
      if (!original || !original.trim()) return;
      try {
        const parsed = JSON.parse(original);
        const normalized = normalizeJsonLdValue(parsed);
        const replaced = JSON.stringify(normalized);
        if (replaced !== original) script.textContent = replaced;
      } catch {
        // Ignore invalid JSON-LD.
      }
    });
  }

  function normalizeElementAttributes(element) {
    if (!element || !element.hasAttributes) return;

    for (const attrName of NORMALIZABLE_ATTRIBUTES) {
      if (!element.hasAttribute(attrName)) continue;
      const original = element.getAttribute(attrName);
      if (!original || !original.trim()) continue;
      const replaced = normalizeGenderedText(original);
      if (replaced !== original) {
        element.setAttribute(attrName, replaced);
      }
    }
  }

  function normalizeAllAttributes(root) {
    if (!root) root = document.documentElement;
    if (!root) return;

    // Normalize attributes on root element itself
    if (root.nodeType === Node.ELEMENT_NODE) {
      normalizeElementAttributes(root);
    }

    // Normalize all descendants with normalizable attributes
    if (!root.querySelectorAll) return;

    try {
      const elements = root.querySelectorAll(NORMALIZABLE_SELECTOR);
      elements.forEach(normalizeElementAttributes);
    } catch {
      // Ignore query selector errors
    }
  }

  function normalizeSvgText(root) {
    if (!root) root = document.documentElement;
    if (!root || !root.querySelectorAll) return;

    try {
      const textElements = root.querySelectorAll('text, tspan, textPath');
      textElements.forEach((element) => {
        // Process text content
        const walker = document.createTreeWalker(
          element,
          NodeFilter.SHOW_TEXT,
          null
        );

        let node;
        while ((node = walker.nextNode())) {
          const original = node.nodeValue;
          if (!original) continue;
          const replaced = normalizeGenderedText(original);
          if (replaced !== original) {
            node.nodeValue = replaced;
          }
        }
      });
    } catch {
      // Ignore SVG processing errors
    }
  }

  function normalizeShadowDom(root) {
    if (!root) return;

    // Process shadow roots in this element and all descendants
    const processElement = (element) => {
      if (!element || element.nodeType !== Node.ELEMENT_NODE) return;

      // If this element has a shadow root, process it
      if (element.shadowRoot) {
        replaceGenderedLanguageInDOM(element.shadowRoot);
        normalizeAllAttributes(element.shadowRoot);
        normalizeSvgText(element.shadowRoot);
        normalizeJsonLdScripts(element.shadowRoot);

        // Recursively process shadow DOM children
        const children = element.shadowRoot.querySelectorAll('*');
        children.forEach(processElement);
      }
    };

    // Process root if it's an element
    if (root.nodeType === Node.ELEMENT_NODE) {
      processElement(root);
    }

    // Process all descendants
    if (root.querySelectorAll) {
      try {
        const allElements = root.querySelectorAll('*');
        allElements.forEach(processElement);
      } catch {
        // Ignore query errors
      }
    }
  }

  function observeGenderedLanguage(root) {
    if (!root) root = document.documentElement;
    if (!root || !root.ownerDocument) return;

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        // Handle added nodes
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.TEXT_NODE) {
            const original = node.nodeValue;
            const replaced = normalizeGenderedText(original);
            if (replaced !== original) node.nodeValue = replaced;
          } else if (node.nodeType === Node.ELEMENT_NODE) {
            replaceGenderedLanguageInDOM(node);
            normalizeAllAttributes(node);
            normalizeSvgText(node);
            normalizeJsonLdScripts(node);
            normalizeShadowDom(node);
          }
        }

        // Handle attribute changes
        if (mutation.type === 'attributes' && mutation.target.nodeType === Node.ELEMENT_NODE) {
          const attrName = mutation.attributeName;
          if (NORMALIZABLE_ATTRIBUTES.includes(attrName)) {
            normalizeElementAttributes(mutation.target);
          }
        }

        // Handle character data changes
        if (mutation.type === 'characterData' && mutation.target.nodeType === Node.TEXT_NODE) {
          const original = mutation.target.nodeValue;
          const replaced = normalizeGenderedText(original);
          if (replaced !== original) {
            mutation.target.nodeValue = replaced;
          }
        }
      }
    });

    observer.observe(root, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: NORMALIZABLE_ATTRIBUTES,
      characterData: true,
    });
  }

  function observeHeadChanges(doc = document) {
    if (!doc || !doc.head) return;
    const headObserver = new MutationObserver(() => {
      normalizeDocumentTitle(doc);
      normalizeMetaTags(doc);
      normalizeJsonLdScripts(doc);
    });

    headObserver.observe(doc.head, {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true,
      attributeFilter: ["content"],
    });
  }

  function startGenderReplacement() {
    // Use documentElement to process EVERYTHING (head + body + all)
    const root = document.documentElement;

    replaceGenderedLanguageInDOM(root);
    normalizeAllAttributes(root);
    normalizeSvgText(root);
    normalizeShadowDom(root);
    observeGenderedLanguage(root);
    normalizeDocumentTitle();
    normalizeMetaTags();
    normalizeJsonLdScripts();
    observeHeadChanges();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startGenderReplacement, { once: true });
  } else {
    startGenderReplacement();
  }
})();