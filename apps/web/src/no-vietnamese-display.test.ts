import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  collectSourceFiles,
  findVietnameseDisplayHits,
  stripCommentsPreservingLines,
} from "./no-vietnamese-display";

describe("stripCommentsPreservingLines", () => {
  it("removes line, block, and JSX comments while keeping newlines", () => {
    const source = [
      `const a = 1; // tiếng Việt`,
      `/* bản nháp */`,
      `const b = "ok";`,
      `{/* góp ý */}`,
      `<span>hi</span>`,
    ].join("\n");

    const stripped = stripCommentsPreservingLines(source);
    expect(stripped).not.toMatch(/tiếng|bản|góp/);
    expect(stripped.split("\n")).toHaveLength(5);
    expect(stripped).toContain('const b = "ok";');
    expect(stripped).toContain("<span>hi</span>");
  });

  it("does not strip comment markers that appear inside strings", () => {
    const source = `const url = "https://example.com"; // real comment với dấu`;
    const stripped = stripCommentsPreservingLines(source);
    expect(stripped).toContain("https://example.com");
    expect(stripped).not.toMatch(/với dấu/);
  });
});

describe("findVietnameseDisplayHits", () => {
  it("flags Vietnamese in JSX text", () => {
    const hits = findVietnameseDisplayHits(`export function X() { return <p>ôn lại</p>; }`);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0]?.excerpt).toMatch(/ôn lại/);
  });

  it("flags Vietnamese in double-quoted strings", () => {
    const hits = findVietnameseDisplayHits(`const label = "Sửa lại bài này";`);
    expect(hits.length).toBeGreaterThan(0);
  });

  it("flags Vietnamese in template literals", () => {
    const hits = findVietnameseDisplayHits("const label = `Bản sửa ${n}/2`;");
    expect(hits.length).toBeGreaterThan(0);
  });

  it("ignores Vietnamese that only appears in comments", () => {
    const source = [
      `// Bản sửa chỉ là ghi chú`,
      `/* Góp ý lần trước */`,
      `export function X() {`,
      `  return <span>{/* ôn lại */}"review"</span>;`,
      `}`,
    ].join("\n");
    expect(findVietnameseDisplayHits(source)).toEqual([]);
  });

  it("ignores English display copy", () => {
    const source = `export function X() { return <p>Revision {n}/2</p>; }`;
    expect(findVietnameseDisplayHits(source)).toEqual([]);
  });
});

describe("apps/web/src has no Vietnamese display strings", () => {
  it("scans non-test source files", () => {
    const root = path.dirname(fileURLToPath(import.meta.url));
    const files = collectSourceFiles(root);
    expect(files.length).toBeGreaterThan(20);

    const failures: string[] = [];
    for (const file of files) {
      const source = fs.readFileSync(file, "utf8");
      const hits = findVietnameseDisplayHits(source);
      for (const hit of hits) {
        failures.push(`${path.relative(root, file)}:${hit.line}: ${hit.excerpt}`);
      }
    }

    expect(failures, failures.join("\n")).toEqual([]);
  });
});
