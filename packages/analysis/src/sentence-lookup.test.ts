import { describe, expect, it } from "vitest";
import { locateSentence } from "./index.js";

describe("locateSentence", () => {
  const text = "First one. Second one is here. Third.";

  it("tìm đúng câu chứa offset", () => {
    const result = locateSentence(text, 15);

    expect(result?.sentence.text).toBe("Second one is here.");
  });

  it("trả về câu liền trước và liền sau", () => {
    const result = locateSentence(text, 15);

    expect(result?.previous?.text).toBe("First one.");
    expect(result?.next?.text).toBe("Third.");
  });

  it("previous là null khi câu chứa offset là câu đầu tiên", () => {
    const result = locateSentence(text, 2);

    expect(result?.sentence.text).toBe("First one.");
    expect(result?.previous).toBeNull();
  });

  it("next là null khi câu chứa offset là câu cuối cùng", () => {
    const result = locateSentence(text, text.length - 2);

    expect(result?.sentence.text).toBe("Third.");
    expect(result?.next).toBeNull();
  });

  it("nhận offset đúng ngay đầu câu", () => {
    const result = locateSentence(text, 11);

    expect(result?.sentence.text).toBe("Second one is here.");
  });

  it("trả về null khi offset nằm ngoài văn bản", () => {
    expect(locateSentence(text, 1000)).toBeNull();
    expect(locateSentence(text, -5)).toBeNull();
  });

  it("offset và span khớp đúng vị trí trên text gốc", () => {
    const result = locateSentence(text, 15);

    expect(text.slice(result!.sentence.start, result!.sentence.end)).toBe(
      result!.sentence.text,
    );
  });
});
