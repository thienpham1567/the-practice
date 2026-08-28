const SINGLE_FILLERS = /\b(?:um|uh|er|like)\b/gi;
const PHRASE_FILLER = /\byou\s+know\b/gi;

export interface SpeakingFluency {
  wordsPerMinute: number;
  fillerCount: number;
}

/**
 * Local fluency metrics from transcript + duration — no AI.
 * Fillers: um, uh, er, like, you know (word-boundary safe).
 */
export function speakingFluency(transcript: string, durationMs: number): SpeakingFluency {
  const words = transcript.trim().split(/\s+/).filter(Boolean);
  const wordsPerMinute =
    durationMs <= 0 || words.length === 0
      ? 0
      : Math.round((words.length / durationMs) * 60_000);

  return {
    wordsPerMinute,
    fillerCount: countFillers(transcript),
  };
}

function countFillers(transcript: string): number {
  const singles = transcript.match(SINGLE_FILLERS)?.length ?? 0;
  const phrases = transcript.match(PHRASE_FILLER)?.length ?? 0;
  return singles + phrases;
}
