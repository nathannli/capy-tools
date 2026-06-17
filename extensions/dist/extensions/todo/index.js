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

// extensions/todo/state.ts
var EMPTY_STATE = { tasks: [], nextId: 1 };
var state = { tasks: [...EMPTY_STATE.tasks], nextId: EMPTY_STATE.nextId };
function getState() {
  return state;
}
function replaceState(next) {
  state = next;
}
function commitState(next) {
  state = next;
}
var VALID_TRANSITIONS = {
  pending: new Set(["in_progress", "completed", "deleted"]),
  in_progress: new Set(["pending", "completed", "deleted"]),
  completed: new Set(["deleted"]),
  deleted: new Set
};
function isTransitionValid(from, to) {
  if (from === to)
    return true;
  return VALID_TRANSITIONS[from].has(to);
}
function detectCycle(taskList, taskId, newBlockedBy) {
  const edges = new Map;
  for (const t of taskList) {
    if (t.id === taskId) {
      const merged = new Set([...t.blockedBy ?? [], ...newBlockedBy]);
      edges.set(t.id, [...merged]);
    } else {
      edges.set(t.id, t.blockedBy ? [...t.blockedBy] : []);
    }
  }
  const visiting = new Set;
  const visited = new Set;
  const hasCycleFrom = (node) => {
    if (visiting.has(node))
      return true;
    if (visited.has(node))
      return false;
    visiting.add(node);
    for (const nb of edges.get(node) ?? []) {
      if (hasCycleFrom(nb))
        return true;
    }
    visiting.delete(node);
    visited.add(node);
    return false;
  };
  for (const node of edges.keys()) {
    if (hasCycleFrom(node))
      return true;
  }
  return false;
}
function deriveBlocks(taskList) {
  const blocks = new Map;
  for (const t of taskList) {
    for (const dep of t.blockedBy ?? []) {
      const arr = blocks.get(dep) ?? [];
      arr.push(t.id);
      blocks.set(dep, arr);
    }
  }
  return blocks;
}
function selectVisibleTasks(state2) {
  return state2.tasks.filter((t) => t.status !== "deleted");
}
function selectTasksByStatus(state2) {
  const visible = selectVisibleTasks(state2);
  return {
    pending: visible.filter((t) => t.status === "pending"),
    inProgress: visible.filter((t) => t.status === "in_progress"),
    completed: visible.filter((t) => t.status === "completed")
  };
}
function selectTodoCounts(state2) {
  const groups = selectTasksByStatus(state2);
  return {
    total: groups.pending.length + groups.inProgress.length + groups.completed.length,
    pending: groups.pending.length,
    inProgress: groups.inProgress.length,
    completed: groups.completed.length
  };
}
function selectShowTaskIds(state2) {
  return selectVisibleTasks(state2).some((t) => t.blockedBy && t.blockedBy.length > 0);
}
function selectTaskSubjectById(state2, id) {
  return state2.tasks.find((t) => t.id === id)?.subject;
}
function selectHasActive(state2) {
  return selectVisibleTasks(state2).some((t) => t.status === "in_progress" || t.status === "pending");
}
function selectOverlayLayout(state2, budget) {
  const all = selectVisibleTasks(state2);
  if (all.length <= budget) {
    return { visible: all, hiddenCompleted: 0, truncatedTail: 0 };
  }
  const innerBudget = budget - 1;
  const nonCompleted = all.filter((t) => t.status !== "completed");
  const totalCompleted = all.length - nonCompleted.length;
  if (nonCompleted.length <= innerBudget) {
    const kept = new Set(nonCompleted);
    for (const t of all) {
      if (kept.size >= innerBudget)
        break;
      if (t.status === "completed")
        kept.add(t);
    }
    const visible2 = all.filter((t) => kept.has(t));
    const shownCompleted = visible2.filter((t) => t.status === "completed").length;
    return { visible: visible2, hiddenCompleted: totalCompleted - shownCompleted, truncatedTail: 0 };
  }
  const visible = nonCompleted.slice(0, innerBudget);
  const truncatedTail = nonCompleted.length - innerBudget;
  return { visible, hiddenCompleted: totalCompleted, truncatedTail };
}
function errorResult(state2, message) {
  return { state: state2, op: { kind: "error", message } };
}
function applyTaskMutation(state2, action, params) {
  switch (action) {
    case "create": {
      if (!params.subject?.trim()) {
        return errorResult(state2, "subject required for create");
      }
      if (params.blockedBy?.length) {
        for (const dep of params.blockedBy) {
          const depTask = state2.tasks.find((t) => t.id === dep);
          if (!depTask)
            return errorResult(state2, `blockedBy: #${dep} not found`);
          if (depTask.status === "deleted")
            return errorResult(state2, `blockedBy: #${dep} is deleted`);
        }
      }
      const newTask = {
        id: state2.nextId,
        subject: params.subject,
        status: "pending"
      };
      if (params.description)
        newTask.description = params.description;
      if (params.activeForm)
        newTask.activeForm = params.activeForm;
      if (params.blockedBy?.length)
        newTask.blockedBy = [...params.blockedBy];
      if (params.owner)
        newTask.owner = params.owner;
      if (params.metadata)
        newTask.metadata = { ...params.metadata };
      const newTasks = [...state2.tasks, newTask];
      return {
        state: { tasks: newTasks, nextId: state2.nextId + 1 },
        op: { kind: "create", taskId: newTask.id }
      };
    }
    case "update": {
      if (params.id === undefined)
        return errorResult(state2, "id required for update");
      const idx = state2.tasks.findIndex((t) => t.id === params.id);
      if (idx === -1)
        return errorResult(state2, `#${params.id} not found`);
      const current = state2.tasks[idx];
      const hasMutation = params.subject !== undefined || params.description !== undefined || params.activeForm !== undefined || params.status !== undefined || params.owner !== undefined || params.metadata !== undefined || params.addBlockedBy && params.addBlockedBy.length > 0 || params.removeBlockedBy && params.removeBlockedBy.length > 0;
      if (!hasMutation)
        return errorResult(state2, "update requires at least one mutable field");
      let newStatus = current.status;
      if (params.status !== undefined) {
        if (!isTransitionValid(current.status, params.status)) {
          return errorResult(state2, `illegal transition ${current.status} → ${params.status}`);
        }
        newStatus = params.status;
      }
      let newBlockedBy = current.blockedBy ? [...current.blockedBy] : [];
      if (params.removeBlockedBy?.length) {
        const toRemove = new Set(params.removeBlockedBy);
        newBlockedBy = newBlockedBy.filter((dep) => !toRemove.has(dep));
      }
      if (params.addBlockedBy?.length) {
        for (const dep of params.addBlockedBy) {
          if (dep === current.id)
            return errorResult(state2, `cannot block #${current.id} on itself`);
          const depTask = state2.tasks.find((t) => t.id === dep);
          if (!depTask)
            return errorResult(state2, `addBlockedBy: #${dep} not found`);
          if (depTask.status === "deleted")
            return errorResult(state2, `addBlockedBy: #${dep} is deleted`);
          if (!newBlockedBy.includes(dep))
            newBlockedBy.push(dep);
        }
        if (detectCycle(state2.tasks, current.id, newBlockedBy)) {
          return errorResult(state2, "addBlockedBy would create a cycle in the blockedBy graph");
        }
      }
      let newMetadata = current.metadata;
      if (params.metadata !== undefined) {
        const merged = { ...current.metadata ?? {} };
        for (const [k, v] of Object.entries(params.metadata)) {
          if (v === null)
            delete merged[k];
          else
            merged[k] = v;
        }
        newMetadata = Object.keys(merged).length ? merged : undefined;
      }
      const updated = { ...current, status: newStatus };
      if (params.subject !== undefined)
        updated.subject = params.subject;
      if (params.description !== undefined)
        updated.description = params.description;
      if (params.activeForm !== undefined)
        updated.activeForm = params.activeForm;
      if (params.owner !== undefined)
        updated.owner = params.owner;
      if (newBlockedBy.length)
        updated.blockedBy = newBlockedBy;
      else
        delete updated.blockedBy;
      if (newMetadata === undefined)
        delete updated.metadata;
      else
        updated.metadata = newMetadata;
      const newTasks = [...state2.tasks];
      newTasks[idx] = updated;
      return {
        state: { tasks: newTasks, nextId: state2.nextId },
        op: { kind: "update", id: updated.id, fromStatus: current.status, toStatus: newStatus }
      };
    }
    case "list": {
      return {
        state: state2,
        op: {
          kind: "list",
          includeDeleted: params.includeDeleted === true,
          ...params.status !== undefined ? { statusFilter: params.status } : {}
        }
      };
    }
    case "get": {
      if (params.id === undefined)
        return errorResult(state2, "id required for get");
      const task = state2.tasks.find((t) => t.id === params.id);
      if (!task)
        return errorResult(state2, `#${params.id} not found`);
      return { state: state2, op: { kind: "get", task } };
    }
    case "delete": {
      if (params.id === undefined)
        return errorResult(state2, "id required for delete");
      const idx = state2.tasks.findIndex((t) => t.id === params.id);
      if (idx === -1)
        return errorResult(state2, `#${params.id} not found`);
      const current = state2.tasks[idx];
      if (current.status === "deleted")
        return errorResult(state2, `#${current.id} is already deleted`);
      const updated = { ...current, status: "deleted" };
      const newTasks = [...state2.tasks];
      newTasks[idx] = updated;
      return {
        state: { tasks: newTasks, nextId: state2.nextId },
        op: { kind: "delete", id: updated.id, subject: updated.subject }
      };
    }
    case "clear": {
      const count = state2.tasks.length;
      return {
        state: { tasks: [], nextId: 1 },
        op: { kind: "clear", count }
      };
    }
  }
}

// extensions/todo/replay.ts
function isTaskDetails(value) {
  if (!value || typeof value !== "object")
    return false;
  const v = value;
  return Array.isArray(v.tasks) && typeof v.nextId === "number";
}
function replayFromBranch(ctx) {
  let result = { tasks: [...EMPTY_STATE.tasks], nextId: EMPTY_STATE.nextId };
  for (const entry of ctx.sessionManager.getBranch()) {
    const e = entry;
    if (e.type !== "message")
      continue;
    const msg = e.message;
    if (!msg || msg.role !== "toolResult" || msg.toolName !== "todo")
      continue;
    if (!isTaskDetails(msg.details))
      continue;
    result = {
      tasks: msg.details.tasks.map((t) => ({ ...t })),
      nextId: msg.details.nextId
    };
  }
  return result;
}

// extensions/todo/render.ts
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
  const state2 = getPatchState();
  state2.refCount += 1;
  if (!state2.cleanup) {
    const installPromise = state2.installPromise ?? installPatch();
    if (!state2.installPromise)
      state2.installPromise = installPromise;
    try {
      state2.cleanup = await installPromise;
    } catch (error) {
      state2.refCount = Math.max(0, state2.refCount - 1);
      throw error;
    } finally {
      if (state2.installPromise === installPromise)
        state2.installPromise = undefined;
    }
  }
  let released = false;
  return async () => {
    if (released)
      return;
    released = true;
    state2.refCount = Math.max(0, state2.refCount - 1);
    if (state2.refCount > 0)
      return;
    const cleanup = state2.cleanup;
    if (!cleanup)
      return;
    state2.cleanup = undefined;
    try {
      cleanup();
    } catch (error) {
      state2.cleanup = cleanup;
      state2.refCount += 1;
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
function getState2() {
  const existing = globalThis[STATE_KEY];
  if (existing && typeof existing === "object") {
    const state2 = existing;
    if (!Array.isArray(state2.patchReleases))
      state2.patchReleases = [];
    return state2;
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
var state2 = getState2();
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
    const parentItem = state2.itemsByCallId.get(parent);
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
  const parentItem = state2.itemsByCallId.get(toolCallId);
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
  if (state2.currentGroup)
    state2.currentGroup.open = false;
  state2.currentGroup = undefined;
}
function createGroup(firstToolCallId) {
  const group = {
    id: state2.nextGroupId++,
    items: [],
    open: true,
    headToolCallId: firstToolCallId,
    visibleToolCallId: firstToolCallId,
    version: 0
  };
  state2.groups.set(group.id, group);
  state2.currentGroup = group;
  return group;
}
function getOrCreateItem(toolName, toolCallId, summary) {
  const existing = state2.itemsByCallId.get(toolCallId);
  if (existing) {
    existing.summary = mergeSummary(existing.summary, summary);
    return existing;
  }
  if (state2.currentGroup?.open && state2.currentGroup.items.length >= MAX_GROUP_ITEMS) {
    closeCurrentGroup();
  }
  const group = state2.currentGroup?.open ? state2.currentGroup : createGroup(toolCallId);
  const previousVisible = state2.itemsByCallId.get(group.visibleToolCallId);
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
  state2.itemsByCallId.set(toolCallId, item);
  bumpGroup(group);
  return item;
}
function groupFor(item) {
  return state2.groups.get(item.groupId);
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
  if (state2.installed || typeof pi.on !== "function")
    return;
  state2.installed = true;
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
      const existing = state2.itemsByCallId.get(String(part.id));
      if (existing) {
        sequenceGroup = groupFor(existing);
        state2.currentGroup = sequenceGroup?.open ? sequenceGroup : undefined;
        existing.summary = mergeSummary(existing.summary, summarizeToolCall(part.name, part.arguments ?? {}));
        bumpGroup(sequenceGroup);
        previousWasBasic = true;
        continue;
      }
      if (sequenceGroup?.open) {
        state2.currentGroup = sequenceGroup;
      } else if (state2.currentGroup?.open) {
        sequenceGroup = state2.currentGroup;
      } else {
        state2.currentGroup = undefined;
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
    retainToolExecutionPatch().then((release) => state2.patchReleases.push(release)).catch((error) => console.warn(`Capy Tools basic-tool-grouping: tool-execution patch unavailable (${error instanceof Error ? error.message : String(error)})`));
  }
  pi.on("session_shutdown", async () => {
    const release = state2.patchReleases.pop();
    if (!release)
      return;
    try {
      await release();
    } catch (error) {
      state2.patchReleases.push(release);
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

// extensions/todo/types.ts
import { StringEnum } from "@earendil-works/pi-ai";
import { Type } from "@sinclair/typebox";
var TOOL_NAME = "todo";
var TOOL_LABEL = "Todo";
var TodoParamsSchema = Type.Object({
  action: StringEnum(["create", "update", "list", "get", "delete", "clear"]),
  subject: Type.Optional(Type.String({ description: "Task subject line (required for create)" })),
  description: Type.Optional(Type.String({ description: "Long-form task description" })),
  activeForm: Type.Optional(Type.String({
    description: "Present-continuous spinner label shown while status is in_progress (e.g. 'writing tests')"
  })),
  status: Type.Optional(StringEnum(["pending", "in_progress", "completed", "deleted"], {
    description: "Target status (update) or list filter (list)"
  })),
  blockedBy: Type.Optional(Type.Array(Type.Number(), {
    description: "Initial blockedBy ids (create only)"
  })),
  addBlockedBy: Type.Optional(Type.Array(Type.Number(), {
    description: "Task ids to add to blockedBy (update only, additive merge)"
  })),
  removeBlockedBy: Type.Optional(Type.Array(Type.Number(), {
    description: "Task ids to remove from blockedBy (update only, additive merge)"
  })),
  owner: Type.Optional(Type.String({ description: "Agent/owner assigned to this task" })),
  metadata: Type.Optional(Type.Record(Type.String(), Type.Unknown(), {
    description: "Arbitrary metadata; pass null value for a key to delete that key on update"
  })),
  id: Type.Optional(Type.Number({
    description: "Task id (required for update, get, delete)"
  })),
  includeDeleted: Type.Optional(Type.Boolean({
    description: "If true, list action returns deleted (tombstoned) tasks as well. Default: false."
  }))
});
function formatStatusLabel(status) {
  switch (status) {
    case "pending":
      return "pending";
    case "in_progress":
      return "in progress";
    case "completed":
      return "completed";
    case "deleted":
      return "deleted";
  }
}

// extensions/todo/render.ts
function pickSubject(args, state3) {
  if (typeof args.subject === "string" && args.subject.trim())
    return args.subject;
  if (typeof args.id === "number")
    return selectTaskSubjectById(state3, args.id);
  return;
}
function summarizeTodoCall(args, state3) {
  const subject = pickSubject(args, state3);
  switch (args.action) {
    case "create":
      return { title: "Added", target: subject, role: "plan" };
    case "update": {
      if (args.status === "in_progress")
        return { title: "Started", target: subject, role: "plan" };
      if (args.status === "completed")
        return { title: "Done", target: subject, role: "plan" };
      if (args.status === "pending")
        return { title: "Reopened", target: subject, role: "plan" };
      if (args.status === "deleted")
        return { title: "Removed", target: subject, role: "plan" };
      return { title: "Updated", target: subject, role: "plan" };
    }
    case "delete":
      return { title: "Removed", target: subject, role: "plan" };
    case "get":
      return { title: "Read todo", target: subject, role: "plan" };
    case "list":
      return { title: "Listed todos", role: "plan" };
    case "clear":
      return { title: "Cleared todos", role: "plan" };
  }
}
function summarizeTodoResult(result, fallback) {
  const details = result.details;
  if (!details)
    return fallback;
  if (details.error)
    return { ...fallback, detail: details.error };
  switch (details.action) {
    case "create": {
      const created = details.tasks[details.tasks.length - 1];
      if (!created)
        return fallback;
      return { ...fallback, target: created.subject, detail: `#${created.id} ${formatStatusLabel(created.status)}` };
    }
    case "update": {
      const params = details.params;
      if (typeof params.id !== "number")
        return fallback;
      const updated = details.tasks.find((t) => t.id === params.id);
      if (!updated)
        return fallback;
      const target = updated.subject;
      const detail = params.status !== undefined ? `#${updated.id} → ${formatStatusLabel(updated.status)}` : `#${updated.id}`;
      return { ...fallback, target, detail };
    }
    case "delete": {
      const params = details.params;
      if (typeof params.id !== "number")
        return fallback;
      return { ...fallback, detail: `#${params.id}` };
    }
    case "list": {
      const visible = details.tasks.filter((t) => t.status !== "deleted");
      return { ...fallback, detail: `${visible.length} todo${visible.length === 1 ? "" : "s"}` };
    }
    case "get": {
      const params = details.params;
      if (typeof params.id !== "number")
        return fallback;
      const task = details.tasks.find((t) => t.id === params.id);
      if (!task)
        return fallback;
      return { ...fallback, target: task.subject, detail: `#${task.id} ${formatStatusLabel(task.status)}` };
    }
    case "clear":
      return { ...fallback, detail: `${details.tasks.length} remaining` };
  }
}
function renderStandaloneCall(args, theme, state3) {
  const summary = summarizeTodoCall(args, state3);
  const verb = summary.title ?? args.action;
  const target = summary.target ? ` ${summary.target}` : "";
  return new Text(theme.fg("muted", `${verb}${target}`), 0, 0);
}
function renderStandaloneResult(result, theme, fallback) {
  const summary = summarizeTodoResult(result, fallback);
  const verb = summary.title ?? "Done";
  const target = summary.target ? ` ${summary.target}` : "";
  const detail = summary.detail ? theme.fg("muted", ` · ${summary.detail}`) : "";
  const headlineColor = result.isError ? "error" : "muted";
  return new Text(theme.fg(headlineColor, `${verb}${target}`) + detail, 0, 0);
}
function renderTodoCall(args, theme, context, state3) {
  const summary = summarizeTodoCall(args, state3);
  if (!canGroupTool(context))
    return renderStandaloneCall(args, theme, state3);
  return renderGroupedToolCall(TOOL_NAME, args, theme, context, summary);
}
function renderTodoResult(args, result, options, theme, context, state3) {
  const callSummary = summarizeTodoCall(args, state3);
  const resultSummary = summarizeTodoResult(result, callSummary);
  if (!canGroupTool(context))
    return renderStandaloneResult(result, theme, callSummary);
  return renderGroupedToolResult(TOOL_NAME, result, options, theme, context, resultSummary);
}
function formatListLine(t) {
  const block = t.blockedBy?.length ? ` ⛓ ${t.blockedBy.map((id) => `#${id}`).join(",")}` : "";
  const form = t.status === "in_progress" && t.activeForm ? ` (${t.activeForm})` : "";
  return `[${t.status}] #${t.id} ${t.subject}${form}${block}`;
}
function formatGetLines(task, state3) {
  const blocks = deriveBlocks(state3.tasks).get(task.id) ?? [];
  const lines = [`#${task.id} [${task.status}] ${task.subject}`];
  if (task.description)
    lines.push(`  description: ${task.description}`);
  if (task.activeForm)
    lines.push(`  activeForm: ${task.activeForm}`);
  if (task.blockedBy?.length) {
    lines.push(`  blockedBy: ${task.blockedBy.map((id) => `#${id}`).join(", ")}`);
  }
  if (blocks.length) {
    lines.push(`  blocks: ${blocks.map((id) => `#${id}`).join(", ")}`);
  }
  if (task.owner)
    lines.push(`  owner: ${task.owner}`);
  return lines.join(`
`);
}
function formatToolContent(op, state3) {
  switch (op.kind) {
    case "create": {
      const t = state3.tasks.find((x) => x.id === op.taskId);
      if (!t)
        return `Created #${op.taskId}`;
      return `Created #${t.id}: ${t.subject} (pending)`;
    }
    case "update": {
      const transition = op.fromStatus !== op.toStatus ? ` (${op.fromStatus} → ${op.toStatus})` : "";
      return `Updated #${op.id}${transition}`;
    }
    case "delete":
      return `Deleted #${op.id}: ${op.subject}`;
    case "clear":
      return `Cleared ${op.count} tasks`;
    case "list": {
      let view = state3.tasks;
      if (!op.includeDeleted)
        view = view.filter((t) => t.status !== "deleted");
      if (op.statusFilter)
        view = view.filter((t) => t.status === op.statusFilter);
      return view.length === 0 ? "No tasks" : view.map(formatListLine).join(`
`);
    }
    case "get":
      return formatGetLines(op.task, state3);
    case "error":
      return `Error: ${op.message}`;
  }
}
function buildTodoToolResult(action, params, state3, op) {
  const text = formatToolContent(op, state3);
  const details = {
    action,
    params,
    tasks: state3.tasks,
    nextId: state3.nextId,
    ...op.kind === "error" ? { error: op.message } : {}
  };
  return { content: [{ type: "text", text }], details };
}

// extensions/todo/overlay.ts
import { truncateToWidth as truncateToWidth3 } from "@earendil-works/pi-tui";
var WIDGET_KEY = "capy-tools-todos";
var MAX_WIDGET_LINES = 12;
function overlayStatusGlyph(status, theme) {
  switch (status) {
    case "pending":
      return theme.fg("muted", "○");
    case "in_progress":
      return theme.fg("warning", "◐");
    case "completed":
      return theme.fg("success", "✓");
    case "deleted":
      return theme.fg("error", "✗");
  }
}
function formatOverlayTaskLine(t, theme, showId) {
  const glyph = overlayStatusGlyph(t.status, theme);
  const subjectColor = t.status === "completed" || t.status === "deleted" ? "muted" : "text";
  let subject = theme.fg(subjectColor, t.subject);
  if (t.status === "completed" || t.status === "deleted") {
    subject = theme.strikethrough(subject);
  }
  let line = glyph;
  if (showId)
    line += ` ${theme.fg("accent", `#${t.id}`)}`;
  line += ` ${subject}`;
  if (t.status === "in_progress" && t.activeForm) {
    line += ` ${theme.fg("muted", `· ${t.activeForm}`)}`;
  }
  if (t.blockedBy && t.blockedBy.length > 0) {
    line += ` ${theme.fg("muted", `⛓ ${t.blockedBy.map((id) => `#${id}`).join(",")}`)}`;
  }
  return line;
}

class TodoOverlay {
  uiCtx;
  widgetRegistered = false;
  tui;
  completedTaskIdsPendingHide = new Set;
  hiddenCompletedTaskIds = new Set;
  lastNextId;
  setUICtx(ctx) {
    if (ctx !== this.uiCtx) {
      this.uiCtx = ctx;
      this.widgetRegistered = false;
      this.tui = undefined;
    }
  }
  update() {
    if (!this.uiCtx)
      return;
    const snapshot = this.getSnapshot();
    const visible = this.selectOverlayTasks(snapshot);
    if (visible.length === 0) {
      if (this.widgetRegistered) {
        this.uiCtx.setWidget(WIDGET_KEY, undefined);
        this.widgetRegistered = false;
        this.tui = undefined;
      }
      return;
    }
    if (!this.widgetRegistered) {
      this.uiCtx.setWidget(WIDGET_KEY, (tui, theme) => {
        this.tui = tui;
        return {
          render: (width) => this.renderWidget(theme, width),
          invalidate: () => {
            this.widgetRegistered = false;
            this.tui = undefined;
          }
        };
      }, { placement: "aboveEditor" });
      this.widgetRegistered = true;
    } else {
      this.tui?.requestRender();
    }
  }
  resetCompletedDisplayState() {
    this.completedTaskIdsPendingHide.clear();
    this.hiddenCompletedTaskIds.clear();
    this.lastNextId = undefined;
  }
  hideCompletedTasksFromPreviousTurn() {
    if (this.completedTaskIdsPendingHide.size === 0)
      return;
    for (const taskId of this.completedTaskIdsPendingHide) {
      this.hiddenCompletedTaskIds.add(taskId);
    }
    this.completedTaskIdsPendingHide.clear();
    this.tui?.requestRender();
  }
  getSnapshot() {
    const state3 = getState();
    if (this.lastNextId !== undefined && state3.nextId < this.lastNextId) {
      this.resetCompletedDisplayState();
    }
    this.lastNextId = state3.nextId;
    const completedTaskIds = new Set(state3.tasks.filter((task) => task.status === "completed").map((task) => task.id));
    for (const taskId of this.completedTaskIdsPendingHide) {
      if (!completedTaskIds.has(taskId))
        this.completedTaskIdsPendingHide.delete(taskId);
    }
    for (const taskId of this.hiddenCompletedTaskIds) {
      if (!completedTaskIds.has(taskId))
        this.hiddenCompletedTaskIds.delete(taskId);
    }
    return { tasks: [...state3.tasks], nextId: state3.nextId };
  }
  selectOverlayTasks(snapshot) {
    return snapshot.tasks.filter((task) => task.status !== "deleted" && !this.shouldHideCompletedTask(task));
  }
  shouldHideCompletedTask(task) {
    return task.status === "completed" && this.hiddenCompletedTaskIds.has(task.id);
  }
  renderWidget(theme, width) {
    const snapshot = this.getSnapshot();
    const overlayTasks = this.selectOverlayTasks(snapshot);
    if (overlayTasks.length === 0)
      return [];
    const overlayState = { tasks: overlayTasks, nextId: snapshot.nextId };
    const truncate = (line) => truncateToWidth3(line, width, "…");
    const counts = selectTodoCounts(overlayState);
    const hasActive = selectHasActive(overlayState);
    const showIds = selectShowTaskIds(overlayState);
    const headingColor = hasActive ? "accent" : "muted";
    const headingText = `Todos ${counts.completed}/${counts.total}`;
    const heading = truncate(theme.fg(headingColor, headingText));
    const lines = [heading];
    const layout = selectOverlayLayout(overlayState, MAX_WIDGET_LINES - 1);
    for (const task of layout.visible) {
      lines.push(truncate(`${theme.fg("muted", "•")} ${formatOverlayTaskLine(task, theme, showIds)}`));
    }
    const newlyDisplayedCompletedTaskIds = overlayTasks.filter((task) => task.status === "completed" && !this.completedTaskIdsPendingHide.has(task.id) && !this.hiddenCompletedTaskIds.has(task.id)).map((task) => task.id);
    for (const taskId of newlyDisplayedCompletedTaskIds) {
      this.completedTaskIdsPendingHide.add(taskId);
    }
    if (layout.hiddenCompleted === 0 && layout.truncatedTail === 0) {
      return lines;
    }
    const totalHidden = layout.hiddenCompleted + layout.truncatedTail;
    const overflowParts = [];
    if (layout.hiddenCompleted > 0)
      overflowParts.push(`${layout.hiddenCompleted} ${formatStatusLabel("completed")}`);
    if (layout.truncatedTail > 0)
      overflowParts.push(`${layout.truncatedTail} ${formatStatusLabel("pending")}`);
    const summary = overflowParts.length > 0 ? `+${totalHidden} more (${overflowParts.join(", ")})` : `+${totalHidden} more`;
    lines.push(truncate(`${theme.fg("muted", "•")} ${theme.fg("muted", summary)}`));
    return lines;
  }
  dispose() {
    if (this.uiCtx)
      this.uiCtx.setWidget(WIDGET_KEY, undefined);
    this.widgetRegistered = false;
    this.tui = undefined;
    this.uiCtx = undefined;
    this.resetCompletedDisplayState();
  }
}

// extensions/todo/index.ts
var PROMPT_SNIPPET = "Manage a task list to track multi-step progress";
var TODO_SYSTEM_PROMPT = [
  "Todo discipline:",
  "Use the `todo` tool immediately when the user gives you 3+ steps, a multi-task list, or any new set of instructions not yet captured.",
  "Skip it for single trivial requests and purely conversational turns.",
  "Before starting a task, mark it `in_progress`. The moment a task is done, mark it `completed` — never batch completions.",
  "Exactly one task is `in_progress` at a time."
].join(`
`);
var PROMPT_GUIDELINES = [
  "Use `todo` for complex work with 3+ steps, when the user gives you a list of tasks, or immediately after receiving new instructions to capture requirements. Skip it for single trivial tasks and purely conversational requests.",
  "When starting any task, mark it in_progress BEFORE beginning work. Mark it completed IMMEDIATELY when done — never batch completions. Exactly one task should be in_progress at a time.",
  "Never mark a task completed if tests are failing, the implementation is partial, or you hit unresolved errors — keep it in_progress and create a new task for the blocker instead.",
  "Task status is a 4-state machine: pending → in_progress → completed, plus deleted as a tombstone. Pass activeForm (present-continuous label, e.g. 'researching existing tool') when marking in_progress.",
  "Use blockedBy to express dependencies (A is blocked by B). On create, pass blockedBy as the initial set. On update, use addBlockedBy / removeBlockedBy (additive merge — do not resend the full array). Cycles are rejected.",
  "list hides tombstoned (deleted) tasks by default; pass includeDeleted:true to see them. Pass status to filter by a single status.",
  "Subject must be short and imperative (e.g. 'Research existing tool'); description is for long-form detail. activeForm is a present-continuous label shown while in_progress."
];
function todoExtension(pi) {
  let overlay;
  pi.on("before_agent_start", () => ({ systemPrompt: TODO_SYSTEM_PROMPT }));
  pi.registerTool({
    name: TOOL_NAME,
    label: TOOL_LABEL,
    description: "Manage a task list for tracking multi-step progress. Actions: create (new task), update (change status/fields/dependencies), list (all tasks, optionally filtered by status), get (single task details), delete (tombstone), clear (reset all). Status: pending → in_progress → completed, plus deleted tombstone. Use this to plan and track multi-step work like research, design, and implementation.",
    promptSnippet: PROMPT_SNIPPET,
    promptGuidelines: PROMPT_GUIDELINES,
    parameters: TodoParamsSchema,
    renderShell: "self",
    async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
      const action = params.action;
      const result = applyTaskMutation(getState(), action, params);
      commitState(result.state);
      return buildTodoToolResult(action, params, result.state, result.op);
    },
    renderCall(args, theme, context) {
      return renderTodoCall(args, theme, context, getState());
    },
    renderResult(result, options, theme, context) {
      const ctxArgs = context?.args;
      const args = ctxArgs ?? { action: "list" };
      return renderTodoResult(args, result, options, theme, context, getState());
    }
  });
  pi.on("session_start", async (_event, ctx) => {
    replaceState(replayFromBranch(ctx));
    if (ctx.hasUI) {
      overlay ??= new TodoOverlay;
      overlay.setUICtx(ctx.ui);
      overlay.resetCompletedDisplayState();
      overlay.update();
    }
  });
  pi.on("session_compact", async (_event, ctx) => {
    replaceState(replayFromBranch(ctx));
    overlay?.resetCompletedDisplayState();
    overlay?.update();
  });
  pi.on("session_tree", async (_event, ctx) => {
    replaceState(replayFromBranch(ctx));
    overlay?.resetCompletedDisplayState();
    overlay?.update();
  });
  pi.on("session_shutdown", async () => {
    overlay?.dispose();
    overlay = undefined;
  });
  pi.on("tool_execution_end", async (event) => {
    if (event.toolName !== TOOL_NAME || event.isError)
      return;
    overlay?.update();
  });
  pi.on("agent_start", async () => {
    overlay?.hideCompletedTasksFromPreviousTurn();
  });
}
export {
  todoExtension as default
};
