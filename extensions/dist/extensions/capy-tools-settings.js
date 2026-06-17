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

// extensions/auto-compact.ts
import { estimateTokens } from "@earendil-works/pi-coding-agent";
var estimateMessageTokens = estimateTokens;
var AUTO_COMPACT_FOLLOW_UP = {
  "pre-turn": "Auto-compact ran before this turn. Continue with the current task.",
  "mid-turn": "Auto-compact ran mid-turn. Continue executing the remaining work.",
  emergency: "Emergency auto-compact ran. Resume where we left off.",
  "session-resume": "Auto-compact ran on session resume. Continue with the active task."
};
var config = { ...DEFAULT_AUTO_COMPACT_CONFIG };
var pendingCompaction = false;
var lastEstimatedTokens = 0;
var truncationAppliedThisTurn = false;
var cachedContextWindow = 0;
var cachedAutoCompactLimit = 0;
var cachedKeepRecentTokens = 0;
function getAutoCompactConfig() {
  return { ...config };
}
async function restoreAutoCompactSettings() {
  const settings = await restoreCapyToolsSettings();
  applyConfig(settings.autoCompact);
  return getAutoCompactConfig();
}
async function persistAutoCompactConfig(overrides) {
  applyConfig(overrides);
  await updateCapyToolsSettings((settings) => ({ ...settings, autoCompact: { ...config } }));
  return getAutoCompactConfig();
}
function getAutoCompactRuntimeStatus(ctx) {
  if (ctx)
    updateCachedLimitsFromContext(ctx);
  const usage = ctx?.getContextUsage?.();
  const tokens = usage?.tokens ?? lastEstimatedTokens;
  const contextWindow = usage?.contextWindow ?? cachedContextWindow;
  const percent = usage?.percent ?? (contextWindow > 0 ? tokens / contextWindow * 100 : null);
  return {
    config: getAutoCompactConfig(),
    tokens,
    contextWindow,
    percent,
    autoCompactLimit: cachedAutoCompactLimit,
    keepRecentTokens: cachedKeepRecentTokens,
    pendingCompaction,
    truncationAppliedThisTurn
  };
}
function applyConfig(overrides) {
  config = { ...config, ...overrides };
  if (cachedContextWindow > 0) {
    cachedAutoCompactLimit = computeAutoCompactLimit(cachedContextWindow);
    cachedKeepRecentTokens = computeKeepRecentTokens(cachedContextWindow);
  }
}
function computeAutoCompactLimit(contextWindow) {
  if (config.autoCompactPercent > 0) {
    return Math.floor(contextWindow * config.autoCompactPercent / 100);
  }
  return config.autoCompactTokenLimit;
}
function computeKeepRecentTokens(contextWindow) {
  return Math.floor(contextWindow * config.keepRecentPercent / 100);
}
function updateCachedLimitsFromContext(ctx, contextWindowOverride) {
  const contextWindow = contextWindowOverride ?? ctx.model?.contextWindow ?? 200000;
  if (contextWindow !== cachedContextWindow) {
    cachedContextWindow = contextWindow;
  }
  cachedAutoCompactLimit = computeAutoCompactLimit(contextWindow);
  cachedKeepRecentTokens = computeKeepRecentTokens(contextWindow);
}
function getTokenUsage(ctx) {
  const usage = ctx.getContextUsage?.();
  if (usage?.contextWindow) {
    updateCachedLimitsFromContext(ctx, usage.contextWindow);
  } else {
    updateCachedLimitsFromContext(ctx);
  }
  return usage?.tokens ?? lastEstimatedTokens;
}
function estimateTotalTokens(messages) {
  let total = 0;
  for (const msg of messages)
    total += estimateMessageTokens(msg);
  return total;
}
function snapToUserBoundary(messages, rawIndex) {
  let idx = rawIndex;
  while (idx < messages.length) {
    if (messages[idx].role === "user")
      break;
    idx++;
  }
  return Math.min(idx, messages.length);
}
function findCutPointRecent(messages, keepTokens) {
  let accumulated = 0;
  for (let i = messages.length - 1;i >= 0; i--) {
    const tokens = estimateMessageTokens(messages[i]);
    if (accumulated + tokens > keepTokens) {
      return snapToUserBoundary(messages, i + 1);
    }
    accumulated += tokens;
  }
  return 0;
}
function findBookendCutRange(messages, keepTokens) {
  const halfBudget = Math.floor(keepTokens / 2);
  let headEnd = 0;
  let headTokens = 0;
  for (let i = 0;i < messages.length; i++) {
    const tokens = estimateMessageTokens(messages[i]);
    if (headTokens + tokens > halfBudget)
      break;
    headTokens += tokens;
    headEnd = i + 1;
  }
  headEnd = snapToUserBoundary(messages, headEnd);
  let tailStart = messages.length;
  let tailTokens = 0;
  for (let i = messages.length - 1;i >= headEnd; i--) {
    const tokens = estimateMessageTokens(messages[i]);
    if (tailTokens + tokens > halfBudget)
      break;
    tailTokens += tokens;
    tailStart = i;
  }
  while (tailStart > headEnd && messages[tailStart]?.role !== "user")
    tailStart--;
  tailStart = Math.max(tailStart, headEnd);
  if (tailStart <= headEnd)
    return [0, 0];
  return [headEnd, tailStart];
}
function applyTruncationStrategy(messages, keepTokens, strategy) {
  switch (strategy) {
    case "keep-recent": {
      const cutIndex = findCutPointRecent(messages, keepTokens);
      if (cutIndex <= 0)
        return null;
      const removed = messages.slice(0, cutIndex);
      const kept = messages.slice(cutIndex);
      return [createTruncationNotice(removed.length, estimateTotalTokens(removed)), ...kept];
    }
    case "keep-bookends": {
      const [removeStart, removeEnd] = findBookendCutRange(messages, keepTokens);
      if (removeStart >= removeEnd)
        return null;
      const removed = messages.slice(removeStart, removeEnd);
      return [
        ...messages.slice(0, removeStart),
        createTruncationNotice(removed.length, estimateTotalTokens(removed)),
        ...messages.slice(removeEnd)
      ];
    }
    case "summarize-all": {
      if (messages.length <= 1)
        return null;
      const lastUserIdx = messages.length - 1;
      const removed = messages.slice(0, lastUserIdx);
      return [createTruncationNotice(removed.length, estimateTotalTokens(removed)), messages[lastUserIdx]];
    }
  }
}
function createTruncationNotice(removedCount, removedTokens) {
  return {
    role: "user",
    content: [
      {
        type: "text",
        text: `[Context compacted: ${removedCount} earlier messages (~${Math.round(removedTokens / 1000)}K tokens) were summarized. Full context is preserved in session history. Continue with the current task.]`
      }
    ],
    timestamp: Date.now()
  };
}
function triggerAutoCompact(pi, ctx, phase, customInstructions) {
  if (pendingCompaction)
    return;
  pendingCompaction = true;
  ctx.compact({
    customInstructions,
    onComplete: () => {
      pendingCompaction = false;
      setImmediate(() => {
        if (ctx.isIdle())
          pi.sendUserMessage(AUTO_COMPACT_FOLLOW_UP[phase]);
      });
    },
    onError: () => {
      pendingCompaction = false;
    }
  });
}
function assistantMessageHasToolCalls(message) {
  if (message.role !== "assistant" || !("content" in message) || !Array.isArray(message.content))
    return false;
  return message.content.some((block) => {
    if (!block || typeof block !== "object")
      return false;
    const type = block.type;
    return type === "tool_use" || type === "toolCall";
  });
}
function formatAutoCompactStatus(ctx) {
  const status = getAutoCompactRuntimeStatus(ctx);
  const percent = status.percent ?? 0;
  return [
    "Auto-compact status:",
    `  Current tokens: ~${Math.round(status.tokens / 1000)}K`,
    `  Limit: ${Math.round(status.autoCompactLimit / 1000)}K (${status.config.autoCompactPercent}% of ${Math.round(status.contextWindow / 1000)}K)`,
    `  Usage: ${percent.toFixed(1)}%`,
    `  Keep recent: ${Math.round(status.keepRecentTokens / 1000)}K (${status.config.keepRecentPercent}%)`,
    `  Strategy: ${STRATEGY_LABELS[status.config.strategy]}`,
    `  Pending compaction: ${status.pendingCompaction}`,
    `  Truncation this turn: ${status.truncationAppliedThisTurn}`
  ].join(`
`);
}
function autoCompactExtension(pi) {
  pi.on("session_start", async (event, ctx) => {
    pendingCompaction = false;
    truncationAppliedThisTurn = false;
    lastEstimatedTokens = 0;
    await restoreAutoCompactSettings();
    if (event.reason === "resume" || event.reason === "fork") {
      const usage = ctx.getContextUsage?.();
      if (usage && usage.tokens !== null) {
        lastEstimatedTokens = usage.tokens;
        updateCachedLimitsFromContext(ctx, usage.contextWindow);
        if (usage.tokens >= cachedAutoCompactLimit) {
          triggerAutoCompact(pi, ctx, "session-resume");
        }
      }
    }
  });
  pi.on("turn_start", async (_event, ctx) => {
    truncationAppliedThisTurn = false;
    await restoreAutoCompactSettings();
    const tokens = getTokenUsage(ctx);
    if (tokens >= cachedAutoCompactLimit) {
      triggerAutoCompact(pi, ctx, "pre-turn", "Focus on preserving task context and recent work.");
    }
  });
  pi.on("context", async (event, ctx) => {
    const messages = event.messages;
    const estimatedTokens = estimateTotalTokens(messages);
    lastEstimatedTokens = estimatedTokens;
    updateCachedLimitsFromContext(ctx);
    if (estimatedTokens > cachedAutoCompactLimit && !pendingCompaction) {
      const newMessages = applyTruncationStrategy(messages, cachedKeepRecentTokens, config.strategy);
      if (newMessages) {
        truncationAppliedThisTurn = true;
        setImmediate(() => {
          triggerAutoCompact(pi, ctx, "emergency", "Emergency context truncation was applied. Generate a comprehensive summary.");
        });
        return { messages: newMessages };
      }
    }
    return;
  });
  pi.on("turn_end", async (event, ctx) => {
    if (!assistantMessageHasToolCalls(event.message))
      return;
    const tokens = getTokenUsage(ctx);
    if (tokens >= cachedAutoCompactLimit && !pendingCompaction) {
      triggerAutoCompact(pi, ctx, "mid-turn", "Mid-turn compaction: preserve current task context and tool call results.");
    }
  });
  pi.on("model_select", async (event) => {
    updateCachedLimitsFromContext({ model: { contextWindow: event.model?.contextWindow ?? 200000 } });
  });
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
async function persistCodexFastConfig(config2) {
  const settings = await updateCapyToolsSettings((current) => ({
    ...current,
    codexFast: {
      ...current.codexFast,
      ...config2
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

// extensions/capy-tools-settings.ts
function formatSettingsSummary() {
  const settings = getCapyToolsSettings();
  const enabledCount = Object.values(settings.tools).filter(Boolean).length;
  return [
    `Working message language: ${loadLanguageLabel(settings.workingMessage.language)}`,
    `Auto-compact threshold: ${settings.autoCompact.autoCompactPercent}%`,
    `Keep recent budget:     ${settings.autoCompact.keepRecentPercent}%`,
    `Strategy:               ${STRATEGY_LABELS[settings.autoCompact.strategy]}`,
    `Codex fast mode:        ${settings.codexFast.enabled ? "enabled" : "disabled"}`,
    `Tools enabled:          ${enabledCount}/${ALL_TOOL_IDS.length}`
  ].join(`
`);
}
async function setWorkingMessageLanguage(ctx, languageText) {
  const language = parseLanguage(languageText);
  if (!language) {
    ctx.ui.notify("Use English, Chinese, Japanese, Korean, or the short codes en, zh, ja, ko.", "warning");
    return false;
  }
  await updateCapyToolsSettings((settings) => ({ ...settings, workingMessage: { language } }));
  ctx.ui.notify(`Capy Tools language set to ${loadLanguageLabel(language)}.`, "info");
  return true;
}
async function openToolsMenu(ctx) {
  while (true) {
    const settings = getCapyToolsSettings();
    const lines = [];
    for (const id of ALL_TOOL_IDS) {
      const icon = settings.tools[id] ? "✅" : "❌";
      lines.push(`${icon} ${id}`);
    }
    const choice = await ctx.ui.select(`Tools

${lines.join(`
`)}

Select a tool to toggle, or Done.`, [...ALL_TOOL_IDS.map((id) => `${settings.tools[id] ? "Disable" : "Enable"} ${id}`), "Done"]);
    if (!choice || choice === "Done")
      return;
    const match = choice.match(/^(Enable|Disable) (.+)$/);
    if (!match)
      continue;
    const toolId = match[2];
    const enable = match[1] === "Enable";
    await updateCapyToolsSettings((s) => ({
      ...s,
      tools: { ...s.tools, [toolId]: enable }
    }));
    ctx.ui.notify(`Tool "${toolId}" ${enable ? "enabled" : "disabled"}. Restart pi or /reload for changes.`, "info");
  }
}
async function openSettingsMenu(ctx) {
  await restoreCapyToolsSettings();
  while (true) {
    const settings = getCapyToolsSettings();
    const choice = await ctx.ui.select(`Capy Tools settings

${formatSettingsSummary()}

What would you like to change?`, [
      `Working message language [${loadLanguageLabel(settings.workingMessage.language)}]`,
      `Auto-compact threshold [${settings.autoCompact.autoCompactPercent}%]`,
      `Keep recent budget [${settings.autoCompact.keepRecentPercent}%]`,
      `Compaction strategy [${settings.autoCompact.strategy}]`,
      `Codex fast mode [${settings.codexFast.enabled ? "enabled" : "disabled"}]`,
      "Tools (enable/disable individual tools)",
      "Auto-compact status",
      "Codex fast status",
      "Reset auto-compact defaults",
      "Done"
    ]);
    if (!choice || choice === "Done")
      return;
    if (choice.startsWith("Working message language")) {
      const picked = await ctx.ui.select("Working message language", ["English", "Chinese", "Japanese", "Korean"].map((label) => label === loadLanguageLabel(settings.workingMessage.language) ? `${label} ✓` : label));
      if (picked)
        await setWorkingMessageLanguage(ctx, picked.replace(/\s+✓$/, ""));
      continue;
    }
    if (choice.startsWith("Auto-compact threshold")) {
      const picked = await ctx.ui.select("Auto-compact threshold (% of context window)", AUTO_COMPACT_PRESETS.map((preset) => `${preset}%${preset === settings.autoCompact.autoCompactPercent ? " ✓" : ""}`));
      if (picked) {
        const autoCompactPercent = parseInt(picked, 10);
        if (!Number.isNaN(autoCompactPercent)) {
          await persistAutoCompactConfig({ autoCompactPercent });
          ctx.ui.notify(`Auto-compact threshold set to ${autoCompactPercent}%.`, "info");
        }
      }
      continue;
    }
    if (choice.startsWith("Keep recent budget")) {
      const picked = await ctx.ui.select("Keep recent budget (% of context window to preserve)", KEEP_RECENT_PRESETS.map((preset) => `${preset}%${preset === settings.autoCompact.keepRecentPercent ? " ✓" : ""}`));
      if (picked) {
        const keepRecentPercent = parseInt(picked, 10);
        if (!Number.isNaN(keepRecentPercent)) {
          await persistAutoCompactConfig({ keepRecentPercent });
          ctx.ui.notify(`Keep recent budget set to ${keepRecentPercent}%.`, "info");
        }
      }
      continue;
    }
    if (choice.startsWith("Compaction strategy")) {
      const strategies = Object.entries(STRATEGY_LABELS);
      const picked = await ctx.ui.select("Compaction strategy", strategies.map(([key, label]) => `${label}${key === settings.autoCompact.strategy ? " ✓" : ""}`));
      if (picked) {
        const entry = strategies.find(([, label]) => picked.startsWith(label));
        if (entry) {
          await persistAutoCompactConfig({ strategy: entry[0] });
          ctx.ui.notify(`Compaction strategy set to ${entry[1]}.`, "info");
        }
      }
      continue;
    }
    if (choice.startsWith("Codex fast mode")) {
      const next = !settings.codexFast.enabled;
      setCodexFastEnabled(next, ctx);
      continue;
    }
    if (choice.startsWith("Tools")) {
      await openToolsMenu(ctx);
      continue;
    }
    if (choice === "Auto-compact status") {
      ctx.ui.notify(formatAutoCompactStatus(ctx), "info");
      continue;
    }
    if (choice === "Codex fast status") {
      ctx.ui.notify(formatCodexFastStatus(), "info");
      continue;
    }
    if (choice === "Reset auto-compact defaults") {
      const ok = await ctx.ui.confirm("Reset auto-compact defaults?", "This resets only the auto-compact section. Working-message language is preserved.");
      if (ok) {
        await persistAutoCompactConfig({ ...DEFAULT_AUTO_COMPACT_CONFIG });
        ctx.ui.notify("Auto-compact settings reset to defaults.", "info");
      }
    }
  }
}
function capyToolsSettingsExtension(pi) {
  pi.registerCommand("capy-tools-settings", {
    description: "Open the Capy Tools settings panel.",
    getArgumentCompletions: (prefix) => {
      const values = [
        "settings",
        "status",
        "reset-auto-compact",
        "codex-fast on",
        "codex-fast off",
        "codex-fast toggle",
        "codex-fast status",
        "tools",
        ...ALL_TOOL_IDS.flatMap((id) => [`enable ${id}`, `disable ${id}`]),
        "en",
        "zh",
        "ja",
        "ko",
        "English",
        "Chinese",
        "Japanese",
        "Korean"
      ];
      return values.filter((value) => value.toLowerCase().startsWith(prefix.toLowerCase())).map((value) => ({ value }));
    },
    handler: async (args, ctx) => {
      await restoreCapyToolsSettings();
      const trimmed = args.trim();
      if (!trimmed || trimmed === "settings") {
        await openSettingsMenu(ctx);
        return;
      }
      if (trimmed === "status" || trimmed === "auto-compact status") {
        ctx.ui.notify(formatAutoCompactStatus(ctx), "info");
        return;
      }
      if (trimmed === "codex-fast status") {
        ctx.ui.notify(formatCodexFastStatus(), "info");
        return;
      }
      if (trimmed === "codex-fast on" || trimmed === "enable-codex-fast") {
        setCodexFastEnabled(true, ctx);
        return;
      }
      if (trimmed === "codex-fast off" || trimmed === "disable-codex-fast") {
        setCodexFastEnabled(false, ctx);
        return;
      }
      if (trimmed === "codex-fast toggle") {
        setCodexFastEnabled(!getCapyToolsSettings().codexFast.enabled, ctx);
        return;
      }
      if (trimmed === "tools") {
        await openToolsMenu(ctx);
        return;
      }
      const enableMatch = trimmed.match(/^enable (.+)$/i);
      if (enableMatch) {
        const toolId = enableMatch[1].trim();
        if (!ALL_TOOL_IDS.includes(toolId)) {
          ctx.ui.notify(`Unknown tool: ${toolId}`, "warning");
          return;
        }
        await updateCapyToolsSettings((s) => ({ ...s, tools: { ...s.tools, [toolId]: true } }));
        ctx.ui.notify(`Tool "${toolId}" enabled. Restart pi or /reload for changes.`, "info");
        return;
      }
      const disableMatch = trimmed.match(/^disable (.+)$/i);
      if (disableMatch) {
        const toolId = disableMatch[1].trim();
        if (!ALL_TOOL_IDS.includes(toolId)) {
          ctx.ui.notify(`Unknown tool: ${toolId}`, "warning");
          return;
        }
        await updateCapyToolsSettings((s) => ({ ...s, tools: { ...s.tools, [toolId]: false } }));
        ctx.ui.notify(`Tool "${toolId}" disabled. Restart pi or /reload for changes.`, "info");
        return;
      }
      if (trimmed === "reset-auto-compact" || trimmed === "auto-compact reset") {
        await persistAutoCompactConfig({ ...DEFAULT_AUTO_COMPACT_CONFIG });
        ctx.ui.notify("Auto-compact settings reset to defaults.", "info");
        return;
      }
      if (await setWorkingMessageLanguage(ctx, trimmed))
        return;
      ctx.ui.notify("Usage: /capy-tools-settings [settings|status|tools|enable <tool>|disable <tool>|codex-fast on|off|en|zh|ja|ko]", "warning");
    }
  });
}
export {
  capyToolsSettingsExtension as default
};
