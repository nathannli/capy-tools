# Safety and Cleanup Review: Persistent Terminal Session Tools

Date: 2026-05-15
Reviewer: code-review validation agent
Scope: `extensions/terminal-session.ts`, `tests/terminal-session.test.ts`, `specs/2026-05-15-persistent-terminal-session/PRODUCT.md`, `specs/2026-05-15-persistent-terminal-session/TECH.md`

## Summary

Verdict: needs safety/cleanup fixes before shipping. The implementation covers the happy-path shape of persistent sessions, but it does not yet meet the PRODUCT.md contracts for host safety expectations, distinguishable unknown/exited/cleaned-up errors, or observable cleanup. The largest risks are direct shell spawning outside host-mediated execution, orphan child trees on Windows and host termination, and tests that can leak long-running processes when assertions fail.

## Findings

### High: command execution may bypass host-mediated approvals/sandbox hooks

- Evidence: PRODUCT.md requires terminal tools not to bypass existing command safety expectations and to remain subject to normal approval/sandbox behavior where available at `specs/2026-05-15-persistent-terminal-session/PRODUCT.md:21`.
- Evidence: TECH.md calls out the same risk and says to avoid hidden shell escalation at `specs/2026-05-15-persistent-terminal-session/TECH.md:111`.
- Evidence: `exec_command` starts processes with direct `child_process.spawn(command, { shell: true, ... })` at `extensions/terminal-session.ts:309` instead of delegating through `pi.exec` or a host-owned command runner.
- Impact: if pi's approvals/sandboxing are implemented in the built-in bash tool or `pi.exec`, this extension bypasses them for arbitrary shell commands. If pi's only enforcement boundary is the OS/process sandbox around the whole extension runtime, then this mirrors current extension-process limits but still does not satisfy the product wording that normal command approvals remain available.
- Recommendation: route command startup through a host-mediated persistent-process API if available, or explicitly document and gate this tool as host-sandbox-only. At minimum, add a TECH/PRODUCT clarification and runtime confirmation/approval integration equivalent to bash before exposing arbitrary shell execution.

### High: process-tree cleanup is unreliable, especially on Windows and host termination

- Evidence: POSIX cleanup relies on `process.kill(-session.child.pid, signal)` at `extensions/terminal-session.ts:128`, which only works because `spawn` uses `detached: process.platform !== "win32"` at `extensions/terminal-session.ts:309`.
- Evidence: Windows falls back to `session.child.kill(signal)` at `extensions/terminal-session.ts:134`, and `write_stdin` maps Ctrl-C to `signalSession(session, "SIGINT")` at `extensions/terminal-session.ts:368` rather than writing an actual console control event.
- Evidence: TECH.md identifies orphaned child processes as a primary risk and calls for central cleanup hooks at `specs/2026-05-15-persistent-terminal-session/TECH.md:107`.
- Impact: on Windows, killing the shell process often does not kill the full child tree started through `cmd.exe`/shell mode, so dev servers can survive after `write_stdin` reports an interrupt. On POSIX, detached process groups make group signaling possible, but also increase orphan risk if the pi process is killed or the extension reloads before explicit cleanup. No unload/process-exit cleanup hook is present in `terminal-session.ts`.
- Recommendation: add platform-specific tree termination. For POSIX, keep process-group signaling but register host/session shutdown cleanup that terminates all running groups. For Windows, use a job object/taskkill-style tree cleanup or avoid claiming reliable cleanup until implemented and tested.

### High: exited sessions are deleted too early to satisfy observable terminal-state semantics

- Evidence: PRODUCT.md requires unknown, exited, and already-cleaned session ids to fail with distinct concise errors at `specs/2026-05-15-persistent-terminal-session/PRODUCT.md:18`.
- Evidence: PRODUCT.md also says a later poll after stop or exit reports the terminal state instead of silently treating it as still running at `specs/2026-05-15-persistent-terminal-session/PRODUCT.md:24`.
- Evidence: TECH.md says final state should be kept briefly so later polls can report exit code instead of returning unknown immediately at `specs/2026-05-15-persistent-terminal-session/TECH.md:53`.
- Evidence: `exec_command` deletes sessions immediately when they have exited before the initial return at `extensions/terminal-session.ts:327`.
- Evidence: `write_stdin` deletes exited sessions immediately after returning one terminal-state result at `extensions/terminal-session.ts:378`.
- Evidence: a later `write_stdin` for a deleted id throws the generic message `was never created or has already been cleaned up` at `extensions/terminal-session.ts:353`.
- Impact: callers cannot distinguish never-created, already-exited, and cleaned-up ids as required. They also get only one chance to observe exit state after a long-running command finishes; a repeated poll reports a generic missing/cleaned-up error instead of the known terminal state.
- Recommendation: keep a bounded tombstone map for exited/cleaned sessions with exit code, signal, final output cursor, and cleanup reason. Expire tombstones by count/time, and return distinct messages for never-created, exited, interrupted, and expired/cleaned-up sessions.

### Medium: spawn failures, permission errors, and cancellation are not reported consistently

- Evidence: PRODUCT.md requires spawn failures, invalid working directories, permission denials, and timeout/cancellation states to be reported without inventing a session id at `specs/2026-05-15-persistent-terminal-session/PRODUCT.md:19`.
- Evidence: `spawn(command, ...)` is executed while building the session object at `extensions/terminal-session.ts:309` and is not wrapped in a try/catch for synchronous spawn errors.
- Evidence: the child `error` handler stores `session.spawnError` and sets exit code 127 at `extensions/terminal-session.ts:235`, but `detailsForSession` does not include that error in returned details at `extensions/terminal-session.ts:186`.
- Evidence: abort handling is installed only after the process is spawned at `extensions/terminal-session.ts:317`, removed after the initial wait at `extensions/terminal-session.ts:320`, and sends SIGTERM rather than returning an explicit cancellation status.
- Impact: a real spawn failure can appear as a generic thrown exception or as an exited status with code 127 and no error text, depending on how Node reports it. A cancellation during the initial wait can still return `running` if the process ignores SIGTERM until the wait expires, and cancellation after `exec_command` returns does not clean up the persistent process.
- Recommendation: wrap spawn creation, report child `error` as `status: "error"` with no usable session id, and keep cancellation metadata separate from normal exit. If the tool call is aborted after spawn, terminate the process tree and wait for close or report that cleanup is pending.

### Medium: `shell: true` changes quoting and command-safety expectations without enough guardrails

- Evidence: the schema describes `cmd` as a shell command at `extensions/terminal-session.ts:14`, and implementation uses `shell: true` at `extensions/terminal-session.ts:309`.
- Evidence: the prompt guideline only says not to use the tool for destructive/privileged/sensitive commands unless explicitly asked at `extensions/terminal-session.ts:250`.
- Impact: metacharacters, environment expansion, redirection, command substitution, and platform shell quoting all apply. That is likely intentional for Codex-style commands, but it means this tool is not equivalent to `spawn(file, args)` and any agent-composed command from untrusted file names or user text has shell-injection risk. It also creates cross-platform quoting drift because POSIX `/bin/sh` and Windows `cmd.exe` parse differently.
- Recommendation: make the shell contract explicit in PRODUCT/TECH and tool text, add examples for safe quoting, and consider an args-based mode for commands built from untrusted components. Add Windows quoting tests if cross-platform support is expected.

### Medium: test cleanup is best-effort and can leak processes on failure

- Evidence: `stopSession` swallows all cleanup errors at `tests/terminal-session.test.ts:25`.
- Evidence: long-running tests call `stopSession` only after assertions, for example `tests/terminal-session.test.ts:75`, `tests/terminal-session.test.ts:127`, `tests/terminal-session.test.ts:128`, and `tests/terminal-session.test.ts:149`.
- Evidence: tests do not use `try/finally` around long-running sessions and do not assert that interrupt actually exits the child process after cleanup.
- Evidence: TECH.md calls for deterministic stop behavior and tests that assert process exit at `specs/2026-05-15-persistent-terminal-session/TECH.md:107`, and manual validation asks to confirm no child process remains at `specs/2026-05-15-persistent-terminal-session/TECH.md:103`.
- Impact: if an assertion fails before cleanup, or if Ctrl-C fails to terminate the child tree, the Bun test process can keep running sessions alive or leave orphaned processes. The swallowed cleanup error also hides regressions in `signalSession`.
- Recommendation: wrap every running-session test in `try/finally`, make cleanup failures visible unless the session is already confirmed exited, and add an after-each/all cleanup registry. Add at least one test that starts a child process tree, interrupts it, and verifies the process/tree exits on each supported platform or is explicitly skipped with a documented limitation.

## Additional Notes

- The happy-path process-group design on macOS/Linux is reasonable for shell-launched command trees: `detached: true` plus negative-PID signaling targets the shell's process group. The missing piece is lifecycle cleanup when the host exits/reloads and robust reporting when signaling fails.
- The implementation bounds returned output and the retained buffer, which addresses the log-flooding risk from PRODUCT.md at `specs/2026-05-15-persistent-terminal-session/PRODUCT.md:23` and TECH.md at `specs/2026-05-15-persistent-terminal-session/TECH.md:108`.
- Current tests cover quick exit, running session ids, stdin writes, unknown ids, invalid workdirs, isolation, rendering, truncation, natural exit, and workdir behavior. They do not cover tombstone semantics, spawn permission failures, cancellation, Windows cleanup, or process-tree cleanup.

## Suggested Fix Order

1. Resolve the host safety model: either use host-mediated execution/approval or document and gate this as direct extension-process shell execution.
2. Add robust process-tree lifecycle cleanup for POSIX and Windows, including host shutdown/reload cleanup.
3. Replace immediate deletion with bounded tombstones and distinct unknown/exited/cleaned-up errors.
4. Normalize spawn/cancellation error reporting to match PRODUCT.md.
5. Harden tests with `try/finally`, cleanup assertions, tombstone checks, and platform-specific cleanup coverage.
