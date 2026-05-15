# Tech Spec: Persistent Terminal Session Tools

Product spec: `specs/2026-05-15-persistent-terminal-session/PRODUCT.md`

## Context

This spec is inspired by Codex CLI's unified exec tool pair and adapts the product shape to pi-basic-tools without starting implementation in this draft phase.

- `package.json:31` - `test:build` must include every shipped extension entry point.
- `package.json:34` - `pi.extensions` is the runtime registration list for this package.
- `extensions/ask-user.ts:45` - representative extension registration shape: schema, compact renderers, and `execute` implementation live in one extension file.
- `extensions/ask-user.ts:56` - compact tool UI pattern where `renderCall()` returns an empty container and `renderResult()` owns the collapsed line.
- `extensions/enable-builtin-search.ts:45` - existing wrapper pattern for delegating to host/built-in tools while overriding rendering.
- `extensions/enable-builtin-search.ts:107` - active-tool inspection and activation pattern for session-start/resource-discovery behavior.
- `tests/extension-host.ts:25` - test host used to register tools and exercise extension behavior without a real pi session.
- `tests/extension-host.ts:152` - current test helper executes one-shot child processes and can be extended or bypassed for persistent-process tests.
- `/Users/lucas/Developer/agentcapy/clones/codex/codex-rs/core/src/tools/handlers/shell_spec.rs:91` - Codex `exec_command` schema returns a session id for ongoing commands.
- `/Users/lucas/Developer/agentcapy/clones/codex/codex-rs/core/src/tools/handlers/shell_spec.rs:141` - Codex `write_stdin` schema writes or polls an existing session.

## Proposed changes

### Tool surface

Implement a small persistent terminal extension with the Codex-aligned tool names now recorded in PRODUCT.md decisions:

- `exec_command`: start a command and return either `exit_code` or `session_id`.
- `write_stdin`: write text to a running session, poll with an empty `chars` string, or send SIGINT with `"\u0003"`.

Candidate `exec_command` parameters:

- `cmd` or `command`: shell command to start.
- `workdir`: optional working directory, defaulting to `ctx.cwd`.
- `tty`: optional boolean for PTY mode when supported.
- `yield_time_ms`: how long to wait for initial output before returning.
- `max_output_bytes`: output cap for model-facing content.

Candidate `write_stdin` parameters:

- `session_id`: required numeric or string id from `exec_command`.
- `chars`: text to write; empty string means poll.
- `yield_time_ms`: how long to wait for more output.
- `max_output_bytes`: output cap.

No separate stop tool ships in the first version. `write_stdin` treats `"\u0003"` as SIGINT for cleanup.

### Runtime ownership

Add a module-level session registry inside the extension or a small helper module:

- Allocate monotonically increasing session ids per Node process.
- Store child process handle, cwd, command label, started timestamp, ring buffer or unread buffer, terminal state, and last-read cursor.
- Append stdout/stderr data into a bounded buffer and expose only unread data on `write_stdin` polls.
- Mark sessions as exited on close and keep final state briefly so later polls can report the exit code instead of returning unknown-session immediately.
- On abort before process creation, return cancellation without storing a session.
- On macOS/POSIX, abort after process creation first sends SIGTERM, then escalates to SIGKILL if the process group does not exit within a short grace period, and returns no usable `session_id`.

### Process execution

Start with Node `child_process.spawn` because the package already tests real child processes and targets Node. PTY support should be optional unless the implementation phase proves a lightweight, acceptable dependency is needed.

Implementation sequence:

1. Add `extensions/terminal-session.ts`.
2. Implement non-PTY persistent spawn, bounded buffering, polling, stdin writes, SIGINT cleanup, exit-state reporting, and cleanup.
3. Add compact UI rendering for both tools following the `ask_user` / search renderer pattern.
4. Wire the extension in `package.json` `pi.extensions` and `test:build`.
5. Add unit/integration tests with deterministic local commands.
6. Document PTY support as a follow-up unless implementation proves it is required for accepted behavior.

### UI rendering

Collapsed result examples should stay one line:

- `exec command session 3 running, 12 lines (to expand)`
- `exec command exited 0, 4 lines (to expand)`
- `write stdin session 3 running, no output (to expand)`

Expanded rendering should show the full returned text payload and structured metadata when useful.

### Compatibility and packaging

The first implementation should not alter existing `bash`, `grep`, `find`, `ls`, `read_block`, or question tools. It should be additive and only activate via new tool entries.

If PTY support needs a native dependency, implementation must explicitly weigh package size, install reliability, and cross-platform behavior before adding it. A non-PTY first version may be preferable if it satisfies dev-server log polling and simple prompt-response workflows.

## Testing and validation

Use `npm run check` as the final package-level validation after implementation. Add focused tests before that:

- Behavior #1: start a command that exits quickly, assert output and `exit_code` are returned with no `session_id`.
- Behavior #1/#2: start a command that waits, assert a `session_id` is returned while the process remains running.
- Behavior #3/#4: write to a deterministic stdin-driven process and assert only new output is returned on subsequent polls.
- Behavior #6: poll an unknown session id and assert a concise unknown-session error.
- Behavior #7: start with an invalid `workdir`, shell startup failure, permission-denied script, and abort-after-spawn SIGTERM-ignoring process; assert no usable session id is returned.
- Behavior #8: run two sessions concurrently and assert output does not cross session boundaries.
- Behavior #10: render collapsed results for running, exited, empty-output, and error states.
- Behavior #11: generate output above the configured cap and assert truncation metadata is present.
- Behavior #12: stop or naturally exit a session, then poll and assert the terminal state is observable.

Manual validation, if PTY mode ships:

- Start a simple REPL or prompt-driven command and verify that TTY behavior differs from non-PTY only where expected.
- Start a dev server, observe readiness output, poll logs, then stop it and confirm no child process remains.

## Risks and mitigations

- Risk: Orphaned child processes after aborted tool calls or failed tests. Mitigation: macOS/POSIX abort-after-spawn escalates from SIGTERM to SIGKILL, tests track active sessions with an `afterEach` cleanup registry, and cleanup failures are surfaced instead of swallowed.
- Risk: Log buffers grow without bound. Mitigation: bounded buffers plus explicit truncation metadata.
- Risk: PTY dependency causes install or cross-platform failures. Mitigation: ship non-PTY first unless PTY is required for accepted behavior.
- Risk: Output cursor bugs hide logs or duplicate old logs. Mitigation: tests for repeated empty polls and mixed stdout/stderr output.
- Risk: Safety expectations differ from pi's one-shot `bash`. Mitigation: keep tool additive and document the first version as a direct extension-process shell runner that does not provide the built-in `bash` per-command approval flow unless the host sandbox already constrains the extension process.

## Follow-ups

- Investigate whether pi core can expose a host-mediated persistent process API so this tool can inherit command approvals/sandboxing instead of using direct `child_process.spawn`.
- Decide whether session metadata should be exposed via a `list_terminal_sessions` tool.
- Decide whether stale sessions should auto-expire after inactivity.
- Decide whether persistent sessions should survive extension reloads; draft assumption is no.
