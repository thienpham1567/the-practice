import { speakingTasksForLevel } from "./speaking-catalog";
import type { SpeakingCueCard } from "./speaking-catalog";
import type { Level } from "./types";

/**
 * Pick a Part 2 cue card for the level, skipping recently used topics when
 * another card is available. Always returns a card so practice can start.
 */
export function pickSpeakingTask(
  level: Level,
  recentTopics: string[] = [],
): SpeakingCueCard {
  const available = speakingTasksForLevel(level);
  const unused = available.filter((card) => !recentTopics.includes(card.topic));
  const pool = unused.length > 0 ? unused : available;
  const picked = pool[0];
  if (!picked) {
    throw new Error(`No speaking cue cards defined for level ${level}`);
  }
  return picked;
}
