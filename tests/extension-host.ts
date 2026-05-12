import { spawn } from "node:child_process";
import { mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export type RegisteredTool = {
  name: string;
  execute: (toolCallId: string, params: any, signal: AbortSignal | undefined, onUpdate: (result: any) => void, ctx: any) => Promise<any> | any;
  [key: string]: any;
};

type HostOptions = {
  cwd?: string;
  activeTools?: string[];
  allTools?: Array<{ name: string; sourceInfo: { source: string; path?: string } }>;
  ui?: any;
};

export type ExtensionHost = ReturnType<typeof createExtensionHost>;

export function builtinTool(name: string) {
  return { name, sourceInfo: { source: "builtin" } };
}

export function createExtensionHost(options: HostOptions = {}) {
  const tools = new Map<string, RegisteredTool>();
  const handlers = new Map<string, Function[]>();
  let activeTools = [...(options.activeTools ?? [])];
  let allTools = [...(options.allTools ?? [])];
  const cwd = options.cwd ?? process.cwd();
  const ui = options.ui ?? createDialogUi();

  const api = {
    registerTool(tool: RegisteredTool) {
      tools.set(tool.name, tool);
      if (!allTools.some((entry) => entry.name === tool.name)) {
        allTools.push({ name: tool.name, sourceInfo: { source: "extension", path: `test:${tool.name}` } });
      }
    },
    on(event: string, handler: Function) {
      const list = handlers.get(event) ?? [];
      list.push(handler);
      handlers.set(event, list);
    },
    exec: runRealCommand,
    getActiveTools() {
      return [...activeTools];
    },
    getAllTools() {
      return [...allTools];
    },
    setActiveTools(toolNames: string[]) {
      activeTools = [...toolNames];
    },
    registerCommand() {},
    registerShortcut() {},
    registerFlag() {},
    getFlag() {
      return undefined;
    },
    registerMessageRenderer() {},
    sendMessage() {},
    sendUserMessage() {},
    appendEntry() {},
    setSessionName() {},
    getSessionName() {
      return undefined;
    },
    setLabel() {},
    getCommands() {
      return [];
    },
  };

  return {
    api,
    cwd,
    ui,
    tools,
    handlers,
    get activeTools() {
      return activeTools;
    },
    setAllTools(next: Array<{ name: string; sourceInfo: { source: string; path?: string } }>) {
      allTools = [...next];
    },
    getTool(name: string) {
      const tool = tools.get(name);
      if (!tool) throw new Error(`Tool not registered: ${name}`);
      return tool;
    },
    async emit(event: string, payload: any = {}) {
      for (const handler of handlers.get(event) ?? []) {
        await handler(payload, { cwd, hasUI: true, ui });
      }
    },
    async runTool(name: string, params: any, runOptions: { cwd?: string; ui?: any; hasUI?: boolean; signal?: AbortSignal } = {}) {
      const tool = tools.get(name);
      if (!tool) throw new Error(`Tool not registered: ${name}`);
      const ctx = {
        cwd: runOptions.cwd ?? cwd,
        hasUI: runOptions.hasUI ?? true,
        ui: runOptions.ui ?? ui,
      };
      return await tool.execute("test-call", params, runOptions.signal, () => {}, ctx);
    },
  };
}

export function createDialogUi(options: { selectAnswers?: Array<string | undefined>; inputAnswers?: Array<string | undefined> } = {}) {
  const selectAnswers = [...(options.selectAnswers ?? [])];
  const inputAnswers = [...(options.inputAnswers ?? [])];
  return {
    async select(_title: string, choices: string[]) {
      if (selectAnswers.length > 0) return selectAnswers.shift();
      return choices[0];
    },
    async input() {
      if (inputAnswers.length > 0) return inputAnswers.shift();
      return "scripted answer";
    },
  };
}

export function createQuestionnaireUi(driver: (component: { handleInput: (data: string) => void; render?: (width: number) => string[] }) => void) {
  return {
    async custom(builder: Function) {
      const theme = createPlainTheme();
      const tui = { requestRender() {} };
      return await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("questionnaire test driver did not submit")), 2_000);
        const done = (value: unknown) => {
          clearTimeout(timeout);
          resolve(value);
        };
        const component = builder(tui, theme, {}, done);
        driver(component);
      });
    },
  };
}

function createPlainTheme() {
  const passthrough = (_name: string, text: string) => text;
  return {
    fg: passthrough,
    bg: passthrough,
    bold: (text: string) => text,
  };
}

async function runRealCommand(command: string, args: string[], options: { cwd?: string; signal?: AbortSignal; timeout?: number } = {}) {
  return await new Promise<{ code: number; killed: boolean; stdout: string; stderr: string }>((resolve) => {
    let stdout = "";
    let stderr = "";
    let killed = false;
    let settled = false;
    const finish = (result: { code: number; killed: boolean; stdout: string; stderr: string }) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      resolve(result);
    };

    const child = spawn(command, args, { cwd: options.cwd, env: process.env });
    const timer = options.timeout
      ? setTimeout(() => {
          killed = true;
          child.kill("SIGTERM");
        }, options.timeout)
      : undefined;

    options.signal?.addEventListener(
      "abort",
      () => {
        killed = true;
        child.kill("SIGTERM");
      },
      { once: true },
    );

    child.stdout?.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr?.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      finish({ code: 127, killed, stdout, stderr: `${stderr}${error.message}` });
    });
    child.on("close", (code) => {
      finish({ code: code ?? 1, killed, stdout, stderr });
    });
  });
}

export async function withTempDir<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const rawDir = await mkdtemp(join(tmpdir(), "pi-basic-tools-test-"));
  const dir = await realpath(rawDir);
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
