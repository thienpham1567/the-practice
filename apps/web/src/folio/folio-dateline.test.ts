import { describe, expect, it } from "vitest";
import { folioDateline } from "./folio-dateline";

describe("folioDateline", () => {
  it("formats an en-GB newspaper line with Vol. 1", () => {
    expect(folioDateline(new Date(2026, 7, 26))).toBe(
      "Vol. 1 · 26 August 2026 · Writing & speaking",
    );
  });
});
