const TARGET_SAMPLE_RATE = 16_000;

/**
 * Encode Float32 PCM into a 16 kHz mono 16-bit WAV (44-byte header + samples).
 * `channels` > 1 treats `pcm` as interleaved and averages to mono.
 */
export function encodeWav(
  pcm: Float32Array,
  sourceSampleRate: number,
  channels = 1,
): Uint8Array {
  const mono = toMono(pcm, channels);
  const downsampled = downsample(mono, sourceSampleRate, TARGET_SAMPLE_RATE);
  const dataBytes = downsampled.length * 2;
  const buffer = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(buffer);

  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + dataBytes, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true); // PCM fmt chunk size
  view.setUint16(20, 1, true); // audio format = PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, TARGET_SAMPLE_RATE, true);
  view.setUint32(28, TARGET_SAMPLE_RATE * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  writeString(view, 36, "data");
  view.setUint32(40, dataBytes, true);

  let offset = 44;
  for (let i = 0; i < downsampled.length; i++) {
    view.setInt16(offset, floatToInt16(downsampled[i]!), true);
    offset += 2;
  }

  return new Uint8Array(buffer);
}

function toMono(pcm: Float32Array, channels: number): Float32Array {
  if (channels <= 1) return pcm;
  const frames = Math.floor(pcm.length / channels);
  const mono = new Float32Array(frames);
  for (let i = 0; i < frames; i++) {
    let sum = 0;
    for (let c = 0; c < channels; c++) {
      sum += pcm[i * channels + c] ?? 0;
    }
    mono[i] = sum / channels;
  }
  return mono;
}

function downsample(
  pcm: Float32Array,
  sourceRate: number,
  targetRate: number,
): Float32Array {
  if (sourceRate <= 0 || targetRate <= 0 || pcm.length === 0) {
    return pcm.length === 0 ? pcm : new Float32Array(0);
  }
  if (sourceRate === targetRate) return pcm;

  const ratio = sourceRate / targetRate;
  const outLength = Math.floor(pcm.length / ratio);
  const out = new Float32Array(outLength);
  for (let i = 0; i < outLength; i++) {
    out[i] = pcm[Math.floor(i * ratio)] ?? 0;
  }
  return out;
}

function floatToInt16(sample: number): number {
  const clipped = Math.max(-1, Math.min(1, sample));
  return clipped < 0 ? Math.round(clipped * 32768) : Math.round(clipped * 32767);
}

function writeString(view: DataView, offset: number, value: string): void {
  for (let i = 0; i < value.length; i++) {
    view.setUint8(offset + i, value.charCodeAt(i));
  }
}
