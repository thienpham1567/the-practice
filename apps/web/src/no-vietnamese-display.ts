import fs from "node:fs";
import path from "node:path";

/** Vietnamese letters with diacritics (and đ/Đ) — Latin letters without marks are fine. */
export const VIETNAMESE_DIACRITIC =
  /[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđÀÁẢÃẠĂẰẮẲẴẶÂẦẤẨẪẬÈÉẺẼẸÊỀẾỂỄỆÌÍỈĨỊÒÓỎÕỌÔỒỐỔỖỘƠỜỚỞỠỢÙÚỦŨỤƯỪỨỬỮỰỲÝỶỸỴĐ]/;

export type VietnameseHit = {
  line: number;
  excerpt: string;
};

/**
 * Strip //, /* *\/, and {/* *\/} comments without touching string contents.
 * Replaces comment text with spaces so line numbers stay aligned.
 */
export function stripCommentsPreservingLines(source: string): string {
  const out: string[] = [];
  let i = 0;
  let state: "code" | "line" | "block" | "jsx" | "squote" | "dquote" | "template" = "code";

  while (i < source.length) {
    const ch = source[i]!;
    const next = source[i + 1];

    if (state === "code") {
      if (ch === "'" || ch === '"' || ch === "`") {
        state = ch === "'" ? "squote" : ch === '"' ? "dquote" : "template";
        out.push(ch);
        i += 1;
        continue;
      }
      if (ch === "/" && next === "/") {
        state = "line";
        out.push(" ", " ");
        i += 2;
        continue;
      }
      if (ch === "/" && next === "*") {
        state = "block";
        out.push(" ", " ");
        i += 2;
        continue;
      }
      if (ch === "{" && next === "/" && source[i + 2] === "*") {
        state = "jsx";
        out.push(" ", " ", " ");
        i += 3;
        continue;
      }
      out.push(ch);
      i += 1;
      continue;
    }

    if (state === "line") {
      if (ch === "\n") {
        state = "code";
        out.push(ch);
      } else {
        out.push(ch === "\n" ? "\n" : " ");
      }
      i += 1;
      continue;
    }

    if (state === "block") {
      if (ch === "*" && next === "/") {
        state = "code";
        out.push(" ", " ");
        i += 2;
      } else {
        out.push(ch === "\n" ? "\n" : " ");
        i += 1;
      }
      continue;
    }

    if (state === "jsx") {
      if (ch === "*" && next === "/") {
        state = "code";
        out.push(" ", " ");
        i += 2;
        if (source[i] === "}") {
          out.push(" ");
          i += 1;
        }
      } else {
        out.push(ch === "\n" ? "\n" : " ");
        i += 1;
      }
      continue;
    }

    // Inside a string / template — copy verbatim, honour escapes.
    out.push(ch);
    if (ch === "\\" && i + 1 < source.length) {
      out.push(source[i + 1]!);
      i += 2;
      continue;
    }
    if (
      (state === "squote" && ch === "'") ||
      (state === "dquote" && ch === '"') ||
      (state === "template" && ch === "`")
    ) {
      state = "code";
    }
    i += 1;
  }

  return out.join("");
}

/**
 * After comments are gone, collect display-ish string / template / JSX text
 * spans that still contain Vietnamese diacritics.
 */
export function findVietnameseDisplayHits(source: string): VietnameseHit[] {
  const code = stripCommentsPreservingLines(source);
  const hits: VietnameseHit[] = [];
  const seen = new Set<number>();

  const record = (index: number, excerpt: string) => {
    const line = code.slice(0, index).split("\n").length;
    if (seen.has(line)) return;
    seen.add(line);
    hits.push({ line, excerpt: excerpt.trim().slice(0, 80) });
  };

  // Quoted strings and templates.
  const stringLike =
    /'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|`(?:\\.|[^`\\])*`/g;
  for (const match of code.matchAll(stringLike)) {
    const text = match[0]!;
    if (VIETNAMESE_DIACRITIC.test(text)) {
      record(match.index ?? 0, text);
    }
  }

  // JSX text nodes: >…< with no nested tags / braces (display copy).
  const jsxText = />([^<{]+)</g;
  for (const match of code.matchAll(jsxText)) {
    const text = match[1]!;
    if (VIETNAMESE_DIACRITIC.test(text)) {
      record((match.index ?? 0) + 1, text);
    }
  }

  return hits;
}

export function collectSourceFiles(rootDir: string): string[] {
  const files: string[] = [];

  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (!/\.(tsx?)$/.test(entry.name)) continue;
      if (/\.test\./.test(entry.name)) continue;
      files.push(full);
    }
  };

  walk(rootDir);
  return files.sort();
}
