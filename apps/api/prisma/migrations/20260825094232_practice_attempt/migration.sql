-- CreateTable
CREATE TABLE "PracticeAttempt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "taskType" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "ideas" JSONB NOT NULL,
    "vocabulary" JSONB NOT NULL,
    "hintsOpened" BOOLEAN NOT NULL DEFAULT false,
    "content" JSONB,
    "plainText" TEXT NOT NULL DEFAULT '',
    "wordCount" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" TIMESTAMP(3),
    "elapsedSeconds" INTEGER,
    "band" DOUBLE PRECISION,
    "scores" JSONB,
    "feedback" JSONB,
    "styleSnapshot" JSONB,

    CONSTRAINT "PracticeAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PracticeAttempt_userId_submittedAt_idx" ON "PracticeAttempt"("userId", "submittedAt");

-- AddForeignKey
ALTER TABLE "PracticeAttempt" ADD CONSTRAINT "PracticeAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
