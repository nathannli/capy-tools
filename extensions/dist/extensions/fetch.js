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

// extensions/fetch.ts
import { access, mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { extname, join as join2, relative, resolve } from "node:path";
import { keyHint as keyHint2 } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import { Type } from "@sinclair/typebox";

// extensions/basic-tool-grouping.ts
import { keyHint } from "@earendil-works/pi-coding-agent";
import { Container, truncateToWidth as truncateToWidth2 } from "@earendil-works/pi-tui";

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

// extensions/tool-execution-patch.ts
import { createRequire as createRequire2 } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
var PI_TOOL_EXECUTION_MODULE = "dist/modes/interactive/components/tool-execution.js";
var PATCH_STATE_KEY = Symbol.for("capy-tools.tool-execution-patch.state");
var OVERRIDE_REGISTRY_KEY = Symbol.for("capy-tools.tool-execution-patch.overrides");
var ANSI_RE = /\[[0-9;?]*[A-Za-z]/g;
function getOverrideRegistry() {
  const existing = globalThis[OVERRIDE_REGISTRY_KEY];
  if (existing instanceof Map)
    return existing;
  const created = new Map;
  globalThis[OVERRIDE_REGISTRY_KEY] = created;
  return created;
}
function registerToolDefinitionOverride(toolName, override) {
  const registry = getOverrideRegistry();
  registry.set(toolName, override);
  return () => {
    if (registry.get(toolName) === override)
      registry.delete(toolName);
  };
}
function getPatchState() {
  const existing = globalThis[PATCH_STATE_KEY];
  if (existing && typeof existing === "object")
    return existing;
  const created = { refCount: 0 };
  globalThis[PATCH_STATE_KEY] = created;
  return created;
}
function isVisuallyEmptyLine(line) {
  return line.replace(ANSI_RE, "").trim().length === 0;
}
function shouldHideRenderedLines(lines) {
  if (lines.length === 0)
    return false;
  for (const line of lines) {
    if (!isVisuallyEmptyLine(line))
      return false;
  }
  return true;
}
function assertPatchableToolExecutionComponent(value) {
  if (!value || typeof value !== "function" && typeof value !== "object") {
    throw new Error("ToolExecution patch failed: ToolExecutionComponent export is missing or invalid.");
  }
  const prototype = value.prototype;
  if (!prototype || typeof prototype !== "object") {
    throw new Error("ToolExecution patch failed: ToolExecutionComponent.prototype is missing.");
  }
  const proto = prototype;
  if (typeof proto.render !== "function") {
    throw new Error("ToolExecution patch failed: ToolExecutionComponent.prototype.render is not a function.");
  }
  for (const name of ["getCallRenderer", "getResultRenderer", "getRenderShell"]) {
    if (typeof proto[name] !== "function") {
      throw new Error(`ToolExecution patch failed: ToolExecutionComponent.prototype.${name} is not a function.`);
    }
  }
  return value;
}
function getPackageRoot(packageName) {
  let entryUrl;
  try {
    entryUrl = import.meta.resolve(packageName);
  } catch (error) {
    throw new Error(`ToolExecution patch failed: could not resolve ${packageName} package root.`, { cause: error });
  }
  try {
    const entryPath = fileURLToPath(entryUrl);
    return dirname(dirname(entryPath));
  } catch (error) {
    throw new Error(`ToolExecution patch failed: could not derive ${packageName} package root from ${entryUrl}.`, {
      cause: error
    });
  }
}
function requirePiCodingAgentInternal(relativePath) {
  const packageRoot = getPackageRoot("@earendil-works/pi-coding-agent");
  const modulePath = join(packageRoot, relativePath);
  try {
    const require2 = createRequire2(import.meta.url);
    return require2(modulePath);
  } catch {
    throw new Error(`sync require failed for ${modulePath}`);
  }
}
async function importPiCodingAgentInternal(relativePath) {
  try {
    return requirePiCodingAgentInternal(relativePath);
  } catch {}
  const packageRoot = getPackageRoot("@earendil-works/pi-coding-agent");
  const moduleUrl = pathToFileURL(join(packageRoot, relativePath)).href;
  try {
    return await import(moduleUrl);
  } catch (error) {
    throw new Error(`ToolExecution patch failed: could not import internal module "@earendil-works/pi-coding-agent/${relativePath}".`, { cause: error });
  }
}
function applyPatch(moduleExports) {
  const ToolExecutionComponent = assertPatchableToolExecutionComponent(moduleExports.ToolExecutionComponent);
  const prototype = ToolExecutionComponent.prototype;
  const registry = getOverrideRegistry();
  const originalRender = prototype.render;
  const patchedRender = function patchedRender2(width) {
    const lines = originalRender.call(this, width);
    return shouldHideRenderedLines(lines) ? [] : lines;
  };
  prototype.render = patchedRender;
  const originalGetCallRenderer = prototype.getCallRenderer;
  const patchedGetCallRenderer = function patchedGetCallRenderer2() {
    const override = registry.get(this.toolName);
    if (override?.renderCall)
      return override.renderCall;
    return originalGetCallRenderer.call(this);
  };
  prototype.getCallRenderer = patchedGetCallRenderer;
  const originalGetResultRenderer = prototype.getResultRenderer;
  const patchedGetResultRenderer = function patchedGetResultRenderer2() {
    const override = registry.get(this.toolName);
    if (override?.renderResult)
      return override.renderResult;
    return originalGetResultRenderer.call(this);
  };
  prototype.getResultRenderer = patchedGetResultRenderer;
  const originalGetRenderShell = prototype.getRenderShell;
  const patchedGetRenderShell = function patchedGetRenderShell2() {
    const override = registry.get(this.toolName);
    if (override?.renderShell)
      return override.renderShell;
    return originalGetRenderShell.call(this);
  };
  prototype.getRenderShell = patchedGetRenderShell;
  const originalHasRendererDefinition = prototype.hasRendererDefinition;
  if (typeof originalHasRendererDefinition === "function") {
    const patchedHasRendererDefinition = function patchedHasRendererDefinition2() {
      if (registry.has(this.toolName))
        return true;
      return originalHasRendererDefinition.call(this);
    };
    prototype.hasRendererDefinition = patchedHasRendererDefinition;
    return () => {
      if (prototype.render === patchedRender)
        prototype.render = originalRender;
      if (prototype.getCallRenderer === patchedGetCallRenderer)
        prototype.getCallRenderer = originalGetCallRenderer;
      if (prototype.getResultRenderer === patchedGetResultRenderer)
        prototype.getResultRenderer = originalGetResultRenderer;
      if (prototype.getRenderShell === patchedGetRenderShell)
        prototype.getRenderShell = originalGetRenderShell;
      if (prototype.hasRendererDefinition === patchedHasRendererDefinition) {
        prototype.hasRendererDefinition = originalHasRendererDefinition;
      }
    };
  }
  return () => {
    if (prototype.render === patchedRender)
      prototype.render = originalRender;
    if (prototype.getCallRenderer === patchedGetCallRenderer)
      prototype.getCallRenderer = originalGetCallRenderer;
    if (prototype.getResultRenderer === patchedGetResultRenderer)
      prototype.getResultRenderer = originalGetResultRenderer;
    if (prototype.getRenderShell === patchedGetRenderShell)
      prototype.getRenderShell = originalGetRenderShell;
  };
}
async function installPatch() {
  const moduleExports = await importPiCodingAgentInternal(PI_TOOL_EXECUTION_MODULE);
  return applyPatch(moduleExports);
}
function tryInstallPatchSync() {
  const patchState = getPatchState();
  if (patchState.cleanup)
    return true;
  try {
    const moduleExports = requirePiCodingAgentInternal(PI_TOOL_EXECUTION_MODULE);
    patchState.cleanup = applyPatch(moduleExports);
    patchState.refCount = Math.max(1, patchState.refCount);
    return true;
  } catch {
    return false;
  }
}
async function retainToolExecutionPatch() {
  const state = getPatchState();
  state.refCount += 1;
  if (!state.cleanup) {
    const installPromise = state.installPromise ?? installPatch();
    if (!state.installPromise)
      state.installPromise = installPromise;
    try {
      state.cleanup = await installPromise;
    } catch (error) {
      state.refCount = Math.max(0, state.refCount - 1);
      throw error;
    } finally {
      if (state.installPromise === installPromise)
        state.installPromise = undefined;
    }
  }
  let released = false;
  return async () => {
    if (released)
      return;
    released = true;
    state.refCount = Math.max(0, state.refCount - 1);
    if (state.refCount > 0)
      return;
    const cleanup = state.cleanup;
    if (!cleanup)
      return;
    state.cleanup = undefined;
    try {
      cleanup();
    } catch (error) {
      state.cleanup = cleanup;
      state.refCount += 1;
      released = false;
      throw error;
    }
  };
}

// extensions/basic-tool-grouping.ts
var BASIC_TOOL_NAMES = new Set([
  "read",
  "bash",
  "grep",
  "find",
  "ls",
  "repo_map",
  "read_block",
  "symbol_outline",
  "apply_patch",
  "exec_command",
  "fetch",
  "sourcegraph",
  "fffind",
  "ffgrep",
  "fff-multi-grep",
  "todo"
]);
var STATE_KEY = Symbol.for("capy-tools.basic-tool-grouping.state");
var STDIN_KEY = Symbol.for("capy-tools.basic-tool-grouping.stdin");
var MAX_COLLAPSED_ITEMS = 5;
var MAX_GROUP_ITEMS = 12;
function getState() {
  const existing = globalThis[STATE_KEY];
  if (existing && typeof existing === "object") {
    const state = existing;
    if (!Array.isArray(state.patchReleases))
      state.patchReleases = [];
    return state;
  }
  const created = {
    groups: new Map,
    itemsByCallId: new Map,
    nextGroupId: 1,
    installed: false,
    patchReleases: []
  };
  globalThis[STATE_KEY] = created;
  return created;
}
function getStdinState() {
  const existing = globalThis[STDIN_KEY];
  if (existing && typeof existing === "object")
    return existing;
  const created = {
    countsBySession: new Map,
    execCommandBySession: new Map
  };
  globalThis[STDIN_KEY] = created;
  return created;
}
var state = getState();
var stdinState = getStdinState();
function classifyStdinChars(chars) {
  if (chars === "\x03")
    return "interrupts";
  if (typeof chars === "string" && chars.length > 0)
    return "writes";
  return "polls";
}
function recordStdinCall(sessionId, chars) {
  if (!sessionId)
    return;
  const counts = stdinState.countsBySession.get(sessionId) ?? { polls: 0, writes: 0, interrupts: 0 };
  counts[classifyStdinChars(chars)] += 1;
  stdinState.countsBySession.set(sessionId, counts);
  const parent = stdinState.execCommandBySession.get(sessionId);
  if (parent) {
    const parentItem = state.itemsByCallId.get(parent);
    if (parentItem) {
      bumpGroup(groupFor(parentItem));
      parentItem.invalidate?.();
    }
  }
}
function recordExecCommandSession(toolCallId, sessionId) {
  if (!sessionId)
    return;
  stdinState.execCommandBySession.set(sessionId, toolCallId);
  const parentItem = state.itemsByCallId.get(toolCallId);
  if (parentItem) {
    bumpGroup(groupFor(parentItem));
    parentItem.invalidate?.();
  }
}
function execCommandSessionFor(item) {
  for (const [sessionId, callId] of stdinState.execCommandBySession) {
    if (callId === item.toolCallId)
      return sessionId;
  }
  return;
}
function stdinMetaFor(item) {
  if (item.toolName !== "exec_command")
    return;
  const sessionId = execCommandSessionFor(item);
  if (!sessionId)
    return;
  const counts = stdinState.countsBySession.get(sessionId);
  if (!counts)
    return;
  const parts = [];
  if (counts.polls > 0)
    parts.push(`${counts.polls} poll${counts.polls === 1 ? "" : "s"}`);
  if (counts.writes > 0)
    parts.push(`${counts.writes} write${counts.writes === 1 ? "" : "s"}`);
  if (counts.interrupts > 0)
    parts.push(`${counts.interrupts} interrupt${counts.interrupts === 1 ? "" : "s"}`);
  return parts.length > 0 ? parts.join(" · ") : undefined;
}
function safeKeyHint(keybinding, description) {
  try {
    return keyHint(keybinding, description);
  } catch {
    return `(${description})`;
  }
}
function collapseWhitespace(text) {
  return text.replace(/\s+/g, " ").trim();
}
function basename(filePath) {
  const normalized = filePath.replace(/\\/g, "/");
  return normalized.split("/").filter(Boolean).pop() ?? normalized;
}
function textContent(result) {
  const content = result?.content?.[0];
  return content?.type === "text" && typeof content.text === "string" ? content.text : "";
}
function hasMeaningfulNonToolContent(part) {
  if (typeof part === "string")
    return part.trim().length > 0;
  if (!part || typeof part !== "object")
    return false;
  if (typeof part.text === "string")
    return part.text.trim().length > 0;
  if (typeof part.content === "string")
    return part.content.trim().length > 0;
  return false;
}
function lineCount(text) {
  return text.split(`
`).filter((line) => line.trim()).length;
}
function firstString(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim())
      return value;
  }
  return;
}
function isBasicTool(toolName) {
  return !!toolName && BASIC_TOOL_NAMES.has(toolName);
}
function closeCurrentGroup() {
  if (state.currentGroup)
    state.currentGroup.open = false;
  state.currentGroup = undefined;
}
function createGroup(firstToolCallId) {
  const group = {
    id: state.nextGroupId++,
    items: [],
    open: true,
    headToolCallId: firstToolCallId,
    visibleToolCallId: firstToolCallId,
    version: 0
  };
  state.groups.set(group.id, group);
  state.currentGroup = group;
  return group;
}
function getOrCreateItem(toolName, toolCallId, summary) {
  const existing = state.itemsByCallId.get(toolCallId);
  if (existing) {
    existing.summary = mergeSummary(existing.summary, summary);
    return existing;
  }
  if (state.currentGroup?.open && state.currentGroup.items.length >= MAX_GROUP_ITEMS) {
    closeCurrentGroup();
  }
  const group = state.currentGroup?.open ? state.currentGroup : createGroup(toolCallId);
  const previousVisible = state.itemsByCallId.get(group.visibleToolCallId);
  if (previousVisible) {
    previousVisible.hidden = true;
    previousVisible.invalidate?.();
  }
  const item = {
    toolCallId,
    toolName,
    groupId: group.id,
    index: group.items.length,
    status: "pending",
    summary,
    hidden: false
  };
  group.items.push(item);
  group.visibleToolCallId = toolCallId;
  state.itemsByCallId.set(toolCallId, item);
  bumpGroup(group);
  return item;
}
function groupFor(item) {
  return state.groups.get(item.groupId);
}
function bumpGroup(group) {
  if (group)
    group.version += 1;
}
function roleForTool(toolName) {
  if (["read", "read_block", "symbol_outline", "repo_map", "ls"].includes(toolName))
    return "inspect";
  if (["grep", "find", "sourcegraph", "fffind", "ffgrep", "fff-multi-grep"].includes(toolName))
    return "search";
  if (["apply_patch"].includes(toolName))
    return "write";
  if (["bash", "exec_command", "write_stdin"].includes(toolName))
    return "run";
  if (["fetch"].includes(toolName))
    return "network";
  if (["todo"].includes(toolName))
    return "plan";
  return "default";
}
function displaySummary(item) {
  return item.resultSummary ?? item.summary;
}
function statusFor(item) {
  if (item.status === "error")
    return "error";
  if (item.status === "pending" || item.status === "running")
    return "running";
  return "done";
}
function visualRoleFor(item) {
  const raw = item.resultSummary?.role ?? item.summary.role ?? roleForTool(item.toolName);
  switch (raw) {
    case "inspect":
    case "search":
    case "write":
    case "run":
    case "network":
    case "plan":
    case "ask":
      return raw;
    default:
      return "default";
  }
}
function mergeMeta(...parts) {
  const list = parts.filter((part) => typeof part === "string" && part.length > 0);
  return list.length > 0 ? list.join(" · ") : undefined;
}
function formatTreeItem(item, theme, width, isLast) {
  const headline = actionHeadline(item);
  const summary = displaySummary(item);
  return renderTreeRow({
    theme,
    width,
    isLast,
    role: visualRoleFor(item),
    status: statusFor(item),
    headline,
    meta: mergeMeta(summary.detail, stdinMetaFor(item))
  });
}
function actionHeadline(item) {
  const summary = displaySummary(item);
  const target = summary.target;
  const title = summary.title;
  if (item.toolName === "bash" || item.toolName === "exec_command")
    return `Ran ${target ?? title ?? item.toolName}`;
  if (item.toolName === "write_stdin") {
    const verb = title ?? "stdin";
    const tag = target ? ` ${target}` : "";
    return `${verb}${tag}`;
  }
  if (item.toolName === "apply_patch")
    return "Edited";
  if (item.toolName === "grep" || item.toolName === "ffgrep")
    return `Search ${target ?? ""}`.trim();
  if (item.toolName === "fff-multi-grep")
    return `Search ${target ?? ""}`.trim();
  if (item.toolName === "find" || item.toolName === "fffind")
    return `Find ${target ?? ""}`.trim();
  if (item.toolName === "ls")
    return `List ${target ?? "."}`;
  if (item.toolName === "read" || item.toolName === "read_block")
    return `Read ${target ?? title ?? item.toolName}`;
  if (item.toolName === "symbol_outline")
    return `Outline ${target ?? ""}`.trim();
  if (item.toolName === "repo_map")
    return `Map ${target ?? "project"}`;
  if (item.toolName === "fetch")
    return target ? `Fetched ${target}` : "Fetched";
  if (item.toolName === "sourcegraph")
    return `Search Sourcegraph ${target ?? ""}`.trim();
  if (item.toolName === "todo") {
    const verb = title ?? "todo";
    return `${verb}${target ? ` ${target}` : ""}`;
  }
  if (title)
    return `${title} ${target ?? ""}`.trim();
  const parts = [];
  if (summary.title)
    parts.push(summary.title);
  if (summary.target)
    parts.push(summary.target);
  return parts.join(" ") || item.toolName;
}
function groupStatus(group) {
  if (group.items.some((item) => item.status === "error"))
    return "error";
  if (group.items.some((item) => item.status === "pending" || item.status === "running"))
    return "running";
  return "done";
}
function plural(noun, count) {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}
function roleFragment(role, count) {
  switch (role) {
    case "run":
      return `ran ${plural("command", count)}`;
    case "write":
      return `edited ${plural("file", count)}`;
    case "search":
      return `searched ${plural("pattern", count)}`;
    case "inspect":
      return `read ${plural("file", count)}`;
    case "network":
      return `fetched ${plural("resource", count)}`;
    case "plan":
      return `tracked ${plural("todo", count)}`;
    case "ask":
      return `asked ${plural("question", count)}`;
    default:
      return `used ${plural("tool", count)}`;
  }
}
var ROLE_DISPLAY_ORDER = ["run", "write", "search", "inspect", "network", "plan", "ask", "default"];
function groupTitle(group) {
  const roles = group.items.map((item) => item.resultSummary?.role ?? item.summary.role ?? roleForTool(item.toolName));
  const total = group.items.length;
  if (roles.every((role) => role === "run"))
    return `Ran ${plural("command", total)}`;
  if (roles.every((role) => role === "write"))
    return `Edited ${plural("file", total)}`;
  if (roles.every((role) => role === "inspect" || role === "search"))
    return `Explored ${plural("target", total)}`;
  if (roles.every((role) => role === "network"))
    return `Fetched ${plural("resource", total)}`;
  if (roles.every((role) => role === "plan"))
    return `Tracked ${plural("todo", total)}`;
  const counts = new Map;
  for (const role of roles)
    counts.set(role, (counts.get(role) ?? 0) + 1);
  const parts = [];
  for (const role of ROLE_DISPLAY_ORDER) {
    const count = counts.get(role);
    if (count)
      parts.push(roleFragment(role, count));
  }
  if (parts.length === 0)
    return `Used ${plural("tool", total)}`;
  parts[0] = parts[0][0].toUpperCase() + parts[0].slice(1);
  return parts.join(", ");
}
function renderGroupLines(group, expanded, theme, width) {
  const status = groupStatus(group);
  const titleRole = status === "error" ? "error" : status === "running" ? "warning" : "muted";
  const maxItems = expanded ? 80 : MAX_COLLAPSED_ITEMS;
  const visible = group.items.slice(-maxItems);
  const lines = [theme.fg(titleRole, groupTitle(group))];
  for (let index = 0;index < visible.length; index += 1) {
    const item = visible[index];
    const isLast = index === visible.length - 1;
    lines.push(...formatTreeItem(item, theme, width, isLast));
  }
  const hidden = group.items.length - visible.length;
  if (expanded && hidden > 0)
    lines.push(theme.fg("muted", `… ${hidden} earlier call${hidden === 1 ? "" : "s"}`));
  if (!expanded)
    lines.push(theme.fg("muted", safeKeyHint("app.tools.expand", "to expand")));
  return lines;
}

class BasicToolGroupComponent {
  item;
  group;
  theme;
  expanded;
  cacheKey;
  cachedLines;
  constructor(item, group, theme, expanded) {
    this.item = item;
    this.group = group;
    this.theme = theme;
    this.expanded = expanded;
  }
  render(width) {
    if (this.item.hidden)
      return [];
    const cacheKey = `${width}:${this.group.version}:${this.expanded ? 1 : 0}`;
    if (this.cachedLines && this.cacheKey === cacheKey)
      return this.cachedLines;
    const lines = renderGroupLines(this.group, this.expanded, this.theme, width);
    this.cacheKey = cacheKey;
    this.cachedLines = lines.map((line) => truncateToWidth2(line, Math.max(1, width)));
    return this.cachedLines;
  }
  invalidate() {
    this.cacheKey = undefined;
    this.cachedLines = undefined;
  }
}

class BasicToolItemComponent {
  item;
  theme;
  constructor(item, theme) {
    this.item = item;
    this.theme = theme;
  }
  render(width) {
    if (this.item.hidden)
      return [];
    const headline = actionHeadline(this.item);
    const summary = displaySummary(this.item);
    const status = statusFor(this.item);
    const role = visualRoleFor(this.item);
    const marker = (() => {
      if (status === "error")
        return { glyph: "!", color: "error" };
      if (status === "running")
        return { glyph: "◐", color: "warning" };
      return { glyph: ROLE_GLYPHS[role] ?? "·", color: "muted" };
    })();
    const textColor = status === "error" ? "error" : "muted";
    const headlinePainted = this.theme.fg(textColor, headline);
    const meta = mergeMeta(summary.detail, stdinMetaFor(this.item));
    const metaPainted = meta ? this.theme.fg(textColor, `  · ${meta}`) : "";
    const line = `${this.theme.fg(marker.color, marker.glyph)} ${headlinePainted}${metaPainted}`;
    return [truncateToWidth2(line, Math.max(1, width), "")];
  }
  invalidate() {}
}
function emptyComponent() {
  return new Container;
}
function mergeSummary(previous, next) {
  return {
    title: next.title ?? previous.title,
    target: next.target ?? previous.target,
    detail: next.detail ?? previous.detail,
    role: next.role ?? previous.role
  };
}
function canGroupTool(context) {
  return typeof context?.toolCallId === "string" && context.toolCallId.length > 0;
}
var OVERRIDDEN_FOREIGN_TOOLS = ["fffind", "ffgrep", "fff-multi-grep"];
function registerForeignToolOverrides() {
  for (const toolName of OVERRIDDEN_FOREIGN_TOOLS) {
    registerToolDefinitionOverride(toolName, {
      renderShell: "self",
      renderCall(args, theme, context) {
        return renderGroupedToolCall(toolName, args ?? {}, theme, context, summarizeToolCall(toolName, args ?? {}));
      },
      renderResult(result, options, theme, context) {
        return renderGroupedToolResult(toolName, result, options ?? {}, theme, context);
      }
    });
  }
}
function installBasicToolGrouping(pi) {
  if (state.installed || typeof pi.on !== "function")
    return;
  state.installed = true;
  registerForeignToolOverrides();
  pi.on("message_start", (event) => {
    const role = event?.message?.role;
    if (role === "user")
      closeCurrentGroup();
  });
  pi.on("tool_execution_start", (event) => {
    const toolName = event?.toolName ?? event?.name ?? event?.tool?.name ?? event?.toolCall?.name;
    if (typeof toolName === "string" && !isBasicTool(toolName))
      closeCurrentGroup();
  });
  pi.on("message_update", (event) => {
    const content = event?.message?.content;
    if (!Array.isArray(content))
      return;
    let previousWasBasic = false;
    let sequenceGroup;
    for (const part of content) {
      if (part?.type !== "toolCall") {
        previousWasBasic = false;
        if (hasMeaningfulNonToolContent(part)) {
          if (sequenceGroup)
            sequenceGroup.open = false;
          sequenceGroup = undefined;
          closeCurrentGroup();
        }
        continue;
      }
      if (part.name === "write_stdin") {
        const args = part.arguments ?? {};
        const sessionId = typeof args?.session_id === "string" ? args.session_id : undefined;
        recordStdinCall(sessionId, args?.chars);
        continue;
      }
      const basic = isBasicTool(part.name);
      if (!basic) {
        previousWasBasic = false;
        if (sequenceGroup)
          sequenceGroup.open = false;
        sequenceGroup = undefined;
        closeCurrentGroup();
        continue;
      }
      const existing = state.itemsByCallId.get(String(part.id));
      if (existing) {
        sequenceGroup = groupFor(existing);
        state.currentGroup = sequenceGroup?.open ? sequenceGroup : undefined;
        existing.summary = mergeSummary(existing.summary, summarizeToolCall(part.name, part.arguments ?? {}));
        bumpGroup(sequenceGroup);
        previousWasBasic = true;
        continue;
      }
      if (sequenceGroup?.open) {
        state.currentGroup = sequenceGroup;
      } else if (state.currentGroup?.open) {
        sequenceGroup = state.currentGroup;
      } else {
        state.currentGroup = undefined;
      }
      const item = getOrCreateItem(part.name, String(part.id), summarizeToolCall(part.name, part.arguments ?? {}));
      sequenceGroup = groupFor(item);
      previousWasBasic = true;
    }
  });
  pi.on("tool_result", (event) => {
    return compactExternalBasicToolResult(event);
  });
  if (!tryInstallPatchSync()) {
    retainToolExecutionPatch().then((release) => state.patchReleases.push(release)).catch((error) => console.warn(`Capy Tools basic-tool-grouping: tool-execution patch unavailable (${error instanceof Error ? error.message : String(error)})`));
  }
  pi.on("session_shutdown", async () => {
    const release = state.patchReleases.pop();
    if (!release)
      return;
    try {
      await release();
    } catch (error) {
      state.patchReleases.push(release);
      console.warn(`Capy Tools basic-tool-grouping: tool-execution patch release failed (${error instanceof Error ? error.message : String(error)})`);
    }
  });
}
function compactExternalBasicToolResult(event) {
  const toolName = event?.toolName;
  if (!["fffind", "ffgrep", "fff-multi-grep"].includes(toolName))
    return;
  const input = event?.input ?? {};
  const details = event?.details ?? {};
  const text = Array.isArray(event?.content) ? textContent({ content: event.content }) : "";
  const count = Number.isFinite(details.totalMatched) ? Number(details.totalMatched) : lineCount(text);
  const files = Number.isFinite(details.totalFiles) ? Number(details.totalFiles) : undefined;
  const target = firstString(input.pattern, Array.isArray(input.patterns) ? input.patterns.join(", ") : undefined, input.path, input.constraints, ".");
  const action = toolName === "fffind" ? "Find" : "Search";
  const scope = firstString(input.path, input.constraints);
  const countLabel = files === undefined ? `${count} result${count === 1 ? "" : "s"}` : `${count} result${count === 1 ? "" : "s"} in ${files} file${files === 1 ? "" : "s"}`;
  const scopeLabel = scope && scope !== target ? ` in ${scope}` : "";
  const textResult = `${action} ${target ?? ""}${scopeLabel} · ${countLabel}`.trim();
  return {
    content: [{ type: "text", text: textResult }],
    details: {
      ...details,
      compactedForDisplay: true,
      originalLineCount: lineCount(text)
    }
  };
}
function summarizeToolCall(toolName, args = {}) {
  const role = roleForTool(toolName);
  const path = typeof args.path === "string" ? args.path : undefined;
  const command = typeof args.command === "string" ? args.command : typeof args.cmd === "string" ? args.cmd : undefined;
  if (toolName === "bash" && command)
    return { title: "run", target: collapseWhitespace(command), role };
  if (toolName === "exec_command" && command)
    return { title: "exec", target: collapseWhitespace(command), role };
  if (toolName === "write_stdin")
    return { title: "stdin", target: args.session_id ? `#${args.session_id}` : undefined, detail: args.chars === "\x03" ? "interrupt" : args.chars ? "write" : "poll", role };
  if (toolName === "grep")
    return { title: "grep", target: args.pattern ? String(args.pattern) : path, role };
  if (toolName === "ffgrep")
    return { title: "ffgrep", target: args.pattern ? String(args.pattern) : path, role };
  if (toolName === "fff-multi-grep")
    return { title: "fff multi grep", target: Array.isArray(args.patterns) ? args.patterns.join(", ") : args.constraints ? String(args.constraints) : undefined, role };
  if (toolName === "find")
    return { title: "find", target: args.pattern ? String(args.pattern) : path, role };
  if (toolName === "fffind")
    return { title: "fffind", target: args.pattern ? String(args.pattern) : path, role };
  if (toolName === "ls")
    return { title: "ls", target: path ?? ".", role };
  if (toolName === "read_block")
    return { title: "read block", target: path, detail: args.symbol ? String(args.symbol) : args.line ? `L${args.line}` : undefined, role };
  if (toolName === "symbol_outline")
    return { title: "outline", target: path, role };
  if (toolName === "repo_map")
    return { title: "repo map", target: path ?? ".", role };
  if (toolName === "apply_patch")
    return { title: "apply patch", role };
  if (toolName === "fetch")
    return { title: "fetch", target: args.url ? String(args.url) : undefined, role };
  if (toolName === "sourcegraph")
    return { title: "sourcegraph", target: args.query ? String(args.query) : undefined, role };
  if (toolName === "todo") {
    return { title: "todo", role };
  }
  if (path)
    return { title: toolName, target: basename(path), role };
  return { title: toolName, role };
}
function summarizeToolResult(toolName, result, fallback) {
  const details = result?.details ?? {};
  const text = textContent(result);
  const role = fallback?.role ?? roleForTool(toolName);
  if (toolName === "read_block" && details.displayPath)
    return { title: "read block", target: `${details.displayPath}:${details.outputStart}-${details.outputEnd}`, role };
  if (toolName === "symbol_outline" && details.displayPath)
    return { title: "outline", target: details.displayPath, detail: `${details.displayedCount ?? details.blockCount ?? 0} blocks`, role };
  if (toolName === "repo_map" && details.root)
    return { title: "repo map", target: basename(String(details.root)), detail: `${details.fileCount ?? "?"} files`, role };
  if (toolName === "apply_patch")
    return { title: "apply patch", detail: `${details.totalFiles ?? 0} files`, role };
  if (["fffind", "ffgrep", "fff-multi-grep"].includes(toolName)) {
    const matched = Number(details.totalMatched);
    const files = Number(details.totalFiles);
    const parts = [];
    if (Number.isFinite(matched))
      parts.push(`${matched} result${matched === 1 ? "" : "s"}`);
    if (Number.isFinite(files) && files > 0)
      parts.push(`in ${files} file${files === 1 ? "" : "s"}`);
    if (parts.length === 0 && text)
      parts.push(`${lineCount(text)} lines`);
    return { ...fallback ?? { title: toolName, role }, detail: parts.join(" ") || undefined };
  }
  if (["grep", "find", "ls"].includes(toolName))
    return { ...fallback ?? { title: toolName, role }, detail: `${lineCount(text)} lines` };
  if (toolName === "bash")
    return { ...fallback ?? { title: "run", role }, detail: result?.isError ? "failed" : `${lineCount(text)} output lines` };
  if (toolName === "read")
    return { ...fallback ?? { title: "read", role }, detail: `${lineCount(text)} lines` };
  if (toolName === "write")
    return { ...fallback ?? { title: "write", role }, detail: "written" };
  if (toolName === "edit")
    return { ...fallback ?? { title: "edit", role }, detail: "edited" };
  return fallback ?? { title: toolName, detail: text ? `${lineCount(text)} lines` : undefined, role };
}
function renderGroupedToolCall(toolName, args, theme, context, summary = summarizeToolCall(toolName, args)) {
  if (toolName === "write_stdin") {
    const sessionId = typeof args?.session_id === "string" ? args.session_id : undefined;
    recordStdinCall(sessionId, args?.chars);
    return emptyComponent();
  }
  if (!isBasicTool(toolName))
    return emptyComponent();
  if (!canGroupTool(context))
    return emptyComponent();
  const toolCallId = String(context.toolCallId);
  const item = getOrCreateItem(toolName, toolCallId, summary);
  if (typeof context?.invalidate === "function")
    item.invalidate = context.invalidate;
  const nextStatus = context?.executionStarted ? "running" : item.status;
  if (item.status !== nextStatus) {
    item.status = nextStatus;
    bumpGroup(groupFor(item));
  }
  const group = groupFor(item);
  if (group && group.items.length > 1)
    return new BasicToolGroupComponent(item, group, theme, !!context?.expanded);
  return new BasicToolItemComponent(item, theme);
}
function renderGroupedToolResult(toolName, result, options, theme, context, summary) {
  if (toolName === "write_stdin")
    return emptyComponent();
  if (!isBasicTool(toolName))
    return emptyComponent();
  if (toolName === "exec_command") {
    const sessionId = result?.details?.session_id;
    if (typeof sessionId === "string" && context?.toolCallId) {
      recordExecCommandSession(String(context.toolCallId), sessionId);
    }
  }
  if (!canGroupTool(context))
    return emptyComponent();
  const toolCallId = String(context.toolCallId);
  const item = getOrCreateItem(toolName, toolCallId, summary ?? summarizeToolCall(toolName, context?.args ?? {}));
  const nextStatus = result?.isError ? "error" : options.isPartial ? "running" : "success";
  item.status = nextStatus;
  item.isPartial = options.isPartial;
  item.resultText = textContent(result);
  item.resultSummary = summarizeToolResult(toolName, result, item.summary);
  bumpGroup(groupFor(item));
  return emptyComponent();
}

// extensions/fetch.ts
var fetchSchema = Type.Object({
  url: Type.String({ description: "The URL to fetch content from (must start with http:// or https://)" }),
  format: Type.Optional(Type.Union([Type.Literal("text"), Type.Literal("markdown"), Type.Literal("html")], {
    description: "Preferred preview format for stored artifacts. The raw response is always saved and Markdown conversion is always attempted.",
    default: "markdown"
  })),
  timeout: Type.Optional(Type.Number({ description: "Request timeout in seconds (default 30, max 120)" }))
});
var MAX_RESPONSE_BYTES = 5 * 1024 * 1024;
var MARKITDOWN_TIMEOUT_MS = 30000;
var FETCH_SCHEMA_VERSION = 1;
function slugify(text, maxLen = 64) {
  const slug = text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, maxLen).replace(/-+$/g, "");
  return slug || "fetch";
}
function formatTimestamp(date = new Date) {
  return [
    date.getFullYear().toString(),
    (date.getMonth() + 1).toString().padStart(2, "0"),
    date.getDate().toString().padStart(2, "0"),
    date.getHours().toString().padStart(2, "0"),
    date.getMinutes().toString().padStart(2, "0"),
    date.getSeconds().toString().padStart(2, "0")
  ].join("");
}
function buildFetchLabel(url) {
  const parsed = new URL(url);
  const pathParts = parsed.pathname.split("/").filter(Boolean).slice(-3);
  const label = [parsed.hostname, ...pathParts];
  if (parsed.search)
    label.push("query");
  return label.join("-") || parsed.hostname || "fetch";
}
async function pathExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}
async function ensureProjectRoot(cwd) {
  const start = resolve(cwd);
  const homeDir = process.env.HOME ? resolve(process.env.HOME) : undefined;
  const globalPiDir = homeDir ? join2(homeDir, ".pi") : undefined;
  let current = start;
  while (true) {
    if (await pathExists(join2(current, ".git")))
      return current;
    const localPiDir = join2(current, ".pi");
    if (await pathExists(localPiDir) && localPiDir !== globalPiDir)
      return current;
    const parent = resolve(current, "..");
    if (parent === current || current === homeDir)
      break;
    current = parent;
  }
  if (start === homeDir) {
    throw new Error("Refusing to store fetch artifacts in global ~/.pi. Run fetch from a project directory.");
  }
  return start;
}
async function createArtifactDir(rootDir, label) {
  await mkdir(rootDir, { recursive: true });
  const baseId = `${formatTimestamp()}-${slugify(label)}`;
  let candidateId = baseId;
  for (let suffix = 2;; suffix += 1) {
    const candidateDir = join2(rootDir, candidateId);
    try {
      await mkdir(candidateDir);
      return { id: candidateId, dir: candidateDir };
    } catch (error) {
      if (!(error instanceof Error) || !("code" in error) || error.code !== "EEXIST")
        throw error;
      candidateId = `${baseId}-${suffix}`;
    }
  }
}
function inferRawExtension(url, contentType) {
  const normalized = contentType.split(";")[0]?.trim().toLowerCase() ?? "";
  if (normalized.includes("text/html"))
    return ".html";
  if (normalized.includes("application/json"))
    return ".json";
  if (normalized.includes("application/pdf"))
    return ".pdf";
  if (normalized.includes("application/zip"))
    return ".zip";
  if (normalized.includes("application/epub+zip"))
    return ".epub";
  if (normalized.includes("application/vnd.openxmlformats-officedocument.wordprocessingml.document"))
    return ".docx";
  if (normalized.includes("application/vnd.openxmlformats-officedocument.presentationml.presentation"))
    return ".pptx";
  if (normalized.includes("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
    return ".xlsx";
  if (normalized.includes("application/msword"))
    return ".doc";
  if (normalized.includes("application/vnd.ms-powerpoint"))
    return ".ppt";
  if (normalized.includes("application/vnd.ms-excel"))
    return ".xls";
  if (normalized.includes("text/markdown"))
    return ".md";
  if (normalized.includes("text/plain"))
    return ".txt";
  if (normalized.includes("application/xml") || normalized.includes("text/xml"))
    return ".xml";
  if (normalized.includes("text/csv"))
    return ".csv";
  const pathname = new URL(url).pathname;
  const fromUrl = extname(pathname).toLowerCase();
  if (fromUrl && /^[.a-z0-9_-]+$/.test(fromUrl))
    return fromUrl;
  return ".html";
}
function formatBytes(bytes) {
  if (bytes < 1024)
    return `${bytes} B`;
  if (bytes < 1024 * 1024)
    return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
function toDisplayPath(projectRoot, absolutePath) {
  const rel = relative(projectRoot, absolutePath);
  if (!rel || rel.startsWith("..") || rel === "")
    return absolutePath;
  return rel;
}
function trimCommandOutput(text, maxChars = 1200) {
  const normalized = text.trim();
  if (normalized.length <= maxChars)
    return normalized;
  return `${normalized.slice(0, maxChars)}...`;
}
function isLikelyTextContentType(contentType) {
  const normalized = contentType.split(";")[0]?.trim().toLowerCase() ?? "";
  return normalized.startsWith("text/") || normalized.includes("json") || normalized.includes("xml") || normalized.includes("javascript") || normalized.includes("yaml") || normalized.includes("csv");
}
function summarizeTextForContext(text) {
  if (text.length === 0) {
    return { lineCount: 0, tokenEstimate: 0 };
  }
  const normalized = text.replace(/\r\n/g, `
`);
  return {
    lineCount: normalized.split(`
`).length,
    tokenEstimate: Math.max(1, Math.ceil(normalized.length / 4))
  };
}
function formatReadTargetStats(readTarget) {
  if (readTarget.lineCount === undefined || readTarget.tokenEstimate === undefined) {
    return readTarget.kind === "raw-binary" ? " (binary file; line and token estimate unavailable)" : "";
  }
  return ` (${readTarget.lineCount} lines, ~${readTarget.tokenEstimate} tokens)`;
}
async function removeIfExists(filePath) {
  try {
    await unlink(filePath);
  } catch (error) {
    if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT")
      throw error;
  }
}
async function runMarkitdown(pi, inputPath, outputPath, cwd, signal, timeoutMs) {
  const candidates = [
    ...process.env.HOME ? [{ command: join2(process.env.HOME, ".local", "bin", "markitdown"), args: [inputPath, "-o", outputPath] }] : [],
    { command: "markitdown", args: [inputPath, "-o", outputPath] },
    { command: "python3", args: ["-m", "markitdown", inputPath, "-o", outputPath] },
    { command: "python", args: ["-m", "markitdown", inputPath, "-o", outputPath] }
  ];
  const attempts = [];
  for (const candidate of candidates) {
    await removeIfExists(outputPath);
    const result = await pi.exec(candidate.command, candidate.args, {
      cwd,
      signal,
      timeout: timeoutMs
    });
    attempts.push({
      command: candidate.command,
      args: candidate.args,
      code: result.code,
      killed: result.killed,
      stdout: trimCommandOutput(result.stdout),
      stderr: trimCommandOutput(result.stderr)
    });
    if (result.code === 0 && await pathExists(outputPath)) {
      return {
        success: true,
        command: [candidate.command, ...candidate.args].join(" "),
        attempts
      };
    }
  }
  return {
    success: false,
    attempts,
    error: "MarkItDown conversion failed or is unavailable on this machine."
  };
}
function buildResultText(details) {
  const lines = [
    `Fetched URL: ${details.url}`,
    `Size: ${formatBytes(details.responseBytes)}`,
    `Artifacts: ${details.artifactDirDisplay}`,
    `Raw response: ${details.rawPathDisplay}`,
    details.markdownPathDisplay ? `Markdown: ${details.markdownPathDisplay}` : "Markdown: conversion failed; see metadata for MarkItDown attempts.",
    `Metadata: ${details.metadataPathDisplay}`,
    details.markitdown.success ? `MarkItDown: success (${details.markitdown.command})` : `MarkItDown: failed (${details.markitdown.error ?? "unknown error"})`,
    `Context follow-up: use read on ${details.readTarget.pathDisplay}${formatReadTargetStats(details.readTarget)}`
  ];
  return lines.join(`
`);
}
function safeKeyHint2(keybinding, description) {
  try {
    return keyHint2(keybinding, description);
  } catch {
    return `(${description})`;
  }
}
function fallbackText(result) {
  const content = result.content?.[0];
  return content?.type === "text" ? content.text : "";
}
function renderSummary(details, theme) {
  const target = details.markdownPathDisplay ?? details.rawPathDisplay;
  const status = details.markdownPathDisplay ? "markdown" : "raw";
  const hint = safeKeyHint2("app.tools.expand", "to expand");
  return theme.fg("success", "fetch ") + theme.fg("accent", target) + theme.fg("dim", ` ${status}, ${formatBytes(details.responseBytes)} ${hint}`);
}
function fetch_default(pi) {
  pi.registerTool({
    name: "fetch",
    label: "fetch",
    description: "Fetch a URL, store the raw response under project-local .pi/fetch/, and attempt Markdown conversion with MarkItDown. " + "Returns the saved artifact paths instead of inlining the page body.",
    parameters: fetchSchema,
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      const url = params.url;
      const requestedFormat = params.format ?? "markdown";
      const timeoutSec = Math.min(params.timeout ?? 30, 120);
      if (!url.startsWith("http://") && !url.startsWith("https://")) {
        throw new Error("URL must start with http:// or https://");
      }
      if (!["text", "markdown", "html"].includes(requestedFormat)) {
        throw new Error("Format must be one of: text, markdown, html");
      }
      const controller = new AbortController;
      const timeout = setTimeout(() => controller.abort(), timeoutSec * 1000);
      if (signal) {
        signal.addEventListener("abort", () => controller.abort(), { once: true });
      }
      try {
        const response = await fetch(url, {
          signal: controller.signal,
          headers: { "User-Agent": "capy-tools/1.0" },
          redirect: "follow"
        });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status} ${response.statusText}`);
        }
        const contentLength = response.headers.get("content-length");
        if (contentLength && parseInt(contentLength, 10) > MAX_RESPONSE_BYTES) {
          throw new Error(`Response exceeds ${MAX_RESPONSE_BYTES / 1024 / 1024} MB limit`);
        }
        const buffer = Buffer.from(await response.arrayBuffer());
        if (buffer.byteLength > MAX_RESPONSE_BYTES) {
          throw new Error(`Response exceeds ${MAX_RESPONSE_BYTES / 1024 / 1024} MB limit`);
        }
        const contentType = response.headers.get("content-type") ?? "";
        const projectRoot = await ensureProjectRoot(ctx.cwd);
        const fetchRoot = join2(projectRoot, ".pi", "fetch");
        const artifact = await createArtifactDir(fetchRoot, buildFetchLabel(url));
        const rawFilename = `response${inferRawExtension(url, contentType)}`;
        const rawPath = join2(artifact.dir, rawFilename);
        const markdownPath = join2(artifact.dir, "content.md");
        const metadataPath = join2(artifact.dir, "meta.json");
        await writeFile(rawPath, buffer);
        const markitdown = await runMarkitdown(pi, rawPath, markdownPath, projectRoot, controller.signal, Math.max(timeoutSec * 1000, MARKITDOWN_TIMEOUT_MS));
        let readTarget;
        if (markitdown.success) {
          const markdownText = await readFile(markdownPath, "utf8");
          readTarget = {
            path: markdownPath,
            pathDisplay: toDisplayPath(projectRoot, markdownPath),
            kind: "markdown",
            ...summarizeTextForContext(markdownText)
          };
        } else if (isLikelyTextContentType(contentType)) {
          readTarget = {
            path: rawPath,
            pathDisplay: toDisplayPath(projectRoot, rawPath),
            kind: "raw-text",
            ...summarizeTextForContext(buffer.toString("utf8"))
          };
        } else {
          readTarget = {
            path: rawPath,
            pathDisplay: toDisplayPath(projectRoot, rawPath),
            kind: "raw-binary"
          };
        }
        const details = {
          id: artifact.id,
          url,
          contentType,
          responseBytes: buffer.byteLength,
          artifactDir: artifact.dir,
          artifactDirDisplay: toDisplayPath(projectRoot, artifact.dir),
          rawPath,
          rawPathDisplay: toDisplayPath(projectRoot, rawPath),
          markdownPath: markitdown.success ? markdownPath : undefined,
          markdownPathDisplay: markitdown.success ? toDisplayPath(projectRoot, markdownPath) : undefined,
          metadataPath,
          metadataPathDisplay: toDisplayPath(projectRoot, metadataPath),
          readTarget,
          markitdown
        };
        const metadata = {
          schemaVersion: FETCH_SCHEMA_VERSION,
          id: artifact.id,
          url,
          requestedFormat,
          fetchedAt: new Date().toISOString(),
          contentType,
          responseBytes: buffer.byteLength,
          paths: {
            artifactDir: artifact.dir,
            rawPath,
            markdownPath: markitdown.success ? markdownPath : undefined
          },
          recommendedRead: readTarget,
          converter: {
            name: "markitdown",
            success: markitdown.success,
            command: markitdown.command,
            error: markitdown.error,
            attempts: markitdown.attempts
          }
        };
        await writeFile(metadataPath, JSON.stringify(metadata, null, 2) + `
`, "utf8");
        return {
          content: [{ type: "text", text: buildResultText(details) }],
          details
        };
      } finally {
        clearTimeout(timeout);
      }
    },
    renderShell: "self",
    renderCall(args, theme, context) {
      return renderGroupedToolCall("fetch", args, theme, context, summarizeToolCall("fetch", args));
    },
    renderResult(result, { expanded, isPartial }, theme, context) {
      if (isPartial) {
        return new Text(theme.fg("warning", "Fetching..."), 0, 0);
      }
      const details = result.details;
      const fullText = fallbackText(result);
      if (!details)
        return new Text(fullText || theme.fg("error", "No output"), 0, 0);
      if (expanded)
        return new Text(fullText, 0, 0);
      if (!canGroupTool(context))
        return new Text(renderSummary(details, theme), 0, 0);
      return renderGroupedToolResult("fetch", result, { expanded, isPartial }, theme, context);
    }
  });
}
export {
  fetch_default as default
};
