import { createRequire } from "node:module";
var __create = Object.create;
var __getProtoOf = Object.getPrototypeOf;
var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
function __accessProp(key) {
  return this[key];
}
var __toESMCache_node;
var __toESMCache_esm;
var __toESM = (mod, isNodeMode, target) => {
  var canCache = mod != null && typeof mod === "object";
  if (canCache) {
    var cache = isNodeMode ? __toESMCache_node ??= new WeakMap : __toESMCache_esm ??= new WeakMap;
    var cached = cache.get(mod);
    if (cached)
      return cached;
  }
  target = mod != null ? __create(__getProtoOf(mod)) : {};
  const to = isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target;
  for (let key of __getOwnPropNames(mod))
    if (!__hasOwnProp.call(to, key))
      __defProp(to, key, {
        get: __accessProp.bind(mod, key),
        enumerable: true
      });
  if (canCache)
    cache.set(mod, to);
  return to;
};
var __commonJS = (cb, mod) => () => (mod || cb((mod = { exports: {} }).exports, mod), mod.exports);
var __require = /* @__PURE__ */ createRequire(import.meta.url);

// extensions/thinking-steps/internal-patch.ts
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Markdown, Spacer, Text } from "@earendil-works/pi-tui";

// extensions/thinking-steps/state.ts
var STATE_KEY = Symbol.for("pi-extensions.thinking-steps.state");
var DEFAULT_SCOPE_KEY = "__default__";
function isRecord(value) {
  return typeof value === "object" && value !== null;
}
function normalizeThinkingScopeKey(scopeKey) {
  const trimmed = scopeKey?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : DEFAULT_SCOPE_KEY;
}
function normalizeThinkingMode(mode) {
  return mode === "collapsed" || mode === "summary" || mode === "expanded" ? mode : "summary";
}
function normalizeActiveThinkingState(value) {
  if (!isRecord(value) || value.active !== true) {
    return { active: false };
  }
  return {
    active: true,
    messageTimestamp: typeof value.messageTimestamp === "number" ? value.messageTimestamp : undefined,
    contentIndex: typeof value.contentIndex === "number" ? value.contentIndex : undefined
  };
}
function normalizeModeByScopeKey(value, currentScopeKey, legacyMode) {
  const modeByScopeKey = {};
  if (isRecord(value)) {
    for (const [scopeKey, scopeMode] of Object.entries(value)) {
      modeByScopeKey[normalizeThinkingScopeKey(scopeKey)] = normalizeThinkingMode(scopeMode);
    }
  }
  modeByScopeKey[currentScopeKey] ??= normalizeThinkingMode(legacyMode);
  return modeByScopeKey;
}
function normalizeActiveByScopeKey(value) {
  const activeByScopeKey = {};
  if (!isRecord(value))
    return activeByScopeKey;
  for (const [scopeKey, entries] of Object.entries(value)) {
    const normalizedScopeKey = normalizeThinkingScopeKey(scopeKey);
    activeByScopeKey[normalizedScopeKey] = {};
    if (!isRecord(entries))
      continue;
    for (const [messageTimestamp, entry] of Object.entries(entries)) {
      if (!isRecord(entry))
        continue;
      activeByScopeKey[normalizedScopeKey][messageTimestamp] = {
        contentIndex: typeof entry.contentIndex === "number" ? entry.contentIndex : undefined
      };
    }
  }
  return activeByScopeKey;
}
function normalizeLastActiveByScopeKey(value) {
  const lastActiveByScopeKey = {};
  if (!isRecord(value))
    return lastActiveByScopeKey;
  for (const [scopeKey, entry] of Object.entries(value)) {
    lastActiveByScopeKey[normalizeThinkingScopeKey(scopeKey)] = normalizeActiveThinkingState(entry);
  }
  return lastActiveByScopeKey;
}
function ensureGlobalStateShape(state) {
  const currentScopeKey = normalizeThinkingScopeKey(typeof state.currentScopeKey === "string" ? state.currentScopeKey : undefined);
  const modeByScopeKey = normalizeModeByScopeKey(state.modeByScopeKey, currentScopeKey, state.mode);
  const activeByScopeKey = normalizeActiveByScopeKey(state.activeByScopeKey);
  const lastActiveByScopeKey = normalizeLastActiveByScopeKey(state.lastActiveByScopeKey);
  const legacyActive = normalizeActiveThinkingState(state.active);
  const refreshToggleByScope = isRecord(state.refreshToggleByScope) ? Object.fromEntries(Object.entries(state.refreshToggleByScope).map(([scopeKey, enabled]) => [normalizeThinkingScopeKey(scopeKey), enabled === true])) : {};
  const messageScopeByObject = state.messageScopeByObject instanceof WeakMap ? state.messageScopeByObject : new WeakMap;
  const messageObjectsByScope = isRecord(state.messageObjectsByScope) ? Object.fromEntries(Object.entries(state.messageObjectsByScope).map(([scopeKey, messages]) => [normalizeThinkingScopeKey(scopeKey), messages instanceof Set ? messages : new Set])) : {};
  const messageScopeByTimestamp = isRecord(state.messageScopeByTimestamp) ? Object.fromEntries(Object.entries(state.messageScopeByTimestamp).filter((entry) => typeof entry[1] === "string").map(([messageTimestamp, scopeKey]) => [messageTimestamp, normalizeThinkingScopeKey(scopeKey)])) : {};
  const legacyPatchReleasesByScope = isRecord(state.patchReleasesByScope) ? Object.fromEntries(Object.entries(state.patchReleasesByScope).map(([scopeKey, releases]) => [normalizeThinkingScopeKey(scopeKey), Array.isArray(releases) ? releases : []])) : {};
  const patchReleases = Array.isArray(state.patchReleases) ? state.patchReleases : Object.values(legacyPatchReleasesByScope).flat();
  const patchReleasesByScope = { ...legacyPatchReleasesByScope };
  for (const scopeKey of Object.keys(modeByScopeKey)) {
    activeByScopeKey[scopeKey] ??= {};
    lastActiveByScopeKey[scopeKey] ??= { active: false };
    refreshToggleByScope[scopeKey] ??= false;
    messageObjectsByScope[scopeKey] ??= new Set;
    patchReleasesByScope[scopeKey] ??= [];
  }
  if (legacyActive.active) {
    lastActiveByScopeKey[currentScopeKey] = legacyActive;
    if (legacyActive.messageTimestamp !== undefined) {
      activeByScopeKey[currentScopeKey][String(legacyActive.messageTimestamp)] = {
        contentIndex: legacyActive.contentIndex
      };
    }
  }
  state.currentScopeKey = currentScopeKey;
  state.modeByScopeKey = modeByScopeKey;
  state.activeByScopeKey = activeByScopeKey;
  state.lastActiveByScopeKey = lastActiveByScopeKey;
  state.refreshToggleByScope = refreshToggleByScope;
  state.messageScopeByObject = messageScopeByObject;
  state.messageObjectsByScope = messageObjectsByScope;
  state.messageScopeByTimestamp = messageScopeByTimestamp;
  state.patchReleases = patchReleases;
  state.patchReleasesByScope = patchReleasesByScope;
  state.patchRefCount = typeof state.patchRefCount === "number" && Number.isFinite(state.patchRefCount) ? state.patchRefCount : 0;
  state.patchCleanup = typeof state.patchCleanup === "function" ? state.patchCleanup : undefined;
  state.patchInstallPromise = state.patchInstallPromise instanceof Promise ? state.patchInstallPromise : undefined;
  return state;
}
var globalState = (() => {
  const existing = globalThis[STATE_KEY];
  if (isRecord(existing)) {
    return ensureGlobalStateShape(existing);
  }
  const created = {
    currentScopeKey: DEFAULT_SCOPE_KEY,
    modeByScopeKey: { [DEFAULT_SCOPE_KEY]: "summary" },
    activeByScopeKey: { [DEFAULT_SCOPE_KEY]: {} },
    lastActiveByScopeKey: { [DEFAULT_SCOPE_KEY]: { active: false } },
    refreshToggleByScope: {},
    messageScopeByObject: new WeakMap,
    messageObjectsByScope: { [DEFAULT_SCOPE_KEY]: new Set },
    messageScopeByTimestamp: {},
    patchReleases: [],
    patchReleasesByScope: {},
    patchRefCount: 0
  };
  globalThis[STATE_KEY] = created;
  return created;
})();
function ensureScopeState(scopeKey) {
  if (!(scopeKey in globalState.modeByScopeKey)) {
    globalState.modeByScopeKey[scopeKey] = "summary";
  }
  if (!(scopeKey in globalState.activeByScopeKey)) {
    globalState.activeByScopeKey[scopeKey] = {};
  }
  if (!(scopeKey in globalState.lastActiveByScopeKey)) {
    globalState.lastActiveByScopeKey[scopeKey] = { active: false };
  }
  if (!(scopeKey in globalState.refreshToggleByScope)) {
    globalState.refreshToggleByScope[scopeKey] = false;
  }
  if (!(scopeKey in globalState.messageObjectsByScope)) {
    globalState.messageObjectsByScope[scopeKey] = new Set;
  }
  if (!(scopeKey in globalState.patchReleasesByScope)) {
    globalState.patchReleasesByScope[scopeKey] = [];
  }
}
function getCurrentThinkingScopeKey() {
  return globalState.currentScopeKey;
}
function setCurrentThinkingScopeKey(scopeKey) {
  const normalizedScopeKey = normalizeThinkingScopeKey(scopeKey);
  ensureScopeState(normalizedScopeKey);
  globalState.currentScopeKey = normalizedScopeKey;
}
function getThinkingStepsMode(scopeKey) {
  const normalizedScopeKey = normalizeThinkingScopeKey(scopeKey ?? globalState.currentScopeKey);
  ensureScopeState(normalizedScopeKey);
  return globalState.modeByScopeKey[normalizedScopeKey] ?? "summary";
}
function setThinkingStepsMode(mode, scopeKey) {
  const normalizedScopeKey = normalizeThinkingScopeKey(scopeKey ?? globalState.currentScopeKey);
  ensureScopeState(normalizedScopeKey);
  globalState.modeByScopeKey[normalizedScopeKey] = mode;
  globalState.currentScopeKey = normalizedScopeKey;
}
function getActiveThinkingState(messageTimestamp, scopeKey) {
  const normalizedScopeKey = normalizeThinkingScopeKey(scopeKey ?? globalState.currentScopeKey);
  ensureScopeState(normalizedScopeKey);
  if (messageTimestamp !== undefined) {
    const entry = globalState.activeByScopeKey[normalizedScopeKey][String(messageTimestamp)];
    if (!entry)
      return { active: false };
    return { active: true, messageTimestamp, contentIndex: entry.contentIndex };
  }
  return { ...globalState.lastActiveByScopeKey[normalizedScopeKey] };
}
function setActiveThinkingState(state, scopeKey) {
  const normalizedScopeKey = normalizeThinkingScopeKey(scopeKey ?? globalState.currentScopeKey);
  ensureScopeState(normalizedScopeKey);
  globalState.lastActiveByScopeKey[normalizedScopeKey] = { ...state };
  if (!state.active || state.messageTimestamp === undefined) {
    if (state.messageTimestamp !== undefined) {
      delete globalState.activeByScopeKey[normalizedScopeKey][String(state.messageTimestamp)];
    }
    return;
  }
  globalState.activeByScopeKey[normalizedScopeKey][String(state.messageTimestamp)] = {
    contentIndex: state.contentIndex
  };
}
function clearActiveThinkingState(messageTimestamp, scopeKey) {
  if (messageTimestamp !== undefined) {
    const normalizedScopeKey = normalizeThinkingScopeKey(scopeKey ?? globalState.currentScopeKey);
    ensureScopeState(normalizedScopeKey);
    delete globalState.activeByScopeKey[normalizedScopeKey][String(messageTimestamp)];
    if (globalState.lastActiveByScopeKey[normalizedScopeKey].messageTimestamp === messageTimestamp) {
      globalState.lastActiveByScopeKey[normalizedScopeKey] = { active: false };
    }
    return;
  }
  if (scopeKey !== undefined) {
    const normalizedScopeKey = normalizeThinkingScopeKey(scopeKey);
    ensureScopeState(normalizedScopeKey);
    globalState.activeByScopeKey[normalizedScopeKey] = {};
    globalState.lastActiveByScopeKey[normalizedScopeKey] = { active: false };
    return;
  }
  for (const existingScopeKey of Object.keys(globalState.modeByScopeKey)) {
    ensureScopeState(existingScopeKey);
    globalState.activeByScopeKey[existingScopeKey] = {};
    globalState.lastActiveByScopeKey[existingScopeKey] = { active: false };
  }
}
function registerThinkingPatchRelease(scopeKey, release) {
  const normalizedScopeKey = normalizeThinkingScopeKey(scopeKey);
  ensureScopeState(normalizedScopeKey);
  globalState.patchReleasesByScope[normalizedScopeKey].push(release);
}
function takeThinkingPatchRelease(scopeKey) {
  const normalizedScopeKey = normalizeThinkingScopeKey(scopeKey);
  ensureScopeState(normalizedScopeKey);
  return globalState.patchReleasesByScope[normalizedScopeKey].pop();
}
function recordThinkingMessageScope(message, scopeKey) {
  const requestedScopeKey = normalizeThinkingScopeKey(scopeKey ?? globalState.currentScopeKey);
  ensureScopeState(requestedScopeKey);
  const existingScopeKey = globalState.messageScopeByObject.get(message);
  const normalizedScopeKey = existingScopeKey ?? requestedScopeKey;
  ensureScopeState(normalizedScopeKey);
  if (!existingScopeKey) {
    globalState.messageScopeByObject.set(message, normalizedScopeKey);
  }
  globalState.messageObjectsByScope[normalizedScopeKey].add(message);
  const timestamp = typeof message.timestamp === "number" ? message.timestamp : undefined;
  if (timestamp !== undefined) {
    globalState.messageScopeByTimestamp[String(timestamp)] = normalizedScopeKey;
  }
}
function resolveThinkingMessageScope(message, fallbackScopeKey) {
  const objectScopeKey = globalState.messageScopeByObject.get(message);
  if (objectScopeKey) {
    ensureScopeState(objectScopeKey);
    return objectScopeKey;
  }
  const timestamp = typeof message.timestamp === "number" ? message.timestamp : undefined;
  if (timestamp !== undefined) {
    const timestampScopeKey = globalState.messageScopeByTimestamp[String(timestamp)];
    if (timestampScopeKey) {
      ensureScopeState(timestampScopeKey);
      return timestampScopeKey;
    }
  }
  const normalizedScopeKey = normalizeThinkingScopeKey(fallbackScopeKey ?? globalState.currentScopeKey);
  ensureScopeState(normalizedScopeKey);
  return normalizedScopeKey;
}
function clearThinkingMessageOwnership(scopeKey) {
  if (scopeKey !== undefined) {
    const normalizedScopeKey = normalizeThinkingScopeKey(scopeKey);
    ensureScopeState(normalizedScopeKey);
    const ownedMessages = globalState.messageObjectsByScope[normalizedScopeKey] ?? new Set;
    for (const message of ownedMessages) {
      globalState.messageScopeByObject.delete(message);
    }
    globalState.messageObjectsByScope[normalizedScopeKey] = new Set;
    for (const [messageTimestamp, ownerScopeKey] of Object.entries(globalState.messageScopeByTimestamp)) {
      if (ownerScopeKey === normalizedScopeKey) {
        delete globalState.messageScopeByTimestamp[messageTimestamp];
      }
    }
    return;
  }
  globalState.messageScopeByObject = new WeakMap;
  globalState.messageObjectsByScope = { [DEFAULT_SCOPE_KEY]: new Set };
  globalState.messageScopeByTimestamp = {};
}
function incrementPatchRefCount() {
  globalState.patchRefCount += 1;
  return globalState.patchRefCount;
}
function decrementPatchRefCount() {
  globalState.patchRefCount = Math.max(0, globalState.patchRefCount - 1);
  return globalState.patchRefCount;
}
function getPatchCleanup() {
  return globalState.patchCleanup;
}
function setPatchCleanup(cleanup) {
  globalState.patchCleanup = cleanup;
}
function getPatchInstallPromise() {
  return globalState.patchInstallPromise;
}
function setPatchInstallPromise(installPromise) {
  globalState.patchInstallPromise = installPromise;
}

// extensions/thinking-steps/render.ts
import { truncateToWidth as truncateToWidth2, visibleWidth as visibleWidth2, wrapTextWithAnsi } from "@earendil-works/pi-tui";

// extensions/thinking-steps/parse.ts
var LIST_ITEM_RE = /^\s*(?:[-*+]\s+|\d+[.)]\s+|[a-z][.)]\s+)/i;
var HEADING_RE = /^\s{0,3}#{1,6}\s+/;
var LEADING_SUMMARY_PHRASE_RE = /^(?:i\s+(?:need|should|want)\s+to|need\s+to|i(?:'m| am)\s+going\s+to|i(?:'ll| will)|let\s+me|let'?s|first,?\s+|next,?\s+|then,?\s+|now,?\s+|okay,?\s+)/i;
function normalizeNewlines(text) {
  return text.replace(/\r\n?/g, `
`);
}
function collapseWhitespace(text) {
  return text.replace(/[ \t]+/g, " ").trim();
}
function stripLeadingMarker(text) {
  return text.replace(HEADING_RE, "").replace(LIST_ITEM_RE, "").trim();
}
function stripLeadingSummaryPhrase(text) {
  const stripped = text.replace(LEADING_SUMMARY_PHRASE_RE, "").trim();
  return stripped.length > 0 ? stripped : text.trim();
}
function capitalize(text) {
  if (!text)
    return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
}
function truncateText(text, maxLength) {
  if (text.length <= maxLength)
    return text;
  const truncated = text.slice(0, Math.max(0, maxLength - 1)).trimEnd();
  return `${truncated}…`;
}
function ensureCompleteVisibleSummary(summary) {
  const trimmed = summary.trim();
  if (!trimmed)
    return trimmed;
  if (!/(?:…|\.\.\.)$/u.test(trimmed)) {
    return /[.!?]$/u.test(trimmed) ? trimmed : `${trimmed.replace(/[.!?;:,]+$/g, "")}.`;
  }
  const withoutEllipsis = trimmed.replace(/(?:…|\.\.\.)+$/gu, "").trimEnd();
  const boundaryMatches = [
    ...Array.from(withoutEllipsis.matchAll(/[,:;](?=\s|$)/g), (match) => match.index ?? -1),
    ...Array.from(withoutEllipsis.matchAll(/\b(?:before|after|while|because|so|then|once|until)\b/gi), (match) => match.index ?? -1)
  ].filter((index) => index > 0);
  const boundaryIndex = boundaryMatches.length > 0 ? Math.max(...boundaryMatches) : -1;
  const candidate = boundaryIndex > 0 ? withoutEllipsis.slice(0, boundaryIndex).trimEnd() : withoutEllipsis.replace(/\s+\S*$/u, "").trimEnd();
  const cleaned = (candidate || withoutEllipsis).replace(/[.!?;:,]+$/g, "").trimEnd();
  return cleaned ? `${cleaned}.` : `${withoutEllipsis.replace(/[.!?;:,]+$/g, "").trimEnd()}.`;
}
function splitListChunk(chunk) {
  const lines = normalizeNewlines(chunk).split(`
`);
  let contentStartIndex = 0;
  while (contentStartIndex < lines.length) {
    const trimmed = lines[contentStartIndex].trim();
    if (!trimmed || isStandaloneHeadingChunk(trimmed)) {
      contentStartIndex += 1;
      continue;
    }
    break;
  }
  const headingPrefix = lines.slice(0, contentStartIndex).join(`
`).trim();
  const contentLines = lines.slice(contentStartIndex);
  const itemLineIndexes = contentLines.reduce((indexes, line, index) => {
    if (LIST_ITEM_RE.test(line))
      indexes.push(index);
    return indexes;
  }, []);
  if (itemLineIndexes.length < 2)
    return [chunk.trim()];
  const items = [];
  let current = [];
  for (const line of contentLines) {
    if (LIST_ITEM_RE.test(line) && current.length > 0) {
      const item = current.join(`
`).trim();
      items.push(headingPrefix ? `${headingPrefix}

${item}` : item);
      current = [line];
    } else {
      current.push(line);
    }
  }
  if (current.length > 0) {
    const item = current.join(`
`).trim();
    items.push(headingPrefix ? `${headingPrefix}

${item}` : item);
  }
  return items.filter(Boolean);
}
function stripMarkdownEmphasis(text) {
  return text.replace(/(\*\*|__)(?=\S)([\s\S]*?\S)\1/g, "$2").replace(/(^|[^\w/.-])\*(?=\S)([\s\S]*?\S)\*(?=[^\w/.-]|$)/g, "$1$2").replace(/(^|[^\w/.-])_(?=\S)([\s\S]*?\S)_(?=[^\w/.-]|$)/g, "$1$2");
}
function isStandaloneHeadingChunk(chunk) {
  const lines = normalizeNewlines(chunk).split(`
`).map((line2) => line2.trim()).filter(Boolean);
  if (lines.length !== 1)
    return false;
  const line = lines[0];
  if (LIST_ITEM_RE.test(line))
    return false;
  if (HEADING_RE.test(line))
    return true;
  if (!/^(\*\*|__)(.+?)\1$/.test(line))
    return false;
  const stripped = stripMarkdownEmphasis(stripLeadingMarker(line));
  return stripped.length > 0 && stripped.length <= 80 && !/[.!?]/.test(stripped);
}
function mergeHeadingParagraphChunks(chunks) {
  const merged = [];
  for (let index = 0;index < chunks.length; index += 1) {
    const chunk = chunks[index];
    const nextChunk = chunks[index + 1];
    if (isStandaloneHeadingChunk(chunk)) {
      const introChunks = [];
      let nextIndex = index + 1;
      while (nextIndex < chunks.length && !isStandaloneHeadingChunk(chunks[nextIndex]) && !isListParagraphChunk(chunks[nextIndex])) {
        introChunks.push(chunks[nextIndex]);
        nextIndex += 1;
      }
      const followingListChunks = [];
      while (nextIndex < chunks.length && isListParagraphChunk(chunks[nextIndex])) {
        followingListChunks.push(chunks[nextIndex]);
        nextIndex += 1;
      }
      if (introChunks.length > 0 && followingListChunks.length > 0) {
        merged.push(`${chunk}

${introChunks.join(`

`)}`);
        for (const listChunk of followingListChunks) {
          merged.push(`${chunk}

${listChunk}`);
        }
        index = nextIndex - 1;
        continue;
      }
      if (followingListChunks.length > 0) {
        merged.push(`${chunk}

${followingListChunks.join(`

`)}`);
        index = nextIndex - 1;
        continue;
      }
      if (nextChunk && !isStandaloneHeadingChunk(nextChunk)) {
        merged.push(`${chunk}

${nextChunk}`);
        index += 1;
        continue;
      }
    }
    merged.push(chunk);
  }
  return merged;
}
function isListParagraphChunk(chunk) {
  const lines = normalizeNewlines(chunk).split(`
`).map((line) => line.trim()).filter(Boolean);
  for (const line of lines) {
    if (LIST_ITEM_RE.test(line))
      return true;
    if (!isStandaloneHeadingChunk(line))
      return false;
  }
  return false;
}
function isListContinuationChunk(chunk) {
  const normalized = normalizeNewlines(chunk).trim();
  if (!normalized || isListParagraphChunk(normalized) || isStandaloneHeadingChunk(normalized)) {
    return false;
  }
  const firstLine = normalized.split(`
`).map((line) => stripMarkdownEmphasis(line.trim())).find(Boolean);
  if (!firstLine)
    return false;
  if (FAILURE_CUE_RE.test(firstLine))
    return false;
  if (STANDALONE_LIST_ACTION_RE.test(firstLine))
    return false;
  const hasFocusedActionCue = DIRECT_ACTION_START_RE.test(firstLine) && (collectPathTokens(firstLine).length > 0 || (firstLine.match(SYMBOL_TOKEN_RE) ?? []).length > 0 || /\b(?:before editing|after editing|npm|node|git|pi|larra|mcp|tsx|tsc)\b/i.test(firstLine));
  if (hasFocusedActionCue)
    return false;
  return !/^(?:overall|in summary|to summarize|in conclusion|finally|that should|this should|those steps should|this confirms|that confirms|with that)\b/i.test(firstLine);
}
var SINGLE_LINE_STEP_CUE_RE = /^(?:first|next|then|now|after that|finally|lastly)[,:\s]/i;
function isStandaloneActionLine(line) {
  const trimmed = line.trim();
  if (!trimmed)
    return false;
  if (LIST_ITEM_RE.test(trimmed))
    return true;
  if (DIRECT_ACTION_START_RE.test(trimmed))
    return true;
  if (STANDALONE_LIST_ACTION_RE.test(trimmed))
    return true;
  if (SINGLE_LINE_STEP_CUE_RE.test(trimmed))
    return true;
  return false;
}
function splitThinkingIntoStepTexts(text) {
  const normalized = normalizeNewlines(text).trim();
  if (!normalized)
    return [];
  const paragraphChunks = normalized.split(/\n{2,}/).map((chunk) => chunk.trim()).filter(Boolean);
  if (paragraphChunks.length === 0)
    return [];
  const mergedChunks = mergeHeadingParagraphChunks(paragraphChunks);
  const steps = [];
  for (let index = 0;index < mergedChunks.length; index += 1) {
    const chunk = mergedChunks[index];
    const previousStep = steps[steps.length - 1];
    if (previousStep && isListParagraphChunk(previousStep) && !isListParagraphChunk(chunk)) {
      const continuationChunks = [chunk];
      let continuationIndex = index + 1;
      while (continuationIndex < mergedChunks.length && !isListParagraphChunk(mergedChunks[continuationIndex])) {
        continuationChunks.push(mergedChunks[continuationIndex]);
        continuationIndex += 1;
      }
      if (continuationChunks.every(isListContinuationChunk) && (continuationIndex === mergedChunks.length || isListParagraphChunk(mergedChunks[continuationIndex]))) {
        steps[steps.length - 1] = previousStep + `

` + continuationChunks.join(`

`);
        index = continuationIndex - 1;
        continue;
      }
    }
    const lines = chunk.split(`
`).map((l) => l.trim()).filter(Boolean);
    if (lines.length > 1 && lines.every(isStandaloneActionLine)) {
      for (const line of lines) {
        steps.push(...splitListChunk(line));
      }
      continue;
    }
    steps.push(...splitListChunk(chunk));
  }
  return steps.length > 0 ? steps : [normalized];
}
var SUMMARY_MAX_CHARS = 84;
var MMR_LAMBDA = 0.7;
var PURE_TIMESTAMP_RE = /^(?:\[)?\d{1,2}:\d{2}(?::\d{2})?(?:\])?$|^\d{4}-\d{2}-\d{2}t\d{2}:\d{2}:\d{2}/i;
var SEPARATOR_RE = /^[\s`~!@#$%^&*()_+=\-\[\]{}\|;:'",.<>/?·]+$/;
var SPINNER_STATUS_RE = /^(?:thinking|loading|working|running|processing|waiting|done|complete|completed|idle)(?:[ .…:-]+)?$/i;
var PATH_TOKEN_RE = /\b(?:[a-z0-9_-]+[/.])+[a-z0-9_-]+\b/gi;
var SYMBOL_TOKEN_RE = /\b[a-z_][a-z0-9_]*\([^)]*\)/gi;
var ARTIFACT_RE = /(?:\b[a-z0-9_-]+\.(?:ts|tsx|js|jsx|json|md|txt|yml|yaml|lock)\b|\b[a-z_][a-z0-9_]*\([^)]*\)|`[^`]+`|\b(?:npm|node|git|pi|larra|mcp|tsx|tsc)\b|\b(?:ts\d{3,5}|err_[a-z0-9_]+)\b)/i;
var FAILURE_CUE_RE = /\b(failed|failure|error|errors|blocked|abort(?:ed)?|cannot|unable|did not complete|not completed|reverted|rollback|locked)\b/i;
var DECISION_CUE_RE = /\b(decided|decision|chose|switched|replaced|confirmed|fixed|resolved|discovered|found|preserve|keeping|keep)\b/i;
var PLAN_CHANGE_CUE_RE = /\b(instead of|rather than|safer (?:plan|path|route|approach|option)|(?:less|lower)-?risk(?:y)? (?:plan|path|route|approach|option)|plan changed|keep the current summarizer as the baseline|only choose the challenger|limit the algorithmic changes)\b/i;
var ACTION_CUE_RE = /\b(retry|rerun|inspect|check|verify|compare|search|find|read|patch|update|implement|remove|rename|write|run|fix|switch|revert|gather|retrieve|list|flag|review|plan|map|archive|explore|wait|look\s+into)\b/i;
var NEXT_ACTION_CUE_RE = /\b(first|next|retry|rerun|before|after)\b/i;
var UNCERTAINTY_CUE_RE = /\b(maybe|might|possibly|probably|seems|looks like|suspect|likely|whether|unverified|haven'?t verified|not verified|before I call this)\b/i;
var SPECULATIVE_CUE_RE = /\b(seems like|could be useful|might be useful|would be useful|considering)\b/i;
var META_CHATTER_RE = /\b(?:i(?:'m| am)?\s+(?:thinking|contemplating|curious|hoping|wondering)|take a closer look|what makes the most sense|could really help|idealized scenarios|real interactions|worth checking)\b/i;
var WEAK_FRAGMENT_START_RE = /^(?:and|but|or|so|then|though|while|which|because|however|therefore|perhaps|maybe|possibly|also|still|just|since)\b/i;
var GENERIC_OBJECT_ACTION_RE = /^(?:flag|review|check|inspect|look\s+into)\s+(?:that|this|it)\b/i;
var DIRECT_ACTION_START_RE = /^(?:use|inspect|check|verify|compare|search|find|read|patch|update|implement|remove|rename|write|run|fix|switch|revert|gather|retrieve|list|flag|review|plan|map|archive|explore|wait|look\s+into)\b/i;
var WEAK_ORIENTATION_RE = /\bconnect and orient ourselves\b/i;
var TOOL_AVAILABILITY_CHATTER_RE = /\b(?:while (?:there(?:'s| is)) a tool for it|might not retrieve\b|can't retrieve\b|cannot retrieve\b)\b/i;
var OUTCOME_UNCERTAINTY_CONTEXT_RE = /\b(?:whether|if|not sure|unsure|uncertain|unverified|not verified|haven'?t verified|maybe|might|may be|possibly|probably|seems|looks like|suspect|before I call this)\b/i;
var EXPLICIT_SUCCESS_RESULT_RE = /\b(?:(?:npm(?: run)? [a-z0-9:-]+|tests?|build|typecheck|lint|validation|suite|command)\s+(?:has\s+)?(?:passed|succeeded)|(?:passed|succeeded)\s+(?:after|once)\b(?=.*\b(?:npm|test|build|typecheck|lint|validation|suite|command)\b))/i;
var EXPLICIT_FAILURE_RESULT_RE = /\b(?:failed|blocked|abort(?:ed)?|cannot|unable|did not complete|not completed|reverted|rollback|locked)\b/i;
var EXPLICIT_ERROR_RESULT_RE = /\b(?:error|errors)\b(?:(?:\s*(?::|=|-))|(?:\s+(?:with|from|because|during|while|after|in|code|message)\b)|(?=.*\b(?:threw|throwing|throws|raised|encountered|reported|returned|hit|shows?|caught)\b))/i;
var FAILURE_REFERENCE_CONTEXT_RE = /\b(?:failure|failures|error|errors)\s+(?:handling|rendering|renderer|case|cases|path|paths|state|states|logic|message|messages|copy|text|wording|semantics|classification|detection|cue|cues|recovery|fallback|branch|branches|surface|mode|modes)\b/i;
var STANDALONE_LIST_ACTION_RE = /^(?:(?:i\s+)?(?:need|should|will|want|plan)\s+to|(?:next|then|now)\b|(?:need|should|must)\s+)/i;
function hasExplicitFailureCue(sentence) {
  const normalized = collapseWhitespace(sentence);
  if (!FAILURE_CUE_RE.test(normalized) || OUTCOME_UNCERTAINTY_CONTEXT_RE.test(normalized))
    return false;
  if (EXPLICIT_FAILURE_RESULT_RE.test(normalized))
    return true;
  if (EXPLICIT_ERROR_RESULT_RE.test(normalized) && !FAILURE_REFERENCE_CONTEXT_RE.test(normalized))
    return true;
  return false;
}
function hasExplicitSuccessCue(sentence) {
  return EXPLICIT_SUCCESS_RESULT_RE.test(sentence) && !OUTCOME_UNCERTAINTY_CONTEXT_RE.test(sentence);
}
function stripBoilerplatePrefix(value) {
  return value.replace(/^\[[^\]]+\]\s*/, "").replace(/^(?:thinking|thoughts?|status|assistant|stdout|stderr|step\s+\d+|progress|delta)\s*[:>-]\s*/i, "").replace(/^>\s+/, "").replace(/^[-=~]{2,}\s*/, "").trim();
}
function isNoiseLine(value) {
  const normalizedLine = collapseWhitespace(stripBoilerplatePrefix(stripMarkdownEmphasis(value)));
  return !normalizedLine || PURE_TIMESTAMP_RE.test(normalizedLine) || SEPARATOR_RE.test(normalizedLine) || SPINNER_STATUS_RE.test(normalizedLine);
}
function splitSummarySentences(value) {
  const placeholders = new Map;
  const protectedValue = value.replace(PATH_TOKEN_RE, (match) => {
    const token = `__PI_THINKING_PATH_${placeholders.size}__`;
    placeholders.set(token, match);
    return token;
  });
  return (protectedValue.match(/[^.!?\n]+(?:[.!?]+|$)/g) ?? [protectedValue]).map((sentence) => {
    let restored = sentence.trim();
    for (const [token, original] of placeholders) {
      restored = restored.replaceAll(token, original);
    }
    return restored;
  }).filter(Boolean);
}
var CLAUSE_BOUNDARY_COMMA_RE = /,\s+(?=(?:then|but|so|however|therefore|while|which|because|and then|next|perhaps|possibly)\b)/i;
function splitClauses(value) {
  return value.split(/;\s+|:\s+|\s+\b(?:but|so|and then)\b\s+|,\s+(?=(?:then|but|so|however|therefore|while|which|because|and then|next|perhaps|possibly)\b)/i).map((clause) => clause.trim()).filter(Boolean);
}
function normalizeCandidateText(value) {
  return collapseWhitespace(stripBoilerplatePrefix(stripMarkdownEmphasis(stripLeadingMarker(value).replace(/[\u2022]+/g, ""))));
}
function compressCandidate(value) {
  let candidate = normalizeCandidateText(value).replace(/^(?:it seems like|it looks like|it could be useful to|it might be useful to|it would be useful to|i['’]?m considering|i am considering|how we can|we can)\s*/i, "").replace(/^\b(?:well|okay|now|actually|basically|simply|really)\b[,:]?\s+/i, "").replace(/^(?:i\s+think\s+)?i\s+need\s+to\s+/i, "").replace(/^(?:i\s+think\s+)?i\s+should\s+/i, "").replace(/^i\s+plan\s+to\s+/i, "").replace(/^i\s+(?:will|can)\s+/i, "").replace(/^i\s+(?:want\s+to|am\s+going\s+to|['’]?m\s+going\s+to)\s+/i, "").replace(/^i\s+think\s+the\s+next\s+step\s+(?:might\s+be|is)\s+to\s+/i, "").replace(/^the\s+next\s+step\s+(?:might\s+be|is)\s+to\s+/i, "").replace(/^(?:it(?:'s| is)\s+(?:a\s+good\s+idea|helpful|useful|worthwhile)\s+to)\s+/i, "").replace(/^\b(?:let me|let'?s)\b\s+/i, "").replace(/\s*\(([^()]*)\)\s*/g, " ").replace(/\b(?:for now|at this point)\b/gi, "").replace(/\b(?:could|might|would)\s+be\s+(?:helpful|useful)(?:\s+(?:here|first))?/gi, "").replace(/\bavailable to me\b/gi, "available").replace(/\bfor it\b/gi, "").trim();
  candidate = candidate.replace(/^using\b/i, "Use").replace(/^inspecting\b/i, "Inspect").replace(/^checking\b/i, "Check").replace(/^comparing\b/i, "Compare").replace(/^verifying\b/i, "Verify").replace(/^searching\b/i, "Search").replace(/^finding\b/i, "Find").replace(/^reviewing\b/i, "Review").replace(/^reading\b/i, "Read").replace(/^writing\b/i, "Write").replace(/^planning\b/i, "Plan").replace(/^mapping out\b/i, "Map out").replace(/^gathering\b/i, "Gather").replace(/^retrieving\b/i, "Retrieve").replace(/^listing\b/i, "List").replace(/^archiving\b/i, "Archive").replace(/^exploring\b/i, "Explore").replace(/^look\s+into\b/i, "Look into").replace(/^connect and orient ourselves\b/i, "Orient to the current state");
  return collapseWhitespace(candidate).replace(/^[,;:.-]+|[,;:.-]+$/g, "").trim();
}
function tokenize(value) {
  const stopwords = new Set([
    "a",
    "an",
    "and",
    "are",
    "as",
    "at",
    "be",
    "been",
    "but",
    "by",
    "for",
    "from",
    "had",
    "has",
    "have",
    "i",
    "if",
    "in",
    "into",
    "is",
    "it",
    "its",
    "just",
    "let",
    "me",
    "my",
    "now",
    "of",
    "on",
    "or",
    "our",
    "so",
    "that",
    "the",
    "their",
    "them",
    "then",
    "there",
    "these",
    "they",
    "this",
    "to",
    "up",
    "was",
    "we",
    "were",
    "what",
    "when",
    "which",
    "while",
    "with",
    "would",
    "yet",
    "you"
  ]);
  const stem = (token) => {
    if (token.length > 5 && token.endsWith("ing"))
      return token.slice(0, -3);
    if (token.length > 4 && token.endsWith("ed"))
      return token.slice(0, -2);
    if (token.length > 4 && token.endsWith("es"))
      return token.slice(0, -2);
    if (token.length > 3 && token.endsWith("s"))
      return token.slice(0, -1);
    return token;
  };
  return collapseWhitespace(value).toLowerCase().split(/[^a-z0-9._/-]+/i).map((token) => stem(token.trim())).filter((token) => token.length > 1 && !stopwords.has(token));
}
function extractCandidates(value) {
  const paragraphs = normalizeNewlines(value).split(/\n{2,}/);
  const candidates = [];
  const seen = new Set;
  let candidateIndex = 0;
  const pushCandidate = (textValue, kind) => {
    const normalizedText = normalizeCandidateText(textValue);
    if (!normalizedText || SEPARATOR_RE.test(normalizedText) || seen.has(normalizedText.toLowerCase()))
      return;
    const tokens = tokenize(normalizedText);
    seen.add(normalizedText.toLowerCase());
    candidates.push({
      text: normalizedText,
      compressed: compressCandidate(normalizedText),
      tokens,
      tokenSet: new Set(tokens),
      index: candidateIndex++,
      kind,
      centrality: 0,
      positionPrior: 0,
      structurePrior: 0,
      cuePrior: 0,
      score: 0
    });
  };
  paragraphs.forEach((paragraph) => {
    const rawLines = normalizeNewlines(paragraph).split(`
`).map((line) => line.trim()).filter(Boolean);
    const cleanLines = rawLines.filter((line) => !isNoiseLine(line));
    if (cleanLines.length === 0)
      return;
    const structuredLines = cleanLines.filter((line) => LIST_ITEM_RE.test(line) || HEADING_RE.test(line));
    structuredLines.forEach((line) => pushCandidate(line, HEADING_RE.test(line) ? "heading" : "bullet"));
    const prose = cleanLines.filter((line) => !LIST_ITEM_RE.test(line) && !HEADING_RE.test(line)).join(" ");
    if (!prose)
      return;
    for (const sentence of splitSummarySentences(prose)) {
      const shouldSplitClauses = sentence.length > 100 || /[;:]|\s+\b(?:but|so|and then)\b/i.test(sentence) || CLAUSE_BOUNDARY_COMMA_RE.test(sentence);
      const clauseCandidates = shouldSplitClauses ? splitClauses(sentence) : [sentence];
      clauseCandidates.forEach((candidate) => pushCandidate(candidate, clauseCandidates.length > 1 ? "clause" : "sentence"));
    }
  });
  return candidates.filter((candidate) => candidate.compressed.length > 0);
}
var SUMMARY_CANDIDATE_LIMIT = 80;
var SUMMARY_CANDIDATE_EDGE_KEEP = 8;
function preliminaryCandidateScore(candidate, candidateCount) {
  const maxIndex = Math.max(candidateCount - 1, 1);
  let score = (1 - candidate.index / maxIndex) * 10;
  if (candidate.index >= candidateCount - SUMMARY_CANDIDATE_EDGE_KEEP)
    score += 8;
  if (candidate.kind === "bullet" || candidate.kind === "heading")
    score += 10;
  if (ARTIFACT_RE.test(candidate.text))
    score += 30;
  if (DIRECT_ACTION_START_RE.test(candidate.compressed))
    score += 45;
  if (DECISION_CUE_RE.test(candidate.text))
    score += 55;
  if (FAILURE_CUE_RE.test(candidate.text))
    score += 70;
  if (TOOL_AVAILABILITY_CHATTER_RE.test(candidate.text))
    score -= 60;
  if (META_CHATTER_RE.test(candidate.text))
    score -= 25;
  return score;
}
function limitSummaryCandidates(candidates) {
  if (candidates.length <= SUMMARY_CANDIDATE_LIMIT)
    return candidates;
  const selected = new Set;
  const edgeCount = Math.min(SUMMARY_CANDIDATE_EDGE_KEEP, candidates.length);
  for (let index = 0;index < edgeCount; index += 1) {
    selected.add(index);
    selected.add(candidates.length - 1 - index);
  }
  const ranked = [...candidates].sort((left, right) => preliminaryCandidateScore(right, candidates.length) - preliminaryCandidateScore(left, candidates.length) || left.index - right.index);
  for (const candidate of ranked) {
    if (selected.size >= SUMMARY_CANDIDATE_LIMIT)
      break;
    selected.add(candidate.index);
  }
  return [...selected].sort((left, right) => left - right).map((index) => candidates[index]).filter(Boolean);
}
function formatSummarySentence(clauses, fallback) {
  const normalizedClauses = clauses.map((candidate) => candidate.replace(/[.!?;:,]+$/g, "").trim()).filter(Boolean).filter((clause, index) => index === 0 || !WEAK_FRAGMENT_START_RE.test(clause));
  if (normalizedClauses.length === 0)
    return fallback;
  const [firstClause, ...restClauses] = normalizedClauses;
  let sentence = capitalize(firstClause);
  if (restClauses.length > 0) {
    const normalizedRest = restClauses.map((clause) => {
      if (/^[A-Z][a-z]/.test(clause))
        return clause.charAt(0).toLowerCase() + clause.slice(1);
      return clause;
    });
    sentence = `${sentence}, ${normalizedRest.join(", ")}`;
  }
  return `${sentence.replace(/[.!?;:,]+$/g, "")}.`;
}
function summarizeThinkingTextBaseline(text, fallback = "Reasoning is hidden by the provider.") {
  const raw = normalizeNewlines(text).trim();
  if (!raw)
    return fallback;
  const candidates = limitSummaryCandidates(extractCandidates(raw));
  if (candidates.length === 0) {
    return truncateText(`${capitalize(collapseWhitespace(stripMarkdownEmphasis(raw))).replace(/[.!?;:,]+$/g, "")}.`, SUMMARY_MAX_CHARS);
  }
  const documentFrequency = new Map;
  for (const candidate of candidates) {
    for (const token of candidate.tokenSet) {
      documentFrequency.set(token, (documentFrequency.get(token) ?? 0) + 1);
    }
  }
  const similarity = (left, right) => {
    if (left.tokenSet.size === 0 && right.tokenSet.size === 0)
      return 0;
    let intersectionWeight = 0;
    let unionWeight = 0;
    for (const token of left.tokenSet) {
      const weight = 1 + Math.log((1 + candidates.length) / (1 + (documentFrequency.get(token) ?? 0)));
      if (right.tokenSet.has(token))
        intersectionWeight += weight;
      unionWeight += weight;
    }
    for (const token of right.tokenSet) {
      if (left.tokenSet.has(token))
        continue;
      const weight = 1 + Math.log((1 + candidates.length) / (1 + (documentFrequency.get(token) ?? 0)));
      unionWeight += weight;
    }
    return unionWeight === 0 ? 0 : intersectionWeight / unionWeight;
  };
  const maxIndex = Math.max(...candidates.map((candidate) => candidate.index), 1);
  const maxCentrality = Math.max(...candidates.map((candidate) => {
    if (candidates.length === 1)
      return 1;
    const total = candidates.filter((other) => other !== candidate).reduce((sum, other) => sum + similarity(candidate, other), 0);
    return total / Math.max(candidates.length - 1, 1);
  }), 1);
  for (const candidate of candidates) {
    const centralityRaw = candidates.length === 1 ? 1 : candidates.filter((other) => other !== candidate).reduce((sum, other) => sum + similarity(candidate, other), 0) / Math.max(candidates.length - 1, 1);
    candidate.centrality = maxCentrality === 0 ? 0 : centralityRaw / maxCentrality;
    candidate.positionPrior = 1 - candidate.index / maxIndex;
    candidate.structurePrior = Math.min(1, (candidate.kind === "bullet" || candidate.kind === "heading" ? 0.45 : 0) + (ARTIFACT_RE.test(candidate.text) ? 0.35 : 0) + (FAILURE_CUE_RE.test(candidate.text) ? 0.25 : 0));
    candidate.cuePrior = Math.min(1, (FAILURE_CUE_RE.test(candidate.text) ? 0.5 : 0) + (DECISION_CUE_RE.test(candidate.text) ? 0.35 : 0) + (ACTION_CUE_RE.test(candidate.compressed) ? 0.6 : 0) + (NEXT_ACTION_CUE_RE.test(candidate.compressed) ? 0.3 : 0) + (ARTIFACT_RE.test(candidate.text) ? 0.2 : 0) - (META_CHATTER_RE.test(candidate.text) ? 0.45 : 0) - (TOOL_AVAILABILITY_CHATTER_RE.test(candidate.text) ? 0.85 : 0) - ((UNCERTAINTY_CUE_RE.test(candidate.text) || SPECULATIVE_CUE_RE.test(candidate.text)) && !FAILURE_CUE_RE.test(candidate.text) && !DIRECT_ACTION_START_RE.test(candidate.compressed) ? 0.75 : 0));
    candidate.score = 0.55 * candidate.centrality + 0.2 * candidate.positionPrior + 0.15 * candidate.structurePrior + 0.1 * candidate.cuePrior;
    const hasConcreteCue = DIRECT_ACTION_START_RE.test(candidate.compressed) || FAILURE_CUE_RE.test(candidate.text) || DECISION_CUE_RE.test(candidate.text) || ARTIFACT_RE.test(candidate.text);
    if (DIRECT_ACTION_START_RE.test(candidate.compressed))
      candidate.score += 0.35;
    if (candidate.kind === "heading" && !hasConcreteCue)
      candidate.score -= 0.45;
    if (META_CHATTER_RE.test(candidate.text) && !hasConcreteCue)
      candidate.score -= 0.4;
    if (TOOL_AVAILABILITY_CHATTER_RE.test(candidate.text) && !hasConcreteCue)
      candidate.score -= 1.1;
    if (WEAK_FRAGMENT_START_RE.test(candidate.compressed) && !hasConcreteCue)
      candidate.score -= 0.9;
    if ((/^not\b/i.test(candidate.compressed) || candidate.tokens.length < 4) && candidate.kind === "clause" && !hasConcreteCue)
      candidate.score -= 0.75;
    if (GENERIC_OBJECT_ACTION_RE.test(candidate.compressed) && !ARTIFACT_RE.test(candidate.text))
      candidate.score -= 0.8;
    if (WEAK_ORIENTATION_RE.test(candidate.compressed) && !ARTIFACT_RE.test(candidate.compressed))
      candidate.score -= 0.6;
  }
  const selected = [];
  const directActionCandidates = candidates.filter((candidate) => DIRECT_ACTION_START_RE.test(candidate.compressed));
  const prioritizedPool = directActionCandidates.length > 0 ? candidates.filter((candidate) => !GENERIC_OBJECT_ACTION_RE.test(candidate.compressed) && !TOOL_AVAILABILITY_CHATTER_RE.test(candidate.text) && (DIRECT_ACTION_START_RE.test(candidate.compressed) || FAILURE_CUE_RE.test(candidate.text) || DECISION_CUE_RE.test(candidate.text) || UNCERTAINTY_CUE_RE.test(candidate.text) && !WEAK_FRAGMENT_START_RE.test(candidate.compressed) && !(candidate.kind === "clause" && candidate.tokens.length < 4))) : candidates;
  const remaining = [...prioritizedPool];
  while (remaining.length > 0 && selected.length < 2) {
    remaining.sort((left, right) => {
      const leftPenalty = selected.length === 0 ? 0 : Math.max(...selected.map((candidate) => similarity(left, candidate)));
      const rightPenalty = selected.length === 0 ? 0 : Math.max(...selected.map((candidate) => similarity(right, candidate)));
      const leftScore = MMR_LAMBDA * left.score - (1 - MMR_LAMBDA) * leftPenalty;
      const rightScore = MMR_LAMBDA * right.score - (1 - MMR_LAMBDA) * rightPenalty;
      return rightScore - leftScore || left.index - right.index;
    });
    const next = remaining.shift();
    const ordered = [...selected, next].sort((left, right) => left.index - right.index);
    if (formatSummarySentence(ordered.map((candidate) => candidate.compressed), fallback).length <= SUMMARY_MAX_CHARS || selected.length === 0) {
      selected.push(next);
    }
  }
  const fallbackPool = prioritizedPool.length > 0 ? prioritizedPool : candidates;
  const orderedSelection = (selected.length > 0 ? selected : [fallbackPool.sort((left, right) => right.score - left.score || left.index - right.index)[0]]).sort((left, right) => left.index - right.index);
  return truncateText(formatSummarySentence(orderedSelection.map((candidate) => candidate.compressed), fallback) || fallback, SUMMARY_MAX_CHARS);
}
function normalizeSummaryEventText(value) {
  return collapseWhitespace(stripBoilerplatePrefix(stripMarkdownEmphasis(value)));
}
function collectPathTokens(text) {
  return Array.from(new Set(text.match(PATH_TOKEN_RE) ?? []));
}
function renderUncertaintySummary(text) {
  const normalized = normalizeSummaryEventText(text);
  const stripped = normalized.replace(/^(?:maybe|perhaps)\s+/i, "").replace(/^(?:it\s+(?:looks|seems)\s+like)\s+/i, "").replace(/^(?:i\s+(?:suspect|think)\s+)\s*/i, "").replace(/\b(?:but\s+)?i\s+haven'?t\s+verified\s+it\s+yet\b/gi, "").replace(/[.!?;:,]+$/g, "").trim();
  if (!stripped)
    return "Checking the current issue carefully.";
  const paths = collectPathTokens(normalized);
  if (/\bbefore i call this a drift\b/i.test(normalized) && paths.length > 0) {
    return `Inspect ${paths[0]} before calling this a drift.`;
  }
  if (/^whether\b/i.test(stripped))
    return `Checking ${stripped}.`;
  return `Checking whether ${stripped}.`;
}
function renderSummaryEvent(event) {
  if (event.type === "uncertainty") {
    return truncateText(renderUncertaintySummary(event.text), SUMMARY_MAX_CHARS);
  }
  if (event.type === "failure") {
    const normalized = normalizeSummaryEventText(event.text).replace(/[.!?;:,]+$/g, "");
    const failureClauses = splitClauses(normalized).map((clause) => normalizeSummaryEventText(clause).replace(/[.!?;:,]+$/g, "")).filter(Boolean);
    const specificFailureClause = failureClauses.find((clause) => /^(?:project reindex is locked by another operation|npm test failed with exit code|typecheck failed with TS\d+ in)\b/i.test(clause));
    const failureClause = (specificFailureClause ?? [...failureClauses].reverse().find((clause) => FAILURE_CUE_RE.test(clause)) ?? normalized).replace(/^(?:but|and)\s+/i, "");
    const npmFailureMatch = failureClause.match(/^npm test failed with exit code (\d+)\b/i);
    if (npmFailureMatch) {
      return `Npm test failed with exit code ${npmFailureMatch[1]}.`;
    }
    const typecheckMatch = failureClause.match(/^typecheck failed with (TS\d+) in ([a-z0-9_./-]+)\b/i);
    if (typecheckMatch) {
      return `Typecheck failed with ${typecheckMatch[1]} in ${typecheckMatch[2]}.`;
    }
    if (/^project reindex is locked by another operation\b/i.test(failureClause)) {
      return "Project reindex is locked by another operation.";
    }
    const cleanedFailure = failureClause.replace(/[.!?;:,]+$/g, "");
    if (cleanedFailure) {
      return truncateText(`${capitalize(cleanedFailure)}.`, SUMMARY_MAX_CHARS);
    }
  }
  if (event.type === "success") {
    const normalized = normalizeSummaryEventText(event.text).replace(/[.!?;:,]+$/g, "");
    const normalizeFollowup = (value) => value.replace(/^(?:once|after)\s+/i, "").replace(/^(?:i|we)\s+updated\s+/i, "updating ").replace(/^(?:i|we)\s+tightened\s+/i, "tightening ").replace(/^the\s+(.+?)\s+was\s+updated$/i, "updating $1").replace(/^the\s+(.+?)\s+were\s+updated$/i, "updating $1").replace(/^updating\s+the\s+/i, "updating ").replace(/^tightening\s+the\s+/i, "tightening ").trim();
    const buildMatch = normalized.match(/^npm run build passed(?:\s+(?:once|after)\s+(.+))?$/i);
    if (buildMatch) {
      const detail = normalizeFollowup(buildMatch[1] ?? "");
      if (detail)
        return truncateText(`Build passed after ${detail}.`, SUMMARY_MAX_CHARS);
    }
    const testMatch = normalized.match(/^(?:npm test|tests?) passed(?:\s+(?:once|after)\s+(.+))?$/i);
    if (testMatch) {
      const detail = normalizeFollowup(testMatch[1] ?? "");
      if (detail)
        return truncateText(`Tests passed after ${detail}.`, SUMMARY_MAX_CHARS);
    }
  }
  if (event.type === "decision") {
    const normalized = normalizeSummaryEventText(event.text).replace(/[.!?;:,]+$/g, "");
    const decidedMatch = normalized.match(/^i decided to\s+(.+)$/i);
    if (decidedMatch) {
      return truncateText(`Decided to ${decidedMatch[1]}.`, SUMMARY_MAX_CHARS);
    }
  }
  if (event.type === "plan_change") {
    const normalized = normalizeSummaryEventText(event.text).replace(/[.!?;:,]+$/g, "");
    if (/^i decided to preserve expanded mode behavior\b/i.test(normalized)) {
      return "Preserve expanded mode; limit changes to collapsed and summary selection.";
    }
    const insteadMatch = normalized.match(/^instead of\s+.+?,\s+i will\s+(.+)$/i);
    if (insteadMatch) {
      return truncateText(`Changed plan: ${insteadMatch[1]}.`, SUMMARY_MAX_CHARS);
    }
    if (/\bbaseline\b/i.test(normalized) && /\bchallenger\b/i.test(normalized) && /\b(?:(?:clearly\s+)?better|wins?)\b/i.test(normalized)) {
      return "Plan: keep current summarizer baseline; add event-aware challenger; use when better.";
    }
  }
  if (event.type === "action") {
    const normalized = normalizeSummaryEventText(event.text);
    const planningMatch = normalized.match(/^(?:i\s+(?:should|will|want\s+to|plan\s+to))\s+(.+)$/i);
    const cleaned2 = planningMatch ? `Planning to ${planningMatch[1].replace(/[.!?;:,]+$/g, "")}.` : `${capitalize(stripLeadingSummaryPhrase(normalized).replace(/[.!?;:,]+$/g, ""))}.`;
    return truncateText(cleaned2, SUMMARY_MAX_CHARS);
  }
  if (event.type === "focus") {
    const normalized = normalizeSummaryEventText(event.text).replace(/[.!?;:,]+$/g, "");
    const paths = collectPathTokens(event.text);
    if (paths.length > 0 && /\bcompare\b/i.test(normalized) && /\bsummary mode\b/i.test(normalized) && /\bbefore (?:editing|touching|changing)\b/i.test(normalized)) {
      return truncateText(`Planning to compare ${paths[0]} selection paths before editing.`, SUMMARY_MAX_CHARS);
    }
    const symbols = Array.from(new Set(event.text.match(SYMBOL_TOKEN_RE) ?? []));
    const commandMatch = event.text.match(/\b(?:node --test|node --import tsx|npm(?: run)? [a-z0-9:-]+)\b/i);
    if (commandMatch && paths.length > 0) {
      const compact = `Next check is ${commandMatch[0]} ${paths[0]}.`;
      if (compact.length <= SUMMARY_MAX_CHARS)
        return compact;
    }
    if (symbols.length >= 2) {
      const compact = `Inspect ${symbols[0]} and ${symbols[1]}.`;
      if (compact.length <= SUMMARY_MAX_CHARS)
        return compact;
    }
    if (paths.length >= 2) {
      const compact = `Inspect ${paths[0]} and ${paths[1]}.`;
      if (compact.length <= SUMMARY_MAX_CHARS)
        return compact;
    }
    if (paths.length === 1) {
      const path = paths[0];
      const withSymbol = symbols[0] && !path.includes(symbols[0]) ? `Inspect ${path} and ${symbols[0]}.` : `Inspect ${path}.`;
      if (withSymbol.length <= SUMMARY_MAX_CHARS)
        return withSymbol;
      return truncateText(`Inspect ${path}.`, SUMMARY_MAX_CHARS);
    }
    if (symbols.length > 0) {
      const compact = `Inspect ${symbols[0]}.`;
      if (compact.length <= SUMMARY_MAX_CHARS)
        return compact;
    }
  }
  const cleaned = normalizeSummaryEventText(event.text).replace(/[.!?;:,]+$/g, "");
  if (!cleaned)
    return "";
  return truncateText(`${capitalize(cleaned)}.`, SUMMARY_MAX_CHARS);
}
function extractThinkingSummaryEvents(text) {
  const raw = normalizeNewlines(text).trim();
  if (!raw)
    return [];
  const sentences = splitSummarySentences(raw).map((sentence) => normalizeSummaryEventText(sentence)).filter(Boolean);
  return sentences.map((sentence, order) => {
    const hasFailure = hasExplicitFailureCue(sentence);
    const hasSuccess = hasExplicitSuccessCue(sentence);
    const hasUncertainty = UNCERTAINTY_CUE_RE.test(sentence) || SPECULATIVE_CUE_RE.test(sentence);
    const hasPlanChange = !hasUncertainty && PLAN_CHANGE_CUE_RE.test(sentence) && (!/\b(?:instead of|rather than)\b/i.test(sentence) || /^(?:instead of|rather than)\b/i.test(sentence));
    const hasDecision = !hasUncertainty && DECISION_CUE_RE.test(sentence);
    const hasFocus = collectPathTokens(sentence).length > 0 || (sentence.match(SYMBOL_TOKEN_RE) ?? []).length > 0;
    const hasAction = ACTION_CUE_RE.test(sentence) || NEXT_ACTION_CUE_RE.test(sentence);
    if (hasFailure)
      return { type: "failure", text: sentence, order, priority: 110 };
    if (hasSuccess)
      return { type: "success", text: sentence, order, priority: 120 };
    if (hasPlanChange)
      return { type: "plan_change", text: sentence, order, priority: 90 };
    if (hasDecision)
      return { type: "decision", text: sentence, order, priority: 85 };
    if (hasUncertainty)
      return { type: "uncertainty", text: sentence, order, priority: 82 };
    if (hasAction)
      return { type: hasFocus ? "focus" : "action", text: sentence, order, priority: hasFocus ? 62 : 58 };
    if (hasFocus)
      return { type: "focus", text: sentence, order, priority: 55 };
    return { type: "generic", text: sentence, order, priority: 10 };
  });
}
function summarizeThinkingTextChallenger(text, fallback) {
  const events = extractThinkingSummaryEvents(text);
  if (events.length === 0) {
    return { summary: fallback, events: [], hasExplicitFailure: false, hasExplicitSuccess: false, collapsedPriority: 0 };
  }
  const latestFailure = [...events].reverse().find((event) => event.type === "failure");
  const latestSuccess = [...events].reverse().find((event) => event.type === "success");
  const hasExplicitFailure = Boolean(latestFailure);
  const hasExplicitSuccess = Boolean(latestSuccess);
  const topEvent = [...events].sort((left, right) => right.priority - left.priority || right.order - left.order)[0];
  return {
    summary: renderSummaryEvent(topEvent) || fallback,
    events,
    hasExplicitFailure,
    hasExplicitSuccess,
    collapsedPriority: topEvent.priority
  };
}
function countRetainedPathTokens(sourceText, summary) {
  return collectPathTokens(sourceText).filter((token) => summary.includes(token)).length;
}
function summarizeThinkingTextDetailed(text, fallback = "Reasoning is hidden by the provider.") {
  const raw = normalizeNewlines(text).trim();
  if (!raw) {
    return {
      summary: fallback,
      baselineSummary: fallback,
      challengerSummary: fallback,
      events: [],
      collapsedPriority: 0,
      hasExplicitFailure: false,
      hasExplicitSuccess: false
    };
  }
  const baselineSummary = summarizeThinkingTextBaseline(raw, fallback);
  const challenger = summarizeThinkingTextChallenger(raw, fallback);
  const challengerSummary = challenger.summary;
  const preservesUncertainty = /\b(?:whether|maybe|might|looks like|seems|uncertain)\b/i.test(challengerSummary);
  const baselinePreservesUncertainty = /\b(?:whether|maybe|might|looks like|seems|uncertain)\b/i.test(baselineSummary);
  const latestFailureOrder = challenger.events.filter((event) => event.type === "failure").at(-1)?.order ?? -1;
  const latestSuccessOrder = challenger.events.filter((event) => event.type === "success").at(-1)?.order ?? -1;
  const laterExplicitSuccess = latestSuccessOrder > latestFailureOrder;
  const baselineHasExplicitSuccess = hasExplicitSuccessCue(baselineSummary);
  const baselineHasExplicitFailure = hasExplicitFailureCue(baselineSummary);
  const baselineRetainedPathCount = countRetainedPathTokens(raw, baselineSummary);
  const challengerRetainedPathCount = countRetainedPathTokens(raw, challengerSummary);
  const sourceSymbols = Array.from(new Set(raw.match(SYMBOL_TOKEN_RE) ?? []));
  const baselineRetainedSymbolCount = sourceSymbols.filter((token) => baselineSummary.includes(token)).length;
  const challengerRetainedSymbolCount = sourceSymbols.filter((token) => challengerSummary.includes(token)).length;
  const startsWithStrongHypothesis = /^(?:maybe|perhaps)\b/i.test(raw) || /^whether\b/i.test(raw);
  const startsWithExplicitIntent = /^(?:i\s+(?:should|will|want\s+to|plan\s+to))\b/i.test(raw);
  const challengerFramesPlan = /^Planning to\b/i.test(challengerSummary);
  const baselineFramesPlan = /^Planning to\b/i.test(baselineSummary);
  const rawRequiresDeferredJudgment = /\bbefore i call this a drift\b/i.test(raw);
  const challengerRetainsDeferredJudgment = /\bbefore calling this a drift\b/i.test(challengerSummary);
  const baselineRetainsDeferredJudgment = /\bbefore (?:i call|calling) this a drift\b/i.test(baselineSummary);
  const repeatedActionKeys = challenger.events.map((event) => event.type === "action" ? stripLeadingSummaryPhrase(normalizeSummaryEventText(event.text)).toLowerCase().replace(/[^a-z0-9\s-]+/g, " ").trim().split(/\s+/).slice(0, 2).join(" ") : "").filter(Boolean);
  const hasRepeatedActionChatter = challenger.events.length >= 3 && challenger.events.every((event) => event.type === "action") && new Set(repeatedActionKeys).size < repeatedActionKeys.length;
  const shouldCompactFocusSummary = challenger.events.length === 1 && challenger.events[0]?.type === "focus" && /^(?:Inspect|Next check is|Planning to compare .* before editing\.)\b/i.test(challengerSummary) && /^(?:before editing |before touching |before changing |i(?:'m| am)\s+(?:reading|inspecting|tracing)|the next check is)\b/i.test(raw) && !/\bdo not regress\b/i.test(raw) && (challengerRetainedPathCount >= baselineRetainedPathCount || challengerRetainedSymbolCount > baselineRetainedSymbolCount);
  const rawHasCompareBeforeEditingIntent = /\bcompare\b/i.test(raw) && /\bsummary mode\b/i.test(raw) && /\bbefore (?:editing|touching|changing)\b/i.test(raw);
  const shouldPreferCompareBeforeEditingTemplate = challenger.events.length === 1 && challenger.events[0]?.type === "focus" && rawHasCompareBeforeEditingIntent && /^Planning to compare .* before editing\.$/i.test(challengerSummary) && challengerRetainedPathCount >= baselineRetainedPathCount && challengerRetainedSymbolCount >= baselineRetainedSymbolCount && challengerSummary.length <= baselineSummary.length;
  const singleChallengerEventType = challenger.events.length === 1 ? challenger.events[0]?.type : undefined;
  const challengerRetainsComparableContext = challengerRetainedPathCount >= baselineRetainedPathCount && challengerRetainedSymbolCount >= baselineRetainedSymbolCount;
  const shouldPreferFailureTemplate = singleChallengerEventType === "failure" && hasExplicitFailureCue(challengerSummary) && challengerRetainedPathCount >= baselineRetainedPathCount;
  const shouldPreferDecisionTemplate = singleChallengerEventType === "decision" && DECISION_CUE_RE.test(challengerSummary) && DECISION_CUE_RE.test(raw) && challengerRetainsComparableContext && challengerSummary.length <= baselineSummary.length + 8;
  const shouldPreferSuccessTemplate = singleChallengerEventType === "success" && hasExplicitSuccessCue(challengerSummary) && challengerRetainsComparableContext && challengerSummary.length <= baselineSummary.length + 8;
  const rawHasExpandedSelectionConstraint = /\bexpanded mode\b/i.test(raw) && /\b(?:collapsed|summary)\b/i.test(raw) && /\b(?:preserve|keep|limit)\b/i.test(raw);
  const shouldPreferExpandedConstraintTemplate = singleChallengerEventType === "plan_change" && rawHasExpandedSelectionConstraint && /\bexpanded mode\b/i.test(challengerSummary) && /\b(?:collapsed|summary)\b/i.test(challengerSummary) && challengerRetainsComparableContext;
  const rawHasHybridPlanFeatures = /\bbaseline\b/i.test(raw) && /\bchallenger\b/i.test(raw) && /\b(?:(?:clearly\s+)?better|wins?)\b/i.test(raw);
  const challengerHasHybridPlanFeatures = /\bbaseline\b/i.test(challengerSummary) && /\bchallenger\b/i.test(challengerSummary) && /\b(?:better|wins?)\b/i.test(challengerSummary);
  const shouldPreferPlanChangeTemplate = singleChallengerEventType === "plan_change" && (challengerHasHybridPlanFeatures || PLAN_CHANGE_CUE_RE.test(challengerSummary) || /^Changed plan:/i.test(challengerSummary)) && (rawHasHybridPlanFeatures || PLAN_CHANGE_CUE_RE.test(raw)) && challengerRetainsComparableContext;
  let summary = baselineSummary;
  if (laterExplicitSuccess && challenger.hasExplicitSuccess && !baselineHasExplicitSuccess) {
    summary = challengerSummary;
  } else if (challenger.hasExplicitFailure && !laterExplicitSuccess && !baselineHasExplicitFailure && hasExplicitFailureCue(challengerSummary)) {
    summary = challengerSummary;
  } else if (startsWithStrongHypothesis && (UNCERTAINTY_CUE_RE.test(raw) || SPECULATIVE_CUE_RE.test(raw)) && preservesUncertainty && !baselinePreservesUncertainty) {
    summary = challengerSummary;
  } else if (rawRequiresDeferredJudgment && challengerRetainsDeferredJudgment && !baselineRetainsDeferredJudgment) {
    summary = challengerSummary;
  } else if (startsWithExplicitIntent && challengerFramesPlan && !baselineFramesPlan) {
    summary = challengerSummary;
  } else if (hasRepeatedActionChatter && challengerSummary !== fallback) {
    summary = challengerSummary;
  } else if (shouldCompactFocusSummary && challengerSummary !== fallback) {
    summary = challengerSummary;
  } else if (shouldPreferCompareBeforeEditingTemplate && challengerSummary !== fallback) {
    summary = challengerSummary;
  } else if (shouldPreferFailureTemplate && challengerSummary !== fallback) {
    summary = challengerSummary;
  } else if (shouldPreferDecisionTemplate && challengerSummary !== fallback) {
    summary = challengerSummary;
  } else if (shouldPreferSuccessTemplate && challengerSummary !== fallback) {
    summary = challengerSummary;
  } else if (shouldPreferExpandedConstraintTemplate && challengerSummary !== fallback) {
    summary = challengerSummary;
  } else if (shouldPreferPlanChangeTemplate && challengerSummary !== fallback) {
    summary = challengerSummary;
  } else if (challengerRetainedPathCount > baselineRetainedPathCount) {
    summary = challengerSummary;
  }
  const visibleSummary = ensureCompleteVisibleSummary(summary);
  const visibleMetadata = summary === challengerSummary ? challenger : summarizeThinkingTextChallenger(visibleSummary, fallback);
  return {
    summary: visibleSummary,
    baselineSummary,
    challengerSummary,
    events: visibleMetadata.events,
    collapsedPriority: visibleMetadata.collapsedPriority,
    hasExplicitFailure: visibleMetadata.hasExplicitFailure,
    hasExplicitSuccess: visibleMetadata.hasExplicitSuccess
  };
}
function inferThinkingRole(text) {
  const haystack = ` ${normalizeNewlines(text).toLowerCase()} `;
  const referenceOnlyFailureCue = FAILURE_REFERENCE_CONTEXT_RE.test(haystack) && !EXPLICIT_FAILURE_RESULT_RE.test(haystack) && !EXPLICIT_ERROR_RESULT_RE.test(haystack);
  const referenceOnlyIssueCue = /\b(?:issue|issues|problem|problems|warning|warnings)\s+(?:handling|rendering|renderer|case|cases|path|paths|state|states|logic|message|messages|copy|text|wording|semantics|classification|detection|cue|cues|recovery|fallback|branch|branches|surface|mode|modes|statement|matching|reproduction|steps?)\b/.test(haystack);
  const scoredRoles = [
    {
      role: "error",
      score: Number(!referenceOnlyFailureCue && !referenceOnlyIssueCue && /\b(error|errors|fail|failed|failure|blocked|locked|cannot|unable|exception|bug|issue|problem|warning|debug|stack trace|traceback)\b/.test(haystack)) * 4 + Number(/\bfix\b/.test(haystack)) * 2
    },
    {
      role: "compare",
      score: Number(/\b(compare|comparison|versus|\bvs\b|trade-?off|alternative|option|weigh|choose between)\b/.test(haystack)) * 4
    },
    {
      role: "search",
      score: Number(/\b(search|grep|find|locate|lookup|browse|discover)\b/.test(haystack)) * 3 + Number(/\b(list|describe)\b(?=.*\btools?\b)/.test(haystack)) * 2
    },
    {
      role: "inspect",
      score: Number(/\b(inspect|examine|read|open|scan|review|trace|look at|understand|orient|connection)\b/.test(haystack)) * 3 + Number(/\bconnect\b/.test(haystack)) * 2
    },
    {
      role: "plan",
      score: Number(/\b(plan|planning|approach|strategy|outline|decide|figure out|map out|organize|break down)\b/.test(haystack)) * 3
    },
    {
      role: "write",
      score: Number(/\b(write|implement|patch|update|refactor|create|add|remove|rename|modify)\b/.test(haystack)) * 3 + Number(/\bedit\b/.test(haystack)) * 2
    },
    {
      role: "verify",
      score: Number(/\b(verify|verification|validate|validation|recheck|prove)\b/.test(haystack)) * 4 + Number(/\b(test|confirm)\b/.test(haystack)) * 2 + Number(/\b(check|ensure)\b/.test(haystack)) * 1
    }
  ];
  const bestRole = scoredRoles.sort((a, b) => b.score - a.score).find((entry) => entry.score > 0);
  return bestRole?.role ?? "default";
}
function iconForThinkingRole(role) {
  switch (role) {
    case "inspect":
      return "◫";
    case "plan":
      return "◇";
    case "compare":
      return "↔";
    case "verify":
      return "✓";
    case "write":
      return "✎";
    case "search":
      return "⌕";
    case "error":
      return "!";
    default:
      return "·";
  }
}
function deriveThinkingSteps(blocks) {
  const steps = [];
  blocks.forEach((block, blockIndex) => {
    if (block.redacted && !block.text.trim()) {
      const summary = "Reasoning is hidden by the provider.";
      steps.push({
        id: `${block.contentIndex}-0`,
        contentIndex: block.contentIndex,
        blockIndex,
        stepIndex: 0,
        summary,
        body: summary,
        role: "default",
        icon: iconForThinkingRole("default"),
        baselineSummary: summary,
        challengerSummary: summary,
        summaryEvents: [],
        collapsedPriority: 0,
        hasExplicitFailure: false,
        hasExplicitSuccess: false
      });
      return;
    }
    const stepTexts = splitThinkingIntoStepTexts(block.text);
    stepTexts.forEach((stepText, stepIndex) => {
      const summaryDetails = summarizeThinkingTextDetailed(stepText);
      const role = inferThinkingRole(`${summaryDetails.summary}
${stepText}`);
      steps.push({
        id: `${block.contentIndex}-${stepIndex}`,
        contentIndex: block.contentIndex,
        blockIndex,
        stepIndex,
        summary: summaryDetails.summary,
        body: stepText.trim(),
        role,
        icon: iconForThinkingRole(role),
        baselineSummary: summaryDetails.baselineSummary,
        challengerSummary: summaryDetails.challengerSummary,
        summaryEvents: summaryDetails.events,
        collapsedPriority: summaryDetails.collapsedPriority,
        hasExplicitFailure: summaryDetails.hasExplicitFailure,
        hasExplicitSuccess: summaryDetails.hasExplicitSuccess
      });
    });
  });
  return steps;
}

// extensions/shared/visual.ts
import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
var ROLE_GLYPHS = {
  inspect: "◫",
  search: "⌕",
  compare: "↔",
  write: "✎",
  run: "▸",
  network: "↗",
  plan: "◇",
  ask: "?",
  verify: "✓",
  default: "·"
};
var ROLE_COLORS = {
  inspect: "mdLink",
  search: "accent",
  compare: "warning",
  write: "success",
  run: "warning",
  network: "mdCode",
  plan: "accent",
  ask: "accent",
  verify: "success",
  default: "muted"
};
function treeConnector(isLast) {
  return isLast ? "└ " : "├ ";
}
function resolveMarker(input) {
  if (input.status === "error")
    return { glyph: "!", color: "error" };
  if (input.status === "running" || input.status === "pending")
    return { glyph: "◐", color: "warning" };
  return {
    glyph: ROLE_GLYPHS[input.role] ?? ROLE_GLYPHS.default,
    color: ROLE_COLORS[input.role] ?? ROLE_COLORS.default
  };
}
var MAX_CONTINUATION_LINES = 3;
var CONTINUATION_PREFIX_LAST = "  │ ";
var CONTINUATION_PREFIX_MID = "│ │ ";
function splitToWidth(text, width) {
  const maxWidth = Math.max(1, width);
  let used = 0;
  let index = 0;
  let lastBreakIndex = 0;
  for (const char of text) {
    const charWidth = visibleWidth(char);
    if (used + charWidth > maxWidth)
      break;
    used += charWidth;
    index += char.length;
    if (/\s/.test(char))
      lastBreakIndex = index;
  }
  const breakWidth = lastBreakIndex > 0 ? visibleWidth(text.slice(0, lastBreakIndex).trimEnd()) : 0;
  const splitIndex = index < text.length && breakWidth >= maxWidth * 0.55 ? lastBreakIndex : index;
  return { head: text.slice(0, splitIndex).trimEnd(), tail: text.slice(splitIndex).trimStart() };
}
function renderTreeRow(options) {
  const { theme, width, isLast, role, status, headline, meta, activeAccent } = options;
  const marker = resolveMarker({ role, status });
  const connector = treeConnector(isLast);
  const connectorColor = activeAccent ? "accent" : "muted";
  const textColor = status === "error" ? "error" : "muted";
  const connectorPainted = theme.fg(connectorColor, connector);
  const glyphPainted = theme.fg(marker.color, marker.glyph);
  const prefix = `${connectorPainted}${glyphPainted} `;
  const prefixWidth = visibleWidth(connector) + visibleWidth(marker.glyph) + 1;
  const firstWidth = Math.max(1, width - prefixWidth);
  const continuationRaw = isLast ? CONTINUATION_PREFIX_LAST : CONTINUATION_PREFIX_MID;
  const continuationPrefixPainted = theme.fg(connectorColor, continuationRaw);
  const continuationWidth = Math.max(1, width - visibleWidth(continuationRaw));
  const metaSuffix = meta ? `  · ${meta}` : "";
  const fullText = `${headline}${metaSuffix}`;
  if (visibleWidth(fullText) <= firstWidth) {
    const headlinePainted = theme.fg(textColor, headline);
    const metaPainted = meta ? theme.fg(textColor, `· ${meta}`) : "";
    const composed = meta ? `${prefix}${headlinePainted}  ${metaPainted}` : `${prefix}${headlinePainted}`;
    return [truncateToWidth(composed, width, "")];
  }
  const lines = [];
  const firstSplit = splitToWidth(fullText, firstWidth);
  lines.push(`${prefix}${theme.fg(textColor, firstSplit.head)}`);
  let rest = firstSplit.tail;
  for (let i = 0;rest && i < MAX_CONTINUATION_LINES; i += 1) {
    const part = splitToWidth(rest, continuationWidth);
    const suffix = part.tail && i === MAX_CONTINUATION_LINES - 1 ? "…" : "";
    lines.push(`${continuationPrefixPainted}${theme.fg(textColor, `${part.head}${suffix}`)}`);
    rest = suffix ? "" : part.tail;
  }
  return lines.map((line) => truncateToWidth(line, Math.max(1, width), ""));
}

// extensions/thinking-steps/render.ts
var MAX_SUMMARY_STEPS = 5;
function thinkingRoleAsVisual(role) {
  switch (role) {
    case "inspect":
    case "search":
    case "compare":
    case "write":
    case "plan":
    case "verify":
      return role;
    case "error":
      return "default";
    default:
      return "default";
  }
}
function roleGlyph(role) {
  if (role === "error")
    return "!";
  return ROLE_GLYPHS[thinkingRoleAsVisual(role)] ?? ROLE_GLYPHS.default;
}
function roleColor(role) {
  if (role === "error")
    return "error";
  return ROLE_COLORS[thinkingRoleAsVisual(role)] ?? ROLE_COLORS.default;
}
function pulseGlyph(theme, nowMs) {
  const frames = [
    theme.fg("dim", "·"),
    theme.fg("muted", "•"),
    theme.fg("accent", "•"),
    theme.fg("muted", "•")
  ];
  const frame = Math.floor(nowMs / 180) % frames.length;
  return frames[frame] ?? frames[0];
}
function sanitizeThinkingText(text) {
  return text.replace(/\r\n?/g, `
`).replace(/[\]PX^_][\s\S]*?(?:|\\|)/g, "").replace(/[][\s\S]*?(?:|\\|)/g, "").replace(/(?:\[[0-?]*[ -/]*[@-~]|[ -/]*[0-9@-~])/g, "").replace(/[0-?]*[ -/]*[@-~]/g, "").replace(/[\x00-\x08\x0B-\x1F\x7F-\x9F]/g, "");
}
function parseInlineSegments(text) {
  const sanitized = sanitizeThinkingText(text);
  const segments = [];
  const markerRe = /(\*\*|__)(?=\S)([\s\S]*?\S)\1|`([^`]+)`|(?<![\w/.-])\*(?!\*)(?=\S)([\s\S]*?\S)(?<!\*)\*(?![\w/.-])|(?<![\w/.-])_(?!_)(?=\S)([\s\S]*?\S)(?<!_)_(?![\w/.-])/g;
  let lastIndex = 0;
  for (const match of sanitized.matchAll(markerRe)) {
    const start = match.index ?? 0;
    if (start > lastIndex)
      segments.push({ text: sanitized.slice(lastIndex, start), style: "plain" });
    if (match[2])
      segments.push({ text: match[2], style: "bold" });
    if (match[3])
      segments.push({ text: match[3], style: "code" });
    if (match[4])
      segments.push({ text: match[4], style: "plain" });
    if (match[5])
      segments.push({ text: match[5], style: "plain" });
    lastIndex = start + match[0].length;
  }
  if (lastIndex < sanitized.length)
    segments.push({ text: sanitized.slice(lastIndex), style: "plain" });
  return segments;
}
function renderInlineSegment(theme, segment, textColor) {
  if (segment.style === "bold")
    return theme.bold(theme.fg(textColor, segment.text));
  if (segment.style === "code")
    return theme.bold(theme.fg("mdCode", segment.text));
  return theme.fg(textColor, segment.text);
}
function renderInline(theme, text, textColor) {
  const sanitized = sanitizeThinkingText(text);
  const segments = parseInlineSegments(sanitized);
  if (segments.length === 0)
    return theme.fg(textColor, sanitized);
  return segments.map((segment) => renderInlineSegment(theme, segment, textColor)).join("");
}
function renderThinkingInlineMarkup(theme, text) {
  return renderInline(theme, text, "thinkingText");
}
function renderThinkingDisplayLine(theme, text) {
  const headingMatch = text.match(/^(\s{0,3})#{1,6}\s+(.+)$/);
  if (headingMatch) {
    const indent = headingMatch[1] ?? "";
    const content = headingMatch[2] ?? "";
    return `${indent}${theme.bold(theme.fg("accent", renderThinkingInlineMarkup(theme, content)))}`;
  }
  const listMatch = text.match(/^(\s*)([-*+]|\d+[.)]|[a-z][.)])\s+(.+)$/i);
  if (listMatch) {
    const indent = listMatch[1] ?? "";
    const marker = listMatch[2] ?? "";
    const content = listMatch[3] ?? "";
    const renderedMarker = /^[-*+]$/.test(marker) ? "•" : marker;
    return `${indent}${theme.fg("muted", renderedMarker)} ${renderThinkingInlineMarkup(theme, content)}`;
  }
  return renderThinkingInlineMarkup(theme, text);
}
function renderWrappedRawText(theme, text, width, prefix) {
  const innerWidth = Math.max(8, width - visibleWidth2(prefix));
  const sanitizedText = sanitizeThinkingText(text);
  const rawLines = sanitizedText.replace(/\t/g, "    ").split(`
`);
  const rendered = [];
  for (const rawLine of rawLines) {
    if (rawLine.trim().length === 0) {
      rendered.push(truncateToWidth2(prefix, width, ""));
      continue;
    }
    const styled = renderThinkingDisplayLine(theme, rawLine);
    const wrapped = wrapTextWithAnsi(styled, innerWidth);
    for (const line of wrapped) {
      rendered.push(truncateToWidth2(`${prefix}${line}`, width, ""));
    }
  }
  return rendered;
}
function stepStyle(step, active) {
  if (active) {
    return { summaryColor: "accent", bold: true };
  }
  if (step.hasExplicitFailure) {
    return { summaryColor: "error", bold: false };
  }
  if (step.role === "verify" && step.hasExplicitSuccess) {
    return { summaryColor: "success", bold: false };
  }
  return { summaryColor: roleColor(step.role), bold: false };
}
function wrapStepHeader(theme, width, step, active, isLast) {
  const style = stepStyle(step, active);
  const connectorColor = active ? "accent" : "muted";
  const treePrefix = treeConnector(isLast);
  const icon = theme.fg(roleColor(step.role), roleGlyph(step.role));
  const prefix = `${theme.fg(connectorColor, treePrefix)}${icon} `;
  const continuationPrefix = " ".repeat(visibleWidth2(`${treePrefix}${roleGlyph(step.role)} `));
  const summaryText = renderInline(theme, step.summary, style.summaryColor);
  const finalSummary = style.bold ? theme.bold(summaryText) : summaryText;
  const innerWidth = Math.max(8, width - visibleWidth2(prefix));
  const wrappedSummary = wrapTextWithAnsi(finalSummary, innerWidth);
  if (wrappedSummary.length === 0) {
    return [truncateToWidth2(prefix, width, "")];
  }
  return wrappedSummary.map((line, index) => truncateToWidth2(`${index === 0 ? prefix : continuationPrefix}${line}`, width, ""));
}
function wrapCollapsedSummaryText(theme, text, firstWidth, continuationWidth) {
  const words = parseInlineSegments(text).flatMap((segment) => segment.text.split(/\s+/).filter(Boolean).map((word) => {
    if (segment.style === "bold")
      return theme.bold(theme.fg("thinkingText", word));
    if (segment.style === "code")
      return theme.bold(theme.fg("mdCode", word));
    return theme.fg("thinkingText", word);
  }));
  if (words.length === 0)
    return [];
  const lines = [];
  let current = "";
  let currentWidth = Math.max(8, firstWidth);
  const continuationLineWidth = () => Math.max(8, continuationWidth);
  for (const word of words) {
    let pending = word;
    while (pending.length > 0) {
      const candidate = current ? `${current} ${pending}` : pending;
      if (visibleWidth2(candidate) <= currentWidth) {
        current = candidate;
        pending = "";
        continue;
      }
      if (current) {
        lines.push(current);
        current = "";
        currentWidth = continuationLineWidth();
        continue;
      }
      const wrappedWord = wrapTextWithAnsi(pending, currentWidth);
      if (wrappedWord.length === 0) {
        pending = "";
        continue;
      }
      if (wrappedWord.length === 1) {
        current = wrappedWord[0] ?? "";
        pending = "";
        continue;
      }
      lines.push(...wrappedWord.slice(0, -1));
      pending = wrappedWord[wrappedWord.length - 1] ?? "";
      currentWidth = continuationLineWidth();
    }
  }
  if (current)
    lines.push(current);
  return lines;
}
function renderCollapsed(theme, width, steps, activeStepId, isActive, nowMs) {
  const step = pickCollapsedStep(steps, activeStepId);
  if (!step)
    return [];
  const label = "Thinking";
  const icon = theme.fg(roleColor(step.role), step.icon);
  const activity = isActive ? pulseGlyph(theme, nowMs) : theme.fg("dim", "·");
  const activitySuffix = ` ${activity}`;
  const activityWidth = visibleWidth2(activitySuffix);
  const prefix = `${theme.fg("muted", "│")} ${theme.fg("dim", label)} ${icon} `;
  const continuationPrefix = `${theme.fg("muted", "│")} ${" ".repeat(visibleWidth2(`${label} ${step.icon} `))}`;
  const summaryLines = wrapCollapsedSummaryText(theme, step.summary, Math.max(1, width - visibleWidth2(prefix) - activityWidth), Math.max(1, width - visibleWidth2(continuationPrefix) - activityWidth));
  if (summaryLines.length <= 1) {
    return [truncateToWidth2(`${prefix}${summaryLines[0] ?? renderThinkingInlineMarkup(theme, step.summary)}${activitySuffix}`, width, "")];
  }
  return summaryLines.map((line, index) => {
    if (index === 0)
      return truncateToWidth2(`${prefix}${line}`, width, "");
    if (index === summaryLines.length - 1)
      return truncateToWidth2(`${continuationPrefix}${line}${activitySuffix}`, width, "");
    return truncateToWidth2(`${continuationPrefix}${line}`, width, "");
  });
}
function pickCollapsedStep(steps, activeStepId) {
  if (steps.length === 0)
    return;
  if (activeStepId) {
    const active = steps.find((step) => step.id === activeStepId);
    if (active)
      return active;
  }
  let latestFailureIndex = -1;
  let latestSuccessAfterFailureIndex = -1;
  for (let i = 0;i < steps.length; i += 1) {
    const step = steps[i];
    if (step.hasExplicitFailure) {
      latestFailureIndex = i;
      latestSuccessAfterFailureIndex = -1;
    }
    if (latestFailureIndex !== -1 && step.hasExplicitSuccess && i > latestFailureIndex) {
      latestSuccessAfterFailureIndex = i;
    }
  }
  if (latestSuccessAfterFailureIndex !== -1)
    return steps[latestSuccessAfterFailureIndex];
  if (latestFailureIndex !== -1)
    return steps[latestFailureIndex];
  return [...steps].sort((left, right) => (right.collapsedPriority ?? 0) - (left.collapsedPriority ?? 0) || right.blockIndex - left.blockIndex || right.stepIndex - left.stepIndex)[0];
}
function selectSummarySteps(steps, _activeStepId) {
  if (steps.length <= MAX_SUMMARY_STEPS)
    return steps;
  return steps.slice(-MAX_SUMMARY_STEPS);
}
function renderGroupHeader(theme, width, totalSteps, isActive) {
  const titleRole = isActive ? "warning" : "dim";
  const title = theme.fg(titleRole, "Thinking Steps");
  if (totalSteps <= 1)
    return truncateToWidth2(title, width, "");
  const count = theme.fg("muted", `  · ${totalSteps} thoughts`);
  return truncateToWidth2(`${title}${count}`, width, "");
}
function renderSummary(theme, width, steps, activeStepId, isActive) {
  const lines = [renderGroupHeader(theme, width, steps.length, isActive)];
  const visible = selectSummarySteps(steps, activeStepId);
  for (let index = 0;index < visible.length; index++) {
    const step = visible[index];
    const isLast = index === visible.length - 1;
    lines.push(...wrapStepHeader(theme, width, step, step.id === activeStepId, isLast));
  }
  return lines;
}
function renderExpanded(theme, width, steps, activeStepId, isActive) {
  const lines = [renderGroupHeader(theme, width, steps.length, isActive)];
  for (let index = 0;index < steps.length; index++) {
    const step = steps[index];
    const isLast = index === steps.length - 1;
    const isStepActive = step.id === activeStepId;
    lines.push(...wrapStepHeader(theme, width, step, isStepActive, isLast));
    const normalizedBody = step.body.trim();
    if (!normalizedBody)
      continue;
    const bodyPrefix = isLast ? "   " : `${theme.fg("muted", "│")}  `;
    lines.push(...renderWrappedRawText(theme, normalizedBody, width, bodyPrefix));
  }
  return lines;
}
function renderThinkingStepsLines(theme, width, options) {
  if (options.steps.length === 0)
    return [];
  if (options.mode === "collapsed") {
    return renderCollapsed(theme, width, options.steps, options.activeStepId, options.isActive, options.nowMs ?? Date.now());
  }
  if (options.mode === "expanded") {
    return renderExpanded(theme, width, options.steps, options.activeStepId, options.isActive);
  }
  return renderSummary(theme, width, options.steps, options.activeStepId, options.isActive);
}
var MERGE_REGISTRY_KEY = Symbol.for("capy-tools.thinking-steps.merge-registry");
function getMergeRegistry() {
  const existing = globalThis[MERGE_REGISTRY_KEY];
  if (existing instanceof Map)
    return existing;
  const created = new Map;
  globalThis[MERGE_REGISTRY_KEY] = created;
  return created;
}
function mergeRegistryKey(scopeKey, messageTimestamp) {
  return `${scopeKey}::${messageTimestamp}`;
}
function clearThinkingMergeRegistry(scopeKey, messageTimestamp) {
  const registry = getMergeRegistry();
  if (scopeKey === undefined && messageTimestamp === undefined) {
    registry.clear();
    return;
  }
  if (scopeKey !== undefined && messageTimestamp !== undefined) {
    registry.delete(mergeRegistryKey(scopeKey, messageTimestamp));
    return;
  }
  if (scopeKey !== undefined) {
    for (const key of [...registry.keys()]) {
      if (key.startsWith(`${scopeKey}::`))
        registry.delete(key);
    }
  }
}

class ThinkingStepsComponent {
  theme;
  messageTimestamp;
  steps;
  cacheKey;
  cachedLines;
  scopeKey;
  sourceBlocks;
  isShadow = false;
  constructor(theme, messageTimestamp, blocks, scopeKey) {
    this.theme = theme;
    this.messageTimestamp = messageTimestamp;
    this.sourceBlocks = [...blocks];
    this.scopeKey = scopeKey ?? getCurrentThinkingScopeKey();
    this.steps = deriveThinkingSteps(this.sourceBlocks);
    const registry = getMergeRegistry();
    const key = mergeRegistryKey(this.scopeKey, this.messageTimestamp);
    const existing = registry.get(key);
    if (existing) {
      existing.primary.appendBlocks(this.sourceBlocks);
      this.isShadow = true;
    } else {
      registry.set(key, { primary: this, blocks: this.sourceBlocks });
    }
  }
  appendBlocks(extra) {
    let added = false;
    for (const block of extra) {
      if (this.sourceBlocks.some((existing) => existing.contentIndex === block.contentIndex))
        continue;
      this.sourceBlocks.push(block);
      added = true;
    }
    if (added) {
      this.steps = deriveThinkingSteps(this.sourceBlocks);
      this.invalidate();
    }
  }
  render(width) {
    if (this.isShadow)
      return [];
    const mode = getThinkingStepsMode(this.scopeKey);
    const active = getActiveThinkingState(this.messageTimestamp, this.scopeKey);
    const activeStepId = active.active && active.contentIndex !== undefined ? [...this.steps].reverse().find((step) => step.contentIndex === active.contentIndex)?.id : undefined;
    const shouldBypassCache = mode === "collapsed" && active.active;
    const nextCacheKey = `${width}:${mode}:${active.active ? 1 : 0}:${activeStepId ?? ""}:${this.sourceBlocks.length}`;
    if (!shouldBypassCache && this.cachedLines && this.cacheKey === nextCacheKey) {
      return this.cachedLines;
    }
    const lines = renderThinkingStepsLines(this.theme, width, {
      mode,
      steps: this.steps,
      activeStepId,
      isActive: active.active,
      nowMs: Date.now()
    });
    if (!shouldBypassCache) {
      this.cacheKey = nextCacheKey;
      this.cachedLines = lines;
    } else {
      this.cacheKey = undefined;
      this.cachedLines = undefined;
    }
    return lines;
  }
  invalidate() {
    this.cacheKey = undefined;
    this.cachedLines = undefined;
  }
}

// extensions/thinking-steps/internal-patch.ts
var PI_CODING_AGENT_INTERNAL_MODULES = {
  assistantMessageComponent: "dist/modes/interactive/components/assistant-message.js",
  theme: "dist/modes/interactive/theme/theme.js"
};
function assertPatchableAssistantMessageComponent(value) {
  if (!value || typeof value !== "function" && typeof value !== "object") {
    throw new Error("Thinking Steps patch failed: AssistantMessageComponent export is missing or invalid.");
  }
  const prototype = value.prototype;
  if (!prototype || typeof prototype !== "object") {
    throw new Error("Thinking Steps patch failed: AssistantMessageComponent.prototype is missing.");
  }
  const candidate = prototype;
  const missingMethods = ["updateContent", "setHideThinkingBlock", "setHiddenThinkingLabel"].filter((name) => typeof candidate[name] !== "function");
  if (missingMethods.length > 0) {
    throw new Error(`Thinking Steps patch failed: AssistantMessageComponent prototype is incompatible (missing ${missingMethods.join(", ")}).`);
  }
  return value;
}
function assertThinkingStepsTheme(value) {
  if (!value || typeof value !== "object") {
    throw new Error("Thinking Steps patch failed: interactive theme export is missing or invalid.");
  }
  try {
    const candidate = value;
    if (typeof candidate.fg !== "function" || typeof candidate.bold !== "function") {
      throw new Error("Thinking Steps patch failed: interactive theme export is incompatible.");
    }
  } catch (error) {
    if (error instanceof Error && /Theme not initialized/.test(error.message)) {
      return value;
    }
    throw error;
  }
  return value;
}
function hasPatchableContentContainer(value) {
  return Boolean(value.contentContainer && typeof value.contentContainer.clear === "function" && typeof value.contentContainer.addChild === "function");
}
function getPackageRoot(packageName) {
  let entryUrl;
  try {
    entryUrl = import.meta.resolve(packageName);
  } catch (error) {
    throw new Error(`Thinking Steps patch failed: could not resolve ${packageName} package root. Pi internals may be unavailable or moved.`, {
      cause: error
    });
  }
  try {
    const entryPath = fileURLToPath(entryUrl);
    return dirname(dirname(entryPath));
  } catch (error) {
    throw new Error(`Thinking Steps patch failed: could not derive ${packageName} package root from ${entryUrl}.`, {
      cause: error
    });
  }
}
function resolvePiCodingAgentInternalModuleUrl(relativePath) {
  const packageRoot = getPackageRoot("@earendil-works/pi-coding-agent");
  return pathToFileURL(join(packageRoot, relativePath)).href;
}
async function importPiCodingAgentInternal(relativePath) {
  const moduleUrl = resolvePiCodingAgentInternalModuleUrl(relativePath);
  try {
    return await import(moduleUrl);
  } catch (error) {
    throw new Error(`Thinking Steps patch failed: could not import internal module "@earendil-works/pi-coding-agent/${relativePath}". Pi internals may have moved.`, {
      cause: error
    });
  }
}
function hasVisibleThinking(content) {
  return content.redacted === true || content.thinking.trim().length > 0;
}
function collectThinkingBlocks(message) {
  const blocks = [];
  message.content.forEach((content, index) => {
    if (content.type !== "thinking")
      return;
    if (!hasVisibleThinking(content))
      return;
    blocks.push({
      contentIndex: index,
      text: content.thinking,
      redacted: content.redacted
    });
  });
  return blocks;
}
function hasVisibleTextContent(message) {
  return message.content.some((content) => content.type === "text" && content.text.trim().length > 0);
}
async function installPatch() {
  const [{ AssistantMessageComponent: rawAssistantMessageComponent }, { theme: rawTheme }] = await Promise.all([
    importPiCodingAgentInternal(PI_CODING_AGENT_INTERNAL_MODULES.assistantMessageComponent),
    importPiCodingAgentInternal(PI_CODING_AGENT_INTERNAL_MODULES.theme)
  ]);
  const AssistantMessageComponent = assertPatchableAssistantMessageComponent(rawAssistantMessageComponent);
  const theme = assertThinkingStepsTheme(rawTheme);
  const prototype = AssistantMessageComponent.prototype;
  const originalUpdateContent = prototype.updateContent;
  const originalSetHideThinkingBlock = prototype.setHideThinkingBlock;
  const originalSetHiddenThinkingLabel = prototype.setHiddenThinkingLabel;
  const normalizeHiddenThinkingLabel = (label) => label.replace(/\u2060+$/gu, "");
  const restoreOriginalMethods = () => {
    if (prototype.updateContent !== originalUpdateContent) {
      prototype.updateContent = originalUpdateContent;
    }
    if (prototype.setHideThinkingBlock !== originalSetHideThinkingBlock) {
      prototype.setHideThinkingBlock = originalSetHideThinkingBlock;
    }
    if (prototype.setHiddenThinkingLabel !== originalSetHiddenThinkingLabel) {
      prototype.setHiddenThinkingLabel = originalSetHiddenThinkingLabel;
    }
  };
  const withOriginalInstanceMethods = (instance, callback) => {
    const ownUpdateContent = Object.prototype.hasOwnProperty.call(instance, "updateContent");
    const ownSetHideThinkingBlock = Object.prototype.hasOwnProperty.call(instance, "setHideThinkingBlock");
    const ownSetHiddenThinkingLabel = Object.prototype.hasOwnProperty.call(instance, "setHiddenThinkingLabel");
    const previousUpdateContent = instance.updateContent;
    const previousSetHideThinkingBlock = instance.setHideThinkingBlock;
    const previousSetHiddenThinkingLabel = instance.setHiddenThinkingLabel;
    instance.updateContent = originalUpdateContent;
    instance.setHideThinkingBlock = originalSetHideThinkingBlock;
    instance.setHiddenThinkingLabel = originalSetHiddenThinkingLabel;
    try {
      return callback();
    } finally {
      if (ownUpdateContent) {
        instance.updateContent = previousUpdateContent;
      } else {
        delete instance.updateContent;
      }
      if (ownSetHideThinkingBlock) {
        instance.setHideThinkingBlock = previousSetHideThinkingBlock;
      } else {
        delete instance.setHideThinkingBlock;
      }
      if (ownSetHiddenThinkingLabel) {
        instance.setHiddenThinkingLabel = previousSetHiddenThinkingLabel;
      } else {
        delete instance.setHiddenThinkingLabel;
      }
    }
  };
  const reportFallback = (stage, error) => {
    console.warn(`Thinking Steps patch warning: falling back to Pi renderer during ${stage}.`, error);
  };
  const fallbackErrorMessage = "Thinking Steps patch failed: Pi internals are incompatible and fallback rendering also failed.";
  const fallbackToOriginalUpdateContent = (instance, message, stage, originalError) => {
    try {
      withOriginalInstanceMethods(instance, () => {
        originalUpdateContent.call(instance, message);
      });
    } catch (fallbackError) {
      throw new Error(fallbackErrorMessage, {
        cause: originalError ? { patchError: originalError, fallbackError } : fallbackError
      });
    }
    if (originalError) {
      reportFallback(stage, originalError);
    }
  };
  const fallbackToOriginalSetHideThinkingBlock = (instance, hide, originalError) => {
    try {
      withOriginalInstanceMethods(instance, () => {
        originalSetHideThinkingBlock.call(instance, hide);
      });
    } catch (fallbackError) {
      throw new Error(fallbackErrorMessage, {
        cause: originalError ? { patchError: originalError, fallbackError } : fallbackError
      });
    }
    if (originalError) {
      reportFallback("setHideThinkingBlock", originalError);
    }
  };
  const fallbackToOriginalSetHiddenThinkingLabel = (instance, label, originalError) => {
    const normalizedLabel = normalizeHiddenThinkingLabel(label);
    try {
      withOriginalInstanceMethods(instance, () => {
        originalSetHiddenThinkingLabel.call(instance, normalizedLabel);
      });
    } catch (fallbackError) {
      throw new Error(fallbackErrorMessage, {
        cause: originalError ? { patchError: originalError, fallbackError } : fallbackError
      });
    }
    if (originalError) {
      reportFallback("setHiddenThinkingLabel", originalError);
    }
  };
  const patchedUpdateContent = function patchedUpdateContent2(message) {
    this.lastMessage = message;
    if (!hasPatchableContentContainer(this)) {
      fallbackToOriginalUpdateContent(this, message, "updateContent");
      return;
    }
    try {
      this.contentContainer.clear();
      const hasToolCalls = message.content.some((content) => content.type === "toolCall");
      this.hasToolCalls = hasToolCalls;
      const thinkingBlocks = collectThinkingBlocks(message);
      if (hasVisibleTextContent(message) && !hasToolCalls) {
        this.contentContainer.addChild(new Spacer(1));
      }
      let renderedThinking = false;
      const hasVisibleTextAfterThinking = (() => {
        const firstThinkingIndex = thinkingBlocks[0]?.contentIndex;
        if (firstThinkingIndex === undefined)
          return false;
        return message.content.slice(firstThinkingIndex + 1).some((content) => content.type === "text" && content.text.trim().length > 0);
      })();
      for (const content of message.content) {
        if (content.type === "text" && content.text.trim()) {
          this.contentContainer.addChild(new Markdown(content.text.trim(), 1, 0, this.markdownTheme));
          continue;
        }
        if (content.type === "thinking" && thinkingBlocks.length > 0 && !renderedThinking) {
          this.contentContainer.addChild(new ThinkingStepsComponent(theme, message.timestamp, thinkingBlocks, resolveThinkingMessageScope(message)));
          renderedThinking = true;
          if (hasVisibleTextAfterThinking) {
            this.contentContainer.addChild(new Spacer(1));
          }
        }
      }
      if (!hasToolCalls) {
        if (message.stopReason === "aborted") {
          const abortMessage = message.errorMessage && message.errorMessage !== "Request was aborted" ? message.errorMessage : "Operation aborted";
          this.contentContainer.addChild(new Spacer(1));
          this.contentContainer.addChild(new Text(theme.fg("error", abortMessage), 1, 0));
        } else if (message.stopReason === "error") {
          const errorMessage = message.errorMessage || "Unknown error";
          this.contentContainer.addChild(new Spacer(1));
          this.contentContainer.addChild(new Text(theme.fg("error", `Error: ${errorMessage}`), 1, 0));
        }
      }
    } catch (error) {
      fallbackToOriginalUpdateContent(this, message, "updateContent", error);
    }
  };
  const patchedSetHideThinkingBlock = function patchedSetHideThinkingBlock2(hide) {
    if (!hasPatchableContentContainer(this)) {
      fallbackToOriginalSetHideThinkingBlock(this, hide);
      return;
    }
    this.hideThinkingBlock = false;
    if (!this.lastMessage)
      return;
    try {
      this.updateContent(this.lastMessage);
    } catch (error) {
      fallbackToOriginalSetHideThinkingBlock(this, hide, error);
    }
  };
  const patchedSetHiddenThinkingLabel = function patchedSetHiddenThinkingLabel2(label) {
    const normalizedLabel = normalizeHiddenThinkingLabel(label);
    if (!hasPatchableContentContainer(this)) {
      fallbackToOriginalSetHiddenThinkingLabel(this, normalizedLabel);
      return;
    }
    this.hiddenThinkingLabel = normalizedLabel;
    if (!this.lastMessage)
      return;
    try {
      this.updateContent(this.lastMessage);
    } catch (error) {
      fallbackToOriginalSetHiddenThinkingLabel(this, normalizedLabel, error);
    }
  };
  try {
    prototype.updateContent = patchedUpdateContent;
    prototype.setHideThinkingBlock = patchedSetHideThinkingBlock;
    prototype.setHiddenThinkingLabel = patchedSetHiddenThinkingLabel;
  } catch (error) {
    try {
      restoreOriginalMethods();
    } catch (rollbackError) {
      throw new Error("Thinking Steps patch failed: AssistantMessageComponent prototype patching failed and rollback was incomplete.", {
        cause: { installError: error, rollbackError }
      });
    }
    throw new Error("Thinking Steps patch failed: AssistantMessageComponent prototype is incompatible with thinking-steps patching.", { cause: error });
  }
  return () => {
    restoreOriginalMethods();
  };
}
async function retainThinkingStepsPatch() {
  incrementPatchRefCount();
  let cleanup = getPatchCleanup();
  if (!cleanup) {
    const existingInstallPromise = getPatchInstallPromise();
    const installPromise = existingInstallPromise ?? installPatch();
    if (!existingInstallPromise) {
      setPatchInstallPromise(installPromise);
    }
    try {
      cleanup = await installPromise;
      if (!getPatchCleanup()) {
        setPatchCleanup(cleanup);
      }
    } catch (error) {
      decrementPatchRefCount();
      throw error;
    } finally {
      if (getPatchInstallPromise() === installPromise) {
        setPatchInstallPromise(undefined);
      }
    }
  }
  let released = false;
  return async () => {
    if (released)
      return;
    const refCount = decrementPatchRefCount();
    if (refCount > 0) {
      released = true;
      return;
    }
    const currentCleanup = getPatchCleanup();
    if (!currentCleanup) {
      released = true;
      return;
    }
    if (getPatchCleanup() === currentCleanup) {
      setPatchCleanup(undefined);
    }
    try {
      await currentCleanup();
      released = true;
    } catch (error) {
      incrementPatchRefCount();
      if (!getPatchCleanup()) {
        setPatchCleanup(currentCleanup);
      }
      throw error;
    }
  };
}

// extensions/thinking-steps/index.ts
var RENDER_MODE = "summary";
function reportPatchError(ctx, error) {
  const message = error instanceof Error ? error.message : String(error);
  console.warn(`Capy Tools thinking-steps: patch unavailable, falling back to Pi's native renderer (${message})`);
}
function thinkingStepsExtension(pi) {
  let sessionScopeKey = getCurrentThinkingScopeKey();
  const setSessionScopeKey = (scopeKey) => {
    sessionScopeKey = scopeKey;
    setCurrentThinkingScopeKey(scopeKey);
    return sessionScopeKey;
  };
  pi.on("session_start", async (_event, ctx) => {
    const activeScopeKey = setSessionScopeKey(ctx.cwd);
    clearActiveThinkingState(undefined, activeScopeKey);
    try {
      registerThinkingPatchRelease(activeScopeKey, await retainThinkingStepsPatch());
    } catch (error) {
      reportPatchError(ctx, error);
      return;
    }
    setThinkingStepsMode(RENDER_MODE, activeScopeKey);
  });
  pi.on("message_start", async (event) => {
    if (event.message.role !== "assistant")
      return;
    recordThinkingMessageScope(event.message, sessionScopeKey);
    const ownerScopeKey = resolveThinkingMessageScope(event.message, sessionScopeKey);
    const timestamp = typeof event.message.timestamp === "number" ? event.message.timestamp : undefined;
    clearActiveThinkingState(timestamp, ownerScopeKey);
    if (timestamp !== undefined)
      clearThinkingMergeRegistry(ownerScopeKey, timestamp);
  });
  pi.on("message_update", async (event) => {
    if (event.message.role !== "assistant")
      return;
    recordThinkingMessageScope(event.message, sessionScopeKey);
    const ownerScopeKey = resolveThinkingMessageScope(event.message, sessionScopeKey);
    const assistantEvent = event.assistantMessageEvent;
    if (assistantEvent.type === "thinking_start" || assistantEvent.type === "thinking_delta") {
      setActiveThinkingState({
        active: true,
        messageTimestamp: event.message.timestamp,
        contentIndex: assistantEvent.contentIndex
      }, ownerScopeKey);
      return;
    }
    if (assistantEvent.type === "thinking_end" || assistantEvent.type === "text_start" || assistantEvent.type === "text_delta" || assistantEvent.type === "text_end" || assistantEvent.type === "toolcall_start" || assistantEvent.type === "toolcall_delta" || assistantEvent.type === "toolcall_end") {
      clearActiveThinkingState(event.message.timestamp, ownerScopeKey);
    }
  });
  pi.on("message_end", async (event) => {
    if (event.message.role !== "assistant")
      return;
    recordThinkingMessageScope(event.message, sessionScopeKey);
    const ownerScopeKey = resolveThinkingMessageScope(event.message, sessionScopeKey);
    const timestamp = typeof event.message.timestamp === "number" ? event.message.timestamp : undefined;
    clearActiveThinkingState(timestamp, ownerScopeKey);
  });
  pi.on("agent_end", async () => {
    clearActiveThinkingState(undefined, sessionScopeKey);
  });
  pi.on("session_shutdown", async (_event, ctx) => {
    const activeScopeKey = setSessionScopeKey(ctx.cwd);
    clearActiveThinkingState(undefined, activeScopeKey);
    clearThinkingMessageOwnership(activeScopeKey);
    clearThinkingMergeRegistry(activeScopeKey);
    const releasePatch = takeThinkingPatchRelease(activeScopeKey);
    if (!releasePatch)
      return;
    try {
      await releasePatch();
    } catch (error) {
      registerThinkingPatchRelease(activeScopeKey, releasePatch);
      reportPatchError(ctx, error);
    }
  });
}
export {
  thinkingStepsExtension as default
};
