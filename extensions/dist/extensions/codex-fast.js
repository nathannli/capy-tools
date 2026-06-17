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

// extensions/capy-tools-config.ts
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { getAgentDir } from "@earendil-works/pi-coding-agent";
var CAPY_TOOLS_CONFIG_PATH = join(getAgentDir(), "capy-tools.json");
var LEGACY_WORKING_MESSAGE_CONFIG_PATH = join(getAgentDir(), "cat-whimsical.json");
var LEGACY_AUTO_COMPACT_CONFIG_PATH = join(getAgentDir(), "auto-compact-settings.json");
var LEGACY_PI_SETTINGS_PATH = join(getAgentDir(), "settings.json");
var LANGUAGE_LABELS = {
  en: "English",
  zh: "Chinese",
  ja: "Japanese",
  ko: "Korean"
};
var ALL_TOOL_IDS = [
  "fetch",
  "enable-builtin-search",
  "repo-map",
  "read-block",
  "symbol-outline",
  "apply-patch",
  "terminal-session",
  "ask-user",
  "ask-question",
  "ask-questionnaire",
  "sourcegraph",
  "recap",
  "message-shape-diagnostic",
  "auto-compact",
  "codex-fast",
  "capy-tools-settings",
  "command-history",
  "efforts",
  "codex-goal",
  "rtk",
  "thinking-steps",
  "todo",
  "showsignature",
  "working-message"
];
var DEFAULT_WORKING_MESSAGE_SETTINGS = {
  language: "en"
};
var DEFAULT_AUTO_COMPACT_CONFIG = {
  autoCompactPercent: 90,
  autoCompactTokenLimit: 0,
  keepRecentPercent: 15,
  strategy: "keep-recent"
};
var DEFAULT_CODEX_FAST_CONFIG = {
  enabled: false
};
var DEFAULT_TOOLS_CONFIG = Object.fromEntries(ALL_TOOL_IDS.map((id) => [id, true]));
var DEFAULT_CAPY_TOOLS_SETTINGS = {
  workingMessage: DEFAULT_WORKING_MESSAGE_SETTINGS,
  autoCompact: DEFAULT_AUTO_COMPACT_CONFIG,
  codexFast: DEFAULT_CODEX_FAST_CONFIG,
  tools: { ...DEFAULT_TOOLS_CONFIG }
};
var AUTO_COMPACT_PRESETS = [80, 85, 90, 95];
var KEEP_RECENT_PRESETS = [5, 10, 15, 20];
var STRATEGY_LABELS = {
  "keep-recent": "Keep recent only (default)",
  "keep-bookends": "Keep oldest + newest, compact middle",
  "summarize-all": "Summarize everything"
};
var currentSettings = structuredClone(DEFAULT_CAPY_TOOLS_SETTINGS);
function parseLanguage(value) {
  const normalized = value.trim().toLowerCase();
  if (normalized in LANGUAGE_LABELS)
    return normalized;
  const label = Object.entries(LANGUAGE_LABELS).find(([, candidate]) => candidate.toLowerCase() === normalized);
  return label?.[0];
}
function loadLanguageLabel(language) {
  return LANGUAGE_LABELS[language];
}
function parsePercent(value, fallback) {
  if (typeof value !== "number" || !Number.isFinite(value))
    return fallback;
  return Math.max(0, Math.floor(value));
}
function parseStrategy(value) {
  return typeof value === "string" && value in STRATEGY_LABELS ? value : undefined;
}
function normalizeWorkingMessageSettings(value) {
  if (!value || typeof value !== "object")
    return { ...DEFAULT_WORKING_MESSAGE_SETTINGS };
  const language = typeof value.language === "string" ? parseLanguage(value.language) : undefined;
  return {
    language: language ?? DEFAULT_WORKING_MESSAGE_SETTINGS.language
  };
}
function normalizeAutoCompactConfig(value) {
  if (!value || typeof value !== "object")
    return { ...DEFAULT_AUTO_COMPACT_CONFIG };
  const raw = value;
  return {
    autoCompactPercent: parsePercent(raw.autoCompactPercent, DEFAULT_AUTO_COMPACT_CONFIG.autoCompactPercent),
    autoCompactTokenLimit: parsePercent(raw.autoCompactTokenLimit, DEFAULT_AUTO_COMPACT_CONFIG.autoCompactTokenLimit),
    keepRecentPercent: parsePercent(raw.keepRecentPercent, DEFAULT_AUTO_COMPACT_CONFIG.keepRecentPercent),
    strategy: parseStrategy(raw.strategy) ?? DEFAULT_AUTO_COMPACT_CONFIG.strategy
  };
}
function normalizeCodexFastConfig(value) {
  if (!value || typeof value !== "object")
    return { ...DEFAULT_CODEX_FAST_CONFIG };
  const enabled = value.enabled;
  return {
    enabled: typeof enabled === "boolean" ? enabled : DEFAULT_CODEX_FAST_CONFIG.enabled
  };
}
function normalizeToolsConfig(value) {
  const defaults = { ...DEFAULT_TOOLS_CONFIG };
  if (!value || typeof value !== "object")
    return defaults;
  const raw = value;
  for (const id of ALL_TOOL_IDS) {
    if (typeof raw[id] === "boolean") {
      defaults[id] = raw[id];
    }
  }
  return defaults;
}
function normalizeCapyToolsSettings(value) {
  if (!value || typeof value !== "object")
    return structuredClone(DEFAULT_CAPY_TOOLS_SETTINGS);
  const raw = value;
  return {
    workingMessage: normalizeWorkingMessageSettings(raw.workingMessage ?? value),
    autoCompact: normalizeAutoCompactConfig(raw.autoCompact),
    codexFast: normalizeCodexFastConfig(raw.codexFast),
    tools: normalizeToolsConfig(raw.tools)
  };
}
function normalizeLegacyCodexFastSettings(value) {
  if (!value || typeof value !== "object")
    return;
  const extensionSettings = value["pi-codex-fast"];
  if (!extensionSettings || typeof extensionSettings !== "object")
    return;
  return normalizeCodexFastConfig(extensionSettings);
}
async function readJson(path) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    return;
  }
}
async function writeSettings(settings) {
  await mkdir(dirname(CAPY_TOOLS_CONFIG_PATH), { recursive: true });
  await writeFile(CAPY_TOOLS_CONFIG_PATH, `${JSON.stringify(settings, null, 2)}
`, "utf8");
}
async function restoreCapyToolsSettings() {
  const unifiedRaw = await readJson(CAPY_TOOLS_CONFIG_PATH);
  const hasUnified = !!unifiedRaw && typeof unifiedRaw === "object";
  const unifiedObject = hasUnified ? unifiedRaw : undefined;
  let next = normalizeCapyToolsSettings(unifiedRaw);
  let shouldWrite = !hasUnified;
  if (!unifiedObject || unifiedObject.workingMessage === undefined) {
    const legacyWorkingMessage = await readJson(LEGACY_WORKING_MESSAGE_CONFIG_PATH);
    if (legacyWorkingMessage !== undefined) {
      next = {
        ...next,
        workingMessage: normalizeWorkingMessageSettings(legacyWorkingMessage)
      };
      shouldWrite = true;
    }
  }
  if (!unifiedObject || unifiedObject.autoCompact === undefined) {
    const legacyAutoCompact = await readJson(LEGACY_AUTO_COMPACT_CONFIG_PATH);
    if (legacyAutoCompact !== undefined) {
      next = {
        ...next,
        autoCompact: normalizeAutoCompactConfig(legacyAutoCompact)
      };
      shouldWrite = true;
    }
  }
  if (!unifiedObject || unifiedObject.codexFast === undefined) {
    const legacyPiSettings = await readJson(LEGACY_PI_SETTINGS_PATH);
    const legacyCodexFast = normalizeLegacyCodexFastSettings(legacyPiSettings);
    if (legacyCodexFast !== undefined) {
      next = {
        ...next,
        codexFast: legacyCodexFast
      };
      shouldWrite = true;
    }
  }
  currentSettings = next;
  if (shouldWrite)
    await writeSettings(currentSettings);
  return structuredClone(currentSettings);
}
function getCapyToolsSettings() {
  return structuredClone(currentSettings);
}
async function saveCapyToolsSettings(settings) {
  currentSettings = normalizeCapyToolsSettings(settings);
  await writeSettings(currentSettings);
  return structuredClone(currentSettings);
}
async function updateCapyToolsSettings(updater) {
  return await saveCapyToolsSettings(updater(structuredClone(currentSettings)));
}

// extensions/codex-fast.ts
var STATUS_KEY = "capy-codex-fast";
var fastModeEnabled = false;
var priorityServiceTierSupported = false;
var activeModelLabel = "no active model";
var settingsWriteQueue = Promise.resolve();
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function supportsPriorityServiceTier(model) {
  return model?.provider === "openai" || model?.provider === "openai-codex";
}
function formatModelLabel(model) {
  return model ? `${model.provider ?? "unknown"}/${model.id ?? "unknown"}` : "no active model";
}
function refreshModelState(model) {
  priorityServiceTierSupported = supportsPriorityServiceTier(model);
  activeModelLabel = formatModelLabel(model);
}
function refreshModelStateFromContext(ctx) {
  try {
    refreshModelState(ctx.model);
  } catch {
    refreshModelState(undefined);
  }
}
function renderStatusText(ctx, text) {
  try {
    return ctx.ui.theme?.fg("accent", text) ?? text;
  } catch {
    return text;
  }
}
function updateStatus(ctx) {
  try {
    if (!ctx.hasUI)
      return;
    if (!fastModeEnabled) {
      ctx.ui.setStatus(STATUS_KEY, undefined);
      return;
    }
    const label = priorityServiceTierSupported ? "OpenAI fast mode" : "fast mode inactive";
    ctx.ui.setStatus(STATUS_KEY, renderStatusText(ctx, label));
  } catch {}
}
function notifyState(ctx) {
  try {
    if (!ctx.hasUI)
      return;
    if (!fastModeEnabled) {
      ctx.ui.notify("Fast mode disabled. OpenAI/OpenAI Codex requests will use the default service tier.", "info");
      return;
    }
    if (priorityServiceTierSupported) {
      ctx.ui.notify("Fast mode enabled. OpenAI/OpenAI Codex requests will send service_tier=priority.", "info");
      return;
    }
    ctx.ui.notify(`Fast mode enabled. It will apply once you switch to an OpenAI or OpenAI Codex model (current: ${activeModelLabel}).`, "info");
  } catch {}
}
async function persistCodexFastConfig(config) {
  const settings = await updateCapyToolsSettings((current) => ({
    ...current,
    codexFast: {
      ...current.codexFast,
      ...config
    }
  }));
  return settings.codexFast;
}
function formatCodexFastStatus() {
  return [
    `Enabled: ${fastModeEnabled ? "yes" : "no"}`,
    `Active model: ${activeModelLabel}`,
    `Current model supports priority tier: ${priorityServiceTierSupported ? "yes" : "no"}`
  ].join(`
`);
}
function setCodexFastEnabled(enabled, ctx, options = {}) {
  fastModeEnabled = enabled;
  if (options.persist !== false) {
    settingsWriteQueue = settingsWriteQueue.catch(() => {
      return;
    }).then(async () => {
      await persistCodexFastConfig({ enabled });
    });
    settingsWriteQueue.catch((error) => {
      try {
        if (!ctx.hasUI)
          return;
        const message = error instanceof Error ? error.message : String(error);
        ctx.ui.notify(`codex-fast: failed to write settings: ${message}`, "warning");
      } catch {}
    });
  }
  updateStatus(ctx);
  if (options.notify !== false)
    notifyState(ctx);
}
async function reloadFastModeState(pi, ctx, options = {}) {
  refreshModelStateFromContext(ctx);
  await settingsWriteQueue.catch(() => {
    return;
  });
  await restoreCapyToolsSettings();
  fastModeEnabled = getCapyToolsSettings().codexFast.enabled;
  if (options.includeStartupFlag === true && pi.getFlag("fast") === true) {
    fastModeEnabled = true;
  }
  updateStatus(ctx);
}
function codexFastExtension(pi) {
  pi.registerFlag("fast", {
    description: "Start with fast mode enabled (adds service_tier=priority to OpenAI/OpenAI Codex requests)",
    type: "boolean",
    default: false
  });
  pi.registerCommand("codex-fast", {
    description: "Toggle OpenAI/OpenAI Codex priority service tier",
    handler: async (_args, ctx) => {
      setCodexFastEnabled(!fastModeEnabled, ctx);
    }
  });
  pi.on("session_start", async (_event, ctx) => {
    await reloadFastModeState(pi, ctx, { includeStartupFlag: true });
  });
  pi.on("model_select", async (event, ctx) => {
    refreshModelState(event.model);
    updateStatus(ctx);
  });
  pi.on("before_provider_request", (event) => {
    if (!fastModeEnabled || !priorityServiceTierSupported || !isRecord(event.payload)) {
      return;
    }
    if (Object.prototype.hasOwnProperty.call(event.payload, "service_tier")) {
      return;
    }
    return {
      ...event.payload,
      service_tier: "priority"
    };
  });
}
export {
  setCodexFastEnabled,
  persistCodexFastConfig,
  formatCodexFastStatus,
  codexFastExtension as default
};
