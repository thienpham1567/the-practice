import { describe, expect, it } from "vitest";
import { folioDateline } from "./folio-dateline";

describe("folioDateline", () => {
  it("formats an uppercase weekday dateline", () => {
    expect(folioDateline(new Date(2026, 7, 26))).toBe("WEDNESDAY, 26 AUGUST 2026");
  });
});
