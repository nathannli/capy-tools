# Lifecycle Experiments: Persistent Terminal Session Tools

Date: 2026-05-15
Agent: lifecycle validation agent
Scope: current `extensions/terminal-session.ts` implementation, exercised through the test extension host without modifying implementation code.

## Purpose

Validate runtime lifecycle behavior for the new `exec_command` / `write_stdin` tools:

- `exec_command` quick-exit versus still-running behavior.
- `write_stdin` polling after natural process exit.
- Ctrl-C cleanup through `write_stdin` with `chars: "\u0003"`.
- Whether shell/child/grandchild processes remain after cleanup.
- Abort behavior while `exec_command` is waiting to yield.

## Commands Run

```sh
npm test -- tests/terminal-session.test.ts
```

```sh
cat >/tmp/pi-terminal-lifecycle-experiments.ts <<'TS'
# temporary Bun script importing extensions/terminal-session.ts and tests/extension-host.ts
# exercised quick exit, running poll, natural exit poll, SIGINT, stubborn SIGINT handler, and AbortSignal
TS
bun /tmp/pi-terminal-lifecycle-experiments.ts
```

```sh
cat >/tmp/pi-terminal-tree-experiment.ts <<'TS'
# temporary Bun script importing extensions/terminal-session.ts and tests/extension-host.ts
# generated /tmp/pi-life-tree-*.sh/js helpers and checked ps/pgrep before and after Ctrl-C
TS
bun /tmp/pi-terminal-tree-experiment.ts
```

Temporary helper files were created only under `/tmp`. No implementation files were edited.

## Baseline Test Result

`npm test -- tests/terminal-session.test.ts` passed:

```text
9 pass
0 fail
39 expect() calls
Ran 9 tests across 1 file. [2.70s]
```

Pass/fail: PASS for the existing focused terminal-session test suite.

## Experiment Results

### 1. `exec_command` Quick Exit

Setup: run a Node one-liner that prints and exits, with `yield_time_ms: 500`.

Observed output:

```json
{
  "experiment": "quick exit",
  "details": {
    "status": "exited",
    "exitCode": 0,
    "signal": null,
    "output": "quick-exit-ok\\n",
    "outputBytes": 14,
    "truncated": false
  }
}
```

Pass/fail: PASS. A command that exits inside the initial yield returns `status: "exited"`, `exitCode: 0`, output, and no `sessionId`.

### 2. `exec_command` Running Session and Empty Poll

Setup: run a Node one-liner that prints readiness and stays alive, then poll with empty `chars`, then interrupt with Ctrl-C.

Observed output:

```json
{
  "experiment": "running session and empty poll",
  "start": {
    "status": "running",
    "sessionId": 2,
    "output": "running-ready\\n",
    "outputBytes": 14,
    "truncated": false
  },
  "poll": {
    "status": "running",
    "sessionId": 2,
    "action": "poll",
    "wroteBytes": 0,
    "output": "",
    "outputBytes": 0,
    "truncated": false
  },
  "stop": {
    "status": "exited",
    "sessionId": 2,
    "exitCode": null,
    "signal": "SIGINT",
    "action": "interrupt",
    "wroteBytes": 0,
    "output": "",
    "outputBytes": 0,
    "truncated": false
  }
}
```

Pass/fail: PASS. A still-running command returns a stable `sessionId`. Empty `write_stdin` polls only unread output. Ctrl-C reports an interrupt action and the process exits by `SIGINT` in this simple case.

### 3. `write_stdin` Polling After Natural Exit

Setup: start a command that prints after 150 ms and exits naturally. Initial `exec_command` used `yield_time_ms: 10`, then `write_stdin` polled with empty `chars` and `yield_time_ms: 1000`. A second poll was attempted after the first terminal-state poll.

Observed output:

```json
{
  "experiment": "poll after natural exit",
  "start": {
    "status": "running",
    "sessionId": 3,
    "output": "",
    "outputBytes": 0,
    "truncated": false
  },
  "finalPoll": {
    "status": "exited",
    "sessionId": 3,
    "exitCode": 0,
    "signal": null,
    "action": "poll",
    "wroteBytes": 0,
    "output": "natural-start\\nnatural-done\\n",
    "outputBytes": 27,
    "truncated": false
  },
  "secondPollError": "terminal session 3 was never created or has already been cleaned up"
}
```

Pass/fail: PARTIAL PASS. The first poll after natural exit reports the terminal state and final output correctly. The implementation deletes the session immediately afterward, so a later poll loses the known exited state and reports the generic never-created/already-cleaned-up error.

### 4. SIGINT Cleanup for Normal Descendants

Setup: start a shell script through `exec_command`; the script keeps a shell process alive, starts a Node child, and the child starts a Node grandchild. Each process includes a unique token. The experiment checked `pgrep`/`ps` before Ctrl-C and after `write_stdin` with `chars: "\u0003"`.

Observed output from the process-tree run:

```json
{
  "token": "pi-life-tree-55251-1778836265012",
  "started": {
    "status": "running",
    "sessionId": 1,
    "output": "shell-pid:55254:pi-life-tree-55251-1778836265012\\nchild-pid:55255:pi-life-tree-55251-1778836265012\\ngrandchild-pid:55256:pi-life-tree-55251-1778836265012\\n"
  },
  "before": {
    "pgrep": ["55254", "55255", "55256"],
    "ps": {
      "55254": "55254 55251 55254 Ss   /bin/sh /tmp/pi-life-tree-55251-1778836265012.sh pi-life-tree-55251-1778836265012",
      "55255": "55255 55254 55254 S    /Users/lucas/.asdf/installs/nodejs/25.9.0/bin/node /tmp/pi-life-tree-55251-1778836265012-child.js pi-life-tree-55251-1778836265012",
      "55256": "55256 55255 55254 S    /Users/lucas/.asdf/installs/nodejs/25.9.0/bin/node /tmp/pi-life-tree-55251-1778836265012-grand.js pi-life-tree-55251-1778836265012"
    }
  },
  "stopped": {
    "status": "exited",
    "sessionId": 1,
    "exitCode": 129,
    "signal": null,
    "action": "interrupt",
    "output": ""
  },
  "after": {
    "pgrep": [],
    "ps": { "55254": "", "55255": "", "55256": "" }
  }
}
```

Pass/fail: PASS on this macOS/POSIX run. The shell, child, and grandchild shared PGID `55254`; `write_stdin` Ctrl-C cleaned up the whole normal process group. No token-matched process remained after the interrupt.

Note: the terminal details reported `exitCode: 129` and `signal: null` for the shell-script case, while the simple Node case reported `exitCode: null` and `signal: "SIGINT"`. That difference is normal shell signal encoding, but consumers should not rely on one exact shape for interrupted shell commands.

### 5. SIGINT Cleanup Risk When Process Handles SIGINT

Setup: start a Node process that installs a `SIGINT` handler and intentionally keeps running. Send Ctrl-C through `write_stdin`, then check the process token. A manual `pkill -f` cleanup was used afterward for the temporary test process.

Observed output:

```json
{
  "experiment": "SIGINT cleanup risk, process handles SIGINT",
  "start": {
    "status": "running",
    "sessionId": 5,
    "output": "stubborn-pid:53709:pi-life-stubborn-53682-1778836161121\\n"
  },
  "beforeSigint": ["53709"],
  "sigint": {
    "status": "running",
    "sessionId": 5,
    "action": "interrupt",
    "wroteBytes": 0,
    "output": "ignored-sigint\\n"
  },
  "afterSigint": ["53709"],
  "afterManualCleanup": []
}
```

Pass/fail: FAIL for guaranteed cleanup. Ctrl-C is delivered, but if the command handles/ignores `SIGINT`, `write_stdin` returns `status: "running"` and leaves the session/process alive. This may be acceptable if Ctrl-C is specified as a cooperative interrupt, but it does not guarantee cleanup.

### 6. AbortSignal During Initial `exec_command` Wait

Setup: call `exec_command` with a long-running Node command and `yield_time_ms: 5000`, then abort the tool call after about 150 ms through `AbortController`.

Observed output:

```json
{
  "experiment": "AbortSignal during exec_command yield",
  "result": {
    "status": "exited",
    "exitCode": null,
    "signal": "SIGTERM",
    "output": "abort-pid:53715:pi-life-abort-53682-1778836162407\\n",
    "outputBytes": 50,
    "truncated": false
  },
  "afterAbort": []
}
```

Pass/fail: PASS for a cooperative/default-signal process. Aborting while `exec_command` is still waiting sends `SIGTERM`, returns an exited terminal state without a `sessionId`, and left no token-matched process behind in this run.

Timeout note: I did not find a hard command timeout in the tool surface. `yield_time_ms` controls how long the tool waits before returning a running session; it does not kill long-running commands. Abort is available via the tool-call signal during the initial wait.

## Risks Found

1. **Post-exit state is one-shot.** The first poll after natural exit reports terminal state, then the session is deleted. Subsequent polls get a generic missing/cleaned-up error rather than a distinct already-exited state.
2. **Ctrl-C is cooperative, not guaranteed cleanup.** Normal process groups on macOS cleaned up correctly, including shell/child/grandchild, but a process with a `SIGINT` handler remained running after `write_stdin` reported an interrupt action.
3. **Interrupted shell commands can encode termination differently.** Simple Node interruption returned `signal: "SIGINT"`; a shell script interrupted by Ctrl-C returned `exitCode: 129`, `signal: null`.
4. **Abort only applies while the initial `exec_command` call is active.** Once `exec_command` has returned a running `sessionId`, later cleanup depends on `write_stdin` Ctrl-C; there is no force-stop or timeout tool.
5. **POSIX process-group cleanup looked good, but this does not validate Windows.** The implementation's Windows fallback cannot be validated from this macOS run and is likely weaker for process trees.

## Recommendations

1. Decide whether Ctrl-C is intended to be cooperative or guaranteed cleanup. If guaranteed cleanup is required, add an escalation path after SIGINT, such as SIGTERM/SIGKILL on POSIX process groups and platform-specific tree termination on Windows.
2. Add a bounded tombstone/terminal-state retention layer so recent exited or interrupted sessions can be polled more than once and produce distinct `exited`, `interrupted`, `cleaned`, and `unknown` errors.
3. Add tests matching these experiments: shell-child-grandchild cleanup, stubborn SIGINT handler behavior, abort during initial yield, and second poll after natural exit.
4. Document that `yield_time_ms` is a yield window, not a command timeout, and that interrupted shell commands may report either a signal or a shell-derived exit code.
5. Add Windows-specific cleanup validation before claiming process-tree cleanup is portable.
