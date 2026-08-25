import { tasksForLevel } from "./task-catalog.js";
import type { Level, TaskSpec, TaskType } from "./types.js";

/**
 * Rotate through the types available at this level, skipping ones the writer
 * has just done. If every type is recent, still return one so practice can start.
 */
export function pickTask(level: Level, recentTypes: TaskType[]): TaskSpec {
  const available = tasksForLevel(level);
  const unused = available.filter((task) => !recentTypes.includes(task.type));
  const pool = unused.length > 0 ? unused : available;
  const picked = pool[0];
  if (!picked) {
    throw new Error(`No practice tasks defined for level ${level}`);
  }
  return picked;
}
