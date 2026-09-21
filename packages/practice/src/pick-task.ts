import { TASK_CATALOG } from "./task-catalog";
import type { TaskSpec, WritingTaskType } from "./types";

/**
 * Rotate through writing types, skipping ones the writer has just done.
 * If every type is recent, still return one so practice can start.
 */
export function pickTask(recentTypes: WritingTaskType[]): TaskSpec {
  const unused = TASK_CATALOG.filter((task) => !recentTypes.includes(task.type));
  const pool = unused.length > 0 ? unused : TASK_CATALOG;
  const picked = pool[0];
  if (!picked) {
    throw new Error("No practice tasks defined");
  }
  return picked;
}
