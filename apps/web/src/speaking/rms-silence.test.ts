import { describe, expect, it } from "vitest";
import {
  MIN_SPEAKING_DURATION_MS,
  pcmRms,
  recordingBlockReason,
} from "./rms-silence";

describe("pcmRms", () => {
  it("returns 0 for an empty buffer", () => {
    expect(pcmRms(new Float32Array(0))).toBe(0);
  });

  it("returns 0 for pure silence", () => {
    expect(pcmRms(new Float32Array(1000))).toBe(0);
  });

  it("returns ~1 for a full-scale square wave of ±1", () => {
    const pcm = new Float32Array(4);
    pcm[0] = 1;
    pcm[1] = -1;
    pcm[2] = 1;
    pcm[3] = -1;
    expect(pcmRms(pcm)).toBeCloseTo(1, 5);
  });

  it("returns a mid value for a quieter signal", () => {
    const pcm = new Float32Array([0.1, -0.1, 0.1, -0.1]);
    expect(pcmRms(pcm)).toBeCloseTo(0.1, 5);
  });
});

describe("recordingBlockReason", () => {
  const loud = (() => {
    const pcm = new Float32Array(100);
    for (let i = 0; i < pcm.length; i++) pcm[i] = i % 2 === 0 ? 0.2 : -0.2;
    return pcm;
  })();

  it("blocks recordings shorter than 10 seconds", () => {
    expect(recordingBlockReason(loud, MIN_SPEAKING_DURATION_MS - 1)).toBe("too-short");
  });

  it("blocks silent recordings even when long enough", () => {
    expect(recordingBlockReason(new Float32Array(1000), MIN_SPEAKING_DURATION_MS)).toBe(
      "silent",
    );
  });

  it("allows a loud recording of at least 10 seconds", () => {
    expect(recordingBlockReason(loud, MIN_SPEAKING_DURATION_MS)).toBeNull();
  });

  it("prefers too-short over silent when both apply", () => {
    expect(recordingBlockReason(new Float32Array(0), 1000)).toBe("too-short");
  });
});
