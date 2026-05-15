# Concurrency and Output Stress: Persistent Terminal Session Tools

Date: 2026-05-15
Reviewer: concurrency/output validation agent
Scope: `extensions/terminal-session.ts`, `tests/terminal-session.test.ts`, `specs/2026-05-15-persistent-terminal-session/PRODUCT.md`, `TECH.md`

## Verdict

Status: core concurrent-session and returned-output behavior is mostly covered, but there is a high-priority cursor bug when the internal session buffer trims while a session has already been read.

The focused tests and ad hoc experiments show that active sessions keep output isolated, repeated empty polls do not duplicate already-read output, returned output is bounded with explicit truncation metadata, and merged stdout/stderr is usable for basic debugging. However, `MAX_BUFFER_BYTES` trimming can make newly produced unread output disappear after a previous read. This violates PRODUCT.md Behavior #3 for high-output sessions and is the main fix recommendation from this pass.

## Commands Run

- `git status --short && rg --files specs/2026-05-15-persistent-terminal-session | sort`
  - Observed a dirty worktree with many pre-existing changes; this report only adds `specs/2026-05-15-persistent-terminal-session/research/concurrency-output-stress.md`.
- `rg -n "persistent|terminal|session|MAX_BUFFER|stdout|stderr|poll|cursor|truncate|truncation" -S . --glob '!node_modules' --glob '!dist' --glob '!build'`
  - Located implementation, tests, and spec behavior references.
- `bun test tests/terminal-session.test.ts`
  - Passed: 9 tests, 0 failures, 39 assertions.
- `bun /tmp/pi-terminal-concurrency-stress.ts`
  - Ran ad hoc stress for 3 concurrent sessions, repeated empty polls, large output truncation, and `MAX_BUFFER_BYTES` cursor behavior. One mixed-stream subcase in this script used Bun `-e` with escaped newlines and produced a quoting error, so mixed-stream validation was rerun separately.
- `bun /tmp/pi-terminal-mixed-stress.ts`
  - Reran mixed stdout/stderr capture with a semicolon-delimited `node -e` command. Passed the intended capture checks.
- `npm run check`
  - Passed: build succeeded, 36 tests passed, 0 failures, 208 assertions.

## Implementation Notes Relevant to Stress Behavior

- Session output is stored per session as a single string buffer: `output` plus `readOffset` in `extensions/terminal-session.ts`.
- stdout and stderr both append into the same buffer via `appendOutput()` in `registerSession()`.
- Returned output is capped by `truncateOutput()` and marks `truncated` / `omittedBytes`.
- Retained session output is capped by `MAX_BUFFER_BYTES = 512_000`; `trimSessionBuffer()` keeps the tail and then sets `readOffset = Math.min(session.readOffset, session.output.length)`.
- `unreadOutput()` returns `session.output.slice(session.readOffset)` and advances `readOffset` to the current string length.

## Observations

### Concurrent output isolation

Ad hoc experiment:

- Started three sessions labeled `alpha`, `beta`, and `gamma`.
- Each session emitted periodic `TICK:<label>:<n>` output, echoed stdin to stdout as `OUT:<label>:...`, and echoed stdin to stderr as `ERR:<label>:...`.
- Wrote a different input to each session and then polled all sessions across three rounds.

Result:

- `sessionCount`: 3
- `observationCount`: 3 writes
- `pollCount`: 9 polls
- `mixedCount`: 0 outputs containing another session's label
- Sample output for each session contained only that session's label.

Conclusion: active-session output isolation is good in the tested scenario. This reinforces the existing two-session coverage in `tests/terminal-session.test.ts`.

### Empty poll cursor behavior

Ad hoc experiment:

- Started a session that printed `ONCE` and then stayed alive.
- Polled five times with `chars: ""` after the initial `exec_command` read had already consumed `ONCE`.

Result:

- Initial output: `ONCE\n`
- Poll outputs: `"", "", "", "", ""`
- Duplicate count for `ONCE`: 0

Conclusion: repeated empty polls do not duplicate old output when the internal buffer has not crossed the trim threshold.

### Large returned output truncation

Ad hoc experiment:

- Ran a command that wrote about 150 KB to stdout, 150 KB to stderr, and tail markers.
- Requested `max_output_bytes: 1000`.

Result:

- Status: `exited`
- `truncated`: true
- `outputBytes`: 300024
- `omittedBytes`: 299044
- Output contained `[... truncated ...]`
- Returned text contained `output_truncated: true` and `omitted_bytes:` metadata.
- Tail sample included the stderr tail marker (`TAIL_STDERR`).

Conclusion: model-facing output is bounded and truncation metadata is explicit. The current metadata describes truncation applied to the retained unread buffer, not necessarily the total process output if the session buffer had already trimmed internally.

### Mixed stdout/stderr capture

Ad hoc experiment:

- Ran a command that produced 30 stdout markers and 30 stderr markers.
- Requested a large enough cap (`max_output_bytes: 12000`) and then a small cap (`max_output_bytes: 500`).

Result with large cap:

- Status: `exited`, exit code 0
- `mixedHasStdout0`: true
- `mixedHasStdout29`: true
- `mixedHasStderr0`: true
- `mixedHasStderr29`: true
- `lineCount`: 60
- `outputBytes`: 880

Result with small cap:

- `truncated`: true
- `omittedBytes`: 400
- Truncated tail still contained both stdout and stderr markers near the end.

Conclusion: stdout and stderr are captured sufficiently for many debugging workflows, but they are merged without stream metadata. Interleaving order is chunk-arrival order and can group stdout/stderr differently than source order. If agents need to distinguish streams, add stream tags or separate details fields in a future version.

### High-output buffer trimming and read-offset bug

Ad hoc experiment:

- Started a long-running session that immediately wrote 600000 `A` bytes plus `READY`.
- `exec_command` consumed the initial retained output and advanced the session cursor.
- Wrote `go\n` to stdin; the process responded with 100000 `B` bytes plus `DONE_B`.
- Polled again.

Result:

- Initial `exec_command` details showed `initialTruncated: true` and `initialOutputBytes: 512000`, meaning the internal buffer had already trimmed to `MAX_BUFFER_BYTES` before return.
- The write response had `afterWriteOutputBytes: 0`.
- The write response did not contain `B` or `DONE_B`.
- A second poll also had `afterSecondPollBytes: 0` and did not contain `DONE_B`.

Conclusion: new unread output can be lost when a previously-read session receives enough additional output to trigger `trimSessionBuffer()`. The likely cause is that `readOffset` is not adjusted by the amount removed from the front of the buffer. When the buffer is trimmed, the cursor should move left by the number of retained string units or bytes dropped before it; instead, it is clamped to the new string length, which can point at or beyond the end of the newly trimmed buffer and skip fresh output.

This is a high-priority gap against Behavior #3 (`empty string polls only new output since the previous read`) and Behavior #11 for long-running logs. It also creates a debugging hazard: an agent can send input to a high-output process and receive no visible response even though the process emitted one.

## PRODUCT.md Behavior Coverage

| Behavior | Coverage from this pass | Notes |
| --- | --- | --- |
| #1. Start returns structured result with output, elapsed time, and exit code or session id. | Covered by tests | `bun test tests/terminal-session.test.ts` passes quick-exit and running-session cases. Stress pass did not find a new issue here. |
| #2. Running sessions remain addressable by session id. | Covered for active sessions | Three concurrent ad hoc sessions remained addressable across writes and polls. Post-exit/tombstone behavior is covered by other reports, not this pass. |
| #3. Stdin writes and empty polls return only new output. | Partially covered; high-output bug found | Normal repeated empty polls returned no duplicates. High-output buffer trimming lost new output after a previous read. |
| #4. Poll/write returns structured output with elapsed wait time, exit code, and truncation indication. | Covered for normal/truncated returns | Details include duration, status/exit code when applicable, output bytes, `truncated`, and `omittedBytes`. High-output internal trim is not separately indicated. |
| #5. Interactive workflows are supported. | Partially covered | Labelled long-running sessions accepted stdin while periodic logs continued. The trim bug can break interactive debugging after large log bursts. |
| #6. Unknown/exited/cleaned ids fail clearly. | Not a focus of this pass | Existing targeted test covers unknown id only; other reports identify tombstone/precision gaps. |
| #7. Spawn failures and cancellation report without invented session ids. | Not a focus of this pass | Invalid workdir is tested in the focused suite. Spawn/cancellation edge cases were not stressed here. |
| #8. Multiple sessions are isolated. | Covered | Existing two-session test passed; ad hoc three-session stress found `mixedCount: 0`. |
| #9. Safety/sandbox expectations are preserved. | Not covered by output stress | Other review work flags direct `child_process.spawn(..., shell: true)` as an unresolved safety-model issue. |
| #10. Collapsed/expanded UI rendering. | Lightly covered by tests | Existing test covers running `exec_command` rendering. This pass did not add renderer stress. |
| #11. Returned output is bounded. | Covered with caveat | Returned output cap and truncation metadata work. Internal `MAX_BUFFER_BYTES` trimming has no distinct metadata and can corrupt unread cursor semantics. |
| #12. Cleanup is observable. | Lightly covered by tests | Natural-exit poll test passes. This pass used Ctrl-C cleanup but did not assert post-stop tombstone semantics. |

## Bugs and Gap Recommendations

### High: adjust read offsets correctly when trimming the session buffer

Evidence: the `trimCursorRisk` experiment lost the entire 100000-byte `B` response and `DONE_B` marker after the initial 600000-byte output had been read and the buffer trimmed.

Recommendation:

- Track cursor positions in the same coordinate system used for trimming. Prefer byte offsets plus a byte ring buffer, or a chunk queue that can drop whole chunks and preserve unread boundaries.
- If keeping a string buffer, compute the retained suffix and subtract the dropped prefix length from `readOffset`, clamping at 0, instead of only clamping to the new string length.
- Add a regression test: produce more than `MAX_BUFFER_BYTES`, read it, produce another large marker-bearing chunk that triggers trimming, then assert the marker is returned exactly once on the next poll.
- Consider including metadata when unread data was dropped because the producer outpaced polling, so agents know logs were lost.

### Medium: separate retained-buffer trimming metadata from returned-output truncation metadata

Current `truncated` / `omittedBytes` describe the `max_output_bytes` cap applied to the unread buffer. They do not reveal bytes discarded by the internal 512 KB session cap before the read. For long-running dev servers, this can hide the fact that old logs are gone.

Recommendation: add fields such as `buffer_truncated`, `buffer_omitted_bytes`, or `oldest_retained_offset` if the implementation keeps a bounded session log.

### Medium: stdout/stderr merging is usable but loses stream identity

The merged buffer captured both streams, but source stream identity is not retained. This is acceptable for the current PRODUCT wording, but stream labels would make debugging compiler/test failures easier.

Recommendation: either document that stdout/stderr are merged, or add optional metadata/separate buffers in a future iteration.

### Medium: add stress tests for output isolation and cursor trimming

Existing tests cover the main happy paths, but not the high-output cursor boundary.

Recommended tests:

1. Three or more active sessions with concurrent periodic output and labelled stdin responses; assert no cross-session labels in each returned output.
2. Five repeated empty polls after a consumed initial line; assert all are empty.
3. Alternating stdout/stderr markers with and without output truncation; assert both streams appear when the cap permits.
4. Internal buffer trim regression described in the high-severity recommendation.

## Final Assessment

The implementation is strong enough for ordinary low/medium-output concurrent workflows, and the current focused suite plus package check pass. It is not yet safe for high-output persistent sessions because `MAX_BUFFER_BYTES` trimming can advance the cursor past newly emitted unread output. Fixing cursor adjustment and adding a regression test should be treated as a blocker for the output semantics in PRODUCT.md Behaviors #3 and #11.
