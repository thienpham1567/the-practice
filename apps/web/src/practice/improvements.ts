/** Coerce grade feedback.improvements into a list. Schema is string[];
 * leftover strings (newlines or a single blob) must not crash .map. */
export function asImprovementList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];
    const lines = trimmed.split(/\n+/).map((line) => line.trim()).filter(Boolean);
    return lines.length > 0 ? lines : [trimmed];
  }
  return [];
}
