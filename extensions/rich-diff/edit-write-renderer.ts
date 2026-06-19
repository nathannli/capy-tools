import { Text, Container, Spacer } from "@earendil-works/pi-tui";
import { formatSize } from "@earendil-works/pi-coding-agent";
import { renderEditDiffResult, renderWriteDiffResult } from "./diff-renderer.ts";
import { DEFAULT_TOOL_DISPLAY_CONFIG } from "./types.ts";
import {
  buildPendingEditPreviewData,
  buildPendingWritePreviewData,
  readWorkspaceUtf8File,
  type PendingDiffPreviewData,
} from "./pending-diff-preview.ts";
import {
  countWriteContentLines,
  getWriteContentSizeBytes,
  shouldRenderWriteCallSummary,
} from "./write-display-utils.ts";
import { extractTextOutput, shortenPath, pluralize } from "./render-utils.ts";

interface RenderTheme {
  fg(color: string, text: string): string;
  bg?(color: string, text: string): string;
  bold?(text: string): string;
  getFgAnsi?(color: string): string;
  getBgAnsi?(color: string): string;
}

interface ToolRenderContextLike {
  args?: unknown;
  toolCallId?: string;
  state?: unknown;
  cwd?: string;
  argsComplete?: boolean;
  isError?: boolean;
  isPartial?: boolean;
  expanded?: boolean;
}

interface ToolRenderOptionsLike {
  expanded?: boolean;
  isPartial?: boolean;
}

export interface WriteExecutionMeta {
  previousContent?: string;
  fileExistedBeforeWrite: boolean;
}

interface PendingDiffPreviewState {
  key?: string;
  data?: PendingDiffPreviewData;
}

const WRITE_EXECUTION_META_LIMIT = 100;
const WRITE_EXECUTION_META_STATE_KEY = "__capyToolsWriteExecutionMeta";
const EDIT_PENDING_PREVIEW_STATE_KEY = "__capyToolsEditPendingPreview";
const WRITE_PENDING_PREVIEW_STATE_KEY = "__capyToolsWritePendingPreview";

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function getStringField(value: unknown, field: string): string | undefined {
  const raw = toRecord(value)[field];
  return typeof raw === "string" ? raw : undefined;
}

function getToolPathArg(value: unknown): string | undefined {
  return getStringField(value, "file_path") ?? getStringField(value, "path");
}

function getToolContentArg(value: unknown): string | undefined {
  return getStringField(value, "content");
}

function countTextLines(value: unknown): number {
  if (typeof value !== "string") return 0;
  return value.replace(/\r/g, "").split("\n").length;
}

function getEditPayloadLineCount(value: unknown): number {
  const record = toRecord(value);
  const lines = record.lines;
  if (Array.isArray(lines)) return lines.filter((line): line is string => typeof line === "string").length;
  if (typeof lines === "string") return countTextLines(lines);
  return countTextLines(record.newText);
}

function getEditLineCount(value: unknown): number {
  const record = toRecord(value);
  const edits = Array.isArray(record.edits) ? record.edits : [];
  if (edits.length > 0) {
    return edits.reduce((total, edit) => total + getEditPayloadLineCount(edit), 0);
  }
  return getEditPayloadLineCount(record);
}

function isToolError(result: unknown, context?: ToolRenderContextLike): boolean {
  return context?.isError === true || toRecord(result).isError === true;
}

function toStateCarrier(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  return value as Record<string, unknown>;
}

export function captureWriteExecutionMeta(cwd: string, rawPath: unknown): WriteExecutionMeta {
  if (typeof rawPath !== "string" || !rawPath.trim()) {
    return { fileExistedBeforeWrite: false };
  }
  const existing = readWorkspaceUtf8File(cwd, rawPath);
  return {
    fileExistedBeforeWrite: existing.exists,
    previousContent: existing.content,
  };
}

export function recordWriteExecutionMeta(
  pendingMetaByToolCallId: Map<string, WriteExecutionMeta>,
  toolCallId: string,
  meta: WriteExecutionMeta,
): void {
  pendingMetaByToolCallId.delete(toolCallId);
  pendingMetaByToolCallId.set(toolCallId, meta);
  while (pendingMetaByToolCallId.size > WRITE_EXECUTION_META_LIMIT) {
    const oldestToolCallId = pendingMetaByToolCallId.keys().next().value;
    if (oldestToolCallId === undefined) return;
    pendingMetaByToolCallId.delete(oldestToolCallId);
  }
}

export function getWriteExecutionMeta(
  context: ToolRenderContextLike | undefined,
  pendingMetaByToolCallId: Map<string, WriteExecutionMeta>,
): WriteExecutionMeta | undefined {
  if (!context) return undefined;

  const carrier = toStateCarrier(context.state);
  const existing = carrier ? toRecord(carrier[WRITE_EXECUTION_META_STATE_KEY]) : undefined;
  if (existing && Object.keys(existing).length > 0) return existing as unknown as WriteExecutionMeta;

  if (!context.toolCallId) return undefined;
  const pending = pendingMetaByToolCallId.get(context.toolCallId);
  if (!pending) return undefined;

  if (carrier) {
    const storedMeta: WriteExecutionMeta = { ...pending };
    carrier[WRITE_EXECUTION_META_STATE_KEY] = storedMeta;
    pendingMetaByToolCallId.delete(context.toolCallId);
    return storedMeta;
  }
  return pending;
}

function getPendingDiffPreviewState(
  context: ToolRenderContextLike | undefined,
  stateKey: string,
): PendingDiffPreviewState | undefined {
  const carrier = toStateCarrier(context?.state);
  if (!carrier) return undefined;

  const current = carrier[stateKey];
  if (current && typeof current === "object" && !Array.isArray(current)) {
    return current as PendingDiffPreviewState;
  }

  const next: PendingDiffPreviewState = {};
  carrier[stateKey] = next;
  return next;
}

function resolvePendingDiffPreview(
  context: ToolRenderContextLike | undefined,
  stateKey: string,
  previewKey: string | undefined,
  compute: () => PendingDiffPreviewData | undefined,
): PendingDiffPreviewData | undefined {
  const previewState = getPendingDiffPreviewState(context, stateKey);
  if (!previewState) return compute();

  if (previewState.key !== previewKey) {
    previewState.key = previewKey;
    previewState.data = previewKey ? compute() : undefined;
  }
  return previewState.data;
}

function buildPendingDiffCallComponent(
  summaryText: string,
  previewData: PendingDiffPreviewData | undefined,
  context: ToolRenderContextLike | undefined,
  theme: RenderTheme,
): Text | Container {
  if (!context?.isPartial || !previewData) return new Text(summaryText, 0, 0);

  const container = new Container();
  container.addChild(new Text(summaryText, 0, 0));
  container.addChild(new Spacer(1));

  if (previewData.notice || typeof previewData.nextContent !== "string") {
    container.addChild(new Text(theme.fg("warning", previewData.notice || "Preview unavailable."), 0, 0));
    return container;
  }

  container.addChild(
    renderWriteDiffResult(
      previewData.nextContent,
      {
        expanded: context.expanded === true,
        filePath: previewData.filePath,
        previousContent: previewData.previousContent,
        fileExistedBeforeWrite: previewData.fileExistedBeforeWrite,
        headerLabel: previewData.headerLabel,
      },
      DEFAULT_TOOL_DISPLAY_CONFIG,
      theme,
      "",
    ),
  );
  return container;
}

function formatLineCountSuffix(lineCount: number, theme: RenderTheme): string {
  return theme.fg("muted", ` (${lineCount} ${pluralize(lineCount, "line")})`);
}

function formatWriteCallSuffix(lineCount: number, sizeBytes: number, theme: RenderTheme): string {
  return theme.fg("muted", ` (${lineCount} ${pluralize(lineCount, "line")} • ${formatSize(sizeBytes)})`);
}

function formatInProgressLineCount(action: string, lineCount: number, theme: RenderTheme): string {
  return theme.fg("warning", `${action}...`) + formatLineCountSuffix(lineCount, theme);
}

export function renderRichEditCall(args: unknown, theme: RenderTheme, context: ToolRenderContextLike): Text | Container {
  const path = shortenPath(getToolPathArg(args));
  const lineCount = getEditLineCount(args);
  const summaryText = `${theme.fg("toolTitle", theme.bold?.("edit") ?? "edit")} ${theme.fg("accent", path || "...")}${formatLineCountSuffix(lineCount, theme)}`;
  if (!context?.argsComplete || !context.isPartial) return new Text(summaryText, 0, 0);

  const previewKey = JSON.stringify({
    path: getToolPathArg(args) ?? null,
    edits: toRecord(args).edits ?? null,
    oldText: getStringField(args, "oldText") ?? null,
    newText: getStringField(args, "newText") ?? null,
  });
  const previewData = resolvePendingDiffPreview(
    context,
    EDIT_PENDING_PREVIEW_STATE_KEY,
    previewKey,
    () => buildPendingEditPreviewData(args, context.cwd ?? process.cwd()),
  );
  return buildPendingDiffCallComponent(summaryText, previewData, context, theme);
}

export function renderRichEditResult(
  result: { content?: Array<{ type: string; text?: string }>; details?: unknown; isError?: boolean },
  options: ToolRenderOptionsLike,
  theme: RenderTheme,
  context?: ToolRenderContextLike,
): unknown {
  const lineCount = getEditLineCount(context?.args);
  if (options.isPartial) return new Text(formatInProgressLineCount("editing", lineCount, theme), 0, 0);

  const fallbackText = extractTextOutput(result);
  if (isToolError(result, context)) return new Text(theme.fg("error", fallbackText || "Edit failed."), 0, 0);

  return renderEditDiffResult(
    result.details,
    { expanded: options.expanded === true, filePath: getToolPathArg(context?.args) },
    DEFAULT_TOOL_DISPLAY_CONFIG,
    theme,
    fallbackText,
  );
}

export function renderRichWriteCall(args: unknown, theme: RenderTheme, context: ToolRenderContextLike): Text | Container {
  const content = getToolContentArg(args);
  const lineCount = countWriteContentLines(content);
  const sizeBytes = getWriteContentSizeBytes(content);
  const path = shortenPath(getToolPathArg(args));
  const suffix = shouldRenderWriteCallSummary({ hasContent: content !== undefined, hasDetailedResultHeader: false })
    ? formatWriteCallSuffix(lineCount, sizeBytes, theme)
    : "";
  const summaryText = `${theme.fg("toolTitle", theme.bold?.("write") ?? "write")} ${theme.fg("accent", path || "...")}${suffix}`;
  if (!context?.argsComplete || !context.isPartial) return new Text(summaryText, 0, 0);

  const previewKey = JSON.stringify({ path: getToolPathArg(args) ?? null, content: content ?? null });
  const previewData = resolvePendingDiffPreview(
    context,
    WRITE_PENDING_PREVIEW_STATE_KEY,
    previewKey,
    () => buildPendingWritePreviewData(args, context.cwd ?? process.cwd()),
  );
  return buildPendingDiffCallComponent(summaryText, previewData, context, theme);
}

export function renderRichWriteResult(
  result: { content?: Array<{ type: string; text?: string }>; details?: unknown; isError?: boolean },
  options: ToolRenderOptionsLike,
  theme: RenderTheme,
  context: ToolRenderContextLike | undefined,
  writeExecutionMetaByToolCallId: Map<string, WriteExecutionMeta>,
): unknown {
  const content = getToolContentArg(context?.args);
  const lineCount = countWriteContentLines(content);
  if (options.isPartial) return new Text(formatInProgressLineCount("writing", lineCount, theme), 0, 0);

  const fallbackText = extractTextOutput(result);
  if (isToolError(result, context)) return new Text(theme.fg("error", fallbackText || "Write failed."), 0, 0);

  const executionMeta = getWriteExecutionMeta(context, writeExecutionMetaByToolCallId);
  return renderWriteDiffResult(
    content,
    {
      expanded: options.expanded === true,
      filePath: getToolPathArg(context?.args),
      previousContent: executionMeta?.previousContent,
      fileExistedBeforeWrite: executionMeta?.fileExistedBeforeWrite ?? false,
    },
    DEFAULT_TOOL_DISPLAY_CONFIG,
    theme,
    fallbackText,
  );
}
