import { describe, expect, it } from "vitest";

import { speakingDescriptor, writingDescriptor } from "./toeic-descriptors";

describe("speakingDescriptor", () => {
  it("describes the top speaking band at 200", () => {
    expect(speakingDescriptor(200).toLowerCase()).toMatch(/workplace|sustained/);
  });

  it("uses the 160–180 band for 165", () => {
    const descriptor = speakingDescriptor(165);

    expect(descriptor).toBe(speakingDescriptor(160));
    expect(descriptor).toBe(speakingDescriptor(180));
    expect(descriptor).not.toBe(speakingDescriptor(190));
    expect(descriptor).not.toBe(speakingDescriptor(150));
  });

  it("describes the lowest speaking band at 0", () => {
    expect(speakingDescriptor(0).toLowerCase()).toMatch(/left|did not/);
  });

  it("uses the 40–50 speaking band for 50 and the lowest band for 30", () => {
    expect(speakingDescriptor(50)).not.toBe(speakingDescriptor(30));
  });

  it.each([80, 100])(
    "says the speaker cannot answer questions at %s",
    (score) => {
      expect(speakingDescriptor(score).toLowerCase()).toMatch(/cannot answer/);
    },
  );

  it("says the 60 speaking band cannot support an opinion", () => {
    expect(speakingDescriptor(60).toLowerCase()).toMatch(/cannot support/);
  });

  it("clamps speaking scores above 200 to the top band", () => {
    expect(speakingDescriptor(210)).toBe(speakingDescriptor(200));
  });
});

describe("writingDescriptor", () => {
  it("distinguishes the 200, 190, 40, and 0 writing bands", () => {
    const descriptors = [200, 190, 40, 0].map(writingDescriptor);

    expect(new Set(descriptors).size).toBe(4);
  });

  it("clamps writing scores below 0 to the lowest band", () => {
    expect(writingDescriptor(-10)).toBe(writingDescriptor(0));
  });

  it("describes the 40 writing band as unable to give straightforward information", () => {
    expect(writingDescriptor(40).toLowerCase()).toMatch(
      /cannot give straightforward|unable to produce/,
    );
  });

  it("distinguishes the limited 50 writing band from the 40 band", () => {
    const descriptor = writingDescriptor(50).toLowerCase();

    expect(descriptor).toMatch(/limited ability/);
    expect(descriptor).not.toMatch(/cannot give straightforward/);
  });

  it("says the 0 writing band left part of the test unanswered", () => {
    expect(writingDescriptor(0).toLowerCase()).toMatch(/unanswered|left/);
  });
});
