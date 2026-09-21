import { describe, expect, it } from "vitest";
import { cefrFromScaled } from "./toeic-cefr";

describe("cefrFromScaled", () => {
  describe("speaking", () => {
    it("maps 179 to B2 and 180 to C1", () => {
      expect(cefrFromScaled(179, "speaking")).toBe("B2");
      expect(cefrFromScaled(180, "speaking")).toBe("C1");
    });

    it("maps 160 to B2", () => {
      expect(cefrFromScaled(160, "speaking")).toBe("B2");
    });

    it("returns null below A1 cut (49)", () => {
      expect(cefrFromScaled(49, "speaking")).toBeNull();
    });
  });

  describe("writing", () => {
    it("maps 150 to B2 and 149 to B1", () => {
      expect(cefrFromScaled(150, "writing")).toBe("B2");
      expect(cefrFromScaled(149, "writing")).toBe("B1");
    });

    it("maps 180 to C1 and 70 to A2", () => {
      expect(cefrFromScaled(180, "writing")).toBe("C1");
      expect(cefrFromScaled(70, "writing")).toBe("A2");
    });

    it("returns null below A1 cut (29)", () => {
      expect(cefrFromScaled(29, "writing")).toBeNull();
    });
  });
});
