-- CreateTable
CREATE TABLE "VocabEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "word" TEXT NOT NULL,
    "meaning" TEXT NOT NULL,
    "example" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "suggestedCount" INTEGER NOT NULL DEFAULT 1,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "lastSuggestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "firstUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VocabEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VocabEntry_userId_usedCount_lastSuggestedAt_idx" ON "VocabEntry"("userId", "usedCount", "lastSuggestedAt");

-- CreateIndex
CREATE UNIQUE INDEX "VocabEntry_userId_word_key" ON "VocabEntry"("userId", "word");

-- AddForeignKey
ALTER TABLE "VocabEntry" ADD CONSTRAINT "VocabEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
