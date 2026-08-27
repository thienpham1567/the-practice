-- AlterTable
ALTER TABLE "PracticeAttempt" ADD COLUMN     "feedbackAudit" JSONB,
ADD COLUMN     "parentAttemptId" TEXT,
ADD COLUMN     "revisionRound" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "PracticeAttempt_parentAttemptId_idx" ON "PracticeAttempt"("parentAttemptId");

-- AddForeignKey
ALTER TABLE "PracticeAttempt" ADD CONSTRAINT "PracticeAttempt_parentAttemptId_fkey" FOREIGN KEY ("parentAttemptId") REFERENCES "PracticeAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
