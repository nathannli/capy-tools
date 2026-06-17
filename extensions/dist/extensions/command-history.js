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

// extensions/command-history.ts
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
var HISTORY_DIR = join(homedir(), ".pi", "folder-history");
var MAX_HISTORY = 500;
function getHistoryFile(cwd) {
  const name = cwd.replace(/[\\\/:]/g, "-");
  return join(HISTORY_DIR, `${name}.jsonl`);
}
function loadHistory(cwd) {
  const file = getHistoryFile(cwd);
  if (!existsSync(file))
    return [];
  try {
    const entries = [];
    const lines = readFileSync(file, "utf8").split(`
`).filter((line) => line.trim());
    for (const line of lines) {
      try {
        const entry = JSON.parse(line);
        if (entry.cwd === cwd && typeof entry.text === "string" && entry.text) {
          entries.push(entry.text);
        }
      } catch {}
    }
    const seen = new Map;
    entries.forEach((text, index) => seen.set(text, index));
    const unique = [...seen.entries()].sort((a, b) => a[1] - b[1]).map(([text]) => text);
    return unique.slice(-MAX_HISTORY);
  } catch {
    return [];
  }
}
function appendHistory(cwd, text) {
  mkdirSync(HISTORY_DIR, { recursive: true });
  const entry = JSON.stringify({ cwd, text, ts: Date.now() });
  appendFileSync(getHistoryFile(cwd), `${entry}
`, "utf8");
}
function commandHistoryExtension(pi) {
  let history = [];
  let historyIndex = -1;
  let savedEditorText = "";
  let currentCwd = "";
  pi.on("session_start", (_event, ctx) => {
    currentCwd = ctx.cwd;
    history = loadHistory(currentCwd);
    historyIndex = -1;
    savedEditorText = "";
    ctx.ui.setStatus("folder-history", history.length > 0 ? `${history.length} cmds (ctrl+up/down)` : undefined);
  });
  pi.on("input", (event) => {
    const text = event.text?.trim();
    if (!text || !currentCwd)
      return;
    appendHistory(currentCwd, text);
    const existingIndex = history.indexOf(text);
    if (existingIndex !== -1)
      history.splice(existingIndex, 1);
    history.push(text);
    if (history.length > MAX_HISTORY)
      history.shift();
    historyIndex = -1;
    savedEditorText = "";
    return { action: "continue" };
  });
  pi.registerShortcut("ctrl+up", {
    description: "Previous command from folder history",
    handler: (ctx) => {
      if (history.length === 0)
        return;
      if (historyIndex === -1) {
        savedEditorText = ctx.ui.getEditorText();
      }
      const nextIndex = historyIndex + 1;
      if (nextIndex >= history.length)
        return;
      historyIndex = nextIndex;
      ctx.ui.setEditorText(history[history.length - 1 - historyIndex]);
    }
  });
  pi.registerShortcut("ctrl+down", {
    description: "Next command from folder history",
    handler: (ctx) => {
      if (historyIndex <= -1)
        return;
      historyIndex--;
      if (historyIndex === -1) {
        ctx.ui.setEditorText(savedEditorText);
      } else {
        ctx.ui.setEditorText(history[history.length - 1 - historyIndex]);
      }
    }
  });
}
export {
  commandHistoryExtension as default
};
