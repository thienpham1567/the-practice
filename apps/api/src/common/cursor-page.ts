export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 50;

export type CursorPage<T> = {
  items: T[];
  nextCursor: string | null;
};

/** `rows` must be fetched with `take: limit + 1`. */
export function toCursorPage<T extends { id: string }>(
  rows: T[],
  limit: number,
): CursorPage<T> {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  return {
    items,
    nextCursor: hasMore ? items[items.length - 1]!.id : null,
  };
}
