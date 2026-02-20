const DEFAULT_SETTINGS = {
  enabled: true,
  blurAll: false,
  targetPerson: "",
  keywords: "",
  blurIntensity: 4,
  concealMode: "blur",
  targetNames: [],
  blurAmount: 4
};

const BLUR_CLASS = "blurred-message-text";
const REVEAL_CLASS = "blurred-reveal";
const BLUR_MODE_CLASS = "blurred-mode-blur";
const OPAQUE_MODE_CLASS = "blurred-mode-opaque";
const MESSAGE_ROW_SELECTOR = "#main div[role='row'], #main div[data-id]";
const SIDEBAR_ROW_SELECTOR = "#pane-side [role='listitem'], #pane-side [data-testid='cell-frame-container'], #pane-side div[role='row']";
const OPAQUE_COLOR = "rgb(36, 38, 38)";

let settings = { ...DEFAULT_SETTINGS };
let observer = null;
let rafId = null;

settings.keywordList = [];

function normalize(value) {
  return (value || "").trim().toLowerCase();
}

function normalizeLoose(value) {
  return normalize(value)
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function matchesTarget(target, source) {
  const strictTarget = normalize(target);
  const strictSource = normalize(source);
  if (strictTarget && strictSource && strictSource.includes(strictTarget)) {
    return true;
  }

  const looseTarget = normalizeLoose(target);
  const looseSource = normalizeLoose(source);
  if (looseTarget && looseSource && looseSource.includes(looseTarget)) {
    return true;
  }

  return false;
}

function parseKeywordList(value) {
  if (Array.isArray(value)) {
    return value.map((item) => item.trim()).filter(Boolean);
  }
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function ensureStyleTag() {
  if (document.getElementById("blurred-style-tag")) {
    return;
  }

  const style = document.createElement("style");
  style.id = "blurred-style-tag";
  (document.head || document.documentElement).appendChild(style);
}

function updateStyleTag() {
  const style = document.getElementById("blurred-style-tag");
  if (!style) {
    return;
  }

  style.textContent = `
    .${BLUR_CLASS} {
      position: relative !important;
      transition: filter 0.3s ease-in-out !important;
      cursor: pointer !important;
      user-select: none !important;
    }
    .${BLUR_CLASS}.${BLUR_MODE_CLASS} {
      filter: blur(${settings.blurIntensity}px) !important;
    }
    .${BLUR_CLASS}.${OPAQUE_MODE_CLASS} {
      filter: none !important;
      background: ${OPAQUE_COLOR} !important;
      color: transparent !important;
      text-shadow: none !important;
    }
    .${BLUR_CLASS}.${OPAQUE_MODE_CLASS} * {
      color: transparent !important;
      text-shadow: none !important;
    }
    .${BLUR_CLASS}.${REVEAL_CLASS} {
      filter: none !important;
      user-select: text !important;
      background: transparent !important;
      color: inherit !important;
    }
    .${BLUR_CLASS}.${REVEAL_CLASS}.${OPAQUE_MODE_CLASS} * {
      color: inherit !important;
    }
  `;
}

function getCurrentChatName() {
  const selectors = [
    "#main header [data-testid='conversation-info-header-chat-title']",
    "#main header [data-testid='conversation-header'] span[dir='auto']",
    "#main header h1 span[dir='auto']",
    "#main header h1 span[title]",
    "#main header span[title]",
    "#main header div[title]",
    "#main header span[dir='auto']",
    "header span[title]",
    "header div[title]",
    "header span[dir='auto']"
  ];

  for (const selector of selectors) {
    const el = document.querySelector(selector);
    if (!el) {
      continue;
    }

    const text = el.getAttribute("title") || el.textContent || "";
    if (text.trim()) {
      return text.trim();
    }
  }

  return "";
}

function parseAuthorFromPrePlainText(prePlainText) {
  const match = String(prePlainText || "").match(/\]\s(.+?):\s$/);
  return match && match[1] ? match[1].trim() : "";
}

function getMessageRows() {
  return Array.from(document.querySelectorAll(MESSAGE_ROW_SELECTOR));
}

function getSidebarRows() {
  const rawRows = Array.from(document.querySelectorAll(SIDEBAR_ROW_SELECTOR));
  const resolvedRows = rawRows
    .map((node) => node.closest("[role='listitem'], [data-testid='cell-frame-container'], div[role='row']") || node)
    .filter((node) => node && node.querySelector);

  const deduped = [];
  const seen = new Set();

  for (const row of resolvedRows) {
    if (seen.has(row)) {
      continue;
    }

    const hasTitle = Boolean(
      row.querySelector("span[title], [data-testid='cell-frame-title'], [data-testid='chat-list-item-title']")
    );
    const hasSecondary = Boolean(
      row.querySelector("[data-testid='cell-frame-secondary'], [data-testid='last-msg'], p, div[dir='auto'], div[dir='ltr']")
    );

    if (hasTitle || hasSecondary) {
      seen.add(row);
      deduped.push(row);
    }
  }

  return deduped;
}

function getRowTargetElement(row) {
  const copyable = row.querySelector("div.copyable-text, span.copyable-text");
  if (copyable && copyable.parentElement) {
    return copyable.parentElement;
  }

  const container = row.querySelector("div[data-testid='msg-container']");
  if (container) {
    return container;
  }

  return row;
}

function isIncomingRow(row) {
  const dataId = row.getAttribute("data-id") || "";
  if (dataId.startsWith("false_")) {
    return true;
  }
  if (dataId.startsWith("true_")) {
    return false;
  }

  const classes = row.className || "";
  if (classes.includes("message-in")) {
    return true;
  }
  if (classes.includes("message-out")) {
    return false;
  }

  return true;
}

function getRowText(row) {
  const parts = row.querySelectorAll("span.selectable-text, [data-testid='msg-text']");
  return Array.from(parts)
    .map((node) => (node.textContent || "").trim())
    .filter(Boolean)
    .join(" ")
    .trim();
}

function getRowAuthor(row) {
  const prePlainNode = row.querySelector(
    "div.copyable-text[data-pre-plain-text], span.copyable-text[data-pre-plain-text]"
  );
  const fromPrePlain = parseAuthorFromPrePlainText(prePlainNode?.getAttribute("data-pre-plain-text"));
  if (fromPrePlain) {
    return fromPrePlain;
  }

  const nameNode = row.querySelector("span[title], span[aria-label]");
  if (!nameNode) {
    return "";
  }

  return (
    nameNode.getAttribute("title") ||
    nameNode.getAttribute("aria-label") ||
    nameNode.textContent ||
    ""
  ).trim();
}

function getSidebarRowName(row) {
  const titleNode = row.querySelector("span[title]");
  if (!titleNode) {
    return "";
  }

  return (titleNode.getAttribute("title") || titleNode.textContent || "").trim();
}

function getSidebarPreviewNodes(row) {
  const directSnippetSelectors = [
    "[data-testid='last-msg']",
    "[data-testid='last-msg'] span",
    "[data-testid='last-msg'] div",
    "[data-testid='cell-frame-secondary'] [data-testid='last-msg']",
    "[data-testid='cell-frame-secondary'] p",
    "[data-testid='cell-frame-secondary'] span",
    "[data-testid='cell-frame-secondary'] div[dir='ltr']",
    "[data-testid='cell-frame-secondary'] div[dir='auto']"
  ];

  for (const selector of directSnippetSelectors) {
    const nodes = Array.from(row.querySelectorAll(selector)).filter((node) => {
      const text = (node.textContent || "").trim();
      if (!text) {
        return false;
      }
      if (/^\d{1,2}:\d{2}/.test(text) || /^\d+$/.test(text)) {
        return false;
      }
      return true;
    });

    if (nodes.length > 0) {
      return nodes;
    }
  }

  const secondaryContainer = row.querySelector("[data-testid='cell-frame-secondary']");
  if (secondaryContainer) {
    const nodes = Array.from(
      secondaryContainer.querySelectorAll("span, div[dir='ltr'], div[dir='auto'], p")
    ).filter((node) => {
      const text = (node.textContent || "").trim();
      if (!text) {
        return false;
      }
      if (/^\d{1,2}:\d{2}/.test(text) || /^\d+$/.test(text)) {
        return false;
      }
      return true;
    });

    if (nodes.length > 0) {
      return nodes;
    }
  }

  const titleNode = row.querySelector("span[title]");
  const candidates = Array.from(row.querySelectorAll("div[dir='ltr'], div[dir='auto'], span, p"));

  return candidates.filter((node) => {
    const text = (node.textContent || "").trim();
    if (!text) {
      return false;
    }

    if (titleNode && node === titleNode) {
      return false;
    }

    if (/^\d{1,2}:\d{2}/.test(text) || /^\d+$/.test(text)) {
      return false;
    }

    return text.length <= 160;
  }).slice(0, 3);
}

function getSidebarPreviewContainer(row) {
  return (
    row.querySelector("[data-testid='last-msg']") ||
    row.querySelector("[data-testid='cell-frame-secondary']") ||
    row.querySelector("p, div[dir='auto'], div[dir='ltr']")
  );
}

function getSidebarPreviewText(row) {
  return normalize(getSidebarPreviewNodes(row).map((el) => el.textContent || "").join(" "));
}

function shouldBlurSidebarRow(row) {
  if (!settings.enabled) {
    return false;
  }

  if (settings.blurAll) {
    return true;
  }

  const target = normalize(settings.targetPerson);
  const rowName = normalize(getSidebarRowName(row));
  const previewText = getSidebarPreviewText(row);

  if (target && matchesTarget(target, rowName)) {
    return true;
  }

  const keywordList = Array.isArray(settings.keywordList) ? settings.keywordList : [];
  if (keywordList.length > 0) {
    if (previewText && keywordList.some((kw) => previewText.includes(kw))) {
      return true;
    }
  }

  return false;
}

function shouldBlurRow(row) {
  if (!settings.enabled) {
    return false;
  }

  const incoming = isIncomingRow(row);
  const target = normalize(settings.targetPerson);
  const chatName = normalize(getCurrentChatName());

  if (settings.blurAll && incoming) {
    return true;
  }

  if (target && matchesTarget(target, chatName)) {
    return true;
  }

  if (target && incoming) {
    const author = normalize(getRowAuthor(row));
    if (matchesTarget(target, author)) {
      return true;
    }
  }

  const keywordList = Array.isArray(settings.keywordList) ? settings.keywordList : [];
  if (keywordList.length > 0) {
    const text = normalize(getRowText(row));
    if (text && keywordList.some((kw) => text.includes(kw))) {
      return true;
    }
  }

  return false;
}

function applyBlurToNode(node) {
  if (!node) {
    return;
  }

  node.classList.add(BLUR_CLASS);
  node.classList.toggle(BLUR_MODE_CLASS, settings.concealMode !== "opaque");
  node.classList.toggle(OPAQUE_MODE_CLASS, settings.concealMode === "opaque");
  node.dataset.blurredApplied = "1";
  node.onclick = (event) => {
    node.classList.toggle(REVEAL_CLASS);
    event.preventDefault();
    event.stopPropagation();
  };
}

function removeBlurFromNode(node) {
  if (!node) {
    return;
  }

  node.classList.remove(BLUR_CLASS);
  node.classList.remove(REVEAL_CLASS);
  node.classList.remove(BLUR_MODE_CLASS);
  node.classList.remove(OPAQUE_MODE_CLASS);
  if (node.dataset.blurredApplied === "1") {
    delete node.dataset.blurredApplied;
    node.onclick = null;
  }
}

function applyBlur() {
  rafId = null;

  const rows = getMessageRows();
  for (const row of rows) {
    const targetNode = getRowTargetElement(row);
    if (shouldBlurRow(row)) {
      applyBlurToNode(targetNode);
    } else {
      removeBlurFromNode(targetNode);
    }
  }

  const sidebarRows = getSidebarRows();
  for (const row of sidebarRows) {
    const previewNodes = getSidebarPreviewNodes(row);
    const shouldBlurPreview = shouldBlurSidebarRow(row);
    const previewTargets =
      previewNodes.length > 0
        ? previewNodes
        : [getSidebarPreviewContainer(row)].filter(Boolean);

    for (const node of previewTargets) {
      if (shouldBlurPreview) {
        applyBlurToNode(node);
      } else {
        removeBlurFromNode(node);
      }
    }
  }
}

function scheduleApplyBlur() {
  if (rafId !== null) {
    return;
  }
  rafId = requestAnimationFrame(applyBlur);
}

function startObserver() {
  if (observer) {
    observer.disconnect();
  }

  observer = new MutationObserver(() => {
    scheduleApplyBlur();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["title", "aria-label", "data-pre-plain-text", "data-id", "class"]
  });
}

function sanitizeSettings(raw) {
  const targetFromLegacy = Array.isArray(raw?.targetNames) ? raw.targetNames[0] || "" : "";
  const blurIntensity =
    Number.isFinite(raw?.blurIntensity) && raw.blurIntensity > 0
      ? raw.blurIntensity
      : Number.isFinite(raw?.blurAmount) && raw.blurAmount > 0
      ? raw.blurAmount
      : DEFAULT_SETTINGS.blurIntensity;

  const targetPerson = (raw?.targetPerson || targetFromLegacy || "").trim();
  const keywordList = parseKeywordList(raw?.keywords);
  const concealMode = raw?.concealMode === "opaque" ? "opaque" : "blur";

  return {
    enabled: raw?.enabled !== false,
    blurAll: Boolean(raw?.blurAll),
    targetPerson,
    keywords: keywordList.join(", "),
    keywordList: keywordList.map(normalize),
    blurIntensity,
    concealMode
  };
}

function loadSettingsAndApply() {
  chrome.storage.sync.get(DEFAULT_SETTINGS, (saved) => {
    settings = sanitizeSettings(saved);
    ensureStyleTag();
    updateStyleTag();
    scheduleApplyBlur();
  });
}

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "sync") {
    return;
  }

  const merged = {
    enabled: changes.enabled ? changes.enabled.newValue : settings.enabled,
    blurAll: changes.blurAll ? changes.blurAll.newValue : settings.blurAll,
    targetPerson: changes.targetPerson ? changes.targetPerson.newValue : settings.targetPerson,
    keywords: changes.keywords ? changes.keywords.newValue : settings.keywords,
    blurIntensity: changes.blurIntensity ? changes.blurIntensity.newValue : settings.blurIntensity,
    concealMode: changes.concealMode ? changes.concealMode.newValue : settings.concealMode,
    targetNames: changes.targetNames ? changes.targetNames.newValue : [settings.targetPerson],
    blurAmount: changes.blurAmount ? changes.blurAmount.newValue : settings.blurIntensity
  };

  settings = sanitizeSettings(merged);
  updateStyleTag();
  scheduleApplyBlur();
});

function init() {
  ensureStyleTag();
  loadSettingsAndApply();
  startObserver();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init, { once: true });
} else {
  init();
}
