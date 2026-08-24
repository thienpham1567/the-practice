import { describe, expect, it } from "vitest";
import { analyze } from "./index.js";

describe("analyze", () => {
  it("trả về đầy đủ các nhánh của AnalysisResult", () => {
    const result = analyze("The cat sat.");

    expect(result).toHaveProperty("highlights");
    expect(result).toHaveProperty("counts");
    expect(result).toHaveProperty("stats");
    expect(result).toHaveProperty("grade");
    expect(result).toHaveProperty("gradeLabel");
  });
});
