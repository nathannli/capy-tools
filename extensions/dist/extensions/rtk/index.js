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

// extensions/rtk/index.ts
import { fileURLToPath } from "node:url";
import { isToolCallEventType } from "@earendil-works/pi-coding-agent";

// extensions/rtk/awareness.ts
var AWARENESS_TEXT = `# RTK — token-optimized CLI proxy

All shell commands executed through the \`bash\` tool are automatically rewritten
to use \`rtk\` before execution (for example, \`git status\` becomes \`rtk git
status\`). This is transparent and delivers 60-90% token savings on the
supported command categories: git, cargo, go/pytest/jest/vitest, tsc,
eslint/ruff/biome/prettier, docker/kubectl, aws, pnpm/pip, ls/find/grep/cat
variants, and more. LaTeX build commands (\`latexmk\`, \`xelatex\`, \`pdflatex\`,
etc.) are summarized locally: full transcripts go to \`.pi/rtk/latex/*.log\`,
while the agent sees only status, key diagnostics, and the log path.

The auto-rewrite only applies to the \`bash\` tool. The built-in \`read\`,
\`grep\`, \`glob\`, and \`list\` tools bypass this hook. When token-efficient
file inspection or code search matters, prefer invoking these through bash:
  rtk read <path>          # filtered file reading
  rtk grep <pattern> <path>
  rtk find <pattern> <dir>
  rtk ls <dir>

Meta commands are NOT auto-rewritten. Call them directly through the \`bash\`
tool when the user asks for analytics or when diagnosing rtk itself:
  rtk --version            # installed rtk version
  rtk gain                 # token savings summary
  rtk gain --history       # recent command-by-command savings
  rtk gain --graph         # ASCII graph of savings over time
  rtk discover             # opportunities that were missed
  rtk proxy <cmd>          # run a command raw, without filtering (debug)

Per-command opt-out: prefix a command with \`RTK_DISABLED=1\` to skip the
rewrite for that one invocation, for example
\`RTK_DISABLED=1 git status\`.
`;

// extensions/rtk/config.ts
var WIDGET_KEY = "rtk";
var STATUS_KEY = "rtk";
var MAX_WIDGET_LINES = 40;
var DEFAULT_TIMEOUT_MS = 2000;
function parsePositiveInt(raw, fallback) {
  if (!raw)
    return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}
function readConfig(env = process.env) {
  const askModeRaw = (env.PI_RTK_ASK_MODE ?? "auto").toLowerCase();
  const askMode = askModeRaw === "confirm" ? "confirm" : "auto";
  return {
    disabled: env.PI_RTK_DISABLED === "1",
    askMode,
    awareness: env.PI_RTK_AWARENESS !== "0",
    timeoutMs: parsePositiveInt(env.PI_RTK_TIMEOUT_MS, DEFAULT_TIMEOUT_MS),
    quiet: env.PI_RTK_QUIET === "1",
    latex: env.PI_RTK_LATEX !== "0"
  };
}
function clampLines(text, max) {
  const lines = text.split(/\r?\n/);
  if (lines.length <= max)
    return lines;
  const kept = lines.slice(0, max);
  kept.push(`… (${lines.length - max} more line(s) truncated)`);
  return kept;
}

// extensions/rtk/latex.ts
import { Buffer } from "node:buffer";
var DISABLE_RE = /(?:^|\s)(?:RTK_DISABLED=1|PI_RTK_LATEX=0)(?=\s|$)/;
var RUNNER_RE = /latex-runner\.mjs/;
var LATEX_COMMAND_RE = /(?:^|[;&|(){}]\s*)(?:(?:env\s+)?(?:[A-Za-z_][A-Za-z0-9_]*=(?:'[^']*'|"[^"]*"|\S+)\s+)*)?(?:\S*\/)?(?:latexmk|xelatex|pdflatex|lualatex|tectonic|bibtex|bibtex8|biber|makeindex|makeglossaries|xdvipdfmx)(?=$|[\s;&|(){}])/;
function isLatexCommand(command) {
  const trimmed = command.trim();
  if (!trimmed)
    return false;
  if (DISABLE_RE.test(trimmed))
    return false;
  if (RUNNER_RE.test(trimmed))
    return false;
  return LATEX_COMMAND_RE.test(trimmed);
}
function shellQuote(value) {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}
function buildLatexRewrite(command, runnerPath) {
  if (!runnerPath || !isLatexCommand(command))
    return null;
  const encoded = Buffer.from(command, "utf8").toString("base64url");
  return `node ${shellQuote(runnerPath)} ${shellQuote(encoded)}`;
}

// extensions/rtk/rewrite.ts
async function rewriteCommand(pi, command, options = {}) {
  const trimmed = command.trim();
  if (!trimmed)
    return { kind: "unchanged" };
  try {
    const result = await pi.exec("rtk", ["rewrite", command], {
      timeout: options.timeoutMs ?? 2000,
      signal: options.signal
    });
    if (result.killed)
      return { kind: "unchanged" };
    const rewritten = (result.stdout ?? "").trim();
    switch (result.code) {
      case 0: {
        if (!rewritten || rewritten === command)
          return { kind: "unchanged" };
        return { kind: "rewrite", command: rewritten };
      }
      case 3: {
        if (!rewritten || rewritten === command)
          return { kind: "unchanged" };
        return { kind: "ask", command: rewritten };
      }
      default:
        return { kind: "unchanged" };
    }
  } catch {
    return { kind: "unchanged" };
  }
}

// extensions/rtk/version.ts
var MIN_RTK_VERSION = { major: 0, minor: 23, patch: 0 };
function formatVersion(v) {
  return `${v.major}.${v.minor}.${v.patch}`;
}
function parseVersion(raw) {
  const match = /rtk\s+(\d+)\.(\d+)\.(\d+)/.exec(raw);
  if (!match)
    return;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3])
  };
}
function isAtLeast(actual, required) {
  if (actual.major !== required.major)
    return actual.major > required.major;
  if (actual.minor !== required.minor)
    return actual.minor > required.minor;
  return actual.patch >= required.patch;
}
async function checkRtkInstallation(pi, timeoutMs = 2000) {
  try {
    const result = await pi.exec("rtk", ["--version"], { timeout: timeoutMs });
    if (result.code !== 0 || result.killed) {
      return { kind: "not-installed" };
    }
    const parsed = parseVersion(result.stdout || result.stderr);
    if (!parsed) {
      return { kind: "unparseable", raw: (result.stdout || result.stderr).trim() };
    }
    if (!isAtLeast(parsed, MIN_RTK_VERSION)) {
      return {
        kind: "too-old",
        version: formatVersion(parsed),
        minVersion: formatVersion(MIN_RTK_VERSION)
      };
    }
    return { kind: "ok", version: formatVersion(parsed) };
  } catch {
    return { kind: "not-installed" };
  }
}

// extensions/rtk/index.ts
var LATEX_RUNNER_PATH = fileURLToPath(new URL("./latex-runner.mjs", import.meta.url));
async function rtkExtension(pi) {
  const config = readConfig();
  if (config.disabled) {
    pi.registerCommand("rtk", {
      description: "pi-rtk is disabled (PI_RTK_DISABLED=1).",
      handler: async (_args, ctx) => {
        ctx.ui.notify("pi-rtk is disabled (PI_RTK_DISABLED=1).", "info");
      }
    });
    return;
  }
  const probe = await checkRtkInstallation(pi, config.timeoutMs);
  let installed = probe.kind === "ok";
  let runtimeEnabled = installed;
  pi.on("session_start", async (_event, ctx) => {
    if (!ctx.hasUI)
      return;
    if (!config.quiet) {
      switch (probe.kind) {
        case "not-installed":
          ctx.ui.notify("pi-rtk: `rtk` is not installed or not on PATH. Install from https://github.com/rtk-ai/rtk — the extension is idle until then.", "warning");
          break;
        case "too-old":
          ctx.ui.notify(`pi-rtk: rtk ${probe.version} is below the required ${probe.minVersion}. Upgrade with "brew upgrade rtk" or "cargo install --git https://github.com/rtk-ai/rtk" — the extension is idle until then.`, "warning");
          break;
        case "unparseable":
          ctx.ui.notify(`pi-rtk: could not parse rtk version output (${probe.raw}). The extension is idle.`, "warning");
          break;
        case "ok":
          break;
      }
    }
    if (probe.kind === "ok") {
      ctx.ui.setStatus(STATUS_KEY, `rtk ${probe.version}`);
    }
  });
  pi.on("before_agent_start", (event) => {
    if (!runtimeEnabled || !config.awareness)
      return;
    return {
      systemPrompt: `${event.systemPrompt}

${AWARENESS_TEXT}`
    };
  });
  pi.on("tool_call", async (event, ctx) => {
    if (!runtimeEnabled)
      return;
    if (!isToolCallEventType("bash", event))
      return;
    const originalCommand = event.input.command;
    if (typeof originalCommand !== "string" || !originalCommand.trim())
      return;
    const outcome = await rewriteCommand(pi, originalCommand, {
      timeoutMs: config.timeoutMs,
      signal: ctx.signal
    });
    switch (outcome.kind) {
      case "unchanged": {
        if (config.latex) {
          const latexRewrite = buildLatexRewrite(originalCommand, LATEX_RUNNER_PATH);
          if (latexRewrite)
            event.input.command = latexRewrite;
        }
        return;
      }
      case "rewrite":
        event.input.command = outcome.command;
        return;
      case "ask": {
        if (config.askMode === "auto" || !ctx.hasUI) {
          event.input.command = outcome.command;
          return;
        }
        const ok = await ctx.ui.confirm("rtk ask-rule", `Rewrite command?

  from: ${originalCommand}
    to: ${outcome.command}`);
        if (ok)
          event.input.command = outcome.command;
        return;
      }
    }
  });
  pi.registerCommand("rtk", {
    description: "Run an rtk meta command (default: `rtk gain`). Subcommands: /rtk clear, /rtk on, /rtk off, /rtk status.",
    handler: async (args, ctx) => {
      const trimmed = (args ?? "").trim();
      if (trimmed === "clear") {
        ctx.ui.setWidget(WIDGET_KEY, undefined);
        return;
      }
      if (trimmed === "off") {
        runtimeEnabled = false;
        ctx.ui.setStatus(STATUS_KEY, "rtk off");
        ctx.ui.notify("pi-rtk: rewriting disabled for this session.", "info");
        return;
      }
      if (trimmed === "on") {
        if (!installed) {
          ctx.ui.notify("pi-rtk: cannot enable — rtk is not installed or too old.", "warning");
          return;
        }
        runtimeEnabled = true;
        if (probe.kind === "ok")
          ctx.ui.setStatus(STATUS_KEY, `rtk ${probe.version}`);
        ctx.ui.notify("pi-rtk: rewriting enabled.", "info");
        return;
      }
      if (trimmed === "status") {
        const state = runtimeEnabled ? "enabled" : "disabled";
        const version = probe.kind === "ok" ? `rtk ${probe.version}` : probe.kind === "too-old" ? `rtk ${probe.version} (too old, need ${probe.minVersion})` : probe.kind === "not-installed" ? "rtk not installed" : `rtk version unparseable (${probe.raw})`;
        ctx.ui.notify(`pi-rtk: ${state}; ${version}`, "info");
        return;
      }
      if (!installed) {
        ctx.ui.notify(probe.kind === "not-installed" ? "pi-rtk: `rtk` is not installed or not on PATH." : `pi-rtk: rtk is unavailable (${probe.kind}).`, "warning");
        return;
      }
      const argv = trimmed.length > 0 ? trimmed.split(/\s+/) : ["gain"];
      let result;
      try {
        result = await pi.exec("rtk", argv, { timeout: 15000 });
      } catch (err) {
        ctx.ui.notify(`pi-rtk: failed to run rtk ${argv.join(" ")}: ${err instanceof Error ? err.message : String(err)}`, "error");
        return;
      }
      const combined = [result.stdout, result.stderr].filter((s) => s && s.trim().length > 0).join(`
`);
      const body = combined.trimEnd();
      if (!body) {
        ctx.ui.notify(`pi-rtk: rtk ${argv.join(" ")} produced no output.`, "info");
        return;
      }
      const header = `$ rtk ${argv.join(" ")}`;
      const lines = [header, "", ...clampLines(body, MAX_WIDGET_LINES)];
      if (result.code !== 0) {
        lines.push("", `(exit code ${result.code})`);
      }
      ctx.ui.setWidget(WIDGET_KEY, lines);
    },
    getArgumentCompletions: (prefix) => {
      const items = [
        { value: "gain", label: "gain — token savings summary" },
        { value: "gain --history", label: "gain --history — recent commands" },
        { value: "gain --graph", label: "gain --graph — ASCII savings graph" },
        { value: "gain --daily", label: "gain --daily — day-by-day" },
        { value: "discover", label: "discover — missed opportunities" },
        { value: "session", label: "session — adoption across sessions" },
        { value: "--version", label: "--version — rtk version" },
        { value: "clear", label: "clear — hide the rtk widget" },
        { value: "on", label: "on — enable rewriting" },
        { value: "off", label: "off — disable rewriting" },
        { value: "status", label: "status — show extension state" }
      ];
      const filtered = items.filter((i) => i.value.startsWith(prefix));
      return filtered.length > 0 ? filtered : null;
    }
  });
}
export {
  rtkExtension as default
};
