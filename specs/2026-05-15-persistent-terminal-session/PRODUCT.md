# Product Spec: Persistent Terminal Session Tools

## Summary

Add Codex-style persistent terminal session tools to pi-basic-tools so an agent can start a long-running or interactive command, continue working, poll fresh output, send input, and cleanly stop the process without shell-level PID/log-file hacks. The feature is for coding-agent workflows such as dev servers, REPLs, interactive setup commands, and debugging consoles.

## Problem

The current one-shot `bash` workflow is awkward for commands that do not exit quickly. Agents must either let the tool call hang until timeout or manually background the process, redirect logs, remember a PID, poll files, and clean up later. That makes dev-server and REPL workflows brittle, noisy, and hard to render compactly in the UI.

## Behavior

1. Starting a command returns a structured result that includes recent output, elapsed time, and either an `exit_code` when the command has finished or a stable `session_id` when the process is still running.
2. When a command is still running, the session remains addressable by `session_id` for later tool calls in the same agent session until it exits, is stopped, or is cleaned up by the host.
3. Sending input to a running session accepts arbitrary text for stdin; sending an empty string polls the session and returns only new output since the previous read for that session.
4. Polling or writing to a session returns structured output with elapsed wait time, any available exit code, and a clear indication when output was truncated.
5. The tool surface supports common interactive workflows: start a dev server, observe the ready URL, run another check outside the session, poll new logs, respond to an interactive prompt, and stop the process when finished.
6. Unknown, exited, or already-cleaned session ids fail with a concise error that tells the agent whether the session never existed, already exited, or was cleaned up.
7. On macOS/POSIX, spawn failures, invalid working directories, permission denials, and cancellation during the initial `exec_command` wait are reported without inventing a usable `session_id`; abort-after-spawn escalates from SIGTERM to SIGKILL when the process does not exit cooperatively.
8. Multiple terminal sessions can be active at the same time; outputs, stdin writes, exit states, and cleanup actions are isolated per session.
9. The tools clearly disclose their safety model: the first version is a direct extension-process shell runner for persistent processes, so it does not provide the same per-command approval flow as pi's one-shot `bash` tool unless the host sandbox already constrains the extension process.
10. Collapsed UI for session tools is one line per tool result, showing command/session id, running/exited status, output size or line count, and an expand hint; expanded UI shows the full returned output.
11. Returned output is bounded by caller-provided or default limits so long-running logs cannot flood the model context or the collapsed UI.
12. Session cleanup is observable: after a session is stopped or exits, a later poll reports the terminal state instead of silently treating it as still running.

## Goals / Non-goals

- Goal: Make persistent terminal workflows first-class for agents using pi-basic-tools.
- Goal: Avoid background-process shell hacks for dev servers, REPLs, debuggers, and interactive CLI prompts.
- Goal: Keep model-facing results structured and UI-facing rendering compact.
- Non-goal: Replace the existing one-shot `bash` tool for ordinary short commands.
- Non-goal: Build a full terminal emulator or browser-like TUI automation system.
- Non-goal: Add remote shell, SSH orchestration, or multi-machine process management in the first version.

## Decisions

- The initial tool names match Codex: `exec_command` starts a session and `write_stdin` polls or writes to it.
- Stopping a session is handled by sending Ctrl-C (`"\u0003"`) through `write_stdin`; no separate stop tool ships in the first version.
- The first version is non-PTY and macOS-validated only. If `tty: true` is requested, the tool reports that PTY mode is not supported yet.
- Sessions persist for the current Node process / pi session only and do not survive extension reloads.
- Output limits are byte-based through `max_output_bytes`, with a bounded default, explicit returned-output truncation metadata, and separate retained-buffer truncation metadata when old session logs are dropped.

## Open questions

- Should a future version add a `list_terminal_sessions` or `terminal_stop` tool if users need more explicit process management?
