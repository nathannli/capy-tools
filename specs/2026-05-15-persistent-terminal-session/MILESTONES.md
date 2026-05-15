# Milestones: Persistent Terminal Session Tools

Free-form implementation log. Record meaningful phase changes, successful milestones, failed attempts, setbacks, fixes, validation notes, and decisions. Use third-level headings with timestamps down to seconds, for example `### 2026-05-13 14:16:36 - Short milestone title`. No strict schema is required.


### 2026-05-15 16:46:42 - Milestone

Started a new draft spec for Codex-style persistent terminal session tools. Captured PRODUCT.md behavior for starting long-running commands, polling/writing stdin by session id, bounded output, cleanup, and compact UI. Drafted TECH.md with current pi-basic-tools wiring context, Codex source references, proposed tool surface, runtime ownership, validation plan, and open implementation decisions. No implementation code was modified.

### 2026-05-15 17:00:46 - Milestone

Resolved the initial implementation decisions before coding: use Codex-aligned tool names `exec_command` and `write_stdin`, support cleanup by treating `"\u0003"` in `write_stdin` as SIGINT instead of adding a separate stop tool, ship a non-PTY first version, keep sessions process-local, and use byte-based output limits. Updated PRODUCT.md and TECH.md to reflect those decisions.

### 2026-05-15 17:03:38 - Milestone

Implemented the first non-PTY persistent terminal session tool pair. Added `extensions/terminal-session.ts` with `exec_command` for starting persistent shell commands and `write_stdin` for polling, writing stdin, or sending SIGINT via `"\u0003"`; wired the extension into package registration/build checks; documented the tools in README/testing docs; and added deterministic child-process tests for quick exits, running sessions, polling, stdin writes, unknown sessions, invalid workdirs, concurrent isolation, compact rendering, truncation, natural exit reporting, and workdir handling. Validation passed with `npm run check` (36 tests, 0 failures).

### 2026-05-15 17:06:36 - Milestone

Started an additional validation phase at the user's request. The plan is to launch parallel review/experiment agents that independently stress persistent terminal session behavior, inspect cleanup and safety risks, and map implementation/tests back to PRODUCT.md behavior before deciding whether fixes or spec updates are needed.

### 2026-05-15 17:20:49 - Milestone

Completed the additional multi-agent validation pass. Initial agents produced lifecycle, concurrency/output, safety/cleanup, and spec-conformance reports; those reports found a high-output cursor bug, one-shot terminal-state retention, and documentation gaps around the direct shell-runner safety model. Fixed the cursor trimming logic, added bounded tombstones for exited/interrupted sessions, expanded tests for SIGINT observability, tombstone polling, retained-buffer trimming, and write_stdin rendering, and updated PRODUCT.md/TECH.md/README/docs to document the non-PTY process-local direct extension runner safety model. Post-fix validation agents passed and confirmed the cursor/tombstone fixes; `npm run check` passed with 39 tests and 224 assertions.

### 2026-05-15 17:28:59 - Milestone

Oracle external audit completed via response `20260515172839-adac5d06` using `gpt-5.5-pro` browser engine. Oracle agreed the feature can ship only as a clearly caveated first-version direct extension-process runner, and identified the main remaining risks as under-tested abort-after-spawn/spawn-permission failures, cooperative rather than guaranteed cleanup especially on Windows or SIGINT-ignoring processes, shell quoting/injection caveats, and best-effort test cleanup. Oracle recommended adding abort/spawn failure tests, README caveats for cooperative Ctrl-C and unproven Windows cleanup, and a stronger test cleanup registry before release if treating #7 as a hard contract.

### 2026-05-15 17:35:50 - Milestone

Addressed Oracle's minimal pre-release concerns within the user-approved macOS-only scope. Implemented macOS/POSIX abort-after-spawn hardening by escalating SIGTERM to SIGKILL and returning no usable session id on cancellation, added tests for SIGTERM-ignoring abort-after-spawn, shell startup failure, and permission-denied script behavior, and replaced best-effort test cleanup with an afterEach cleanup registry that surfaces failures. Updated README/docs and PRODUCT/TECH to state the first version is macOS-validated, non-PTY, process-local, direct extension-process shell runner; Windows process-tree cleanup remains explicitly out of scope. Validation passed with `npm run check` (41 tests, 236 assertions).

### 2026-05-15 17:39:56 - Milestone

Finalized documentation and bumped the package version. README and docs/testing now describe the persistent terminal tools, macOS validation scope, non-PTY/process-local/direct-runner caveats, cooperative Ctrl-C cleanup, and abort-after-spawn escalation. Ran `npm version 0.5.3 --no-git-tag-version` to synchronize package.json/package-lock.json, then validated with `npm run check` (41 tests, 236 assertions, 0 failures).

### 2026-05-15 18:15:59 - Milestone

Improved terminal-session collapsed UI after real E2E showed it was hard to see what `exec_command` was running. `exec_command` now renders a call summary with the command before execution completes, and collapsed results include session id, action/status, truncated command, and output line count. `write_stdin` now shows the target session/action in its call summary and the associated command in collapsed results. Validated with `npm test -- tests/terminal-session.test.ts` (14 pass) and `npm run check` (46 pass, 268 assertions).

### 2026-05-15 18:21:45 - Milestone

Further improved `write_stdin` visibility after observing collapsed rows like `write stdin session 2 running, no output`, which hid the underlying command. The renderer now resolves `session_id` through the in-memory running session or tombstone map and shows the command in `write_stdin` call, partial/loading, and collapsed result views. Validated with targeted terminal-session tests and full `npm run check` (48 tests, 280 assertions, 0 failures).

### 2026-05-15 18:43:12 - Milestone

Added extension-local grouped basic-tool rendering that also covers `exec_command` and `write_stdin` when they appear in consecutive basic-tool runs. The terminal-session tools now participate in a shared `TOOLS` block during real TUI rendering while preserving their legacy standalone renderer behavior for direct renderer tests and expanded output. Validated with full `npm run check` (49 tests, 287 assertions, 0 failures).

### 2026-05-15 19:54:13 - Milestone

Added a real PTY/TUI capture harness (`scripts/capture-pi-tui.py`) and `npm run test:tui-capture` to launch an actual interactive `pi`, save raw ANSI plus plain-text transcripts under `.pi/tui-captures/`, and assert that the visible grouped `TOOLS` block contains `symbol_outline`, `read_block`, and `grep` without duplicate labels. The first captures exposed that unit renderer tests were too weak: `agent_start`/partial `message_update` and unknown `tool_execution_start` events split groups in the real UI. Fixed grouping boundaries, added a single runtime entrypoint (`extensions/index.ts`) so state is shared in real Pi loading, and added regression tests for continuation lifecycle events, incomplete args, unknown tool-start payloads, and partial message updates. Validated with `npm run test:tui-capture` (artifact `.pi/tui-captures/20260515-194953/plain.txt` shows `TOOLS done · 3 calls · 3 done`) and `npm run check` (53 tests, 292 assertions, 0 failures).

### 2026-05-15 19:58:23 - Milestone

Tightened the TUI capture harness after advisor review: `--expect-tools-block` now requires all named tools to appear in the same rendered `TOOLS` snapshot, matched blocks are printed for quick inspection, and non-zero termination is only tolerated when the sentinel was observed and Pi was intentionally interrupted/terminated after capture. Re-ran real capture successfully at `.pi/tui-captures/20260515-195456/plain.txt`; the transcript contains `TOOLS done · 3 calls · 3 done` with `symbol_outline`, `read_block`, and `grep` in one block. Re-ran `npm run check`: 53 tests, 292 assertions, 0 failures.

### 2026-05-15 20:12:25 - Milestone

Investigated the user's live UI evidence showing fragmented `TOOLS done` cards. Added `--current-pi-settings` support and `npm run test:tui-capture:current` so the harness can launch Pi through the user's normal settings path instead of only isolated local extensions. Tightened block matching to require the final `TOOLS done` block. Both isolated capture (`.pi/tui-captures/20260515-200032/plain.txt`) and current-settings capture (`.pi/tui-captures/20260515-200855/plain.txt`) now show one `TOOLS done · 3 calls · 3 done` block containing `symbol_outline`, `read_block`, and `grep`. This indicates the weird live display is from the already-running Pi session using the pre-fix renderer; a fresh Pi process loads the single-entry `extensions/index.ts` path correctly. Re-ran `npm run check`: 53 tests, 292 assertions, 0 failures.

### 2026-05-15 21:16:14 - Milestone

Live-session direct tool testing showed the head-row rendering strategy was still wrong for interactive visibility: when only the latest/current row stays visible, rendering the whole `TOOLS` group from the first tool row can make tool calls disappear from the user's view. Updated grouped rendering so each group tracks `renderToolCallId` and the latest basic tool row owns the visible `TOOLS` group, while earlier rows return empty. `renderGroupedToolResult` also returns the group component for the latest row so the done state remains visible. Updated regression tests to assert latest-row ownership across continuation lifecycle events, unknown tool-start events, and partial message updates. Validated with `npm run test:build && npm test -- tests/repo-map-read-block.test.ts` (18 tests, 120 assertions, 0 failures). A fresh Pi reload is required for this new renderer strategy to be visible in the current interactive session.

### 2026-05-15 21:51:47 - Milestone

User's live UI showed latest-row rendering was nearly correct but duplicated the same `TOOLS` block many times and accumulated `65 earlier calls` across assistant text. Fixed two issues: `renderGroupedToolResult` now only updates group status and returns an empty component so the latest call row is the sole visible owner, and `message_update` now treats meaningful non-tool assistant content as a boundary that closes the current basic-tool group. Added regressions proving call/result do not both render the same group and that assistant text closes a group before later tools. Validated with `npm test -- tests/repo-map-read-block.test.ts` (20 tests, 126 assertions, 0 failures) and full `npm run check` (55 tests, 297 assertions, 0 failures). A fresh reload is needed before live direct-call inspection uses this de-duplicated renderer.

### 2026-05-15 23:08:26 - Milestone

Final grouped TOOLS renderer converged to a single compact line per tool call: `icon toolName detail` with no card/group wrapper, no truncation, no duplication, and no earlier-call filler. RenderCall owns the visible line; renderResult updates status and returns empty. Body details are preserved via mergeSummary so streaming incomplete args do not overwrite existing pattern/path/target. The compact format survived live reload testing with mixed tools (symbol_outline, read_block, grep, find, ls, bash). Package version bumped to 0.5.4.
