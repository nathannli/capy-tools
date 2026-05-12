import { describe, expect, test } from "bun:test";
import { mkdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import fetchExtension from "../extensions/fetch.ts";
import sourcegraphExtension from "../extensions/sourcegraph.ts";
import { createExtensionHost, withTempDir } from "./extension-host.ts";

describe("fetch", () => {
  test(
    "fetches a live URL, stores artifacts, and converts with the real MarkItDown CLI",
    async () => {
      await withTempDir(async (dir) => {
        await mkdir(join(dir, ".pi"), { recursive: true });
        const host = createExtensionHost({ cwd: dir });
        fetchExtension(host.api as any);

        const result = await host.runTool("fetch", { url: "https://example.com/", format: "markdown", timeout: 60 });
        const details = result.details;

        expect(result.content[0].text).toContain("Fetched URL: https://example.com/");
        expect(details.url).toBe("https://example.com/");
        expect(details.rawPathDisplay).toMatch(/^\.pi\/fetch\//);
        expect(details.metadataPathDisplay).toMatch(/^\.pi\/fetch\//);
        expect(details.markitdown.success).toBe(true);
        expect(details.markdownPath).toBeTruthy();
        expect(existsSync(details.rawPath)).toBe(true);
        expect(existsSync(details.markdownPath)).toBe(true);
        expect(existsSync(details.metadataPath)).toBe(true);

        const markdown = await readFile(details.markdownPath, "utf8");
        expect(markdown.toLowerCase()).toContain("example domain");
        const metadata = JSON.parse(await readFile(details.metadataPath, "utf8"));
        expect(metadata.converter.success).toBe(true);
        expect(metadata.recommendedRead.kind).toBe("markdown");
      });
    },
    120_000,
  );

  test("rejects non-http URLs before writing artifacts", async () => {
    await withTempDir(async (dir) => {
      await mkdir(join(dir, ".pi"), { recursive: true });
      const host = createExtensionHost({ cwd: dir });
      fetchExtension(host.api as any);

      await expect(host.runTool("fetch", { url: "file:///etc/passwd" })).rejects.toThrow("URL must start with http:// or https://");
    });
  });
});

describe("sourcegraph", () => {
  test(
    "searches Sourcegraph's public GraphQL API without an API key",
    async () => {
      const host = createExtensionHost();
      sourcegraphExtension(host.api as any);
      const result = await host.runTool("sourcegraph", {
        query: "repo:^github\\.com/openai/codex$ CODEX_CORE_APPLY_PATCH_ARG1",
        count: 2,
        context_window: 1,
        timeout: 60,
      });
      const text = result.content[0].text;

      expect(text).toContain("# Sourcegraph Search Results");
      expect(text).toContain("github.com/openai/codex");
      expect(text).toContain("CODEX_CORE_APPLY_PATCH_ARG1");
    },
    120_000,
  );

  test("rejects an empty query", async () => {
    const host = createExtensionHost();
    sourcegraphExtension(host.api as any);
    await expect(host.runTool("sourcegraph", { query: "" })).rejects.toThrow("query parameter is required");
  });
});
