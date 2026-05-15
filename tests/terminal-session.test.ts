import { afterEach, describe, expect, test } from "bun:test";
import { chmod, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import terminalSessionExtension from "../extensions/terminal-session.ts";
import { createExtensionHost, withTempDir } from "./extension-host.ts";

function plainTheme() {
  return {
    fg: (_name: string, text: string) => text,
    bold: (text: string) => text,
  };
}

function renderComponent(component: { render: (width: number) => string[] }) {
  return component.render(200).map((line) => line.trimEnd()).join("\n");
}

function nodeCommand(script: string) {
  return `${JSON.stringify(process.execPath)} -e ${JSON.stringify(script)}`;
}

const cleanupSessions: Array<{ host: ReturnType<typeof createExtensionHost>; sessionId: number }> = [];

function trackSession(host: ReturnType<typeof createExtensionHost>, sessionId: number) {
  cleanupSessions.push({ host, sessionId });
  return sessionId;
}

async function stopSession(host: ReturnType<typeof createExtensionHost>, sessionId: number) {
  try {
    const result = await host.runTool("write_stdin", { session_id: sessionId, chars: "\u0003", yield_time_ms: 500 });
    if (result.details.status === "running") throw new Error(`terminal session ${sessionId} did not stop after SIGINT`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!/already|never created|expired/.test(message)) throw error;
  }
}

afterEach(async () => {
  const pending = cleanupSessions.splice(0, cleanupSessions.length);
  const errors: string[] = [];
  for (const item of pending) {
    try {
      await stopSession(item.host, item.sessionId);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }
  if (errors.length > 0) throw new Error(`terminal session cleanup failed:\n${errors.join("\n")}`);
});

describe("terminal sessions", () => {
  test("exec_command returns exit code for a command that finishes quickly", async () => {
    const host = createExtensionHost();
    terminalSessionExtension(host.api as any);

    const result = await host.runTool("exec_command", {
      cmd: nodeCommand("console.log('quick done')"),
      yield_time_ms: 500,
    });

    expect(result.details.status).toBe("exited");
    expect(result.details.exitCode).toBe(0);
    expect(result.details.sessionId).toBeUndefined();
    expect(result.details.output).toContain("quick done");
    expect(result.content[0].text).toContain("exit_code: 0");
  });

  test("exec_command returns a session id for a running command and write_stdin polls new output", async () => {
    const host = createExtensionHost();
    terminalSessionExtension(host.api as any);
    const script = [
      "console.log('ready')",
      "process.stdin.setEncoding('utf8')",
      "process.stdin.on('data', (data) => { console.log('echo:' + data.trim()) })",
      "setInterval(() => {}, 1000)",
    ].join(";");

    const started = await host.runTool("exec_command", {
      cmd: nodeCommand(script),
      yield_time_ms: 300,
    });
    const sessionId = trackSession(host, started.details.sessionId);
    try {
      expect(started.details.status).toBe("running");
      expect(sessionId).toEqual(expect.any(Number));
      expect(started.details.output).toContain("ready");

      const emptyPoll = await host.runTool("write_stdin", { session_id: sessionId, chars: "", yield_time_ms: 100 });
      expect(emptyPoll.details.action).toBe("poll");
      expect(emptyPoll.details.output).toBe("");

      const wrote = await host.runTool("write_stdin", { session_id: sessionId, chars: "hello\n", yield_time_ms: 300 });
      expect(wrote.details.action).toBe("write");
      expect(wrote.details.wroteBytes).toBe(6);
      expect(wrote.details.output).toContain("echo:hello");
    } finally {
      await stopSession(host, sessionId);
    }
  });

  test("write_stdin reports unknown sessions clearly", async () => {
    const host = createExtensionHost();
    terminalSessionExtension(host.api as any);

    await expect(host.runTool("write_stdin", { session_id: 999_999, chars: "" })).rejects.toThrow("terminal session 999999");
  });

  test("exec_command reports invalid workdirs without creating a session", async () => {
    await withTempDir(async (dir) => {
      const host = createExtensionHost({ cwd: dir });
      terminalSessionExtension(host.api as any);
      const missing = join(dir, "missing");

      const result = await host.runTool("exec_command", {
        cmd: nodeCommand("console.log('never runs')"),
        workdir: missing,
      });

      expect(result.details.status).toBe("error");
      expect(result.details.sessionId).toBeUndefined();
      expect(result.details.error).toContain("invalid workdir");
      expect(result.details.output).toBe("");
    });
  });

  test("multiple running sessions keep output isolated", async () => {
    const host = createExtensionHost();
    terminalSessionExtension(host.api as any);
    const script = [
      "const label = process.argv[1]",
      "console.log('ready:' + label)",
      "process.stdin.setEncoding('utf8')",
      "process.stdin.on('data', (data) => { console.log(label + ':' + data.trim()) })",
      "setInterval(() => {}, 1000)",
    ].join(";");

    const first = await host.runTool("exec_command", { cmd: `${nodeCommand(script)} first`, yield_time_ms: 300 });
    const second = await host.runTool("exec_command", { cmd: `${nodeCommand(script)} second`, yield_time_ms: 300 });
    const firstId = trackSession(host, first.details.sessionId);
    const secondId = trackSession(host, second.details.sessionId);

    try {
      const firstWrite = await host.runTool("write_stdin", { session_id: firstId, chars: "one\n", yield_time_ms: 300 });
      const secondWrite = await host.runTool("write_stdin", { session_id: secondId, chars: "two\n", yield_time_ms: 300 });

      expect(firstWrite.details.output).toContain("first:one");
      expect(firstWrite.details.output).not.toContain("second:two");
      expect(secondWrite.details.output).toContain("second:two");
      expect(secondWrite.details.output).not.toContain("first:one");
    } finally {
      await stopSession(host, firstId);
      await stopSession(host, secondId);
    }
  });

  test("collapsed and expanded render terminal session results", async () => {
    const host = createExtensionHost();
    terminalSessionExtension(host.api as any);
    const tool = host.getTool("exec_command");
    const result = await host.runTool("exec_command", {
      cmd: nodeCommand("console.log('render ready'); setInterval(() => {}, 1000)"),
      yield_time_ms: 300,
    });

    const call = renderComponent(tool.renderCall({ cmd: "node -e \"setInterval(() => {}, 1000)\"" }, plainTheme(), {}));
    expect(call).toContain("exec command node -e");
    const collapsed = renderComponent(tool.renderResult(result, { expanded: false, isPartial: false }, plainTheme(), {}));
    expect(collapsed).toContain("exec command #");
    expect(collapsed).toContain("running:");
    expect(collapsed).toContain("setInterval");
    expect(collapsed).toContain("render ready");
    expect(collapsed).toContain("(to expand)");
    const expanded = renderComponent(tool.renderResult(result, { expanded: true, isPartial: false }, plainTheme(), {}));
    expect(expanded).toContain("render ready");

    await stopSession(host, trackSession(host, result.details.sessionId));
  });

  test("output truncation is explicit", async () => {
    const host = createExtensionHost();
    terminalSessionExtension(host.api as any);
    const result = await host.runTool("exec_command", {
      cmd: nodeCommand("console.log('x'.repeat(200))"),
      yield_time_ms: 500,
      max_output_bytes: 40,
    });

    expect(result.details.status).toBe("exited");
    expect(result.details.truncated).toBe(true);
    expect(result.details.omittedBytes).toBeGreaterThan(0);
    expect(result.details.output).toContain("[... truncated ...]");
    expect(result.content[0].text).toContain("output_truncated: true");
  });

  test("polling after natural exit reports the terminal state", async () => {
    const host = createExtensionHost();
    terminalSessionExtension(host.api as any);
    const started = await host.runTool("exec_command", {
      cmd: nodeCommand("console.log('start'); setTimeout(() => { console.log('done'); process.exit(0) }, 120)"),
      yield_time_ms: 10,
    });
    const sessionId = trackSession(host, started.details.sessionId);
    expect(started.details.status).toBe("running");

    const final = await host.runTool("write_stdin", { session_id: sessionId, chars: "", yield_time_ms: 500 });
    expect(final.details.status).toBe("exited");
    expect(final.details.exitCode).toBe(0);
    expect(final.details.output).toContain("done");

    const tombstone = await host.runTool("write_stdin", { session_id: sessionId, chars: "", yield_time_ms: 10 });
    expect(tombstone.details.status).toBe("exited");
    expect(tombstone.details.exitCode).toBe(0);
    expect(tombstone.details.error).toContain("already exited");
  });

  test("exec_command can start in an existing workdir", async () => {
    await withTempDir(async (dir) => {
      const nested = join(dir, "nested");
      await mkdir(nested);
      const host = createExtensionHost({ cwd: dir });
      terminalSessionExtension(host.api as any);
      const result = await host.runTool("exec_command", {
        cmd: "pwd",
        workdir: nested,
        yield_time_ms: 500,
      });

      expect(result.details.status).toBe("exited");
      expect(result.details.output).toContain(nested);
    });
  });

  test("SIGINT interruption returns observable terminal state", async () => {
    const host = createExtensionHost();
    terminalSessionExtension(host.api as any);
    const started = await host.runTool("exec_command", {
      cmd: nodeCommand("console.log('interrupt-ready'); setInterval(() => {}, 1000)"),
      yield_time_ms: 300,
    });
    const sessionId = trackSession(host, started.details.sessionId);

    const stopped = await host.runTool("write_stdin", { session_id: sessionId, chars: "\u0003", yield_time_ms: 500 });
    expect(stopped.details.status).toBe("exited");
    expect(stopped.details.action).toBe("interrupt");
    expect(stopped.details.sessionId).toBe(sessionId);

    const tombstone = await host.runTool("write_stdin", { session_id: sessionId, chars: "", yield_time_ms: 10 });
    expect(tombstone.details.status).toBe("exited");
    expect(tombstone.details.error).toContain("already interrupted");
  });

  test("buffer trimming preserves new unread output after a large prior read", async () => {
    const host = createExtensionHost();
    terminalSessionExtension(host.api as any);
    const script = [
      "process.stdout.write('A'.repeat(600000) + 'READY\\n')",
      "process.stdin.setEncoding('utf8')",
      "process.stdin.on('data', () => { process.stdout.write('B'.repeat(100000) + 'DONE_B\\n') })",
      "setInterval(() => {}, 1000)",
    ].join(";");
    const started = await host.runTool("exec_command", {
      cmd: nodeCommand(script),
      yield_time_ms: 500,
      max_output_bytes: 1000,
    });
    const sessionId = trackSession(host, started.details.sessionId);

    try {
      expect(started.details.status).toBe("running");
      expect(started.details.bufferTruncated).toBe(true);

      const wrote = await host.runTool("write_stdin", {
        session_id: sessionId,
        chars: "go\n",
        yield_time_ms: 500,
        max_output_bytes: 120000,
      });

      expect(wrote.details.outputBytes).toBeGreaterThan(100000);
      expect(wrote.details.output).toContain("DONE_B");
      expect(wrote.details.output).toContain("BBBB");
    } finally {
      await stopSession(host, sessionId);
    }
  });

  test("abort after spawn force-terminates a SIGTERM-ignoring process without returning a session", async () => {
    const host = createExtensionHost();
    terminalSessionExtension(host.api as any);
    const controller = new AbortController();
    const script = [
      "console.log('abort-ready:' + process.pid)",
      "process.on('SIGTERM', () => { console.log('ignored-sigterm') })",
      "setInterval(() => {}, 1000)",
    ].join(";");
    const run = host.runTool("exec_command", {
      cmd: nodeCommand(script),
      yield_time_ms: 5000,
    }, { signal: controller.signal });

    setTimeout(() => controller.abort(), 100);
    const result = await run;

    expect(result.details.sessionId).toBeUndefined();
    expect(result.details.status).toBe("exited");
    expect(result.details.signal).toBe("SIGKILL");
    expect(result.details.error).toContain("cancelled");
    expect(result.details.output).toContain("abort-ready");
  });

  test("shell startup failures and permission denials exit without persistent session ids", async () => {
    await withTempDir(async (dir) => {
      const host = createExtensionHost({ cwd: dir });
      terminalSessionExtension(host.api as any);

      const missing = await host.runTool("exec_command", {
        cmd: "definitely-not-a-real-pi-basic-tools-command",
        yield_time_ms: 500,
      });
      expect(missing.details.status).toBe("exited");
      expect(missing.details.exitCode).not.toBe(0);
      expect(missing.details.sessionId).toBeUndefined();

      const script = join(dir, "not-executable.sh");
      await writeFile(script, "#!/bin/sh\necho should-not-run\n", "utf8");
      await chmod(script, 0o644);
      const denied = await host.runTool("exec_command", {
        cmd: JSON.stringify(script),
        yield_time_ms: 500,
      });
      expect(denied.details.status).toBe("exited");
      expect(denied.details.exitCode).not.toBe(0);
      expect(denied.details.sessionId).toBeUndefined();
      expect(denied.details.output).not.toContain("should-not-run");
    });
  });

  test("write_stdin renderer covers exited tombstone and error states", async () => {
    const host = createExtensionHost();
    terminalSessionExtension(host.api as any);
    const writeTool = host.getTool("write_stdin");
    const started = await host.runTool("exec_command", {
      cmd: nodeCommand("setTimeout(() => process.exit(0), 80)"),
      yield_time_ms: 10,
    });
    const sessionId = trackSession(host, started.details.sessionId);
    await host.runTool("write_stdin", { session_id: sessionId, chars: "", yield_time_ms: 300 });
    const tombstone = await host.runTool("write_stdin", { session_id: sessionId, chars: "", yield_time_ms: 10 });

    const call = renderComponent(writeTool.renderCall({ session_id: sessionId, chars: "" }, plainTheme(), {}));
    expect(call).toContain(`write stdin #${sessionId} poll:`);
    expect(call).toContain("setTimeout");
    const partial = renderComponent(writeTool.renderResult(tombstone, { expanded: false, isPartial: true }, plainTheme(), { args: { session_id: sessionId } }));
    expect(partial).toContain("write stdin:");
    expect(partial).toContain("setTimeout");
    const collapsed = renderComponent(writeTool.renderResult(tombstone, { expanded: false, isPartial: false }, plainTheme(), {}));
    expect(collapsed).toContain(`write stdin #${sessionId} poll exited 0`);
    expect(collapsed).toContain("setTimeout");
    expect(collapsed).toContain("no output");
    const expanded = renderComponent(writeTool.renderResult(tombstone, { expanded: true, isPartial: false }, plainTheme(), {}));
    expect(expanded).toContain("already exited");
  });
});
