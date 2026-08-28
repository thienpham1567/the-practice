/** Minimum speaking length the API accepts — mirror server `Min(10_000)`. */
export const MIN_SPEAKING_DURATION_MS = 10_000;

/**
 * RMS below this is treated as mic silence / near-silence.
 * Calibrated for Float32 PCM in [-1, 1]; room noise usually sits above this.
 */
export const SILENCE_RMS_THRESHOLD = 0.01;

export type RecordingBlockReason = "too-short" | "silent";

/** Root-mean-square amplitude of a Float32 PCM buffer. */
export function pcmRms(pcm: Float32Array): number {
  if (pcm.length === 0) return 0;
  let sumSquares = 0;
  for (let i = 0; i < pcm.length; i++) {
    const sample = pcm[i]!;
    sumSquares += sample * sample;
  }
  return Math.sqrt(sumSquares / pcm.length);
}

/**
 * Why a recording cannot be submitted, or `null` if it may proceed.
 * Short clips are checked before silence so the user sees the clearer message.
 */
export function recordingBlockReason(
  pcm: Float32Array,
  durationMs: number,
): RecordingBlockReason | null {
  if (durationMs < MIN_SPEAKING_DURATION_MS) return "too-short";
  if (pcmRms(pcm) < SILENCE_RMS_THRESHOLD) return "silent";
  return null;
}
