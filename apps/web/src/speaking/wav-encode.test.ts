import { describe, expect, it } from "vitest";
import { encodeWav } from "./wav-encode";

const SAMPLE_RATE = 16_000;

function readString(view: DataView, offset: number, length: number): string {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += String.fromCharCode(view.getUint8(offset + i));
  }
  return out;
}

function pcmAt(view: DataView, sampleIndex: number): number {
  return view.getInt16(44 + sampleIndex * 2, true);
}

describe("encodeWav", () => {
  it("writes a 44-byte RIFF/WAVE header for 16 kHz mono 16-bit PCM", () => {
    const pcm = new Float32Array([0, 0.5, -0.5, 1]);
    const wav = encodeWav(pcm, 16_000);
    const view = new DataView(wav.buffer, wav.byteOffset, wav.byteLength);

    expect(wav.byteLength).toBe(44 + pcm.length * 2);
    expect(readString(view, 0, 4)).toBe("RIFF");
    expect(view.getUint32(4, true)).toBe(wav.byteLength - 8);
    expect(readString(view, 8, 4)).toBe("WAVE");
    expect(readString(view, 12, 4)).toBe("fmt ");
    expect(view.getUint32(16, true)).toBe(16);
    expect(view.getUint16(20, true)).toBe(1); // PCM
    expect(view.getUint16(22, true)).toBe(1); // mono
    expect(view.getUint32(24, true)).toBe(SAMPLE_RATE);
    expect(view.getUint32(28, true)).toBe(SAMPLE_RATE * 2); // byte rate
    expect(view.getUint16(32, true)).toBe(2); // block align
    expect(view.getUint16(34, true)).toBe(16); // bits per sample
    expect(readString(view, 36, 4)).toBe("data");
    expect(view.getUint32(40, true)).toBe(pcm.length * 2);
  });

  it("encodes float samples to little-endian signed 16-bit PCM", () => {
    const pcm = new Float32Array([0, 1, -1, 0.5]);
    const wav = encodeWav(pcm, 16_000);
    const view = new DataView(wav.buffer, wav.byteOffset, wav.byteLength);

    expect(pcmAt(view, 0)).toBe(0);
    expect(pcmAt(view, 1)).toBe(32767);
    expect(pcmAt(view, 2)).toBe(-32768);
    expect(pcmAt(view, 3)).toBe(16384);
  });

  it("downsamples from a higher source rate to 16 kHz", () => {
    // 32 kHz → 16 kHz: keep every other sample.
    const pcm = new Float32Array([0.1, 0.2, 0.3, 0.4, 0.5, 0.6]);
    const wav = encodeWav(pcm, 32_000);
    const view = new DataView(wav.buffer, wav.byteOffset, wav.byteLength);

    expect(view.getUint32(24, true)).toBe(SAMPLE_RATE);
    expect(view.getUint32(40, true)).toBe(3 * 2);
    expect(pcmAt(view, 0)).toBe(Math.round(0.1 * 32767));
    expect(pcmAt(view, 1)).toBe(Math.round(0.3 * 32767));
    expect(pcmAt(view, 2)).toBe(Math.round(0.5 * 32767));
  });

  it("returns a valid empty WAV when the buffer is empty", () => {
    const wav = encodeWav(new Float32Array(0), 16_000);
    const view = new DataView(wav.buffer, wav.byteOffset, wav.byteLength);

    expect(wav.byteLength).toBe(44);
    expect(readString(view, 0, 4)).toBe("RIFF");
    expect(view.getUint32(40, true)).toBe(0);
  });

  it("averages stereo channels into mono", () => {
    // Interleaved L/R: [L0, R0, L1, R1]
    const stereo = new Float32Array([0.2, 0.4, -0.4, 0.0]);
    const wav = encodeWav(stereo, 16_000, 2);
    const view = new DataView(wav.buffer, wav.byteOffset, wav.byteLength);

    expect(view.getUint16(22, true)).toBe(1);
    expect(view.getUint32(40, true)).toBe(2 * 2);
    expect(pcmAt(view, 0)).toBe(Math.round(0.3 * 32767));
    expect(pcmAt(view, 1)).toBe(Math.round(-0.2 * 32768));
  });
});
