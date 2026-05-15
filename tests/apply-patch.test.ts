import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import applyPatchExtension from "../extensions/apply-patch.ts";
import { createExtensionHost, withTempDir } from "./extension-host.ts";

function plainTheme() {
  return {
    fg: (_name: string, text: string) => text,
    bold: (text: string) => text,
  };
}

function renderComponent(component: { render: (width: number) => string[] }) {
  return component.render(200).map((line) => line.trimEnd()).join("\n");
}

describe("apply_patch", () => {
  test("applies add, update, move, and delete hunks", async () => {
    await withTempDir(async (dir) => {
      await writeFile(join(dir, "source.txt"), "old\nkeep\n", "utf8");
      await writeFile(join(dir, "move.txt"), "before\n", "utf8");
      await writeFile(join(dir, "delete.txt"), "gone\n", "utf8");
      const host = createExtensionHost({ cwd: dir });
      applyPatchExtension(host.api as any);

      const result = await host.runTool("apply_patch", {
        patch: `*** Begin Patch
*** Add File: nested/new.txt
+hello
+world
*** Update File: source.txt
@@
-old
+new
 keep
*** Update File: move.txt
*** Move to: moved.txt
@@
-before
+after
*** Delete File: delete.txt
*** End Patch`,
      });

      expect(result.details).toMatchObject({ status: "success", totalFiles: 4, added: 1, modified: 2, deleted: 1, partialFailure: false });
      expect(result.content[0].text).toContain("Success. Updated the following files:");
      expect(result.content[0].text).toContain("A nested/new.txt");
      expect(result.content[0].text).toContain("M source.txt");
      expect(result.content[0].text).toContain("M moved.txt (from move.txt)");
      expect(result.content[0].text).toContain("D delete.txt");
      expect(await readFile(join(dir, "nested", "new.txt"), "utf8")).toBe("hello\nworld\n");
      expect(await readFile(join(dir, "source.txt"), "utf8")).toBe("new\nkeep\n");
      expect(await readFile(join(dir, "moved.txt"), "utf8")).toBe("after\n");
      expect(existsSync(join(dir, "move.txt"))).toBe(false);
      expect(existsSync(join(dir, "delete.txt"))).toBe(false);

      const tool = host.getTool("apply_patch");
      expect(renderComponent(tool.renderCall({}, plainTheme(), {}))).toBe("");
      const collapsed = renderComponent(tool.renderResult(result, { expanded: false, isPartial: false }, plainTheme(), {}));
      expect(collapsed).toBe("apply patch 4 files A1 M2 D1 (to expand)");
      expect(collapsed).not.toContain("source.txt");
      const expanded = renderComponent(tool.renderResult(result, { expanded: true, isPartial: false }, plainTheme(), {}));
      expect(expanded).toContain("M source.txt");
    });
  });

  test("allows absolute paths and lenient heredoc wrappers", async () => {
    await withTempDir(async (dir) => {
      const absoluteFile = join(dir, "absolute.txt");
      const host = createExtensionHost({ cwd: join(dir, "not-the-target") });
      applyPatchExtension(host.api as any);

      const result = await host.runTool("apply_patch", {
        patch: `<<'EOF'
*** Begin Patch
*** Add File: ${absoluteFile}
+absolute write
*** End Patch
EOF`,
      });

      expect(result.details.status).toBe("success");
      expect(result.details.changes[0]).toMatchObject({ type: "A", path: absoluteFile, absolutePath: absoluteFile });
      expect(await readFile(absoluteFile, "utf8")).toBe("absolute write\n");
    });
  });

  test("uses fuzzy matching for minor Unicode punctuation differences", async () => {
    await withTempDir(async (dir) => {
      await writeFile(join(dir, "unicode.txt"), "local import – avoids top‑level dep\n", "utf8");
      const host = createExtensionHost({ cwd: dir });
      applyPatchExtension(host.api as any);

      const result = await host.runTool("apply_patch", {
        patch: `*** Begin Patch
*** Update File: unicode.txt
@@
-local import - avoids top-level dep
+local import ok
*** End Patch`,
      });

      expect(result.details.status).toBe("success");
      expect(await readFile(join(dir, "unicode.txt"), "utf8")).toBe("local import ok\n");
    });
  });

  test("reports failure without recursively deleting directories", async () => {
    await withTempDir(async (dir) => {
      await mkdir(join(dir, "folder"));
      const host = createExtensionHost({ cwd: dir });
      applyPatchExtension(host.api as any);

      const result = await host.runTool("apply_patch", {
        patch: `*** Begin Patch
*** Delete File: folder
*** End Patch`,
      });

      expect(result.details.status).toBe("failed");
      expect(result.details.totalFiles).toBe(0);
      expect(result.details.error).toContain("path is a directory");
      expect(existsSync(join(dir, "folder"))).toBe(true);

      const tool = host.getTool("apply_patch");
      const collapsed = renderComponent(tool.renderResult(result, { expanded: false, isPartial: false }, plainTheme(), {}));
      expect(collapsed).toBe("apply patch failed (to expand)");
    });
  });

  test("surfaces parse errors as failed tool results", async () => {
    const host = createExtensionHost();
    applyPatchExtension(host.api as any);

    const result = await host.runTool("apply_patch", { patch: "*** Begin Patch\n*** End Patch" });

    expect(result.details.status).toBe("failed");
    expect(result.details.error).toContain("No files were modified");
    expect(result.content[0].text).toContain("Failed to apply patch.");
  });
});
