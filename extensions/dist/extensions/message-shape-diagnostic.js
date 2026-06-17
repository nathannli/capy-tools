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

// extensions/message-shape-diagnostic.ts
import { appendFileSync, mkdirSync } from "node:fs";
import { dirname, isAbsolute, join } from "node:path";
var ENV_FLAG = "PI_BASIC_TOOLS_DIAG_SHAPES";
var ENV_PATH = "PI_BASIC_TOOLS_DIAG_SHAPES_PATH";
function computeShape(content) {
  const parts = [];
  let textParts = 0;
  let thinkingParts = 0;
  let toolCallParts = 0;
  let firstToolCallIndex = -1;
  let postToolTextChars = 0;
  let interleaved = false;
  let sawToolCall = false;
  for (let i = 0;i < content.length; i++) {
    const part = content[i];
    const type = part?.type;
    if (type === "text") {
      const text = typeof part.text === "string" ? part.text : "";
      parts.push(`text(${text.length})`);
      textParts++;
      if (sawToolCall) {
        if (text.trim().length > 0)
          interleaved = true;
        postToolTextChars += text.length;
      }
    } else if (type === "thinking") {
      const thinking = typeof part.thinking === "string" ? part.thinking : "";
      parts.push(`thinking(${thinking.length})`);
      thinkingParts++;
      if (sawToolCall) {
        if (thinking.trim().length > 0)
          interleaved = true;
        postToolTextChars += thinking.length;
      }
    } else if (type === "toolCall") {
      const name = typeof part.name === "string" ? part.name : "?";
      parts.push(`toolCall(${name})`);
      toolCallParts++;
      if (firstToolCallIndex < 0)
        firstToolCallIndex = i;
      sawToolCall = true;
    } else {
      parts.push(`?(${typeof type === "string" ? type : "unknown"})`);
    }
  }
  return {
    ts: new Date().toISOString(),
    interleaved,
    partCount: content.length,
    textParts,
    thinkingParts,
    toolCallParts,
    firstToolCallIndex,
    postToolTextChars,
    shape: parts.join(",")
  };
}
function resolveLogPath(cwd) {
  const override = process.env[ENV_PATH];
  if (override && override.length > 0) {
    return isAbsolute(override) ? override : join(cwd, override);
  }
  return join(cwd, ".pi", "diagnostics", "message-shapes.jsonl");
}
function messageShapeDiagnosticExtension(pi) {
  if (!process.env[ENV_FLAG])
    return;
  let warnedOnce = false;
  const cwd = process.cwd();
  const logPath = resolveLogPath(cwd);
  try {
    mkdirSync(dirname(logPath), { recursive: true });
  } catch {}
  try {
    appendFileSync(logPath, JSON.stringify({ ts: new Date().toISOString(), event: "diag_enabled", cwd }) + `
`);
  } catch {}
  pi.on("message_end", (event) => {
    const message = event?.message;
    if (!message || message.role !== "assistant")
      return;
    const content = Array.isArray(message.content) ? message.content : [];
    if (content.length === 0)
      return;
    const record = computeShape(content);
    if (typeof message.stopReason === "string")
      record.stopReason = message.stopReason;
    try {
      appendFileSync(logPath, JSON.stringify(record) + `
`);
    } catch (error) {
      if (!warnedOnce) {
        warnedOnce = true;
        const msg = error instanceof Error ? error.message : String(error);
        console.warn(`[capy-tools] message-shape-diagnostic failed to write ${logPath}: ${msg}`);
      }
    }
  });
}
export {
  messageShapeDiagnosticExtension as default,
  computeShape
};
