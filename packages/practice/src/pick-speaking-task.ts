import { SPEAKING_SEEDS } from "./speaking-catalog";
import type { SpeakingSeed } from "./speaking-catalog";
import type { SpeakingTaskType } from "./types";

/**
 * Pick a TOEIC speaking seed of the given type, skipping recently used keys
 * when another seed is available. Always returns a seed so practice can start.
 */
export function pickSpeakingTask(
  type: SpeakingTaskType,
  recentKeys: string[] = [],
): SpeakingSeed {
  const available = SPEAKING_SEEDS.filter((seed) => seed.type === type);
  const unused = available.filter((seed) => !recentKeys.includes(seed.key));
  const pool = unused.length > 0 ? unused : available;
  const picked = pool[0];
  if (!picked) {
    throw new Error(`No speaking seeds defined for type ${type}`);
  }
  return picked;
}
