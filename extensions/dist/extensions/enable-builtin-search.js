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

// extensions/enable-builtin-search.ts
import { createBashTool, createEditTool, createEditToolDefinition, createFindTool, createGrepTool, createLsTool, createReadTool, createWriteTool, createWriteToolDefinition, keyHint as keyHint2 } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";

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

// extensions/rtk.ts
import { spawnSync } from "node:child_process";
var rtkAvailable;
function hasRtk() {
  if (rtkAvailable !== undefined)
    return rtkAvailable;
  try {
    const result = spawnSync("rtk", ["--version"], { timeout: 2000, stdio: "pipe" });
    rtkAvailable = result.status === 0;
  } catch {
    rtkAvailable = false;
  }
  return rtkAvailable;
}
function rtkRewrite(command) {
  if (!hasRtk())
    return command;
  try {
    const result = spawnSync("rtk", ["rewrite", command], { timeout: 2000, stdio: "pipe" });
    if (result.status !== 1 && result.stdout) {
      const rewritten = result.stdout.toString().trim();
      if (rewritten)
        return rewritten;
    }
  } catch {}
  return command;
}
function rtkSpawnHook(context) {
  return { ...context, command: rtkRewrite(context.command) };
}

// extensions/enable-builtin-search.ts
var DEFAULT_BUILTINS = new Set(["read", "bash", "edit", "write"]);
var SEARCH_BUILTINS = ["grep", "find", "ls"];
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
function countNonEmptyLines(text) {
  return text.split(`
`).filter((line) => line.trim().length > 0).length;
}
function plural2(noun, count) {
  if (count === 1)
    return noun;
  if (noun === "match")
    return "matches";
  if (noun === "entry")
    return "entries";
  return `${noun}s`;
}
function renderSearchResult(label, noun, result, { expanded, isPartial }, theme) {
  if (isPartial)
    return new Text(theme.fg("warning", `${label}...`), 0, 0);
  const fullText = fallbackText(result);
  const count = countNonEmptyLines(fullText);
  const truncated = result.details?.truncation?.truncated || result.details?.matchLimitReached || result.details?.resultLimitReached || result.details?.entryLimitReached;
  const hint = safeKeyHint2("app.tools.expand", "to expand");
  const summary = count === 0 || /no matches|no files|empty/i.test(fullText) ? `No ${plural2(noun, 2)}` : `${label === "grep" ? "Search" : label === "find" ? "Find" : "List"} results`;
  return new Text(theme.fg("accent", summary) + theme.fg("dim", `${truncated ? `
truncated` : ""}
${hint}`), 0, 0);
}
function registerCompactBuiltInRenderers(pi) {
  const cwd = process.cwd();
  const read = createReadTool(cwd);
  const bash = createBashTool(cwd);
  const edit = createEditToolDefinition(cwd);
  const write = createWriteToolDefinition(cwd);
  const grep = createGrepTool(cwd);
  const find = createFindTool(cwd);
  const ls = createLsTool(cwd);
  pi.registerTool({
    name: "read",
    label: read.label,
    description: read.description,
    promptSnippet: read.promptSnippet,
    promptGuidelines: read.promptGuidelines,
    parameters: read.parameters,
    renderShell: "self",
    renderCall(args, theme, context) {
      return renderGroupedToolCall("read", args, theme, context, summarizeToolCall("read", args));
    },
    renderResult(result, options, theme, context) {
      if (!canGroupTool(context))
        return new Text(theme.fg("accent", "Read file"), 0, 0);
      return renderGroupedToolResult("read", result, options, theme, context);
    },
    async execute(toolCallId, params, signal, onUpdate, ctx) {
      return createReadTool(ctx.cwd).execute(toolCallId, params, signal, onUpdate);
    }
  });
  pi.registerTool({
    name: "bash",
    label: bash.label,
    description: bash.description,
    promptSnippet: bash.promptSnippet,
    promptGuidelines: bash.promptGuidelines,
    parameters: bash.parameters,
    renderShell: "self",
    renderCall(args, theme, context) {
      return renderGroupedToolCall("bash", args, theme, context, summarizeToolCall("bash", args));
    },
    renderResult(result, options, theme, context) {
      if (!canGroupTool(context))
        return new Text(theme.fg(result?.isError ? "error" : "accent", "Ran command"), 0, 0);
      return renderGroupedToolResult("bash", result, options, theme, context);
    },
    async execute(toolCallId, params, signal, onUpdate, ctx) {
      const options = hasRtk() ? { spawnHook: rtkSpawnHook } : undefined;
      return createBashTool(ctx.cwd, options).execute(toolCallId, params, signal, onUpdate);
    }
  });
  const forceExpanded = (context) => ({ ...context, expanded: true });
  pi.registerTool({
    name: "edit",
    label: edit.label,
    description: edit.description,
    promptSnippet: edit.promptSnippet,
    promptGuidelines: edit.promptGuidelines,
    parameters: edit.parameters,
    renderShell: "self",
    renderCall(args, theme, context) {
      return edit.renderCall(args, theme, forceExpanded(context));
    },
    renderResult(result, options, theme, context) {
      return edit.renderResult(result, { ...options, expanded: true }, theme, forceExpanded(context));
    },
    async execute(toolCallId, params, signal, onUpdate, ctx) {
      return createEditTool(ctx.cwd).execute(toolCallId, params, signal, onUpdate);
    }
  });
  pi.registerTool({
    name: "write",
    label: write.label,
    description: write.description,
    promptSnippet: write.promptSnippet,
    promptGuidelines: write.promptGuidelines,
    parameters: write.parameters,
    renderShell: "self",
    renderCall(args, theme, context) {
      return write.renderCall(args, theme, forceExpanded(context));
    },
    renderResult(result, options, theme, context) {
      return write.renderResult(result, { ...options, expanded: true }, theme, forceExpanded(context));
    },
    async execute(toolCallId, params, signal, onUpdate, ctx) {
      return createWriteTool(ctx.cwd).execute(toolCallId, params, signal, onUpdate);
    }
  });
  pi.registerTool({
    name: "grep",
    label: grep.label,
    description: grep.description,
    promptSnippet: grep.promptSnippet,
    promptGuidelines: grep.promptGuidelines,
    parameters: grep.parameters,
    renderShell: "self",
    renderCall(args, theme, context) {
      return renderGroupedToolCall("grep", args, theme, context, summarizeToolCall("grep", args));
    },
    renderResult(result, options, theme, context) {
      if (options.expanded || !canGroupTool(context))
        return renderSearchResult("grep", "match", result, options, theme);
      return renderGroupedToolResult("grep", result, options, theme, context);
    },
    async execute(toolCallId, params, signal, onUpdate, ctx) {
      return createGrepTool(ctx.cwd).execute(toolCallId, params, signal, onUpdate);
    }
  });
  pi.registerTool({
    name: "find",
    label: find.label,
    description: find.description,
    promptSnippet: find.promptSnippet,
    promptGuidelines: find.promptGuidelines,
    parameters: find.parameters,
    renderShell: "self",
    renderCall(args, theme, context) {
      return renderGroupedToolCall("find", args, theme, context, summarizeToolCall("find", args));
    },
    renderResult(result, options, theme, context) {
      if (options.expanded || !canGroupTool(context))
        return renderSearchResult("find", "path", result, options, theme);
      return renderGroupedToolResult("find", result, options, theme, context);
    },
    async execute(toolCallId, params, signal, onUpdate, ctx) {
      return createFindTool(ctx.cwd).execute(toolCallId, params, signal, onUpdate);
    }
  });
  pi.registerTool({
    name: "ls",
    label: ls.label,
    description: ls.description,
    promptSnippet: ls.promptSnippet,
    promptGuidelines: ls.promptGuidelines,
    parameters: ls.parameters,
    renderShell: "self",
    renderCall(args, theme, context) {
      return renderGroupedToolCall("ls", args, theme, context, summarizeToolCall("ls", args));
    },
    renderResult(result, options, theme, context) {
      if (options.expanded || !canGroupTool(context))
        return renderSearchResult("ls", "entry", result, options, theme);
      return renderGroupedToolResult("ls", result, options, theme, context);
    },
    async execute(toolCallId, params, signal, onUpdate, ctx) {
      return createLsTool(ctx.cwd).execute(toolCallId, params, signal, onUpdate);
    }
  });
}
function enableSearchBuiltins(pi) {
  const activeTools = pi.getActiveTools();
  if (!activeTools.some((name) => DEFAULT_BUILTINS.has(name)))
    return;
  const availableBuiltins = new Set(pi.getAllTools().filter((tool) => tool.sourceInfo.source === "builtin").map((tool) => tool.name));
  const nextTools = [...activeTools];
  for (const name of SEARCH_BUILTINS) {
    if (availableBuiltins.has(name) && !nextTools.includes(name)) {
      nextTools.push(name);
    }
  }
  if (nextTools.length !== activeTools.length) {
    pi.setActiveTools(nextTools);
  }
}
function enableBuiltinSearchExtension(pi) {
  installBasicToolGrouping(pi);
  registerCompactBuiltInRenderers(pi);
  pi.on("session_start", () => enableSearchBuiltins(pi));
  pi.on("resources_discover", () => enableSearchBuiltins(pi));
}
export {
  enableBuiltinSearchExtension as default
};
