import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { matchVocab, normalizeWord } from "./vocab-match";

export type VocabSuggestItem = {
  word: string;
  meaning: string;
  example: string;
};

@Injectable()
export class VocabService {
  constructor(private readonly prisma: PrismaService) {}

  async recordSuggested(
    userId: string,
    level: string,
    items: VocabSuggestItem[],
  ): Promise<void> {
    await Promise.all(
      items.map((item) => {
        const word = normalizeWord(item.word);
        if (!word) return Promise.resolve();

        return this.prisma.vocabEntry.upsert({
          where: { userId_word: { userId, word } },
          create: {
            userId,
            word,
            meaning: item.meaning,
            example: item.example,
            level,
          },
          update: {
            suggestedCount: { increment: 1 },
            lastSuggestedAt: new Date(),
          },
        });
      }),
    );
  }

  async reviewCandidates(
    userId: string,
    level: string,
  ): Promise<VocabSuggestItem[]> {
    const newest = await this.prisma.practiceAttempt.findFirst({
      where: { userId },
      orderBy: { startedAt: "desc" },
      select: { vocabulary: true },
    });

    const excludeWords = vocabularyWords(newest?.vocabulary);

    return this.prisma.vocabEntry.findMany({
      where: {
        userId,
        level,
        usedCount: 0,
        word: { notIn: excludeWords },
      },
      orderBy: { lastSuggestedAt: "asc" },
      take: 4,
      select: { word: true, meaning: true, example: true },
    });
  }

  async markUsed(userId: string, plainText: string): Promise<void> {
    const entries = await this.prisma.vocabEntry.findMany({
      where: { userId },
    });
    if (entries.length === 0) return;

    const matched = matchVocab(
      plainText,
      entries.map((entry) => entry.word),
    );
    if (matched.size === 0) return;

    const now = new Date();
    await Promise.all(
      entries
        .filter((entry) => matched.has(entry.word))
        .map((entry) =>
          this.prisma.vocabEntry.update({
            where: { id: entry.id },
            data: {
              usedCount: { increment: 1 },
              ...(entry.firstUsedAt == null ? { firstUsedAt: now } : {}),
            },
          }),
        ),
    );
  }
}

function vocabularyWords(vocabulary: unknown): string[] {
  if (!Array.isArray(vocabulary)) return [];

  const words: string[] = [];
  for (const item of vocabulary) {
    if (
      item &&
      typeof item === "object" &&
      "word" in item &&
      typeof (item as { word: unknown }).word === "string"
    ) {
      const normalized = normalizeWord((item as { word: string }).word);
      if (normalized) words.push(normalized);
    }
  }
  return words;
}
