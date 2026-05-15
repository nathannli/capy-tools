# Post-Oracle macOS Fixes

Date: 2026-05-15
Scope: Oracle response `20260515172839-adac5d06`, constrained by the user to macOS validation only.

## Changes made

- Hardened `exec_command` abort-after-spawn behavior on macOS/POSIX: when an active tool call is aborted during the initial yield window, the implementation now sends SIGTERM, waits briefly, then escalates to SIGKILL if the process group is still running. The returned result has no usable `session_id`.
- Added tests for a SIGTERM-ignoring spawned process to verify abort-after-spawn does not return a persistent session id.
- Added shell startup failure and permission-denied script tests to verify failed commands exit without persistent session ids.
- Reworked test cleanup to track active terminal sessions and run an `afterEach` cleanup pass. Cleanup failures are surfaced unless the session is already exited/interrupted/expired.
- Updated README, docs/testing, PRODUCT.md, and TECH.md to state that this first version is macOS-validated, non-PTY, process-local, and a direct extension-process shell runner. README now states that Ctrl-C cleanup is cooperative, abort-after-spawn escalates on macOS/POSIX, and Windows process-tree cleanup is not validated in this package.

## Commands run

```bash
npm test -- tests/terminal-session.test.ts
npm run check
```

## Observations

- Targeted terminal-session tests passed with 14 tests and 67 assertions.
- Full package check passed with 41 tests and 236 assertions.
- The abort-after-spawn regression uses a Node process that installs a SIGTERM handler and keeps running. The tool abort path escalated to SIGKILL and returned no `session_id`.
- Shell startup failure and non-executable script cases returned exited results with non-zero exit codes and no persistent `session_id`.
- The cleanup registry did not report leaked sessions during the targeted or full test runs.

## Remaining caveats

- Windows cleanup remains explicitly out of scope for this package's validation.
- Ctrl-C through `write_stdin` is still cooperative; a process that catches SIGINT can remain running unless a separate force-stop behavior is added in the future.
- The implementation remains a direct extension-process shell runner rather than built-in `bash` approval parity; this is now documented as shipped behavior.
