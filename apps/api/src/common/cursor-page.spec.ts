import { toCursorPage } from "./cursor-page";

describe("toCursorPage", () => {
  it("returns null nextCursor when there is no extra row", () => {
    const items = [{ id: "a" }, { id: "b" }];
    expect(toCursorPage(items, 2)).toEqual({ items, nextCursor: null });
  });

  it("trims the peek row and points nextCursor at the last kept id", () => {
    const rows = [{ id: "a" }, { id: "b" }, { id: "c" }];
    expect(toCursorPage(rows, 2)).toEqual({
      items: [{ id: "a" }, { id: "b" }],
      nextCursor: "b",
    });
  });
});
