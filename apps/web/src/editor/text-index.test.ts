import { describe, expect, it } from "vitest";
import { buildTextIndex, rangeFor } from "./text-index";

function root(html: string): HTMLElement {
  const element = document.createElement("div");
  element.innerHTML = html;
  return element;
}

describe("buildTextIndex", () => {
  it("gom text của một đoạn", () => {
    const index = buildTextIndex(root("<p>The cat sat.</p>"));

    expect(index.text).toBe("The cat sat.");
    expect(index.segments).toHaveLength(1);
    expect(index.segments[0]).toMatchObject({ start: 0, end: 12 });
  });

  it("ngăn các đoạn bằng dòng trống", () => {
    const index = buildTextIndex(root("<p>First.</p><p>Second.</p>"));

    expect(index.text).toBe("First.\n\nSecond.");
  });

  it("nối liền các đoạn text inline trong cùng một khối", () => {
    const index = buildTextIndex(root("<p>The <strong>cat</strong> sat.</p>"));

    expect(index.text).toBe("The cat sat.");
    expect(index.segments).toHaveLength(3);
    expect(index.segments[1]).toMatchObject({ start: 4, end: 7 });
  });

  it("coi heading và list item là khối riêng", () => {
    const index = buildTextIndex(root("<h1>Title</h1><ul><li>One</li><li>Two</li></ul>"));

    expect(index.text).toBe("Title\n\nOne\n\nTwo");
  });

  it("bỏ qua khối rỗng ở đầu", () => {
    const index = buildTextIndex(root("<p></p><p>Only this.</p>"));

    expect(index.text).toBe("Only this.");
  });

  it("trả về rỗng với root không có chữ", () => {
    const index = buildTextIndex(root(""));

    expect(index.text).toBe("");
    expect(index.segments).toEqual([]);
  });
});

describe("rangeFor", () => {
  it("dựng range trong một text node", () => {
    const element = root("<p>The cat sat.</p>");
    const index = buildTextIndex(element);

    expect(rangeFor(index, 4, 7)?.toString()).toBe("cat");
  });

  it("dựng range bắc qua nhiều text node", () => {
    const element = root("<p>The <strong>cat</strong> sat.</p>");
    const index = buildTextIndex(element);

    expect(rangeFor(index, 0, 7)?.toString()).toBe("The cat");
  });

  it("dựng range trải qua ranh giới đoạn", () => {
    const element = root("<p>First.</p><p>Second.</p>");
    const index = buildTextIndex(element);

    // Dấu ngăn "\n\n" chỉ có trong chuỗi, không có trong DOM.
    expect(rangeFor(index, 0, 15)?.toString()).toBe("First.Second.");
  });

  it("trả về null khi offset nằm ngoài văn bản", () => {
    const index = buildTextIndex(root("<p>Short</p>"));

    expect(rangeFor(index, 10, 20)).toBeNull();
  });

  it("trả về null khi range rỗng", () => {
    const index = buildTextIndex(root("<p>Short</p>"));

    expect(rangeFor(index, 2, 2)).toBeNull();
  });
});
