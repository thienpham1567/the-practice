-- AlterTable
ALTER TABLE "PracticeAttempt" ADD COLUMN "scale" TEXT NOT NULL DEFAULT 'ielts';
ALTER TABLE "PracticeAttempt" ADD COLUMN "rawRating" INTEGER;
ALTER TABLE "PracticeAttempt" ADD COLUMN "estimatedScaled" INTEGER;
ALTER TABLE "PracticeAttempt" ADD COLUMN "cefrEstimate" TEXT;
ALTER TABLE "PracticeAttempt" ADD COLUMN "taskPayload" JSONB;

ALTER TABLE "SpeakingAttempt" ADD COLUMN "scale" TEXT NOT NULL DEFAULT 'ielts';
ALTER TABLE "SpeakingAttempt" ADD COLUMN "rawRating" INTEGER;
ALTER TABLE "SpeakingAttempt" ADD COLUMN "estimatedScaled" INTEGER;
ALTER TABLE "SpeakingAttempt" ADD COLUMN "cefrEstimate" TEXT;
ALTER TABLE "SpeakingAttempt" ADD COLUMN "taskType" TEXT;
