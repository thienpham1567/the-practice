import { describe, expect, it } from "vitest";
import { bandToCefr } from "./band-to-cefr.js";

describe("bandToCefr", () => {
  it("maps band boundaries onto CEFR levels", () => {
    expect(bandToCefr(3.5)).toBe("A2");
    expect(bandToCefr(4.0)).toBe("B1");
    expect(bandToCefr(5.0)).toBe("B1");
    expect(bandToCefr(5.5)).toBe("B2");
    expect(bandToCefr(6.5)).toBe("B2");
    expect(bandToCefr(7.0)).toBe("C1");
  });
});
