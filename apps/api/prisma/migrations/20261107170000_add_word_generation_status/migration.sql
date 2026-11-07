-- CreateEnum
CREATE TYPE "WordGenerationStatus" AS ENUM ('generating', 'ready', 'failed');

-- AlterTable
ALTER TABLE "Word"
ADD COLUMN "generationStatus" "WordGenerationStatus" NOT NULL DEFAULT 'ready',
ADD COLUMN "generationStartedAt" TIMESTAMPTZ(3),
ADD COLUMN "generationAttemptCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "generationError" TEXT;

-- CreateIndex
CREATE INDEX "Word_generationStatus_generationStartedAt_idx"
ON "Word"("generationStatus", "generationStartedAt");
