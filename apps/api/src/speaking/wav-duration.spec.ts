import { wavDurationMs } from "./wav-duration";

function wav(seconds: number, sampleRate = 16_000, bitsPerSample = 16): Buffer {
  const blockAlign = bitsPerSample / 8;
  const dataBytes = Math.round(seconds * sampleRate) * blockAlign;
  const buffer = Buffer.alloc(44 + dataBytes);
  buffer.write("RIFF", 0, "ascii");
  buffer.writeUInt32LE(36 + dataBytes, 4);
  buffer.write("WAVE", 8, "ascii");
  buffer.write("fmt ", 12, "ascii");
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * blockAlign, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);
  buffer.write("data", 36, "ascii");
  buffer.writeUInt32LE(dataBytes, 40);
  return buffer;
}

describe("wavDurationMs", () => {
  it("reads the length of the 16 kHz mono WAV the web app records", () => {
    expect(wavDurationMs(wav(15))).toBe(15_000);
  });

  it("sees through a low-rate WAV that packs minutes into few bytes", () => {
    // 8 kHz 8-bit: 8 000 B/s — 3 phút chỉ ~1,4 MB.
    expect(wavDurationMs(wav(180, 8_000, 8))).toBe(180_000);
  });

  it("skips unknown chunks before data", () => {
    const base = wav(2);
    const list = Buffer.alloc(8 + 5 + 1);
    list.write("LIST", 0, "ascii");
    list.writeUInt32LE(5, 4);
    const withList = Buffer.concat([base.subarray(0, 36), list, base.subarray(36)]);
    expect(wavDurationMs(withList)).toBe(2_000);
  });

  it("counts only the samples actually present when the header overstates them", () => {
    const truncated = wav(10).subarray(0, 44 + 32_000);
    expect(wavDurationMs(truncated)).toBe(1_000);
  });

  it("rejects anything that is not a WAV", () => {
    expect(wavDurationMs(Buffer.from("AAAAAA"))).toBeNull();
    expect(wavDurationMs(Buffer.from("ID3\u0004mp3-ish-bytes"))).toBeNull();
    const noFmt = wav(1);
    noFmt.write("junk", 12, "ascii");
    expect(wavDurationMs(noFmt)).toBeNull();
  });
});
