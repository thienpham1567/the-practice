-- CreateTable
CREATE TABLE "SpeakingAttempt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "cueCard" JSONB NOT NULL,
    "durationMs" INTEGER,
    "transcript" TEXT,
    "marks" JSONB,
    "fluency" JSONB,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "gradingStartedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "band" DOUBLE PRECISION,
    "scores" JSONB,
    "feedback" JSONB,
    "parentAttemptId" TEXT,
    "revisionRound" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "SpeakingAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SpeakingAttempt_userId_submittedAt_idx" ON "SpeakingAttempt"("userId", "submittedAt");

-- CreateIndex
CREATE INDEX "SpeakingAttempt_parentAttemptId_idx" ON "SpeakingAttempt"("parentAttemptId");

-- AddForeignKey
ALTER TABLE "SpeakingAttempt" ADD CONSTRAINT "SpeakingAttempt_parentAttemptId_fkey" FOREIGN KEY ("parentAttemptId") REFERENCES "SpeakingAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpeakingAttempt" ADD CONSTRAINT "SpeakingAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
