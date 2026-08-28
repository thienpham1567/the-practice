import { isSpeakingSubmitPath } from "./configure-body-parser";

describe("isSpeakingSubmitPath", () => {
  it("matches POST speaking submit with or without trailing slash", () => {
    expect(isSpeakingSubmitPath("POST", "/speaking/attempts/abc123/submit")).toBe(true);
    expect(isSpeakingSubmitPath("POST", "/speaking/attempts/abc123/submit/")).toBe(true);
  });

  it("rejects other methods and nearby speaking routes", () => {
    expect(isSpeakingSubmitPath("GET", "/speaking/attempts/abc123/submit")).toBe(false);
    expect(isSpeakingSubmitPath("POST", "/speaking/attempts")).toBe(false);
    expect(isSpeakingSubmitPath("POST", "/speaking/attempts/abc123")).toBe(false);
    expect(isSpeakingSubmitPath("POST", "/speaking/attempts/abc123/revise")).toBe(false);
    expect(isSpeakingSubmitPath("POST", "/practice/attempts/abc123/submit")).toBe(false);
  });
});
