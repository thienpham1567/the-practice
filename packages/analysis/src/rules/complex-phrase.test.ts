import { describe, expect, it } from "vitest";
import { splitSentences } from "../tokenize.js";
import { complexPhraseRule } from "./complex-phrase.js";

function run(text: string) {
  return complexPhraseRule(splitSentences(text), text);
}

describe("complexPhraseRule", () => {
  it("bắt từ phức tạp và kèm gợi ý thay thế", () => {
    const text = "We utilize the tool.";
    const highlights = run(text);

    expect(highlights).toHaveLength(1);
    expect(text.slice(highlights[0]!.start, highlights[0]!.end)).toBe("utilize");
    expect(highlights[0]!.type).toBe("complex-phrase");
    expect(highlights[0]!.suggestion).toBe("use");
  });

  it("bắt cụm nhiều từ", () => {
    const text = "He left due to the fact that it rained.";
    const highlights = run(text);

    expect(text.slice(highlights[0]!.start, highlights[0]!.end)).toBe("due to the fact that");
    expect(highlights[0]!.suggestion).toBe("because");
  });

  it("giữ nhiều gợi ý ngăn bằng dấu phẩy", () => {
    expect(run("Please commence work.")[0]!.suggestion).toBe("begin, start");
  });

  it("đề nghị bỏ hẳn cụm thừa", () => {
    const highlights = run("The aforementioned rule applies.");

    expect(highlights).toHaveLength(1);
    expect(highlights[0]!.suggestion).toBe("");
  });

  it("không khớp bên trong từ khác", () => {
    expect(run("The permitted user logged in.")).toEqual([]);
  });

  it("không phân biệt hoa thường", () => {
    expect(run("Utilize this.")[0]!.suggestion).toBe("use");
  });

  it("ưu tiên cụm dài hơn khi có lồng nhau", () => {
    const text = "Do it in order to win.";
    const highlights = run(text);

    expect(highlights).toHaveLength(1);
    expect(text.slice(highlights[0]!.start, highlights[0]!.end)).toBe("in order to");
  });

  it("trả về mảng rỗng khi câu đã đơn giản", () => {
    expect(run("The cat sat on the mat.")).toEqual([]);
  });
});
