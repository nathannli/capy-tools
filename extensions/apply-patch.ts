/**
 * Apply Patch Extension
 *
 * Registers an `apply_patch` tool compatible with the Codex/opencode patch
 * language. This is intentionally separate from pi's built-in `edit` tool:
 * use `edit` for exact replacement edits and `apply_patch` for add/update/
 * delete/move patches that touch one or more files.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Box, Container, Spacer, Text } from "@earendil-works/pi-tui";
import { Type } from "@sinclair/typebox";
import { constants } from "fs";
import { access as fsAccess, mkdir as fsMkdir, readFile as fsReadFile, unlink as fsUnlink, writeFile as fsWriteFile } from "fs/promises";
import { dirname, isAbsolute, relative, resolve as resolvePath } from "path";
import { diffLines } from "../vendor/diff/line.js";

const BEGIN_PATCH = "*** Begin Patch";
const END_PATCH = "*** End Patch";
const ADD_FILE = "*** Add File: ";
const DELETE_FILE = "*** Delete File: ";
const UPDATE_FILE = "*** Update File: ";
const MOVE_TO = "*** Move to: ";
const END_OF_FILE = "*** End of File";

const applyPatchSchema = Type.Object({
	patchText: Type.String({
		description: "Codex/opencode-style patch payload: *** Begin Patch ... *** End Patch",
	}),
});

interface ApplyPatchInput {
	patchText: string;
}

interface UpdateChunk {
	changeContext?: string;
	oldLines: string[];
	newLines: string[];
	isEndOfFile: boolean;
}

type PatchOperation =
	| { kind: "add"; path: string; contents: string }
	| { kind: "delete"; path: string }
	| { kind: "update"; path: string; movePath?: string; chunks: UpdateChunk[] };

interface Workspace {
	readText: (absolutePath: string) => Promise<string>;
	writeText: (absolutePath: string, content: string) => Promise<void>;
	deleteFile: (absolutePath: string) => Promise<void>;
	exists: (absolutePath: string) => Promise<boolean>;
	checkWritableTarget: (absolutePath: string, kind: PatchOperation["kind"]) => Promise<void>;
}

interface FileDiff {
	filePath: string;
	relativePath: string;
	type: "add" | "delete" | "update" | "move";
	movePath?: string;
	diff: string;
	additions: number;
	deletions: number;
	firstChangedLine?: number;
}

interface ApplyPatchResultDetails {
	diff: string;
	files: Array<{
		filePath: string;
		relativePath: string;
		type: FileDiff["type"];
		patch: string;
		additions: number;
		deletions: number;
		movePath?: string;
	}>;
	firstChangedLine?: number;
}

type PatchPreview = { diff: string; files: FileDiff[]; firstChangedLine?: number } | { error: string };

function normalizeToLF(text: string): string {
	return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function detectLineEnding(content: string): "\n" | "\r\n" {
	const crlfIdx = content.indexOf("\r\n");
	const lfIdx = content.indexOf("\n");
	if (lfIdx === -1 || crlfIdx === -1) return "\n";
	return crlfIdx < lfIdx ? "\r\n" : "\n";
}

function restoreLineEndings(text: string, ending: "\n" | "\r\n"): string {
	return ending === "\r\n" ? text.replace(/\n/g, "\r\n") : text;
}

function splitBom(content: string): { bom: string; text: string } {
	return content.startsWith("\uFEFF") ? { bom: "\uFEFF", text: content.slice(1) } : { bom: "", text: content };
}

function ensureTrailingNewline(content: string): string {
	return content.endsWith("\n") ? content : `${content}\n`;
}

function stripHeredocWrapper(input: string): string {
	const normalized = normalizeToLF(input).trim();
	const lines = normalized.split("\n");
	if (lines.length < 3) return normalized;

	const match = lines[0].match(/^(?:cat\s+)?<<[-]?['\"]?([A-Za-z_][A-Za-z0-9_]*)['\"]?$/);
	if (!match) return normalized;

	const delimiter = match[1];
	if (lines[lines.length - 1].trim() !== delimiter) return normalized;
	return lines.slice(1, -1).join("\n").trim();
}

function normalizePatchText(patchText: string): string {
	return stripHeredocWrapper(patchText);
}

function resolvePatchPath(cwd: string, filePath: string): string {
	const trimmed = filePath.trim();
	if (!trimmed) throw new Error("Patch path cannot be empty");
	return isAbsolute(trimmed) ? resolvePath(trimmed) : resolvePath(cwd, trimmed);
}

function displayPath(cwd: string, filePath: string): string {
	const abs = resolvePatchPath(cwd, filePath);
	const rel = relative(cwd, abs).replace(/\\/g, "/");
	return rel && !rel.startsWith("..") ? rel : abs;
}

function normalizeLineForFuzzyMatch(value: string): string {
	return value
		.trim()
		.normalize("NFKC")
		.replace(/[\u2010\u2011\u2012\u2013\u2014\u2015\u2212]/g, "-")
		.replace(/[\u2018\u2019\u201A\u201B]/g, "'")
		.replace(/[\u201C\u201D\u201E\u201F]/g, '"')
		.replace(/[\u00A0\u2002-\u200A\u202F\u205F\u3000]/g, " ");
}

function tryMatch(
	lines: string[],
	pattern: string[],
	start: number,
	eof: boolean,
	compare: (a: string, b: string) => boolean,
): number | undefined {
	if (pattern.length === 0) return start;
	if (pattern.length > lines.length) return undefined;

	if (eof) {
		const fromEnd = lines.length - pattern.length;
		if (fromEnd >= start && pattern.every((line, idx) => compare(lines[fromEnd + idx], line))) {
			return fromEnd;
		}
	}

	for (let i = start; i <= lines.length - pattern.length; i++) {
		let matched = true;
		for (let p = 0; p < pattern.length; p++) {
			if (!compare(lines[i + p], pattern[p])) {
				matched = false;
				break;
			}
		}
		if (matched) return i;
	}

	return undefined;
}

function seekSequence(lines: string[], pattern: string[], start: number, eof: boolean): number | undefined {
	const passes: Array<(a: string, b: string) => boolean> = [
		(a, b) => a === b,
		(a, b) => a.trimEnd() === b.trimEnd(),
		(a, b) => a.trim() === b.trim(),
		(a, b) => normalizeLineForFuzzyMatch(a) === normalizeLineForFuzzyMatch(b),
	];

	for (const compare of passes) {
		const found = tryMatch(lines, pattern, start, eof, compare);
		if (found !== undefined) return found;
	}

	return undefined;
}

function applyReplacements(lines: string[], replacements: Array<[number, number, string[]]>): string[] {
	const next = [...lines];
	for (const [start, oldLen, newSegment] of [...replacements].sort((a, b) => b[0] - a[0])) {
		next.splice(start, oldLen, ...newSegment);
	}
	return next;
}

function deriveUpdatedContent(filePath: string, currentContent: string, chunks: UpdateChunk[]): string {
	const originalLines = currentContent.split("\n");
	if (originalLines[originalLines.length - 1] === "") originalLines.pop();

	const replacements: Array<[number, number, string[]]> = [];
	let lineIndex = 0;

	for (const chunk of chunks) {
		if (chunk.changeContext !== undefined) {
			const ctxIndex = seekSequence(originalLines, [chunk.changeContext], lineIndex, false);
			if (ctxIndex === undefined) {
				throw new Error(`Failed to find context '${chunk.changeContext}' in ${filePath}`);
			}
			lineIndex = ctxIndex + 1;
		}

		if (chunk.oldLines.length === 0) {
			const insertAt = originalLines[originalLines.length - 1] === "" ? originalLines.length - 1 : originalLines.length;
			replacements.push([insertAt, 0, [...chunk.newLines]]);
			continue;
		}

		let pattern = chunk.oldLines;
		let newSlice = chunk.newLines;
		let found = seekSequence(originalLines, pattern, lineIndex, chunk.isEndOfFile);

		if (found === undefined && pattern[pattern.length - 1] === "") {
			pattern = pattern.slice(0, -1);
			if (newSlice[newSlice.length - 1] === "") newSlice = newSlice.slice(0, -1);
			found = seekSequence(originalLines, pattern, lineIndex, chunk.isEndOfFile);
		}

		if (found === undefined) {
			throw new Error(`Failed to find expected lines in ${filePath}:\n${chunk.oldLines.join("\n")}`);
		}

		replacements.push([found, pattern.length, [...newSlice]]);
		lineIndex = found + pattern.length;
	}

	const newLines = applyReplacements(originalLines, replacements);
	if (newLines[newLines.length - 1] !== "") newLines.push("");
	return newLines.join("\n");
}

function parseUpdateChunk(lines: string[], startIndex: number, lastContentLine: number): { chunk: UpdateChunk; nextIndex: number } {
	let i = startIndex;
	let changeContext: string | undefined;
	const first = lines[i].trimEnd();

	if (first === "@@") {
		i++;
	} else if (first.startsWith("@@ ")) {
		changeContext = first.slice(3);
		i++;
	} else {
		throw new Error(`Expected update hunk to start with @@ context marker, got: '${lines[i]}'`);
	}

	const oldLines: string[] = [];
	const newLines: string[] = [];
	let parsed = 0;
	let isEndOfFile = false;

	while (i <= lastContentLine) {
		const raw = lines[i];
		const trimmed = raw.trimEnd();

		if (trimmed === END_OF_FILE) {
			if (parsed === 0) throw new Error("Update hunk does not contain any lines");
			isEndOfFile = true;
			i++;
			break;
		}

		if (parsed > 0 && (trimmed.startsWith("@@") || trimmed.startsWith("*** "))) break;

		if (raw.length === 0) {
			oldLines.push("");
			newLines.push("");
			parsed++;
			i++;
			continue;
		}

		const marker = raw[0];
		const body = raw.slice(1);
		if (marker === " ") {
			oldLines.push(body);
			newLines.push(body);
		} else if (marker === "-") {
			oldLines.push(body);
		} else if (marker === "+") {
			newLines.push(body);
		} else {
			throw new Error(`Unexpected line found in update hunk: '${raw}'. Every hunk line must start with ' ', '+', or '-'.`);
		}

		parsed++;
		i++;
	}

	if (parsed === 0) throw new Error("Update hunk does not contain any lines");
	return { chunk: { changeContext, oldLines, newLines, isEndOfFile }, nextIndex: i };
}

function parsePatch(patchText: string): PatchOperation[] {
	const lines = normalizePatchText(patchText).split("\n");
	while (lines.length > 0 && lines[0].trim() === "") lines.shift();
	while (lines.length > 0 && lines[lines.length - 1].trim() === "") lines.pop();

	if (lines.length < 2) throw new Error("Patch is empty or invalid");
	if (lines[0].trim() !== BEGIN_PATCH) throw new Error(`The first line of the patch must be '${BEGIN_PATCH}'`);
	if (lines[lines.length - 1].trim() !== END_PATCH) throw new Error(`The last line of the patch must be '${END_PATCH}'`);

	const operations: PatchOperation[] = [];
	let i = 1;
	const lastContentLine = lines.length - 2;

	while (i <= lastContentLine) {
		if (lines[i].trim() === "") {
			i++;
			continue;
		}

		const line = lines[i].trimEnd();
		if (line.startsWith(ADD_FILE)) {
			const path = line.slice(ADD_FILE.length).trim();
			i++;
			const contentLines: string[] = [];
			while (i <= lastContentLine) {
				const next = lines[i];
				if (next.trimEnd().startsWith("*** ")) break;
				if (!next.startsWith("+")) throw new Error(`Invalid add-file line '${next}'. Add file lines must start with '+'.`);
				contentLines.push(next.slice(1));
				i++;
			}
			if (contentLines.length === 0) throw new Error(`Add file hunk for path '${path}' is empty`);
			operations.push({ kind: "add", path, contents: ensureTrailingNewline(contentLines.join("\n")) });
			continue;
		}

		if (line.startsWith(DELETE_FILE)) {
			const path = line.slice(DELETE_FILE.length).trim();
			operations.push({ kind: "delete", path });
			i++;
			continue;
		}

		if (line.startsWith(UPDATE_FILE)) {
			const path = line.slice(UPDATE_FILE.length).trim();
			i++;
			let movePath: string | undefined;
			if (i <= lastContentLine && lines[i].trimEnd().startsWith(MOVE_TO)) {
				movePath = lines[i].trimEnd().slice(MOVE_TO.length).trim();
				i++;
			}

			const chunks: UpdateChunk[] = [];
			while (i <= lastContentLine) {
				if (lines[i].trim() === "") {
					i++;
					continue;
				}
				if (lines[i].trimEnd().startsWith("*** ")) break;
				const parsed = parseUpdateChunk(lines, i, lastContentLine);
				chunks.push(parsed.chunk);
				i = parsed.nextIndex;
			}

			if (chunks.length === 0) throw new Error(`Update file hunk for path '${path}' is empty`);
			operations.push({ kind: "update", path, movePath, chunks });
			continue;
		}

		throw new Error(`'${line}' is not a valid hunk header. Valid headers: '${ADD_FILE}', '${DELETE_FILE}', '${UPDATE_FILE}'.`);
	}

	if (operations.length === 0) throw new Error("Patch rejected: no file operations found");
	return operations;
}

async function pathExists(absolutePath: string): Promise<boolean> {
	try {
		await fsAccess(absolutePath, constants.F_OK);
		return true;
	} catch {
		return false;
	}
}

async function findExistingParent(absolutePath: string): Promise<string> {
	let parent = dirname(absolutePath);
	while (!(await pathExists(parent))) {
		const next = dirname(parent);
		if (next === parent) break;
		parent = next;
	}
	return parent;
}

function createRealWorkspace(): Workspace {
	return {
		readText: (absolutePath) => fsReadFile(absolutePath, "utf-8"),
		writeText: async (absolutePath, content) => {
			await fsMkdir(dirname(absolutePath), { recursive: true });
			await fsWriteFile(absolutePath, content, "utf-8");
		},
		deleteFile: (absolutePath) => fsUnlink(absolutePath),
		exists: pathExists,
		checkWritableTarget: async (absolutePath, kind) => {
			if (kind === "add") {
				const parent = await findExistingParent(absolutePath);
				await fsAccess(parent, constants.W_OK);
				return;
			}
			await fsAccess(absolutePath, constants.R_OK | constants.W_OK);
			await fsAccess(dirname(absolutePath), constants.W_OK);
		},
	};
}

function createVirtualWorkspace(cwd: string): Workspace {
	const state = new Map<string, string | null>();

	async function ensureLoaded(absolutePath: string): Promise<void> {
		if (state.has(absolutePath)) return;
		try {
			state.set(absolutePath, await fsReadFile(absolutePath, "utf-8"));
		} catch {
			state.set(absolutePath, null);
		}
	}

	return {
		readText: async (absolutePath) => {
			await ensureLoaded(absolutePath);
			const content = state.get(absolutePath);
			if (content === null || content === undefined) throw new Error(`File not found: ${relative(cwd, absolutePath)}`);
			return content;
		},
		writeText: async (absolutePath, content) => {
			state.set(absolutePath, content);
		},
		deleteFile: async (absolutePath) => {
			await ensureLoaded(absolutePath);
			if (state.get(absolutePath) === null) throw new Error(`File not found: ${relative(cwd, absolutePath)}`);
			state.set(absolutePath, null);
		},
		exists: async (absolutePath) => {
			await ensureLoaded(absolutePath);
			return state.get(absolutePath) !== null;
		},
		checkWritableTarget: async () => {
			// The virtual workspace is for correctness preflight only.
		},
	};
}

function generateDiffString(oldContent: string, newContent: string, contextLines = 4): { diff: string; firstChangedLine?: number; additions: number; deletions: number } {
	const parts = diffLines(oldContent, newContent);
	const output: string[] = [];
	const oldLines = oldContent.split("\n");
	const newLines = newContent.split("\n");
	const maxLineNum = Math.max(oldLines.length, newLines.length);
	const lineNumWidth = String(maxLineNum).length;
	let oldLineNum = 1;
	let newLineNum = 1;
	let firstChangedLine: number | undefined;
	let additions = 0;
	let deletions = 0;
	let lastWasChange = false;

	for (let i = 0; i < parts.length; i++) {
		const part = parts[i];
		const raw = part.value.split("\n");
		if (raw[raw.length - 1] === "") raw.pop();

		if (part.added || part.removed) {
			if (firstChangedLine === undefined) firstChangedLine = newLineNum;
			for (const line of raw) {
				if (part.added) {
					output.push(`+${String(newLineNum).padStart(lineNumWidth, " ")} ${line}`);
					newLineNum++;
					additions++;
				} else {
					output.push(`-${String(oldLineNum).padStart(lineNumWidth, " ")} ${line}`);
					oldLineNum++;
					deletions++;
				}
			}
			lastWasChange = true;
			continue;
		}

		const nextPartIsChange = i < parts.length - 1 && (parts[i + 1].added || parts[i + 1].removed);
		if (lastWasChange || nextPartIsChange) {
			const showAtStart = lastWasChange ? contextLines : 0;
			const showAtEnd = nextPartIsChange ? contextLines : 0;
			if (raw.length <= showAtStart + showAtEnd) {
				for (const line of raw) {
					output.push(` ${String(oldLineNum).padStart(lineNumWidth, " ")} ${line}`);
					oldLineNum++;
					newLineNum++;
				}
			} else {
				for (let j = 0; j < showAtStart; j++) {
					output.push(` ${String(oldLineNum).padStart(lineNumWidth, " ")} ${raw[j]}`);
					oldLineNum++;
					newLineNum++;
				}
				const skipped = raw.length - showAtStart - showAtEnd;
				if (skipped > 0) {
					output.push(` ${"".padStart(lineNumWidth, " ")} ...`);
					oldLineNum += skipped;
					newLineNum += skipped;
				}
				for (let j = raw.length - showAtEnd; j < raw.length; j++) {
					output.push(` ${String(oldLineNum).padStart(lineNumWidth, " ")} ${raw[j]}`);
					oldLineNum++;
					newLineNum++;
				}
			}
		} else {
			oldLineNum += raw.length;
			newLineNum += raw.length;
		}
		lastWasChange = false;
	}

	return { diff: output.join("\n"), firstChangedLine, additions, deletions };
}

async function applyPatchOperations(ops: PatchOperation[], workspace: Workspace, cwd: string, signal?: AbortSignal, collectDiff = false): Promise<FileDiff[]> {
	const changes: FileDiff[] = [];

	for (const op of ops) {
		if (signal?.aborted) throw new Error("Operation aborted");
		const abs = resolvePatchPath(cwd, op.path);
		const exists = await workspace.exists(abs);
		if (op.kind !== "add" && !exists) throw new Error(`Failed to ${op.kind} ${op.path}: file does not exist.`);
		await workspace.checkWritableTarget(abs, op.kind === "add" && exists ? "update" : op.kind);
		if (op.kind === "update" && op.movePath) {
			await workspace.checkWritableTarget(resolvePatchPath(cwd, op.movePath), "add");
		}
	}

	for (const op of ops) {
		if (signal?.aborted) throw new Error("Operation aborted");

		if (op.kind === "add") {
			const abs = resolvePatchPath(cwd, op.path);
			const oldText = (await workspace.exists(abs)) ? await workspace.readText(abs) : "";
			const newText = ensureTrailingNewline(op.contents);
			await workspace.writeText(abs, newText);
			const diff = collectDiff ? generateDiffString(oldText, newText) : { diff: "", additions: 0, deletions: 0 };
			changes.push({
				filePath: abs,
				relativePath: displayPath(cwd, op.path),
				type: "add",
				diff: diff.diff,
				additions: diff.additions,
				deletions: diff.deletions,
				firstChangedLine: diff.firstChangedLine,
			});
			continue;
		}

		if (op.kind === "delete") {
			const abs = resolvePatchPath(cwd, op.path);
			const oldText = await workspace.readText(abs);
			await workspace.deleteFile(abs);
			const diff = collectDiff ? generateDiffString(oldText, "") : { diff: "", additions: 0, deletions: 0 };
			changes.push({
				filePath: abs,
				relativePath: displayPath(cwd, op.path),
				type: "delete",
				diff: diff.diff,
				additions: diff.additions,
				deletions: diff.deletions,
				firstChangedLine: diff.firstChangedLine,
			});
			continue;
		}

		const sourceAbs = resolvePatchPath(cwd, op.path);
		const sourceRaw = await workspace.readText(sourceAbs);
		const source = splitBom(sourceRaw);
		const lineEnding = detectLineEnding(source.text);
		const normalizedSource = normalizeToLF(source.text);
		const normalizedUpdated = deriveUpdatedContent(op.path, normalizedSource, op.chunks);
		const finalContent = source.bom + restoreLineEndings(normalizedUpdated, lineEnding);
		const targetAbs = op.movePath ? resolvePatchPath(cwd, op.movePath) : sourceAbs;

		await workspace.writeText(targetAbs, finalContent);
		if (op.movePath) await workspace.deleteFile(sourceAbs);

		const diff = collectDiff ? generateDiffString(normalizedSource, normalizedUpdated) : { diff: "", additions: 0, deletions: 0 };
		changes.push({
			filePath: targetAbs,
			relativePath: displayPath(cwd, op.movePath ?? op.path),
			type: op.movePath ? "move" : "update",
			movePath: op.movePath ? displayPath(cwd, op.movePath) : undefined,
			diff: diff.diff,
			additions: diff.additions,
			deletions: diff.deletions,
			firstChangedLine: diff.firstChangedLine,
		});
	}

	return changes;
}

function combinedDiff(files: FileDiff[]): string {
	return files
		.filter((file) => file.diff)
		.map((file) => `File: ${file.relativePath}\n${file.diff}`)
		.join("\n\n");
}

function summaryLine(file: FileDiff): string {
	if (file.type === "add") return `A ${file.relativePath}`;
	if (file.type === "delete") return `D ${file.relativePath}`;
	if (file.type === "move") return `R ${file.relativePath}`;
	return `M ${file.relativePath}`;
}

function mutationPathsForOps(ops: PatchOperation[], cwd: string): string[] {
	const paths = new Set<string>();
	for (const op of ops) {
		paths.add(resolvePatchPath(cwd, op.path));
		if (op.kind === "update" && op.movePath) paths.add(resolvePatchPath(cwd, op.movePath));
	}
	return [...paths].sort();
}

const mutationQueues = new Map<string, Promise<void>>();

async function withFileMutationQueueLocal<T>(filePath: string, fn: () => Promise<T>): Promise<T> {
	const previous = mutationQueues.get(filePath) ?? Promise.resolve();
	let release!: () => void;
	const gate = new Promise<void>((resolve) => {
		release = resolve;
	});
	const current = previous.catch(() => undefined).then(() => gate);
	mutationQueues.set(filePath, current);

	await previous.catch(() => undefined);
	try {
		return await fn();
	} finally {
		release();
		if (mutationQueues.get(filePath) === current) mutationQueues.delete(filePath);
	}
}

async function withMutationQueues<T>(paths: string[], fn: () => Promise<T>): Promise<T> {
	const unique = [...new Set(paths)].sort();
	let run = fn;
	for (const filePath of unique.reverse()) {
		const next = run;
		run = () => withFileMutationQueueLocal(filePath, next);
	}
	return run();
}

async function previewPatch(patchText: string, cwd: string, signal?: AbortSignal): Promise<PatchPreview> {
	try {
		const ops = parsePatch(patchText);
		const files = await applyPatchOperations(ops, createVirtualWorkspace(cwd), cwd, signal, true);
		return { diff: combinedDiff(files), files, firstChangedLine: files.find((file) => file.firstChangedLine !== undefined)?.firstChangedLine };
	} catch (error) {
		return { error: error instanceof Error ? error.message : String(error) };
	}
}

async function applyPatch(patchText: string, cwd: string, signal?: AbortSignal): Promise<{ content: Array<{ type: "text"; text: string }>; details: ApplyPatchResultDetails }> {
	const ops = parsePatch(patchText);
	const mutationPaths = mutationPathsForOps(ops, cwd);

	return withMutationQueues(mutationPaths, async () => {
		try {
			await applyPatchOperations(ops, createVirtualWorkspace(cwd), cwd, signal, false);
		} catch (error) {
			throw new Error(`Preflight failed before mutating files.\n${error instanceof Error ? error.message : String(error)}`);
		}

		const files = await applyPatchOperations(ops, createRealWorkspace(), cwd, signal, true);
		const diff = combinedDiff(files);
		const firstChangedLine = files.find((file) => file.firstChangedLine !== undefined)?.firstChangedLine;
		const output = `Success. Updated the following files:\n${files.map(summaryLine).join("\n")}`;
		return {
			content: [{ type: "text", text: output }],
			details: {
				diff,
				files: files.map((file) => ({
					filePath: file.filePath,
					relativePath: file.relativePath,
					type: file.type,
					patch: file.diff,
					additions: file.additions,
					deletions: file.deletions,
					movePath: file.movePath,
				})),
				firstChangedLine,
			},
		};
	});
}

function prepareApplyPatchArguments(input: unknown): unknown {
	if (typeof input === "string") return { patchText: input };
	if (!input || typeof input !== "object") return input;
	const args = input as Record<string, unknown>;
	if (typeof args.patchText === "string") return args;
	if (typeof args.patch === "string") return { ...args, patchText: args.patch };
	return args;
}

function validateInput(input: unknown): ApplyPatchInput {
	const args = prepareApplyPatchArguments(input) as Partial<ApplyPatchInput>;
	if (!args || typeof args.patchText !== "string" || args.patchText.trim() === "") {
		throw new Error("apply_patch requires a non-empty patchText string.");
	}
	return { patchText: args.patchText };
}

function parseDiffLine(line: string): { prefix: string; lineNum: string; content: string } | null {
	const match = line.match(/^([+\-\s])(\s*\d*)\s(.*)$/);
	if (!match) return null;
	return { prefix: match[1], lineNum: match[2], content: match[3] };
}

function renderPatchDiff(diffText: string, theme: any): string {
	return diffText
		.split("\n")
		.map((line) => {
			if (line.startsWith("File: ")) return theme.fg("accent", line);
			const parsed = parseDiffLine(line);
			if (!parsed) return theme.fg("toolDiffContext", line);
			const content = parsed.content.replace(/\t/g, "   ");
			if (parsed.prefix === "+") return theme.fg("toolDiffAdded", `+${parsed.lineNum} ${content}`);
			if (parsed.prefix === "-") return theme.fg("toolDiffRemoved", `-${parsed.lineNum} ${content}`);
			return theme.fg("toolDiffContext", ` ${parsed.lineNum} ${content}`);
		})
		.join("\n");
}

function createApplyPatchCallComponent() {
	return Object.assign(new Box(1, 1, (text: string) => text), {
		preview: undefined as PatchPreview | undefined,
		previewArgsKey: undefined as string | undefined,
		previewPending: false,
		settledError: false,
	});
}

function getApplyPatchCallComponent(state: any, lastComponent: unknown) {
	if (lastComponent instanceof Box) {
		state.callComponent = lastComponent;
		return lastComponent as ReturnType<typeof createApplyPatchCallComponent>;
	}
	if (state.callComponent) return state.callComponent as ReturnType<typeof createApplyPatchCallComponent>;
	const component = createApplyPatchCallComponent();
	state.callComponent = component;
	return component;
}

function formatApplyPatchCall(args: unknown, theme: any): string {
	const prepared = prepareApplyPatchArguments(args) as Partial<ApplyPatchInput> | undefined;
	const patchText = typeof prepared?.patchText === "string" ? prepared.patchText : "";
	let suffix = "";
	if (patchText) {
		try {
			suffix = ` ${parsePatch(patchText).length} op(s)`;
		} catch {
			suffix = " invalid patch";
		}
	}
	return `${theme.fg("toolTitle", theme.bold("apply_patch"))}${theme.fg("toolOutput", suffix)}`;
}

function getHeaderBg(preview: PatchPreview | undefined, settledError: boolean, theme: any) {
	if (preview) return "error" in preview ? (text: string) => theme.bg("toolErrorBg", text) : (text: string) => theme.bg("toolSuccessBg", text);
	if (settledError) return (text: string) => theme.bg("toolErrorBg", text);
	return (text: string) => theme.bg("toolPendingBg", text);
}

function buildCallComponent(component: ReturnType<typeof createApplyPatchCallComponent>, args: unknown, theme: any) {
	component.setBgFn(getHeaderBg(component.preview, component.settledError, theme));
	component.clear();
	component.addChild(new Text(formatApplyPatchCall(args, theme), 0, 0));
	if (!component.preview) return component;
	component.addChild(new Spacer(1));
	const body = "error" in component.preview ? theme.fg("error", component.preview.error) : renderPatchDiff(component.preview.diff, theme);
	component.addChild(new Text(body, 0, 0));
	return component;
}

function setPreview(component: ReturnType<typeof createApplyPatchCallComponent>, preview: PatchPreview, argsKey?: string): boolean {
	const current = component.preview;
	const changed = current === undefined || JSON.stringify(current) !== JSON.stringify(preview);
	component.preview = preview;
	component.previewArgsKey = argsKey;
	component.previewPending = false;
	return changed;
}

export default function applyPatchExtension(pi: ExtensionAPI) {
	pi.registerTool({
		name: "apply_patch",
		label: "apply_patch",
		description:
			"Apply a Codex/opencode-style patch to files. Supports *** Add File, *** Delete File, and *** Update File with optional *** Move to. Use this for multi-file structural edits; use edit for exact text replacement.",
		promptSnippet: "Apply Codex/opencode-style add/update/delete/move patches across one or more files",
		promptGuidelines: [
			"Use apply_patch for multi-file changes, creating files, deleting files, or moving files with a Codex-style patch payload.",
			"Use edit for precise exact-text replacements inside existing files; use apply_patch when a patch is clearer than many replacements.",
			"Every apply_patch payload must start with *** Begin Patch and end with *** End Patch.",
			"In apply_patch Add File hunks, prefix every content line with +. In Update File hunks, prefix lines with space, -, or +.",
		],
		parameters: applyPatchSchema,
		renderShell: "self",
		prepareArguments: prepareApplyPatchArguments,

		async execute(_toolCallId, input, signal, _onUpdate, ctx) {
			const { patchText } = validateInput(input);
			return applyPatch(patchText, ctx.cwd, signal);
		},

		renderCall(args, theme, context) {
			const component = getApplyPatchCallComponent(context.state, context.lastComponent);
			const prepared = prepareApplyPatchArguments(args) as Partial<ApplyPatchInput> | undefined;
			const patchText = typeof prepared?.patchText === "string" ? prepared.patchText : undefined;
			const argsKey = patchText ? patchText : undefined;

			if (component.previewArgsKey !== argsKey) {
				component.preview = undefined;
				component.previewArgsKey = argsKey;
				component.previewPending = false;
				component.settledError = false;
			}

			if (context.argsComplete && patchText && !component.preview && !component.previewPending) {
				component.previewPending = true;
				const requestKey = argsKey;
				void previewPatch(patchText, context.cwd, context.signal).then((preview) => {
					if (component.previewArgsKey === requestKey) {
						setPreview(component, preview, requestKey);
						context.invalidate();
					}
				});
			}

			return buildCallComponent(component, args, theme);
		},

		renderResult(result, _options, theme, context) {
			const component = context.state.callComponent as ReturnType<typeof createApplyPatchCallComponent> | undefined;
			const typedResult = result as { details?: ApplyPatchResultDetails };
			let changed = false;

			if (component) {
				if (!context.isError && typedResult.details?.diff) {
					changed = setPreview(component, {
						diff: typedResult.details.diff,
						files: typedResult.details.files.map((file) => ({
							filePath: file.filePath,
							relativePath: file.relativePath,
							type: file.type,
							movePath: file.movePath,
							diff: file.patch,
							additions: file.additions,
							deletions: file.deletions,
						})),
						firstChangedLine: typedResult.details.firstChangedLine,
					}, component.previewArgsKey) || changed;
				}
				if (component.settledError !== context.isError) {
					component.settledError = context.isError;
					changed = true;
				}
				if (changed) buildCallComponent(component, context.args, theme);
			}

			const output = new Container();
			if (context.isError) {
				const text = result.content
					.filter((item: any) => item.type === "text")
					.map((item: any) => item.text || "")
					.join("\n");
				if (text) {
					output.addChild(new Spacer(1));
					output.addChild(new Text(theme.fg("error", text), 1, 0));
				}
			}
			return output;
		},
	});
}
