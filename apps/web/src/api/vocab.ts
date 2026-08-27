import { apiFetch } from "./client";

export interface VocabEntry {
  id: string;
  word: string;
  meaning: string;
  example: string;
  level: string;
  usedCount: number;
  suggestedCount: number;
  lastSuggestedAt: string;
  firstUsedAt: string | null;
  createdAt: string;
}

export type VocabStatusFilter = "all" | "unused" | "used";

export const listVocab = async () => {
  const page = await apiFetch<{ items: VocabEntry[]; nextCursor: string | null }>(
    "/practice/vocab",
  );
  return page.items;
};
