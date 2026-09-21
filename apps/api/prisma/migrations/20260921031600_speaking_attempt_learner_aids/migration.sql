-- AlterTable
ALTER TABLE "SpeakingAttempt" ADD COLUMN     "structure" JSONB;
ALTER TABLE "SpeakingAttempt" ADD COLUMN     "vocabulary" JSONB;
ALTER TABLE "SpeakingAttempt" ADD COLUMN     "hintsOpened" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "SpeakingAttempt" ADD COLUMN     "sampleTalks" JSONB;
