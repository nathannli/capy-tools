# pi-basic-tools

Standalone basic tools for pi.

This package bundles a practical set of editing, fetch, web-reference, compact basic-tool UI, and built-in search activation extensions split out from `pi-goodstuff`.

## Included extensions

- `fetch`
- `enable-builtin-search` (activates pi's built-in `grep`, `find`, and `ls` tools)
- `repo-map` (`repo_map` tool)
- `read-block` (`read_block` tool)
- `symbol-outline` (`symbol_outline` tool)
- `apply-patch` (`apply_patch` tool)
- `terminal-session` (`exec_command` and `write_stdin` tools)
- `ask-user` (`ask_user` tool)
- `ask-question` (`ask_question` tool)
- `ask-questionnaire` (`ask_questionnaire` tool)
- `sourcegraph`

## Core helper tools

`repo_map` generates a compact project orientation map: root, git state, manifests, language mix, important files, directory clusters, and recent changes.

`read_block` reads the enclosing code or Markdown block around a line or symbol, so agents can inspect the right semantic unit without guessing offset/limit ranges.

`symbol_outline` lists a file's readable functions, classes, types, declarations, or Markdown sections with `read_block` line anchors, so agents can discover the right block before reading it.

`apply_patch` applies Codex-style patch text with `*** Begin Patch` / `*** End Patch` envelopes and `*** Add File`, `*** Update File`, `*** Move to`, and `*** Delete File` operations. This implementation intentionally stays close to Codex behavior: it accepts absolute paths, can overwrite add/move destinations, can delete files, creates missing parent directories for writes, and applies hunks sequentially. It is a direct extension-process filesystem writer, not pi's built-in `bash` approval flow; review paths carefully before using it, especially absolute paths and delete/move hunks. Delete is non-recursive and refuses directories.

`exec_command` starts a persistent terminal session for long-running or interactive commands and returns either an `exit_code` for finished commands or a `session_id` for commands that are still running.

`write_stdin` writes to, polls, or interrupts a running `exec_command` session; pass an empty `chars` string to poll fresh output and `"\u0003"` to send SIGINT. The first version is non-PTY, process-local, macOS-validated, and uses byte-based output limits through `max_output_bytes`; it is a direct extension-process shell runner rather than the built-in `bash` approval flow. Ctrl-C cleanup is cooperative, with abort-after-spawn escalating from SIGTERM to SIGKILL on macOS/POSIX; Windows process-tree cleanup is not validated in this package.

`ask_user` adds a simple free-form user prompt for cases where the agent needs an unstructured answer before continuing.

`ask_question` adds a small, session-friendly tool for asking the user a focused question with optional choices and free-text fallback.

`ask_questionnaire` adds a multi-question TUI for batching related questions with suggested options, recommended defaults, free-text answers, and a submit review screen.

> Looking for task tracking? `todo` is no longer shipped here. Install [`@tintinweb/pi-tasks`](https://github.com/tintinweb/pi-tasks) for `TaskCreate`/`TaskList`/`TaskUpdate` and friends.

### Built-in search activation

`enable-builtin-search` activates pi's internal `grep`, `find`, and `ls` tools. It also installs compact group-aware renderers for common basic tools (`read`, `bash`, `edit`, `write`, `grep`, `find`, `ls`, and this package's file/navigation tools), so consecutive basic-tool calls collapse into one `TOOLS` block and split again when a non-basic tool appears. Legacy custom `glob`, `grep`, and `list` implementations were removed so they cannot shadow pi's built-ins.

## Runtime requirements and dependencies

### Pi core package scope

Pi core packages have moved from `@mariozechner/*` to `@earendil-works/*`. This package imports and tests against the new scope (`@earendil-works/pi-ai`, `@earendil-works/pi-coding-agent`, and `@earendil-works/pi-tui`) and keeps them as peer dependencies so pi supplies its own core runtime.

### Bundled in this package

### External tools you must provide

- `fetch` requires [MarkItDown](https://github.com/microsoft/markitdown) for Markdown conversion.
- Activated built-in `grep` and `find` use pi's managed `rg` and `fd` tools; install them on `PATH` or let pi download them when needed.
- MarkItDown upstream requires Python 3.10 or newer.
- Recommended installation method: `pipx`, so the `markitdown` CLI is available on `PATH` without modifying the package itself.

## Installation

Install the pi package:

```bash
pi install npm:@capyup/pi-basic-tools
```

Install `pipx` if it is not already available:

```bash
brew install pipx
```

Alternative `pipx` installation:

```bash
python3 -m pip install --user pipx
python3 -m pipx ensurepath
```

Install MarkItDown for the `fetch` tool:

```bash
pipx install 'markitdown[all]'
```

Verify that MarkItDown is available:

```bash
markitdown --version
```

If pi is already running, reload extensions after installing or updating dependencies:

```text
/reload
```

## Testing

The test suite is strict by default: it uses real filesystem operations, real `git`, live network calls to `example.com` and Sourcegraph, and the real MarkItDown CLI. Missing dependencies are expected to fail tests instead of being mocked or skipped.

```bash
npm install
npm test
npm run test:build
npm run check
```

For real TUI renderer validation, run the PTY capture harness. It launches an actual interactive `pi` instance, captures the terminal ANSI stream, writes a plain-text transcript under `.pi/tui-captures/`, and asserts that the grouped `TOOLS` block contains `symbol_outline`, `read_block`, and `grep` without `grep grep` duplication:

```bash
npm run test:tui-capture
```

To validate the user's normal Pi loading path rather than the isolated local-extension setup, run:

```bash
npm run test:tui-capture:current
```

Test coverage includes `repo_map`, `read_block`, `symbol_outline`, `apply_patch`, `exec_command`, `write_stdin`, `ask_user`, `ask_question`, `ask_questionnaire`, `fetch`, `sourcegraph`, grouped basic-tool rendering, `enable-builtin-search`, TUI capture harness support, and package wiring. See [`docs/testing.md`](docs/testing.md) for the dependency checklist, public research summary, and recommended pi extension testing workflow.

## Update

Update this package inside pi:

```bash
pi update npm:@capyup/pi-basic-tools
```

If you need to update MarkItDown as well:

```bash
pipx upgrade markitdown
```

## Fetch storage and conversion

The `fetch` tool does not inline the fetched page body into the tool result. Instead, it stores artifacts under the current project's `.pi/fetch/` directory using a timestamp-plus-slug layout similar to task artifacts. It does not fall back to the global `~/.pi`; if you run it directly from your home directory, it refuses and asks you to work from a project directory.

```text
.pi/fetch/<timestamp>-<slug>/
  response.<ext>
  content.md
  meta.json
```

### Files written by `fetch`

- `response.<ext>`: raw fetched response saved byte-for-byte with an extension inferred from `Content-Type` or URL.
- `content.md`: Markdown generated by MarkItDown when conversion succeeds.
- `meta.json`: metadata for the fetch run, including URL, content type, byte size, saved paths, and MarkItDown command attempts.

### MarkItDown execution order

`fetch` attempts MarkItDown in this order:

1. `~/.local/bin/markitdown`
2. `markitdown`
3. `python3 -m markitdown`
4. `python -m markitdown`

If conversion fails, the raw response is still preserved and `meta.json` records the failed attempts.

### Expected workflow after `fetch`

The `fetch` result explicitly tells the agent which saved file to read next. It also reports a rough line count and token estimate for that recommended file so the model can decide whether to read it immediately.

After calling `fetch`, inspect the generated Markdown with `read`:

```text
read .pi/fetch/<timestamp>-<slug>/content.md
```

If Markdown conversion fails, `fetch` points `read` at the raw saved response instead. For binary responses it still preserves the file, but line and token estimates are omitted because they would not be meaningful.

If Markdown conversion fails, inspect either of these instead:

```text
read .pi/fetch/<timestamp>-<slug>/response.<ext>
read .pi/fetch/<timestamp>-<slug>/meta.json
```

## Future tool ideas

Good candidates for later `pi-basic-tools` additions:

- `diagnostics` / `check`: run project-aware lint/test/typecheck commands with structured, compressed results.
- `symbols`: LSP or Serena-backed `find_symbol`, `references`, and safe rename/replace helpers.
- Structured git write tools: guarded branch/commit helpers that never hide dirty worktree risk.
- Context utilities: inspect active tools, model context usage, and recent large tool outputs.

Browser automation, heavy web research, and semantic language-server workflows may be better as separate packages or MCP integrations instead of bloating this core package.

## Notes

- `fetch` keeps a 5 MB response-size guard.
- `fetch` saves binary responses safely; it does not force them through text decoding before writing them to disk.
- Legacy custom `glob`, `grep`, and `list` implementations are intentionally absent; pi's built-in `grep`, `find`, and `ls` are preferred.

## License

MIT
