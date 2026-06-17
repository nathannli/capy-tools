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

// extensions/efforts/config.ts
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
var STANDARD_LEVELS = ["off", "minimal", "low", "medium", "high", "xhigh"];
var STANDARD_LEVEL_SET = new Set(STANDARD_LEVELS);
function isStandardLevel(level) {
  if (typeof level !== "string")
    return false;
  return STANDARD_LEVEL_SET.has(level);
}
function getEffortConfigPath() {
  return join(homedir(), ".pi", "effort_levels.json");
}
function parseEffortConfig(raw, source) {
  if (raw === undefined || raw === null) {
    return { entries: [], source };
  }
  if (!Array.isArray(raw)) {
    return {
      entries: [],
      source,
      error: `effort_levels.json must be a JSON array (got ${typeof raw}).`
    };
  }
  const entries = [];
  for (let i = 0;i < raw.length; i++) {
    const item = raw[i];
    if (!item || typeof item !== "object")
      continue;
    const rec = item;
    if (typeof rec.provider !== "string" || !rec.provider)
      continue;
    if (typeof rec.model !== "string" || !rec.model)
      continue;
    if (!Array.isArray(rec.efforts))
      continue;
    const efforts = rec.efforts.filter((e) => typeof e === "string" && e.trim().length > 0).map((e) => e.trim());
    if (efforts.length === 0)
      continue;
    const mode = rec.mode === "replace" ? "replace" : "add";
    entries.push({
      provider: rec.provider,
      model: rec.model,
      efforts,
      mode
    });
  }
  return { entries, source };
}
function loadEffortConfig() {
  const path = getEffortConfigPath();
  if (!existsSync(path)) {
    return { entries: [], source: path };
  }
  try {
    const raw = readFileSync(path, "utf8");
    const trimmed = raw.trim();
    if (trimmed === "")
      return { entries: [], source: path };
    const parsed = JSON.parse(trimmed);
    return parseEffortConfig(parsed, path);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      entries: [],
      source: path,
      error: `Failed to read ${path}: ${message}`
    };
  }
}
function findEntryFor(config, provider, modelId) {
  if (!provider || !modelId)
    return;
  return config.entries.find((e) => e.provider === provider && e.model === modelId);
}
function computeEffortLevels(baseLevels, entry) {
  if (!entry)
    return [...baseLevels];
  if (entry.mode === "replace")
    return dedupePreserveOrder(entry.efforts);
  return dedupePreserveOrder([...baseLevels, ...entry.efforts]);
}
function dedupePreserveOrder(values) {
  const seen = new Set;
  const out = [];
  for (const v of values) {
    if (seen.has(v))
      continue;
    seen.add(v);
    out.push(v);
  }
  return out;
}

// extensions/efforts/patch.ts
import { AgentSession } from "@earendil-works/pi-coding-agent";
var PATCH_MARKER = "__piEffortsPatched__";
function applyAgentSessionPatch(getConfig) {
  const proto = AgentSession.prototype;
  if (proto[PATCH_MARKER])
    return;
  const original = proto.getAvailableThinkingLevels;
  if (typeof original !== "function") {
    return;
  }
  proto.getAvailableThinkingLevels = function patchedGetAvailableThinkingLevels() {
    const base = Array.from(original.call(this) ?? []);
    const model = this.model;
    if (!model || !model.provider || !model.id)
      return base;
    const config = getConfig();
    const entry = findEntryFor(config, model.provider, model.id);
    return computeEffortLevels(base, entry);
  };
  proto[PATCH_MARKER] = true;
}

// extensions/efforts/payload.ts
var MAX_REASONABLE_BUDGET = 1e6;
function asObject(value) {
  if (!value || typeof value !== "object")
    return;
  return value;
}
function parseNumericEffort(effort) {
  const trimmed = effort.trim();
  if (!/^\d+$/.test(trimmed))
    return;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n <= 0 || n > MAX_REASONABLE_BUDGET)
    return;
  return Math.floor(n);
}
function rewritePayload(payload, effort) {
  const result = { payload, rewrote: false, notes: [] };
  const obj = asObject(payload);
  if (!obj)
    return result;
  const reasoning = asObject(obj.reasoning);
  if (reasoning && "effort" in reasoning) {
    if (reasoning.effort !== effort) {
      reasoning.effort = effort;
      result.rewrote = true;
      result.notes.push(`reasoning.effort -> "${effort}"`);
    }
    if (!reasoning.summary) {
      reasoning.summary = "auto";
    }
    const include = obj.include;
    if (!Array.isArray(include)) {
      obj.include = ["reasoning.encrypted_content"];
    } else if (!include.includes("reasoning.encrypted_content")) {
      include.push("reasoning.encrypted_content");
    }
  }
  if ("reasoning_effort" in obj) {
    if (obj.reasoning_effort !== effort) {
      obj.reasoning_effort = effort;
      result.rewrote = true;
      result.notes.push(`reasoning_effort -> "${effort}"`);
    }
  }
  const outputConfig = asObject(obj.output_config);
  if (outputConfig && "effort" in outputConfig) {
    if (outputConfig.effort !== effort) {
      outputConfig.effort = effort;
      result.rewrote = true;
      result.notes.push(`output_config.effort -> "${effort}"`);
    }
  }
  const thinking = asObject(obj.thinking);
  if (thinking) {
    if ("effort" in thinking) {
      if (thinking.effort !== effort) {
        thinking.effort = effort;
        result.rewrote = true;
        result.notes.push(`thinking.effort -> "${effort}"`);
      }
    } else if ("budget_tokens" in thinking) {
      const numeric = parseNumericEffort(effort);
      if (numeric !== undefined && thinking.budget_tokens !== numeric) {
        thinking.budget_tokens = numeric;
        if (thinking.type !== "enabled")
          thinking.type = "enabled";
        result.rewrote = true;
        result.notes.push(`thinking.budget_tokens -> ${numeric}`);
      }
    }
  }
  result.payload = obj;
  return result;
}

// extensions/efforts/state.ts
import { existsSync as existsSync2, mkdirSync, readFileSync as readFileSync2, writeFileSync } from "node:fs";
import { homedir as homedir2 } from "node:os";
import { dirname, join as join2 } from "node:path";
var STATE_VERSION = 1;
function getStatePath() {
  return join2(homedir2(), ".pi", "effort_levels.state.json");
}
function modelKey(provider, model) {
  return `${provider}/${model}`;
}
function readStateFile() {
  const path = getStatePath();
  if (!existsSync2(path)) {
    return { version: STATE_VERSION, selections: {} };
  }
  try {
    const raw = readFileSync2(path, "utf8").trim();
    if (raw === "")
      return { version: STATE_VERSION, selections: {} };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return { version: STATE_VERSION, selections: {} };
    }
    const obj = parsed;
    const selections = obj.selections && typeof obj.selections === "object" ? obj.selections : {};
    const sanitized = {};
    for (const [k, v] of Object.entries(selections)) {
      if (typeof v === "string" && v.length > 0)
        sanitized[k] = v;
    }
    return { version: STATE_VERSION, selections: sanitized };
  } catch {
    return { version: STATE_VERSION, selections: {} };
  }
}
function writeStateFile(state) {
  const path = getStatePath();
  try {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify(state, null, 2) + `
`, "utf8");
  } catch {}
}
function getSavedEffort(provider, model) {
  if (!provider || !model)
    return;
  const state = readStateFile();
  return state.selections[modelKey(provider, model)];
}
function setSavedEffort(provider, model, effort) {
  if (!provider || !model)
    return;
  const state = readStateFile();
  state.selections[modelKey(provider, model)] = effort;
  writeStateFile(state);
}
function clearSavedEffort(provider, model) {
  if (!provider || !model)
    return;
  const state = readStateFile();
  const key = modelKey(provider, model);
  if (!(key in state.selections))
    return;
  delete state.selections[key];
  writeStateFile(state);
}

// extensions/efforts/index.ts
var STATUS_KEY = "pi-efforts";
var LOG_PREFIX = "[pi-efforts]";
var currentConfig = { entries: [], source: "" };
function refreshConfig() {
  currentConfig = loadEffortConfig();
  if (currentConfig.error) {
    console.warn(`${LOG_PREFIX} ${currentConfig.error}`);
  }
  return currentConfig;
}
function logRefresh() {
  if (currentConfig.entries.length === 0) {
    if (currentConfig.error)
      return;
    return;
  }
}
function isCustomEffortForModel(config, provider, modelId, level) {
  if (isStandardLevel(level))
    return false;
  const entry = findEntryFor(config, provider, modelId);
  if (!entry)
    return false;
  return entry.efforts.includes(level);
}
function updateStatus(pi, ctx) {
  if (!ctx.hasUI)
    return;
  const model = ctx.model;
  const level = pi.getThinkingLevel();
  if (!model || isStandardLevel(level)) {
    ctx.ui.setStatus(STATUS_KEY, undefined);
    return;
  }
  if (!isCustomEffortForModel(currentConfig, model.provider, model.id, level)) {
    ctx.ui.setStatus(STATUS_KEY, undefined);
    return;
  }
  ctx.ui.setStatus(STATUS_KEY, `effort: ${level}`);
}
function restoreEffortForModel(pi, ctx) {
  const model = ctx.model;
  if (!model)
    return;
  const entry = findEntryFor(currentConfig, model.provider, model.id);
  if (!entry)
    return;
  const saved = getSavedEffort(model.provider, model.id);
  if (!saved)
    return;
  if (!entry.efforts.includes(saved)) {
    clearSavedEffort(model.provider, model.id);
    return;
  }
  if (saved === pi.getThinkingLevel())
    return;
  try {
    pi.setThinkingLevel(saved);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`${LOG_PREFIX} failed to restore effort "${saved}" for ${model.provider}/${model.id}: ${message}`);
  }
}
function piEffortsExtension(pi) {
  refreshConfig();
  logRefresh();
  applyAgentSessionPatch(() => currentConfig);
  pi.on("session_start", async (_evt, ctx) => {
    refreshConfig();
    restoreEffortForModel(pi, ctx);
    updateStatus(pi, ctx);
  });
  pi.on("model_select", async (_evt, ctx) => {
    restoreEffortForModel(pi, ctx);
    updateStatus(pi, ctx);
  });
  pi.on("thinking_level_select", async (evt, ctx) => {
    const model = ctx.model;
    if (!model)
      return;
    const entry = findEntryFor(currentConfig, model.provider, model.id);
    const level = evt.level;
    if (!entry) {
      clearSavedEffort(model.provider, model.id);
      updateStatus(pi, ctx);
      return;
    }
    if (entry.efforts.includes(level) && !isStandardLevel(level)) {
      setSavedEffort(model.provider, model.id, level);
    } else if (isStandardLevel(level)) {
      clearSavedEffort(model.provider, model.id);
    }
    updateStatus(pi, ctx);
  });
  pi.on("before_provider_request", async (evt, ctx) => {
    const model = ctx.model;
    if (!model)
      return;
    const level = pi.getThinkingLevel();
    if (!isCustomEffortForModel(currentConfig, model.provider, model.id, level)) {
      return;
    }
    const { payload, rewrote } = rewritePayload(evt.payload, level);
    if (!rewrote)
      return;
    return payload;
  });
  pi.registerCommand("efforts-reload", {
    description: "Reload ~/.pi/effort_levels.json (pi-efforts).",
    async handler(_args, ctx) {
      const cfg = refreshConfig();
      const lines = [
        `pi-efforts reloaded ${cfg.entries.length} entr${cfg.entries.length === 1 ? "y" : "ies"} from ${cfg.source}.`
      ];
      if (cfg.error)
        lines.push(`Warning: ${cfg.error}`);
      for (const entry of cfg.entries) {
        lines.push(`  ${entry.provider}/${entry.model}  [${entry.mode}]  ${entry.efforts.join(", ")}`);
      }
      ctx.ui.notify(lines.join(`
`), cfg.error ? "warning" : "info");
      updateStatus(pi, ctx);
    }
  });
}
export {
  piEffortsExtension as default
};
