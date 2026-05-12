import { describe, expect, test } from "bun:test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import applyPatchExtension from "../extensions/apply-patch.ts";
import { createExtensionHost, withTempDir } from "./extension-host.ts";

async function runPatch(cwd: string, patchText: string) {
  const host = createExtensionHost({ cwd });
  applyPatchExtension(host.api as any);
  return await host.runTool("apply_patch", { patchText });
}

describe("apply_patch", () => {
  test("applies add, update, and delete operations in one real filesystem patch", async () => {
    await withTempDir(async (dir) => {
      await writeFile(join(dir, "modify.txt"), "line1\nline2\n", "utf8");
      await writeFile(join(dir, "delete.txt"), "obsolete\n", "utf8");

      const result = await runPatch(
        dir,
        "*** Begin Patch\n*** Add File: nested/new.txt\n+created\n*** Delete File: delete.txt\n*** Update File: modify.txt\n@@\n-line2\n+changed\n*** End Patch",
      );

      expect(result.content[0].text).toContain("Success. Updated the following files");
      expect(result.content[0].text).toContain("A nested/new.txt");
      expect(result.content[0].text).toContain("D delete.txt");
      expect(result.content[0].text).toContain("M modify.txt");
      expect(await readFile(join(dir, "nested", "new.txt"), "utf8")).toBe("created\n");
      expect(await readFile(join(dir, "modify.txt"), "utf8")).toBe("line1\nchanged\n");
      expect(existsSync(join(dir, "delete.txt"))).toBe(false);
      expect(result.details.files.map((file: any) => file.type).sort()).toEqual(["add", "delete", "update"]);
      expect(result.details.diff).toContain("File: modify.txt");
    });
  });

  test("moves a file into a new directory", async () => {
    await withTempDir(async (dir) => {
      await mkdir(join(dir, "old"), { recursive: true });
      await writeFile(join(dir, "old", "name.txt"), "old content\n", "utf8");

      await runPatch(
        dir,
        "*** Begin Patch\n*** Update File: old/name.txt\n*** Move to: renamed/dir/name.txt\n@@\n-old content\n+new content\n*** End Patch",
      );

      expect(existsSync(join(dir, "old", "name.txt"))).toBe(false);
      expect(await readFile(join(dir, "renamed", "dir", "name.txt"), "utf8")).toBe("new content\n");
    });
  });

  test("supports Codex/opencode heredoc patches and add-file overwrite", async () => {
    await withTempDir(async (dir) => {
      await writeFile(join(dir, "duplicate.txt"), "old content\n", "utf8");

      const result = await runPatch(
        dir,
        "cat <<'EOF'\n*** Begin Patch\n*** Add File: duplicate.txt\n+new content\n*** End Patch\nEOF",
      );

      expect(await readFile(join(dir, "duplicate.txt"), "utf8")).toBe("new content\n");
      expect(result.content[0].text).toContain("A duplicate.txt");
      expect(result.details.diff).toContain("old content");
      expect(result.details.diff).toContain("new content");
    });
  });

  test("rejects invalid patch text without mutating files", async () => {
    await withTempDir(async (dir) => {
      await writeFile(join(dir, "modify.txt"), "line1\nline2\n", "utf8");

      await expect(
        runPatch(
          dir,
          "*** Begin Patch\n*** Add File: created.txt\n+hello\n*** Update File: missing.txt\n@@\n-old\n+new\n*** End Patch",
        ),
      ).rejects.toThrow("Preflight failed before mutating files");

      expect(await readFile(join(dir, "modify.txt"), "utf8")).toBe("line1\nline2\n");
      expect(existsSync(join(dir, "created.txt"))).toBe(false);
    });
  });

  test("rejects missing update context and preserves target content", async () => {
    await withTempDir(async (dir) => {
      await writeFile(join(dir, "modify.txt"), "line1\nline2\n", "utf8");

      await expect(
        runPatch(dir, "*** Begin Patch\n*** Update File: modify.txt\n@@\n-missing\n+changed\n*** End Patch"),
      ).rejects.toThrow("Failed to find expected lines");

      expect(await readFile(join(dir, "modify.txt"), "utf8")).toBe("line1\nline2\n");
    });
  });

  test("rejects empty patches", async () => {
    await withTempDir(async (dir) => {
      await expect(runPatch(dir, "*** Begin Patch\n*** End Patch")).rejects.toThrow("no file operations");
    });
  });
});
